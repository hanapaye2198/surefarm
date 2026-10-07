<?php

namespace App;

enum FarmVerificationResult: string
{
    case Verified = 'verified';
    case Failed = 'failed';
    case NeedsReview = 'needs_review';
}
