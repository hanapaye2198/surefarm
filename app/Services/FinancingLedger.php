<?php

namespace App\Services;

use App\FinancingBalanceSource;
use App\FinancingComponent;
use App\FinancingDirection;
use App\FinancingStatus;
use App\FinancingTransactionType;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Support\DecimalQuantity;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Balances come from posted transactions. Reversed rows stay in the
 * ledger and drop out of the balance together with their reversal.
 */
class FinancingLedger
{
    public const DUE_SOON_DAYS = 14;

    public function lock(FarmFinancing $financing): FarmFinancing
    {
        $locked = FarmFinancing::query()->whereKey($financing->id)->lockForUpdate()->firstOrFail();
        $locked->load('farm');

        return $locked;
    }

    /**
     * @param  array{
     *     type: FinancingTransactionType,
     *     amount: string,
     *     component: FinancingComponent,
     *     direction: FinancingDirection,
     *     occurred_on: string,
     *     group_reference?: string|null,
     *     payment_method?: string|null,
     *     external_reference?: string|null,
     *     recorded_by?: int|null,
     *     reverses_transaction_id?: int|null,
     *     idempotency_key?: string|null,
     *     notes?: string|null
     * }  $data
     */
    public function post(FarmFinancing $financing, array $data): FinancingTransaction
    {
        if ($financing->balance_source !== FinancingBalanceSource::Ledger) {
            throw ValidationException::withMessages([
                'amount' => 'This financing grant has a stated balance and does not accept ledger transactions.',
            ]);
        }

        $transaction = $financing->transactions()->create([
            'group_reference' => $data['group_reference'] ?? null,
            'type' => $data['type'],
            'amount' => $data['amount'],
            'currency' => $financing->currency,
            'component' => $data['component'],
            'direction' => $data['direction'],
            'occurred_on' => $data['occurred_on'],
            'payment_method' => $data['payment_method'] ?? null,
            'external_reference' => $data['external_reference'] ?? null,
            'recorded_by' => $data['recorded_by'] ?? null,
            'reverses_transaction_id' => $data['reverses_transaction_id'] ?? null,
            'idempotency_key' => $data['idempotency_key'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        $financing->unsetRelation('transactions');

        return $transaction;
    }

    /**
     * @return array{principal: int, interest: int, fee: int}
     */
    public function outstandingCents(FarmFinancing $financing, ?CarbonInterface $asOf = null): array
    {
        $cents = [
            'principal' => 0,
            'interest' => 0,
            'fee' => 0,
        ];

        if ($financing->balance_source !== FinancingBalanceSource::Ledger) {
            return $cents;
        }

        foreach ($this->activeTransactions($financing, $asOf) as $transaction) {
            $amount = $this->cents($transaction->amount);
            $key = $transaction->component->value;

            if ($transaction->direction === FinancingDirection::Increase) {
                $cents[$key] += $amount;
            } else {
                $cents[$key] -= $amount;
            }
        }

        return $cents;
    }

    public function hasActiveDisbursement(FarmFinancing $financing, ?CarbonInterface $asOf = null): bool
    {
        return $this->activeTransactions($financing, $asOf)
            ->contains(fn (FinancingTransaction $transaction): bool => $transaction->type === FinancingTransactionType::Disbursement);
    }

    /**
     * @param  array{principal: int, interest: int, fee: int}  $cents
     */
    public function totalDueCents(array $cents): int
    {
        return $cents['principal'] + $cents['interest'] + $cents['fee'];
    }

    /**
     * @param  array{principal: int, interest: int, fee: int}  $cents
     * @return array{principal: int, interest: int, fee: int}
     */
    public function apply(array $cents, FinancingComponent $component, FinancingDirection $direction, int $amountCents): array
    {
        $next = $cents;
        $key = $component->value;
        $next[$key] += $direction === FinancingDirection::Increase ? $amountCents : -$amountCents;

        return $next;
    }

    /**
     * @param  array{principal: int, interest: int, fee: int}  $cents
     * @param  array<string, string>  $fields
     */
    public function assertNonNegative(array $cents, array $fields): void
    {
        $errors = [];

        foreach ($fields as $component => $field) {
            if (($cents[$component] ?? 0) < 0) {
                $errors[$field] = ucfirst($component).' cannot be reduced below the amount still due.';
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function refreshPosition(FarmFinancing $financing): FarmFinancing
    {
        if ($financing->balance_source !== FinancingBalanceSource::Ledger) {
            return $financing;
        }

        $financing->unsetRelation('transactions');
        $cents = $this->outstandingCents($financing);
        $settled = $this->totalDueCents($cents) === 0;
        $disbursed = $this->hasActiveDisbursement($financing);
        $servicing = $financing->status->isServicing() || $financing->status === FinancingStatus::Completed;

        $changes = [];

        if ($servicing && ! $disbursed && $settled) {
            $changes = [
                'status' => FinancingStatus::Approved,
                'disbursed_at' => null,
                'date_granted' => null,
                'loan_balance' => null,
                'completed_at' => null,
            ];
        } elseif ($disbursed && $settled && $servicing) {
            $changes = [
                'status' => FinancingStatus::Completed,
                'completed_at' => $financing->completed_at ?? now(),
                'loan_balance' => DecimalQuantity::fromCents(0),
            ];
        } elseif ($disbursed && ! $settled && $servicing) {
            if ($financing->status === FinancingStatus::Completed) {
                $changes['status'] = $financing->defaulted_at !== null
                    ? FinancingStatus::Defaulted
                    : FinancingStatus::Disbursed;
                $changes['completed_at'] = null;
            }

            $changes['loan_balance'] = DecimalQuantity::fromCents($cents['principal']);
        }

        if ($changes !== []) {
            $financing->update($changes);
        }

        return $financing;
    }

    public function cents(mixed $amount): int
    {
        try {
            return DecimalQuantity::cents($amount);
        } catch (InvalidArgumentException) {
            throw ValidationException::withMessages([
                'amount' => 'Amount must be a number with at most 2 decimal places.',
            ]);
        }
    }

    public function money(string $currency, int $cents): string
    {
        $formatted = number_format((float) DecimalQuantity::fromCents($cents), 2);

        return $currency === 'PHP' ? '₱'.$formatted : $currency.' '.$formatted;
    }

    /**
     * @return Collection<int, FinancingTransaction>
     */
    public function activeTransactions(FarmFinancing $financing, ?CarbonInterface $asOf = null): Collection
    {
        $transactions = $financing->relationLoaded('transactions')
            ? $financing->transactions
            : $financing->transactions()->get();

        $asOfDate = $asOf?->toDateString();
        $reversed = [];

        foreach ($transactions as $transaction) {
            if ($transaction->type !== FinancingTransactionType::Reversal || $transaction->reverses_transaction_id === null) {
                continue;
            }

            if ($asOfDate !== null && $transaction->occurred_on->toDateString() > $asOfDate) {
                continue;
            }

            $reversed[$transaction->reverses_transaction_id] = true;
        }

        return $transactions
            ->filter(function (FinancingTransaction $transaction) use ($asOfDate, $reversed): bool {
                if ($transaction->type === FinancingTransactionType::Reversal) {
                    return false;
                }

                if (isset($reversed[$transaction->id])) {
                    return false;
                }

                return $asOfDate === null || $transaction->occurred_on->toDateString() <= $asOfDate;
            })
            ->values();
    }

    /**
     * @param  Collection<int, FinancingTransaction>  $transactions
     * @return array<int, true>
     */
    public function reversedIds(Collection $transactions, ?CarbonInterface $asOf = null): array
    {
        $asOfDate = $asOf?->toDateString();
        $reversed = [];

        foreach ($transactions as $transaction) {
            if ($transaction->type !== FinancingTransactionType::Reversal || $transaction->reverses_transaction_id === null) {
                continue;
            }

            if ($asOfDate !== null && $transaction->occurred_on->toDateString() > $asOfDate) {
                continue;
            }

            $reversed[$transaction->reverses_transaction_id] = true;
        }

        return $reversed;
    }
}
