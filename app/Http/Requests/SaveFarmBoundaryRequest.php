<?php

namespace App\Http\Requests;

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\User;
use App\Services\FarmBoundaryGeometry;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class SaveFarmBoundaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $farm = $this->route('farm');

        if (! $user instanceof User || ! $farm instanceof Farm) {
            return false;
        }

        if ($user->canAccess(UserRole::Operations)) {
            return true;
        }

        return $user->role === UserRole::FieldVerifier
            && $farm->assigned_verifier_id === $user->id
            && in_array($farm->verification_status, [
                FarmVerificationStatus::Pending,
                FarmVerificationStatus::NeedsReview,
                FarmVerificationStatus::InProgress,
            ], true);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'boundary_geojson' => ['required', 'array'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $message = app(FarmBoundaryGeometry::class)->message($this->input('boundary_geojson'));

                if ($message !== null) {
                    $validator->errors()->add('boundary_geojson', $message);
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'boundary_geojson.required' => 'Enter a polygon boundary.',
            'boundary_geojson.array' => 'Enter a polygon boundary.',
        ];
    }
}
