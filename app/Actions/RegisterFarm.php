<?php

namespace App\Actions;

use App\Contracts\FarmIdGenerator;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\Farmer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class RegisterFarm
{
    public function __construct(private FarmIdGenerator $farmIds) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Farmer $farmer, array $data, ?UploadedFile $droneImage = null): Farm
    {
        $storedPath = null;

        try {
            return DB::transaction(function () use ($farmer, $data, $droneImage, &$storedPath): Farm {
                if ($droneImage !== null) {
                    $storedPath = $droneImage->store('farms/drone-images');

                    if ($storedPath === false) {
                        throw new \RuntimeException('Farm drone image could not be stored.');
                    }
                }

                $farm = $farmer->farms()->create([
                    'farm_id' => 'TMP-'.Str::uuid()->toString(),
                    'farm_name' => $data['farm_name'] ?? null,
                    'crop_type' => $data['crop_type'],
                    'declared_area_hectares' => $data['declared_area_hectares'],
                    'purok_sitio' => $data['purok_sitio'] ?? null,
                    'barangay' => $data['barangay'] ?? null,
                    'municipality' => $data['municipality'] ?? null,
                    'province' => $data['province'] ?? null,
                    'latitude' => $data['latitude'] ?? null,
                    'longitude' => $data['longitude'] ?? null,
                    'verification_status' => FarmVerificationStatus::Pending,
                    'status' => FarmStatus::Active,
                    'current_stage' => $data['current_stage'] ?? null,
                    'number_of_hills' => $data['number_of_hills'] ?? null,
                    'data_validated' => array_key_exists('data_validated', $data) ? $data['data_validated'] : null,
                    'property_ownership' => $data['property_ownership'] ?? null,
                    'contracted_value_estimated' => $data['contracted_value_estimated'] ?? null,
                    'input_support_amount' => $data['input_support_amount'] ?? null,
                    'financing_support_amount' => $data['financing_support_amount'] ?? null,
                    'drone_image_path' => $storedPath,
                    'notes' => $data['notes'] ?? null,
                ]);

                $farm->update([
                    'farm_id' => $this->farmIds->fromSequence($farm->id),
                ]);

                return $farm->load('farmer');
            });
        } catch (Throwable $exception) {
            if (is_string($storedPath)) {
                Storage::delete($storedPath);
            }

            throw $exception;
        }
    }
}
