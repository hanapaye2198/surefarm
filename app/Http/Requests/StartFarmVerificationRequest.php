<?php

namespace App\Http\Requests;

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\User;
use App\Services\RegistryScope;
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
            && $user->hasRole(UserRole::FieldVerifier, UserRole::Admin)
            && $farm instanceof Farm
            && app(RegistryScope::class)->canViewFarm($user, $farm)
            && in_array($farm->verification_status, [
                FarmVerificationStatus::Pending,
                FarmVerificationStatus::NeedsReview,
                FarmVerificationStatus::Failed,
                FarmVerificationStatus::Verified,
            ], true);
    }
}
