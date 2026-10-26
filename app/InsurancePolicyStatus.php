<?php

namespace App;

enum InsurancePolicyStatus: string
{
    case Recorded = 'recorded';
    case Submitted = 'submitted';
    case UnderReview = 'under_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Active = 'active';
    case Expired = 'expired';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Recorded => 'Stated coverage',
            self::Submitted => 'Submitted',
            self::UnderReview => 'Under review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Active => 'Active',
            self::Expired => 'Expired',
            self::Cancelled => 'Cancelled',
        };
    }

    public function isOpen(): bool
    {
        return $this === self::Submitted || $this === self::UnderReview;
    }

    public function canCancel(): bool
    {
        return $this === self::Submitted
            || $this === self::UnderReview
            || $this === self::Approved;
    }

    public function coversClaims(): bool
    {
        return $this === self::Active || $this === self::Expired;
    }
}
