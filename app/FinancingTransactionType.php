<?php

namespace App;

enum FinancingTransactionType: string
{
    case Disbursement = 'disbursement';
    case PrincipalRepayment = 'principal_repayment';
    case InterestCharge = 'interest_charge';
    case InterestPayment = 'interest_payment';
    case FeeCharge = 'fee_charge';
    case FeePayment = 'fee_payment';
    case Adjustment = 'adjustment';
    case Reversal = 'reversal';

    public function label(): string
    {
        return match ($this) {
            self::Disbursement => 'Disbursement',
            self::PrincipalRepayment => 'Principal repayment',
            self::InterestCharge => 'Interest charge',
            self::InterestPayment => 'Interest payment',
            self::FeeCharge => 'Fee charge',
            self::FeePayment => 'Fee payment',
            self::Adjustment => 'Adjustment',
            self::Reversal => 'Reversal',
        };
    }

    public function isCashIn(): bool
    {
        return match ($this) {
            self::PrincipalRepayment, self::InterestPayment, self::FeePayment => true,
            default => false,
        };
    }

    public function isCashOut(): bool
    {
        return $this === self::Disbursement;
    }

    public function movesCash(): bool
    {
        return $this->isCashIn() || $this->isCashOut();
    }
}
