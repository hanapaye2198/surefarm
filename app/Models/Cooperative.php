<?php

namespace App\Models;

use App\CooperativeStatus;
use Database\Factories\CooperativeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property CooperativeStatus $status
 */
#[Fillable(['name', 'code', 'status'])]
class Cooperative extends Model
{
    /** @use HasFactory<CooperativeFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CooperativeStatus::class,
        ];
    }

    /**
     * @return HasMany<Farmer, $this>
     */
    public function farmers(): HasMany
    {
        return $this->hasMany(Farmer::class);
    }
}
