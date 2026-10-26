<?php

namespace App\Actions;

use App\HarvestStatus;
use App\Models\FarmHarvest;
use App\Models\User;
use App\Notifications\FarmHarvestRecordedNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class RecordFarmHarvest
{
    /**
     * Store an actual harvest. The linked production estimate, farm
     * area, verification, activities, and finance records stay as they are.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $user): FarmHarvest
    {
        $photos = array_values(array_filter(
            is_array($data['photos'] ?? null) ? $data['photos'] : [],
            fn (mixed $photo): bool => $photo instanceof UploadedFile,
        ));
        $photoMetadata = is_array($data['photos_metadata'] ?? null) ? $data['photos_metadata'] : [];
        unset($data['photos'], $data['photos_metadata']);

        $storedPaths = [];

        try {
            foreach ($photos as $photo) {
                $path = $photo->store('farm-harvests/photos', 'local');

                if (! is_string($path)) {
                    throw new RuntimeException('Harvest photo could not be stored.');
                }

                $storedPaths[] = $path;
            }

            $harvest = DB::transaction(function () use ($data, $user, $photos, $photoMetadata, $storedPaths): FarmHarvest {
                $harvest = FarmHarvest::query()->create([
                    'farm_id' => $data['farm_id'],
                    'crop_type' => $data['crop_type'] ?? null,
                    'coffee_variety' => $data['coffee_variety'] ?? null,
                    'estimated_green_bean_quantity_kg' => $data['estimated_green_bean_quantity_kg'] ?? null,
                    'production_id' => $data['production_id'] ?? null,
                    'harvest_date' => $data['harvest_date'],
                    'quantity' => $data['quantity'],
                    'unit' => $data['unit'],
                    'quality_grade' => $data['quality_grade'] ?? null,
                    'status' => $data['status'] ?? HarvestStatus::Completed,
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $user->id,
                ]);

                foreach ($photos as $index => $photo) {
                    $metadata = is_array($photoMetadata[$index] ?? null) ? $photoMetadata[$index] : [];
                    $latitude = $metadata['latitude'] ?? null;
                    $longitude = $metadata['longitude'] ?? null;
                    $fileSize = $photo->getSize();

                    $harvest->photos()->create([
                        'storage_path' => $storedPaths[$index],
                        'original_name' => mb_substr($photo->getClientOriginalName(), 0, 255),
                        'mime_type' => $photo->getMimeType() ?? 'application/octet-stream',
                        'file_size' => is_int($fileSize) ? $fileSize : 0,
                        'captured_at' => $metadata['captured_at'] ?? null,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'uploaded_by' => $user->id,
                    ]);
                }

                return $harvest->load(['farm.farmer', 'production', 'creator', 'photos.uploader']);
            });
        } catch (Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk('local')->delete($storedPaths);
            }

            throw $exception;
        }

        $harvest->loadMissing('farm.farmer.user');

        $farmerUser = $harvest->farm?->farmer?->user;

        try {
            if ($farmerUser !== null && ! $farmerUser->is($user)) {
                $farmerUser->notify(new FarmHarvestRecordedNotification($harvest));
            }
        } catch (Throwable $exception) {
            report($exception);
        }

        return $harvest;
    }
}
