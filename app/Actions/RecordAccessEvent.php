<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\AccessEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class RecordAccessEvent
{
    /**
     * @param  array<string, scalar|null>  $metadata
     */
    public function handle(
        User $actor,
        AccessEventAction $action,
        ?User $subject = null,
        ?Model $auditable = null,
        array $metadata = [],
    ): AccessEvent {
        return AccessEvent::query()->create([
            'actor_id' => $actor->id,
            'subject_user_id' => $subject?->id,
            'action' => $action,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'metadata' => $metadata === [] ? null : $metadata,
            'created_at' => now(),
        ]);
    }
}
