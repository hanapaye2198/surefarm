<?php

namespace App\Models;

use Database\Factories\FinancingDocumentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property Carbon $created_at
 */
#[Fillable([
    'farm_financing_id',
    'path',
    'original_name',
    'uploaded_by',
])]
class FinancingDocument extends Model
{
    /** @use HasFactory<FinancingDocumentFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<FarmFinancing, $this>
     */
    public function financing(): BelongsTo
    {
        return $this->belongsTo(FarmFinancing::class, 'farm_financing_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
