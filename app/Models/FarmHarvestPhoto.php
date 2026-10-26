<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

#[Fillable([
    'farm_harvest_id',
    'storage_path',
    'original_name',
    'mime_type',
    'file_size',
    'captured_at',
    'latitude',
    'longitude',
    'uploaded_by',
])]
class FarmHarvestPhoto extends Model
{
    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'captured_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'file_size' => 'integer',
        ];
    }

    /** @return BelongsTo<FarmHarvest, $this> */
    public function harvest(): BelongsTo
    {
        return $this->belongsTo(FarmHarvest::class, 'farm_harvest_id');
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** @return array<string, mixed> */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->original_name,
            'url' => URL::temporarySignedRoute(
                'api.mobile.media.farm-harvest-photo',
                now()->addMinutes(15),
                ['photo' => $this->id],
            ),
            'captured_at' => $this->captured_at === null
                ? null
                : Carbon::parse($this->captured_at)->toIso8601String(),
            'latitude' => $this->latitude === null ? null : (float) $this->latitude,
            'longitude' => $this->longitude === null ? null : (float) $this->longitude,
            'uploaded_by' => $this->uploader?->name,
        ];
    }
}
