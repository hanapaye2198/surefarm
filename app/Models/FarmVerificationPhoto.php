<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

#[Fillable([
    'farm_verification_id',
    'evidence_type',
    'storage_path',
    'original_name',
    'mime_type',
    'file_size',
    'captured_at',
    'latitude',
    'longitude',
    'uploaded_by',
])]
class FarmVerificationPhoto extends Model
{
    protected function casts(): array
    {
        return [
            'captured_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'file_size' => 'integer',
        ];
    }

    /** @return BelongsTo<FarmVerification, $this> */
    public function verification(): BelongsTo
    {
        return $this->belongsTo(FarmVerification::class, 'farm_verification_id');
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
            'type' => $this->evidence_type,
            'name' => $this->original_name,
            'url' => URL::temporarySignedRoute(
                'api.mobile.media.farm-verification-photo',
                now()->addMinutes(15),
                ['photo' => $this->id],
            ),
            'captured_at' => $this->captured_at?->toIso8601String(),
            'latitude' => $this->latitude === null ? null : (float) $this->latitude,
            'longitude' => $this->longitude === null ? null : (float) $this->longitude,
            'uploaded_by' => $this->uploader?->name,
        ];
    }
}
