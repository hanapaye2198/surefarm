<?php

namespace App\Http\Controllers;

use App\Models\Farmer;
use App\Models\FarmerWalletRequest;
use App\Models\FarmerWalletTransaction;
use App\Models\User;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MobileWalletController extends Controller
{
    public function show(Request $request): Response
    {
        $farmer = $this->farmer($request);
        $balance = $this->availableBalance($farmer);
        $reserved = $this->reservedBalance($farmer);
        $demoBalance = $this->demoBalance($farmer);

        $transactions = $farmer->walletTransactions()
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (FarmerWalletTransaction $transaction): array => [
                'id' => 'transaction-'.$transaction->id,
                'direction' => $transaction->direction,
                'amount_label' => ($transaction->direction === 'credit' ? '+ ' : '- ')
                    .$this->moneyLabel($transaction->amount_minor),
                'description' => $transaction->description,
                'reference' => $transaction->reference,
                'status_label' => $transaction->is_demo
                    ? 'Demo sample only'
                    : $this->statusLabel($transaction->status),
                'created_at' => ($transaction->occurred_at ?? $transaction->created_at)?->format('M j, Y g:i A'),
                'sort_timestamp' => ($transaction->occurred_at ?? $transaction->created_at)?->getTimestamp() ?? 0,
            ]);

        $requests = $farmer->walletRequests()
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (FarmerWalletRequest $walletRequest): array => [
                'id' => 'request-'.$walletRequest->id,
                'direction' => 'debit',
                'amount_label' => '- '.$this->moneyLabel($walletRequest->amount_minor),
                'description' => $walletRequest->review_notes === null
                    ? $walletRequest->description
                    : $walletRequest->description.' - '.$walletRequest->review_notes,
                'reference' => $walletRequest->reference,
                'status_label' => $this->statusLabel($walletRequest->status),
                'created_at' => $walletRequest->created_at?->format('M j, Y g:i A'),
                'sort_timestamp' => $walletRequest->created_at?->getTimestamp() ?? 0,
            ]);

        return Inertia::render('mobile/farmer-wallet', [
            'wallet' => [
                'balance_minor' => $balance,
                'balance_label' => $this->moneyLabel($balance),
                'demo_balance_minor' => $demoBalance,
                'demo_balance_label' => $this->moneyLabel($demoBalance),
                'reserved_minor' => $reserved,
                'reserved_label' => $this->moneyLabel($reserved),
                'currency' => 'PHP',
                'account_label' => 'SureFarm E-wallet',
            ],
            'transactions' => $transactions->concat($requests)
                ->sortByDesc('sort_timestamp')
                ->take(50)
                ->map(function (array $transaction): array {
                    unset($transaction['sort_timestamp']);

                    return $transaction;
                })
                ->values()
                ->all(),
        ]);
    }

    public function requestBillPayment(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:1000000'],
            'biller_name' => ['required', 'string', 'max:80'],
            'account_name' => ['required', 'string', 'max:100'],
            'account_reference' => ['required', 'string', 'max:100'],
        ]);

        $farmer = $this->farmer($request);
        $amountMinor = $this->amountMinor((string) $validated['amount']);
        $biller = trim($validated['biller_name']);

        $this->createRequest($farmer, [
            'kind' => 'bill_payment',
            'amount_minor' => $amountMinor,
            'provider' => $biller,
            'account_name' => trim($validated['account_name']),
            'account_reference' => trim($validated['account_reference']),
            'description' => 'Bill payment request - '.$biller,
            'reference' => $this->requestReference('BILL'),
        ]);

        return redirect()->to('/api/mobile/farmer/wallet');
    }

    public function requestCashout(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:1000000'],
            'provider' => ['required', Rule::in(['GCash', 'Maya'])],
            'account_name' => ['required', 'string', 'max:100'],
            'account_reference' => ['required', 'string', 'regex:/^\\+?[0-9\\s-]{10,16}$/'],
        ]);

        $farmer = $this->farmer($request);
        $amountMinor = $this->amountMinor((string) $validated['amount']);
        $accountReference = preg_replace('/[\\s-]+/', '', $validated['account_reference']) ?? '';

        $this->createRequest($farmer, [
            'kind' => 'cashout',
            'amount_minor' => $amountMinor,
            'provider' => $validated['provider'],
            'account_name' => trim($validated['account_name']),
            'account_reference' => $accountReference,
            'description' => 'Cash-out request to '.$validated['provider'],
            'reference' => $this->requestReference('CASH'),
        ]);

        return redirect()->to('/api/mobile/farmer/wallet');
    }

    public function operationsIndex(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->canAccess(UserRole::Operations), 403);

        $visibleFarmers = Farmer::query()->visibleTo($user)->select('id');
        $requests = FarmerWalletRequest::query()
            ->with('farmer')
            ->whereIn('farmer_id', $visibleFarmers)
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', ['pending'])
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (FarmerWalletRequest $walletRequest): array => [
                'id' => $walletRequest->id,
                'kind' => $walletRequest->kind,
                'kind_label' => $walletRequest->kind === 'cashout' ? 'Cash-out' : 'Bill payment',
                'status' => $walletRequest->status,
                'status_label' => $this->statusLabel($walletRequest->status),
                'amount_label' => $this->moneyLabel($walletRequest->amount_minor),
                'provider' => $walletRequest->provider,
                'account_name' => $walletRequest->account_name,
                'account_reference' => $walletRequest->account_reference,
                'description' => $walletRequest->description,
                'reference' => $walletRequest->reference,
                'provider_reference' => $walletRequest->provider_reference,
                'review_notes' => $walletRequest->review_notes,
                'farmer_name' => $walletRequest->farmer?->fullName() ?? 'Farmer',
                'farmer_id' => $walletRequest->farmer?->farmer_id,
                'created_at' => $walletRequest->created_at?->format('M j, Y g:i A'),
            ])
            ->values()
            ->all();

        return Inertia::render('mobile/wallet-requests', [
            'requests' => $requests,
        ]);
    }

    public function complete(Request $request, FarmerWalletRequest $walletRequest): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->canAccess(UserRole::Operations), 403);
        $this->ensureWalletRequestVisible($user, $walletRequest);

        $validated = $request->validate([
            'provider_reference' => [
                'required',
                'string',
                'max:120',
                Rule::unique('farmer_wallet_transactions', 'provider_reference'),
                Rule::unique('farmer_wallet_requests', 'provider_reference'),
            ],
        ]);

        DB::transaction(function () use ($user, $walletRequest, $validated): void {
            $farmer = Farmer::query()->lockForUpdate()->findOrFail($walletRequest->farmer_id);
            $lockedRequest = FarmerWalletRequest::query()->lockForUpdate()->findOrFail($walletRequest->id);
            abort_unless($lockedRequest->status === 'pending', 409, 'This wallet request has already been processed.');

            $reference = trim($validated['provider_reference']);
            $lockedRequest->update([
                'status' => 'completed',
                'processed_by' => $user->id,
                'provider_reference' => $reference,
                'processed_at' => now(),
            ]);

            $farmer->walletTransactions()->create([
                'direction' => 'debit',
                'status' => 'completed',
                'amount_minor' => $lockedRequest->amount_minor,
                'currency' => $lockedRequest->currency,
                'description' => $lockedRequest->description,
                'reference' => 'TXN-'.$lockedRequest->reference,
                'provider' => $lockedRequest->provider,
                'provider_reference' => $reference,
                'occurred_at' => now(),
            ]);
        });

        return redirect()->to('/api/mobile/wallet-requests');
    }

    public function reject(Request $request, FarmerWalletRequest $walletRequest): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->canAccess(UserRole::Operations), 403);
        $this->ensureWalletRequestVisible($user, $walletRequest);

        $validated = $request->validate([
            'review_notes' => ['required', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($user, $walletRequest, $validated): void {
            Farmer::query()->lockForUpdate()->findOrFail($walletRequest->farmer_id);
            $lockedRequest = FarmerWalletRequest::query()->lockForUpdate()->findOrFail($walletRequest->id);
            abort_unless($lockedRequest->status === 'pending', 409, 'This wallet request has already been processed.');

            $lockedRequest->update([
                'status' => 'rejected',
                'processed_by' => $user->id,
                'review_notes' => trim($validated['review_notes']),
                'processed_at' => now(),
            ]);
        });

        return redirect()->to('/api/mobile/wallet-requests');
    }

    /**
     * @param  array{kind: string, amount_minor: int, provider: string, account_name: string, account_reference: string, description: string, reference: string}  $attributes
     */
    private function createRequest(Farmer $farmer, array $attributes): FarmerWalletRequest
    {
        return DB::transaction(function () use ($farmer, $attributes): FarmerWalletRequest {
            $lockedFarmer = Farmer::query()->lockForUpdate()->findOrFail($farmer->id);
            if ($attributes['amount_minor'] > $this->availableBalance($lockedFarmer)) {
                throw ValidationException::withMessages([
                    'amount' => 'The amount is greater than your available E-wallet balance.',
                ]);
            }

            return $lockedFarmer->walletRequests()->create([
                ...$attributes,
                'status' => 'pending',
                'currency' => 'PHP',
            ]);
        });
    }

    private function availableBalance(Farmer $farmer): int
    {
        $transactions = $farmer->walletTransactions()
            ->where('status', 'completed')
            ->where('is_demo', false);
        $credits = (int) (clone $transactions)->where('direction', 'credit')->sum('amount_minor');
        $debits = (int) (clone $transactions)->where('direction', 'debit')->sum('amount_minor');

        return max(0, $credits - $debits - $this->reservedBalance($farmer));
    }

    private function demoBalance(Farmer $farmer): int
    {
        $transactions = $farmer->walletTransactions()
            ->where('status', 'completed')
            ->where('is_demo', true);
        $credits = (int) (clone $transactions)->where('direction', 'credit')->sum('amount_minor');
        $debits = (int) (clone $transactions)->where('direction', 'debit')->sum('amount_minor');

        return max(0, $credits - $debits);
    }

    private function reservedBalance(Farmer $farmer): int
    {
        return (int) $farmer->walletRequests()
            ->whereIn('status', ['pending', 'processing'])
            ->sum('amount_minor');
    }

    private function ensureWalletRequestVisible(User $user, FarmerWalletRequest $walletRequest): void
    {
        abort_unless(
            Farmer::query()->visibleTo($user)->whereKey($walletRequest->farmer_id)->exists(),
            404,
        );
    }

    private function farmer(Request $request): Farmer
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->role === UserRole::Farmer, 403);

        return $user->farmer()->firstOrFail();
    }

    private function amountMinor(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
    }

    private function moneyLabel(int $amountMinor): string
    {
        return "\u{20B1}".number_format($amountMinor / 100, 2);
    }

    private function requestReference(string $prefix): string
    {
        return $prefix.'-'.now()->format('ymd').'-'.Str::upper(Str::random(10));
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'completed' => 'Completed',
            'pending' => 'Pending operations',
            'processing' => 'Processing',
            'failed' => 'Failed',
            'rejected' => 'Rejected',
            'reversed' => 'Reversed',
            default => 'Unknown',
        };
    }
}
