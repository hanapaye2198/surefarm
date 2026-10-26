<?php

namespace App;

enum InsuranceClaimStatus: string
{
    case Submitted = 'submitted';
    case UnderReview = 'under_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Settled = 'settled';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Submitted => 'Submitted',
            self::UnderReview => 'Under review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Settled => 'Settled',
            self::Closed => 'Closed',
        };
    }

    public function isOpen(): bool
    {
        return $this === self::Submitted || $this === self::UnderReview;
    }
}
