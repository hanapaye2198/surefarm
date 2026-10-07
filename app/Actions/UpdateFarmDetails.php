<?php

namespace App\Actions;

use App\Models\Farm;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
    public function handle(Farm $farm, array $data, ?UploadedFile $droneImage = null): Farm
    {
        $storedPath = null;

        try {
            return DB::transaction(function () use ($farm, $data, $droneImage, &$storedPath): Farm {
                $previousImage = $farm->drone_image_path;

                if ($droneImage !== null) {
                    $storedPath = $droneImage->store('farms/drone-images');

                    if ($storedPath === false) {
                        throw new \RuntimeException('Farm drone image could not be stored.');
                    }
                }

                $farm->update([
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
                ]);

                if (is_string($storedPath) && is_string($previousImage)) {
                    Storage::delete($previousImage);
                }

                return $farm->refresh();
            });
        } catch (Throwable $exception) {
            if (is_string($storedPath)) {
                Storage::delete($storedPath);
            }

            throw $exception;
        }
    }
}
