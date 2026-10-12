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
            'farm_exists' => ['required', 'boolean'],
            'location_matches' => ['required', 'boolean'],
            'coffee_crop_observed' => ['required', 'boolean'],
            'boundary_captured' => ['required', 'boolean'],
            'area_checked' => ['required', 'boolean'],
            'required_photos_captured' => ['required', 'boolean'],
            'farmer_or_representative_met' => ['required', 'boolean'],
            'evidence_type' => ['sometimes', 'string', 'in:farm_entrance,coffee_plants,farm_boundary,general_farm_view,other'],
            'evidence_photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'captured_at' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
