<?php

namespace App\Models\Concerns;

use App\Models\User;
use App\Services\RegistryScope;
use Illuminate\Database\Eloquent\Builder;

trait VisibleToRegistry
{
    /**
     * Limit a registry query to the records this account may see.
     * A missing user leaves the query unchanged so seeders and jobs
     * are not filtered by a web session.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeVisibleTo(Builder $query, ?User $user): Builder
    {
        if (! $user instanceof User) {
            return $query;
        }

        return app(RegistryScope::class)->constrain($query, $user);
    }
}
