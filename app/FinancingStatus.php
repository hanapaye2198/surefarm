<?php

namespace App;

enum FinancingStatus: string
{
    case Recorded = 'recorded';
    case Submitted = 'submitted';
    case UnderReview = 'under_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Disbursed = 'disbursed';
    case Completed = 'completed';
    case Defaulted = 'defaulted';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Recorded => 'Recorded grant',
            self::Submitted => 'Submitted',
            self::UnderReview => 'Under review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Disbursed => 'Disbursed',
            self::Completed => 'Completed',
            self::Defaulted => 'Defaulted',
            self::Cancelled => 'Cancelled',
        };
    }

    public function isOpenApplication(): bool
    {
        return $this === self::Submitted || $this === self::UnderReview;
    }

    public function isServicing(): bool
    {
        return $this === self::Disbursed || $this === self::Defaulted;
    }
}
