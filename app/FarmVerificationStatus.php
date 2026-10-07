<?php

namespace App;

enum FarmVerificationStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Verified = 'verified';
    case Failed = 'failed';
    case NeedsReview = 'needs_review';
}
