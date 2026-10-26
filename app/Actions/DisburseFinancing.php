<?php

namespace App\Actions;

use App\AccessEventAction;
use App\FinancingComponent;
use App\FinancingDirection;
use App\FinancingRepaymentFrequency;
use App\FinancingStatus;
use App\FinancingTransactionType;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Models\User;
use App\Services\FinancingAuthorization;
use App\Services\FinancingLedger;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DisburseFinancing
{
    public function __construct(
        private FinancingLedger $ledger,
        private FinancingAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmFinancing $financing, array $data, User $actor): FarmFinancing
    {
        try {
            return DB::transaction(fn (): FarmFinancing => $this->disburse($financing, $data, $actor));
        } catch (UniqueConstraintViolationException) {
            $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->first();

            if ($existing instanceof FinancingTransaction && (int) $existing->farm_financing_id === (int) $financing->id) {
                return $financing->refresh();
            }

            throw ValidationException::withMessages([
                'client_token' => 'This disbursement was already submitted.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function disburse(FarmFinancing $financing, array $data, User $actor): FarmFinancing
    {
        $locked = $this->ledger->lock($financing);
        $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->lockForUpdate()->first();

        if ($existing instanceof FinancingTransaction) {
            if ((int) $existing->farm_financing_id !== (int) $locked->id || $existing->type !== FinancingTransactionType::Disbursement) {
                throw ValidationException::withMessages([
                    'client_token' => 'This submission was already used for a different transaction.',
                ]);
            }

            return $locked;
        }

        if (! $this->authorization->manage($actor)) {
            abort(403);
        }

        if ((int) $locked->submitted_by === (int) $actor->id) {
            abort(403, 'You cannot disburse a financing request you submitted.');
        }

        if (! $locked->usesLedger() || $locked->status !== FinancingStatus::Approved) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Only an approved financing agreement can be disbursed.',
            ]);
        }

        $this->assertTerms($locked, $data['occurred_on']);
        $group = (string) Str::ulid();
        $principal = (string) $locked->amount;

        $this->ledger->post($locked, [
            'type' => FinancingTransactionType::Disbursement,
            'amount' => $principal,
            'component' => FinancingComponent::Principal,
            'direction' => FinancingDirection::Increase,
            'occurred_on' => $data['occurred_on'],
            'group_reference' => $group,
            'external_reference' => $data['disbursement_reference'],
            'recorded_by' => $actor->id,
            'idempotency_key' => $data['client_token'],
            'notes' => $data['notes'] ?? null,
        ]);

        $interest = $this->ledger->cents($locked->interest_amount ?? '0');

        if ($interest > 0) {
            $this->ledger->post($locked, [
                'type' => FinancingTransactionType::InterestCharge,
                'amount' => (string) $locked->interest_amount,
                'component' => FinancingComponent::Interest,
                'direction' => FinancingDirection::Increase,
                'occurred_on' => $data['occurred_on'],
                'group_reference' => $group,
                'recorded_by' => $actor->id,
                'notes' => 'Stated interest recognized at disbursement.',
            ]);
        }

        $fee = $this->ledger->cents($locked->fee_amount ?? '0');

        if ($fee > 0) {
            $this->ledger->post($locked, [
                'type' => FinancingTransactionType::FeeCharge,
                'amount' => (string) $locked->fee_amount,
                'component' => FinancingComponent::Fee,
                'direction' => FinancingDirection::Increase,
                'occurred_on' => $data['occurred_on'],
                'group_reference' => $group,
                'recorded_by' => $actor->id,
                'notes' => 'Fee recognized at disbursement.',
            ]);
        }

        $locked->update([
            'status' => FinancingStatus::Disbursed,
            'disbursed_at' => $data['occurred_on'],
            'date_granted' => $data['occurred_on'],
            'disbursement_reference' => $data['disbursement_reference'],
        ]);
        $this->ledger->refreshPosition($locked);

        $this->accessEvents->handle($actor, AccessEventAction::FinancingDisbursed, null, $locked, [
            'reference' => $locked->reference,
            'amount' => $principal,
            'currency' => $locked->currency,
            'disbursement_reference' => $data['disbursement_reference'],
        ]);

        return $locked->refresh();
    }

    private function assertTerms(FarmFinancing $financing, string $occurredOn): void
    {
        if ($financing->repayment_frequency === null || $financing->due_date === null) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Set the repayment frequency and due date before disbursing.',
            ]);
        }

        if ($occurredOn > now()->toDateString()) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Disbursement date cannot be in the future.',
            ]);
        }

        if ($financing->application_date !== null && $occurredOn < $financing->application_date->toDateString()) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Disbursement date cannot be before the application date.',
            ]);
        }

        if ($financing->due_date->toDateString() < $occurredOn) {
            throw ValidationException::withMessages([
                'occurred_on' => 'The due date cannot be before the disbursement date.',
            ]);
        }

        $needsCount = in_array($financing->repayment_frequency, [
            FinancingRepaymentFrequency::Monthly,
            FinancingRepaymentFrequency::Quarterly,
        ], true);

        if ($needsCount && ($financing->installment_count === null || $financing->installment_count < 1)) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Enter the number of installments before disbursing.',
            ]);
        }

        if ($this->ledger->cents($financing->amount) <= 0) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Principal must be greater than zero before disbursement.',
            ]);
        }
    }
}
