<?php

namespace App;

enum UserRole: string
{
    case Admin = 'admin';
    case Operations = 'operations';
    case FieldVerifier = 'field_verifier';
    case CooperativeOfficer = 'cooperative_officer';
    case Farmer = 'farmer';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrator',
            self::Operations => 'Operations',
            self::FieldVerifier => 'Field verifier',
            self::CooperativeOfficer => 'Cooperative officer',
            self::Farmer => 'Farmer',
        };
    }

    public function requiresConfirmedTwoFactor(): bool
    {
        return match ($this) {
            self::Admin, self::Operations => true,
            self::FieldVerifier, self::CooperativeOfficer, self::Farmer => false,
        };
    }
}
