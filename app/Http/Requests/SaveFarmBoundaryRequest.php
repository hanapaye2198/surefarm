<?php

namespace App\Http\Requests;

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\User;
use App\Services\FarmBoundaryGeometry;
use App\Services\RegistryScope;
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

        $isBoundaryPreview = $this->is('api/mobile/farms/*/boundary-preview');
        $inProgress = $farm->verification_status === FarmVerificationStatus::InProgress;

        if ($isBoundaryPreview) {
            return $user->canAccess(UserRole::Operations, UserRole::FieldVerifier, UserRole::Admin)
                && app(RegistryScope::class)->canViewFarm($user, $farm);
        }

        if (! $inProgress && $user->canAccess(UserRole::Operations, UserRole::Admin)) {
            return true;
        }

        return $this->is('api/mobile/*')
            && $inProgress
            && $user->hasRole(UserRole::FieldVerifier, UserRole::Admin)
            && app(RegistryScope::class)->canViewFarm($user, $farm);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'boundary_geojson' => ['required', 'array'],
            'gps_point_accuracies' => ['sometimes', 'array', 'max:1000'],
            'gps_point_accuracies.*' => ['nullable', 'numeric', 'between:0,1000'],
            'capture_method' => ['sometimes', 'string', 'in:device_gps,map_manual'],
            'gps_point_captured_at' => ['sometimes', 'array', 'max:1000'],
            'gps_point_captured_at.*' => ['required', 'date'],
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

                    return;
                }

                $geometry = app(FarmBoundaryGeometry::class)->inspect($this->input('boundary_geojson'));
                $positions = $geometry['polygon']['coordinates'][0] ?? [];
                $expectedCount = max(0, count($positions) - 1);
                $accuracies = $this->input('gps_point_accuracies');
                $timestamps = $this->input('gps_point_captured_at');

                if (is_array($accuracies) && count($accuracies) !== $expectedCount) {
                    $validator->errors()->add(
                        'gps_point_accuracies',
                        'GPS accuracy readings must match the boundary points.',
                    );
                }

                if (is_array($timestamps) && count($timestamps) !== $expectedCount) {
                    $validator->errors()->add(
                        'gps_point_captured_at',
                        'GPS capture times must match the boundary points.',
                    );
                }

                $farm = $this->route('farm');
                $isPreview = $this->is('api/mobile/farms/*/boundary-preview');
                $isActiveVerification = $farm instanceof Farm
                    && $farm->verification_status === FarmVerificationStatus::InProgress
                    && ! $isPreview;

                if ($isActiveVerification && $this->input('capture_method') !== 'device_gps') {
                    $validator->errors()->add(
                        'capture_method',
                        'Capture and save the boundary with the field verifier mobile GPS tool.',
                    );
                }

                $deviceGpsCapture = $this->input('capture_method') === 'device_gps';
                $manualMapCapture = $this->input('capture_method') === 'map_manual';

                if (($isActiveVerification || $deviceGpsCapture)
                    && (! is_array($timestamps) || count($timestamps) !== $expectedCount)) {
                    $validator->errors()->add(
                        'gps_point_captured_at',
                        'A capture time is required for every GPS boundary point.',
                    );
                }

                if ($manualMapCapture && (is_array($timestamps) || is_array($accuracies))) {
                    $validator->errors()->add(
                        'capture_method',
                        'A manually drawn map boundary cannot include device GPS readings.',
                    );
                }

                if (is_array($timestamps)) {
                    foreach ($timestamps as $timestamp) {
                        try {
                            // The timestamp is supplied by the field device.
                            // Keep it as metadata, but do not compare its clock
                            // to the server when accepting the boundary.
                            \Illuminate\Support\Carbon::parse($timestamp);
                        } catch (\Throwable) {
                            continue; // The date rule reports malformed values.
                        }
                    }
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
