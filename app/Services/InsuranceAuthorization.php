<?php

namespace App\Services;

use App\InsuranceClaimStatus;
use App\InsurancePolicyStatus;
use App\Models\FarmInsurance;
use App\Models\InsuranceClaim;
use App\Models\User;
use App\UserRole;

class InsuranceAuthorization
{
    public function manage(User $user): bool
    {
        return $user->canAccess(UserRole::Operations) && $user->suspended_at === null;
    }

    public function isPolicyApplicant(User $user, FarmInsurance $policy): bool
    {
        return $policy->submitted_by !== null && (int) $policy->submitted_by === (int) $user->id;
    }

    public function isClaimApplicant(User $user, InsuranceClaim $claim): bool
    {
        return $claim->submitted_by !== null && (int) $claim->submitted_by === (int) $user->id;
    }

    public function canReviewPolicy(User $user, FarmInsurance $policy): bool
    {
        return $this->manage($user)
            && ! $this->isPolicyApplicant($user, $policy)
            && $policy->status === InsurancePolicyStatus::Submitted;
    }

    public function canApprovePolicy(User $user, FarmInsurance $policy): bool
    {
        return $this->manage($user)
            && ! $this->isPolicyApplicant($user, $policy)
            && $policy->status === InsurancePolicyStatus::UnderReview;
    }

    public function canRejectPolicy(User $user, FarmInsurance $policy): bool
    {
        return $this->manage($user)
            && ! $this->isPolicyApplicant($user, $policy)
            && $policy->status->isOpen();
    }

    public function canCancelPolicy(User $user, FarmInsurance $policy): bool
    {
        return $this->manage($user) && $policy->status->canCancel();
    }

    public function canActivate(User $user, FarmInsurance $policy): bool
    {
        return $this->manage($user)
            && ! $this->isPolicyApplicant($user, $policy)
            && $policy->status === InsurancePolicyStatus::Approved;
    }

    public function canSubmitClaim(User $user, FarmInsurance $policy): bool
    {
        return $this->manage($user) && $policy->status->coversClaims();
    }

    public function canReviewClaim(User $user, InsuranceClaim $claim): bool
    {
        return $this->manage($user)
            && ! $this->isClaimApplicant($user, $claim)
            && $claim->status === InsuranceClaimStatus::Submitted;
    }

    public function canDecideClaim(User $user, InsuranceClaim $claim): bool
    {
        return $this->manage($user)
            && ! $this->isClaimApplicant($user, $claim)
            && $claim->status === InsuranceClaimStatus::UnderReview;
    }

    public function canSettle(User $user, InsuranceClaim $claim): bool
    {
        return $this->manage($user)
            && ! $this->isClaimApplicant($user, $claim)
            && $claim->status === InsuranceClaimStatus::Approved;
    }

    public function canClose(User $user, InsuranceClaim $claim): bool
    {
        return $this->manage($user)
            && ($claim->status === InsuranceClaimStatus::Settled || $claim->status === InsuranceClaimStatus::Rejected);
    }

    public function canUpload(User $user, FarmInsurance $policy): bool
    {
        return $this->manage($user) && $policy->status !== InsurancePolicyStatus::Recorded;
    }

    /**
     * @return array<string, bool>
     */
    public function policyAbilities(User $user, FarmInsurance $policy): array
    {
        return [
            'review' => $this->canReviewPolicy($user, $policy),
            'approve' => $this->canApprovePolicy($user, $policy),
            'reject' => $this->canRejectPolicy($user, $policy),
            'cancel' => $this->canCancelPolicy($user, $policy),
            'activate' => $this->canActivate($user, $policy),
            'claim' => $this->canSubmitClaim($user, $policy),
            'upload' => $this->canUpload($user, $policy),
        ];
    }

    /**
     * @return array<string, bool>
     */
    public function claimAbilities(User $user, InsuranceClaim $claim): array
    {
        return [
            'review' => $this->canReviewClaim($user, $claim),
            'approve' => $this->canDecideClaim($user, $claim),
            'reject' => $this->canDecideClaim($user, $claim),
            'settle' => $this->canSettle($user, $claim),
            'close' => $this->canClose($user, $claim),
            'upload' => $this->manage($user),
        ];
    }
}
