<?php

namespace App\Actions;

use App\AccessEventAction;
use App\FinancingBalanceSource;
use App\FinancingInterestMethod;
use App\FinancingStatus;
use App\Models\Farm;
use App\Models\FarmFinancing;
use App\Models\FarmProduction;
use App\Models\User;
use App\Services\FinancingLedger;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SubmitFinancingApplication
{
    public function __construct(
        private FinancingLedger $ledger,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Farm $farm, array $data, User $actor): FarmFinancing
    {
        try {
            return DB::transaction(function () use ($farm, $data, $actor): FarmFinancing {
                $existing = FarmFinancing::query()
                    ->where('client_token', $data['client_token'])
                    ->lockForUpdate()
                    ->first();

                if ($existing instanceof FarmFinancing) {
                    $this->assertSameApplication($existing, $farm, $data);

                    return $existing;
                }

                $productionId = $data['farm_production_id'] ?? null;

                if ($productionId !== null && ! FarmProduction::query()->whereKey($productionId)->where('farm_id', $farm->id)->exists()) {
                    throw ValidationException::withMessages([
                        'farm_production_id' => 'Choose a crop cycle from this farm.',
                    ]);
                }

                $interest = FinancingInterestMethod::from($data['interest_method']);
                $interestCents = $this->ledger->cents($data['interest_amount']);
                $feeCents = $this->ledger->cents($data['fee_amount']);

                if ($interest === FinancingInterestMethod::None && $interestCents !== 0) {
                    throw ValidationException::withMessages([
                        'interest_amount' => 'Leave interest at zero when the agreement has no interest.',
                    ]);
                }

                if ($interest === FinancingInterestMethod::Stated && $interestCents <= 0) {
                    throw ValidationException::withMessages([
                        'interest_amount' => 'Enter the interest amount for this agreement.',
                    ]);
                }

                if ($feeCents < 0) {
                    throw ValidationException::withMessages([
                        'fee_amount' => 'Fee cannot be negative.',
                    ]);
                }

                $financing = FarmFinancing::query()->create([
                    'farm_id' => $farm->id,
                    'farm_production_id' => $productionId,
                    'submitted_by' => $actor->id,
                    'amount' => $data['amount'],
                    'date_granted' => null,
                    'loan_balance' => null,
                    'financing_type' => $data['financing_type'],
                    'purpose' => $data['purpose'],
                    'currency' => $data['currency'],
                    'interest_method' => $interest,
                    'interest_rate' => $interest === FinancingInterestMethod::Stated ? ($data['interest_rate'] ?? null) : null,
                    'interest_amount' => $data['interest_amount'],
                    'fee_amount' => $data['fee_amount'],
                    'application_date' => $data['application_date'],
                    'status' => FinancingStatus::Submitted,
                    'balance_source' => FinancingBalanceSource::Ledger,
                    'repayment_frequency' => $data['repayment_frequency'] ?? null,
                    'installment_count' => $data['installment_count'] ?? null,
                    'due_date' => $data['due_date'] ?? null,
                    'maturity_date' => $data['maturity_date'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'client_token' => $data['client_token'],
                ]);

                $this->accessEvents->handle($actor, AccessEventAction::FinancingSubmitted, null, $financing, [
                    'reference' => $financing->reference,
                    'amount' => $data['amount'],
                    'currency' => $data['currency'],
                ]);

                return $financing;
            });
        } catch (UniqueConstraintViolationException) {
            $existing = FarmFinancing::query()->where('client_token', $data['client_token'])->first();

            if ($existing instanceof FarmFinancing) {
                $this->assertSameApplication($existing, $farm, $data);

                return $existing;
            }

            throw ValidationException::withMessages([
                'client_token' => 'This application was already submitted.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertSameApplication(FarmFinancing $existing, Farm $farm, array $data): void
    {
        $same = (int) $existing->farm_id === (int) $farm->id
            && $this->ledger->cents($existing->amount) === $this->ledger->cents($data['amount'])
            && $existing->currency === $data['currency'];

        if (! $same) {
            throw ValidationException::withMessages([
                'client_token' => 'This submission was already used for a different application.',
            ]);
        }
    }
}
