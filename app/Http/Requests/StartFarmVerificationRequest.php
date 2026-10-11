<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Models\Farm;
use App\FarmVerificationStatus;
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
        $farm = $this->route('farm');

        return $user instanceof User
            && $user->role === UserRole::FieldVerifier
            && $farm instanceof Farm
            && $farm->assigned_verifier_id === $user->id
            && in_array($farm->verification_status, [
                FarmVerificationStatus::Pending,
                FarmVerificationStatus::NeedsReview,
            ], true);
    }
}
