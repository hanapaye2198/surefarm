<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class StartFarmVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->canVerify();
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [];
    }

    /**
     * Farmers cannot verify a farm, including their own.
     * Operations staff remain outside the verification workspace.
     */
    private function canVerify(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && $user->role !== UserRole::Farmer
            && $user->canAccess(UserRole::FieldVerifier);
    }
}
