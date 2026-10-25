<?php

namespace App\Http\Requests;

use App\CropType;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\User;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class StoreFarmVerificationInspectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $farm = $this->route('farm');
        $verification = $farm instanceof Farm
            ? $farm->verifications()->whereNull('result')->latest('id')->first()
            : null;

        return $user instanceof User
            && ! $user->isSuspended()
            && $user->hasRole(UserRole::FieldVerifier, UserRole::Admin)
            && $farm instanceof Farm
            && app(RegistryScope::class)->canViewFarm($user, $farm)
            && $farm->verification_status === FarmVerificationStatus::InProgress
            && $verification?->hasFreshBoundaryCapture() === true;
    }

    protected function prepareForValidation(): void
    {
        $farm = $this->route('farm');

        // Accept the earlier coffee-only mobile client payload while all new
        // clients use the crop-agnostic checklist field.
        if (
            $farm instanceof Farm
            && $farm->crop_type === CropType::Coffee
            && ! $this->exists('crop_observed')
            && $this->exists('coffee_crop_observed')
        ) {
            $this->merge(['crop_observed' => $this->input('coffee_crop_observed')]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'boundary_revision' => ['required', 'integer', 'min:1'],
            'farm_exists' => ['required', 'boolean'],
            'location_matches' => ['required', 'boolean'],
            'crop_observed' => ['required', 'boolean'],
            'boundary_captured' => ['required', 'boolean'],
            'area_checked' => ['required', 'boolean'],
            'farmer_or_representative_met' => ['required', 'boolean'],
            'evidence_type' => ['required', 'string', 'in:farm_entrance,crop_plants,coffee_plants,farm_boundary,general_farm_view,other'],
            'evidence_photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
            'captured_at' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function isMobileWorkflow(): bool
    {
        return $this->is('api/mobile/*');
    }
}
