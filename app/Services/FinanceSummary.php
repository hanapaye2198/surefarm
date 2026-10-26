<?php

namespace App\Services;

use App\FinancingBalanceSource;
use App\FinancingTransactionType;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Finance figures are calculated from posted rows inside the caller's registry scope.
 * Snapshot grants stay in their own totals and are never added to ledger balances.
 */
class FinanceSummary
{
    public function __construct(private FinancingLedger $ledger) {}

    /**
     * @param  array{
     *     from: string|null,
     *     to: string|null,
     *     as_of: string,
     *     farmer_id: int|null,
     *     province: string|null,
     *     municipality: string|null,
     *     ...
     * }  $filters
     * @return array<string, mixed>
     */
    public function summarize(User $user, array $filters): array
    {
        $asOf = CarbonImmutable::parse($filters['as_of'])->startOfDay();
        $asOfDate = $asOf->toDateString();
        $dueSoonEnd = $asOf->addDays(FinancingLedger::DUE_SOON_DAYS)->toDateString();

        $financings = $this->scoped($user, $filters)
            ->with(['transactions', 'farm.farmer'])
            ->get();

        /** @var array<string, array{disbursed: int, repayments: int, principal: int, interest: int, fee: int, overdue: int, due_soon: int}> $buckets */
        $buckets = [];
        /** @var array<string, array{principal: int, balance: int}> $snapshots */
        $snapshots = [];
        $active = 0;
        $pending = 0;
        $dueSoonCount = 0;
        $overdueCount = 0;
        $snapshotCount = 0;
        $recent = [];

        foreach ($financings as $financing) {
            if ($financing->balance_source === FinancingBalanceSource::Snapshot) {
                $snapshotCount++;
                $currency = $financing->currency ?: 'PHP';
                $snapshots[$currency] ??= ['principal' => 0, 'balance' => 0];
                $snapshots[$currency]['principal'] += $this->ledger->cents($financing->amount ?? '0');

                if ($financing->loan_balance !== null) {
                    $snapshots[$currency]['balance'] += $this->ledger->cents($financing->loan_balance);
                }

                continue;
            }

            $currency = $financing->currency ?: 'PHP';
            $buckets[$currency] ??= [
                'disbursed' => 0,
                'repayments' => 0,
                'principal' => 0,
                'interest' => 0,
                'fee' => 0,
                'overdue' => 0,
                'due_soon' => 0,
            ];

            $reversed = $this->ledger->reversedIds($financing->transactions, $asOf);
            $position = $this->ledger->outstandingCents($financing, $asOf);
            $buckets[$currency]['principal'] += $position['principal'];
            $buckets[$currency]['interest'] += $position['interest'];
            $buckets[$currency]['fee'] += $position['fee'];

            foreach ($financing->transactions as $transaction) {
                $date = $transaction->occurred_on->toDateString();

                if ($date <= $asOfDate && $this->inPeriod($date, $filters['from'], $filters['to'])) {
                    $recent[] = $this->recentRow($financing, $transaction, isset($reversed[$transaction->id]));
                }

                if (! $this->inPeriod($date, $filters['from'], $filters['to']) || $date > $asOfDate) {
                    continue;
                }

                if ($transaction->type === FinancingTransactionType::Reversal || isset($reversed[$transaction->id])) {
                    continue;
                }

                $amount = $this->ledger->cents($transaction->amount);

                if ($transaction->type === FinancingTransactionType::Disbursement) {
                    $buckets[$currency]['disbursed'] += $amount;
                }

                if ($transaction->type->isCashIn()) {
                    $buckets[$currency]['repayments'] += $amount;
                }
            }

            if ($this->wasPending($financing, $asOfDate)) {
                $pending++;
            }

            if ($this->wasActive($financing, $asOfDate)) {
                $active++;
            }

            if (! $this->wasServicing($financing, $asOfDate)) {
                continue;
            }

            $due = $financing->due_date?->toDateString();
            $totalDue = $this->ledger->totalDueCents($position);

            if ($due === null || $totalDue <= 0) {
                continue;
            }

            if ($due < $asOfDate) {
                $overdueCount++;
                $buckets[$currency]['overdue'] += $totalDue;
            } elseif ($due <= $dueSoonEnd) {
                $dueSoonCount++;
                $buckets[$currency]['due_soon'] += $totalDue;
            }
        }

        usort($recent, function (array $left, array $right): int {
            $byDate = strcmp($right['occurred_on_sort'], $left['occurred_on_sort']);

            return $byDate !== 0 ? $byDate : $right['id'] <=> $left['id'];
        });

        return [
            'as_of' => $asOfDate,
            'as_of_label' => $asOf->format('F j, Y'),
            'period_from' => $filters['from'],
            'period_to' => $filters['to'],
            'active_agreements' => $active,
            'pending_applications' => $pending,
            'due_soon_count' => $dueSoonCount,
            'overdue_count' => $overdueCount,
            'snapshot_count' => $snapshotCount,
            'currencies' => array_map(
                fn (string $currency, array $bucket): array => $this->presentBucket($currency, $bucket),
                array_keys($buckets),
                array_values($buckets),
            ),
            'snapshots' => array_map(
                fn (string $currency, array $bucket): array => [
                    'currency' => $currency,
                    'stated_principal' => $this->ledger->money($currency, $bucket['principal']),
                    'stated_balance' => $this->ledger->money($currency, $bucket['balance']),
                ],
                array_keys($snapshots),
                array_values($snapshots),
            ),
            'recent_transactions' => array_map(function (array $row): array {
                unset($row['occurred_on_sort']);

                return $row;
            }, array_slice($recent, 0, 8)),
            'definitions' => $this->definitions(),
        ];
    }

