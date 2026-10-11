<?php

namespace App\Http\Requests;

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\User;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class StoreFarmVerificationInspectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $farm = $this->route('farm');

        return $user instanceof User
            && $user->role === UserRole::FieldVerifier
            && $farm instanceof Farm
            && $farm->assigned_verifier_id === $user->id
            && $farm->verification_status === FarmVerificationStatus::InProgress
            && $farm->boundary()->exists();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'farm_identified' => ['required', 'accepted'],
            'boundary_walked' => ['required', 'accepted'],
            'farmer_or_representative_met' => ['required', 'accepted'],
            'evidence_photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }
}
