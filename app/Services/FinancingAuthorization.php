<?php

namespace App\Services;

use App\FinancingBalanceSource;
use App\FinancingReconciliationStatus;
use App\FinancingStatus;
use App\FinancingTransactionType;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Models\User;
use App\UserRole;

/**
 * Financing decisions are separate from registry visibility.
 * The applicant cannot review, approve, reject, or disburse their own request.
 */
class FinancingAuthorization
{
    public function manage(User $user): bool
    {
        return ! $user->isSuspended() && $user->canAccess(UserRole::Operations);
    }

    public function canReview(User $user, FarmFinancing $financing): bool
    {
        return $this->manage($user)
            && $financing->usesLedger()
            && $financing->status === FinancingStatus::Submitted
            && ! $this->isApplicant($user, $financing);
    }

    public function canApprove(User $user, FarmFinancing $financing): bool
    {
        return $this->manage($user)
            && $financing->usesLedger()
            && $financing->status === FinancingStatus::UnderReview
            && ! $this->isApplicant($user, $financing);
    }

    public function canReject(User $user, FarmFinancing $financing): bool
    {
        return $this->manage($user)
            && $financing->usesLedger()
            && $financing->status->isOpenApplication()
            && ! $this->isApplicant($user, $financing);
    }

    public function canCancel(User $user, FarmFinancing $financing): bool
    {
        if (! $this->manage($user) || ! $financing->usesLedger()) {
            return false;
        }

        return in_array($financing->status, [
            FinancingStatus::Submitted,
            FinancingStatus::UnderReview,
            FinancingStatus::Approved,
        ], true);
    }

    public function canDisburse(User $user, FarmFinancing $financing): bool
    {
        return $this->manage($user)
            && $financing->usesLedger()
            && $financing->status === FinancingStatus::Approved
            && ! $this->isApplicant($user, $financing);
    }

    public function canRepay(User $user, FarmFinancing $financing): bool
    {
        return $this->manage($user)
            && $financing->usesLedger()
            && $financing->status->isServicing();
    }

    public function canDefault(User $user, FarmFinancing $financing): bool
    {
        return $this->manage($user)
            && $financing->usesLedger()
            && $financing->status === FinancingStatus::Disbursed;
    }

    public function canAdjust(User $user, FarmFinancing $financing): bool
    {
        return $this->canRepay($user, $financing);
    }

    public function canReverse(User $user, FarmFinancing $financing, FinancingTransaction $transaction): bool
    {
        return $this->manage($user)
            && $financing->balance_source === FinancingBalanceSource::Ledger
            && $transaction->farm_financing_id === $financing->id
            && $transaction->type !== FinancingTransactionType::Reversal
            && $transaction->reverses_transaction_id === null
            && ! $this->isReversed($financing, $transaction);
    }

    public function canReconcile(User $user, FarmFinancing $financing, FinancingTransaction $transaction): bool
    {
        return $this->manage($user)
            && $transaction->farm_financing_id === $financing->id
            && $transaction->type->movesCash()
            && $transaction->reconciliation_status === FinancingReconciliationStatus::Recorded
            && ! $this->isReversed($financing, $transaction);
    }

    public function canUpload(User $user, FarmFinancing $financing): bool
    {
        return $this->manage($user);
    }

    /**
     * @return array<string, bool>
     */
    public function abilities(User $user, FarmFinancing $financing): array
    {
        return [
            'review' => $this->canReview($user, $financing),
            'approve' => $this->canApprove($user, $financing),
            'reject' => $this->canReject($user, $financing),
            'cancel' => $this->canCancel($user, $financing),
            'disburse' => $this->canDisburse($user, $financing),
            'repay' => $this->canRepay($user, $financing),
            'default' => $this->canDefault($user, $financing),
            'adjust' => $this->canAdjust($user, $financing),
            'upload' => $this->canUpload($user, $financing),
        ];
    }

    private function isApplicant(User $user, FarmFinancing $financing): bool
    {
        return $financing->submitted_by !== null && (int) $financing->submitted_by === (int) $user->id;
    }

    private function isReversed(FarmFinancing $financing, FinancingTransaction $transaction): bool
    {
        return $financing->transactions
            ->contains(fn (FinancingTransaction $row): bool => (int) $row->reverses_transaction_id === (int) $transaction->id);
    }
}