    /**
     * @param  array{
     *     farmer_id: int|null,
     *     province: string|null,
     *     municipality: string|null,
     *     ...
     * }  $filters
     * @return Builder<FarmFinancing>
     */
    public function scoped(User $user, array $filters): Builder
    {
        return FarmFinancing::query()
            ->visibleTo($user)
            ->when($filters['farmer_id'] !== null, function (Builder $query) use ($filters): void {
                $query->whereHas('farm', fn (Builder $farm) => $farm->where('farmer_id', $filters['farmer_id']));
            })
            ->when($filters['province'] !== null, function (Builder $query) use ($filters): void {
                $query->whereHas('farm', fn (Builder $farm) => $farm->where('province', $filters['province']));
            })
            ->when($filters['municipality'] !== null, function (Builder $query) use ($filters): void {
                $query->whereHas('farm', fn (Builder $farm) => $farm->where('municipality', $filters['municipality']));
            });
    }

    /**
     * @param  array{disbursed: int, repayments: int, principal: int, interest: int, fee: int, overdue: int, due_soon: int}  $bucket
     * @return array<string, string>
     */
    private function presentBucket(string $currency, array $bucket): array
    {
        return [
            'currency' => $currency,
            'disbursed' => $this->ledger->money($currency, $bucket['disbursed']),
            'repayments' => $this->ledger->money($currency, $bucket['repayments']),
            'outstanding_principal' => $this->ledger->money($currency, $bucket['principal']),
            'outstanding_interest' => $this->ledger->money($currency, $bucket['interest']),
            'outstanding_fees' => $this->ledger->money($currency, $bucket['fee']),
            'overdue' => $this->ledger->money($currency, $bucket['overdue']),
            'due_soon' => $this->ledger->money($currency, $bucket['due_soon']),
        ];
    }

