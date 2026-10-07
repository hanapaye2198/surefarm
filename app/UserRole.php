<?php

namespace App;

enum UserRole: string
{
    case Admin = 'admin';
    case Operations = 'operations';
    case FieldVerifier = 'field_verifier';
    case Farmer = 'farmer';
}
