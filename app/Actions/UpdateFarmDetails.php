<?php

namespace App\Actions;

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class UpdateFarmDetails
{
    /**
     * Updates farm reference data. Declared area is only changed when
     * the request includes a new declared value. Measured area,
     * verified area, and verification status are left untouched.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(
        Farm $farm,
        array $data,
        ?UploadedFile $droneImage = null,
        ?User $actor = null,
    ): Farm
    {
        $storedPath = null;
        $previousImage = null;

        try {
            $updatedFarm = DB::transaction(function () use ($farm, $data, $droneImage, $actor, &$storedPath, &$previousImage): Farm {
                $lockedFarm = Farm::query()->lockForUpdate()->findOrFail($farm->id);
                $previousImage = $lockedFarm->drone_image_path;
                $previousDeclaredArea = (float) $lockedFarm->declared_area_hectares;
                $nextDeclaredArea = (float) ($data['declared_area_hectares'] ?? $previousDeclaredArea);

                $verificationInputsChanged = $this->verificationInputsChanged($lockedFarm, $data);

                if (
                    $lockedFarm->verification_status === FarmVerificationStatus::InProgress
                    && $verificationInputsChanged
                ) {
                    throw ValidationException::withMessages([
                        'farm' => 'Declared area, crop, and farm location cannot change while a field verification is in progress.',
                    ]);
                }

                if ($droneImage !== null) {
                    $storedPath = $droneImage->store('farms/drone-images', 'local');

                    if ($storedPath === false) {
                        throw new \RuntimeException('Farm drone image could not be stored.');
                    }
                }

                $attributes = [
                    'farm_name' => $data['farm_name'] ?? null,
                    'crop_type' => $data['crop_type'],
                    'declared_area_hectares' => $data['declared_area_hectares'],
                    'purok_sitio' => $data['purok_sitio'] ?? null,
                    'barangay' => $data['barangay'] ?? null,
                    'municipality' => $data['municipality'] ?? null,
                    'province' => $data['province'] ?? null,
                    'latitude' => $data['latitude'] ?? null,
                    'longitude' => $data['longitude'] ?? null,
                    'status' => $data['status'],
                    'current_stage' => $data['current_stage'] ?? null,
                    'number_of_hills' => $data['number_of_hills'] ?? null,
                    'data_validated' => array_key_exists('data_validated', $data) ? $data['data_validated'] : null,
                    'property_ownership' => $data['property_ownership'] ?? null,
                    'contracted_value_estimated' => $data['contracted_value_estimated'] ?? null,
                    'input_support_amount' => $data['input_support_amount'] ?? null,
                    'financing_support_amount' => $data['financing_support_amount'] ?? null,
                    'drone_image_path' => $storedPath ?? $previousImage,
                    'notes' => $data['notes'] ?? null,
                ];

                if ($verificationInputsChanged && $lockedFarm->verified_area_hectares !== null) {
                    // Keep the last accepted measurement for audit, but make
                    // the stale verification visible until a new attempt is
                    // completed against the changed farm details.
                    $attributes['verification_status'] = FarmVerificationStatus::NeedsReview;
                }

                $lockedFarm->update($attributes);

                if ($this->area($previousDeclaredArea) !== $this->area($nextDeclaredArea)) {
                    $lockedFarm->areaDeclarations()->create([
                        'previous_area_hectares' => $previousDeclaredArea,
                        'declared_area_hectares' => $nextDeclaredArea,
                        'event_type' => 'revision',
                        'recorded_by' => $actor?->id,
                        'recorded_at' => now(),
                    ]);
                }

                return $lockedFarm->refresh();
            });

            if (is_string($storedPath) && is_string($previousImage)) {
                try {
                    Storage::disk('local')->delete($previousImage);
                } catch (Throwable $cleanupException) {
                    report($cleanupException);
                }
            }

            return $updatedFarm;
        } catch (Throwable $exception) {
            if (is_string($storedPath)) {
                Storage::disk('local')->delete($storedPath);
            }

            throw $exception;
        }
    }

    /** @param array<string, mixed> $data */
    private function verificationInputsChanged(Farm $farm, array $data): bool
    {
        if ($this->area($farm->declared_area_hectares) !== $this->area($data['declared_area_hectares'] ?? null)) {
            return true;
        }

        $crop = $farm->crop_type?->value;
        if ($crop !== ($data['crop_type'] ?? null)) {
            return true;
        }

        foreach (['purok_sitio', 'barangay', 'municipality', 'province'] as $field) {
            if ($this->text($farm->{$field}) !== $this->text($data[$field] ?? null)) {
                return true;
            }
        }

        foreach (['latitude', 'longitude'] as $field) {
            if ($this->coordinate($farm->{$field}) !== $this->coordinate($data[$field] ?? null)) {
                return true;
            }
        }

        return false;
    }

    private function area(mixed $value): ?string
    {
        return is_numeric($value) ? number_format((float) $value, 2, '.', '') : null;
    }

    private function coordinate(mixed $value): ?string
    {
        return is_numeric($value) ? number_format((float) $value, 7, '.', '') : null;
    }

    private function text(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
