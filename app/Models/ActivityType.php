<?php

namespace App\Models;

use App\ActivityCategory;
use App\ActivityTypeStatus;
use Database\Factories\ActivityTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property ActivityTypeStatus $status
 * @property ActivityCategory|null $category
 */
#[Fillable([
    'name',
    'code',
    'description',
    'category',
    'status',
])]
class ActivityType extends Model
{
    /** @use HasFactory<ActivityTypeFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ActivityTypeStatus::class,
            'category' => ActivityCategory::class,
        ];
    }

    /**
     * @return HasMany<FarmActivity, $this>
     */
    public function activities(): HasMany
    {
        return $this->hasMany(FarmActivity::class);
    }
}