    /**
     * @return array{id: int, financing_id: int, financing_reference: string, reference: string, type_label: string, amount_label: string, occurred_on: string, occurred_on_sort: string, reconciliation: string, reversed: bool, farmer_name: string}
     */
    private function recentRow(FarmFinancing $financing, FinancingTransaction $transaction, bool $reversed): array
    {
        return [
            'id' => $transaction->id,
            'financing_id' => $financing->id,
            'financing_reference' => $financing->reference ?? '—',
            'reference' => $transaction->reference ?? '—',
            'type_label' => $transaction->type->label(),
            'amount_label' => $financing->money($transaction->amount),
            'occurred_on' => $transaction->occurred_on->format('m/d/Y'),
            'occurred_on_sort' => $transaction->occurred_on->toDateString(),
            'reconciliation' => $transaction->type->movesCash()
                ? $transaction->reconciliation_status->label()
                : 'Not a cash movement',
            'reversed' => $reversed || $transaction->type === FinancingTransactionType::Reversal,
            'farmer_name' => $financing->farm->farmer->fullName(),
        ];
    }

    private function wasServicing(FarmFinancing $financing, string $asOfDate): bool
    {
        if (! $financing->usesLedger() || $financing->disbursed_at === null) {
            return false;
        }

        if ($financing->disbursed_at->toDateString() > $asOfDate) {
            return false;
        }

        return $financing->completed_at === null || $financing->completed_at->toDateString() > $asOfDate;
    }

    private function wasActive(FarmFinancing $financing, string $asOfDate): bool
    {
        if (! $this->wasServicing($financing, $asOfDate)) {
            return false;
        }

        return $financing->defaulted_at === null || $financing->defaulted_at->toDateString() > $asOfDate;
    }

    private function wasPending(FarmFinancing $financing, string $asOfDate): bool
    {
        if (! $financing->usesLedger() || $financing->application_date === null) {
            return false;
        }

        if ($financing->application_date->toDateString() > $asOfDate) {
            return false;
        }

        if ($financing->approved_at !== null && $financing->approved_at->toDateString() <= $asOfDate) {
            return false;
        }

        if ($financing->rejected_at !== null && $financing->rejected_at->toDateString() <= $asOfDate) {
            return false;
        }

        return $financing->cancelled_at === null || $financing->cancelled_at->toDateString() > $asOfDate;
    }

    private function inPeriod(string $date, ?string $from, ?string $to): bool
    {
        if ($from !== null && $date < $from) {
            return false;
        }

        return $to === null || $date <= $to;
    }

    /**
     * @return list<array{metric: string, definition: string}>
     */
    private function definitions(): array
    {
        return [
            [
                'metric' => 'Disbursements',
                'definition' => 'Sum of disbursement transactions whose date falls in the selected period and that were not reversed on or before the balance date. Stated farm grants are excluded.',
            ],
            [
                'metric' => 'Repayments received',
                'definition' => 'Cash received in the period for principal, interest, and fees. Interest charges and fee charges are not repayments. Reversed payments are excluded once the reversal date is on or before the balance date.',
            ],
            [
                'metric' => 'Outstanding principal',
                'definition' => 'Principal increases minus principal decreases from ledger transactions dated on or before the balance date. Interest, fees, and stated loan balances are not included.',
            ],
            [
                'metric' => 'Outstanding interest and fees',
                'definition' => 'Unpaid stated interest and unpaid fees from the ledger. A financing agreement with no interest keeps interest at zero. These amounts are not added to outstanding principal.',
            ],
            [
                'metric' => 'Overdue balance',
                'definition' => 'Principal, interest, and fees still due on agreements whose due date is before the balance date and that were disbursed and not completed by that date.',
            ],
            [
                'metric' => 'Active agreements',
                'definition' => 'Ledger agreements disbursed on or before the balance date, not completed, and not defaulted by that date.',
            ],
            [
                'metric' => 'Pending applications',
                'definition' => 'Ledger applications submitted on or before the balance date that were not yet approved, rejected, or cancelled.',
            ],
            [
                'metric' => 'Recorded grants',
                'definition' => 'Farm financing rows entered with a stated amount and stated balance. They are not disbursements and are not included in the ledger totals.',
            ],
        ];
    }
}
