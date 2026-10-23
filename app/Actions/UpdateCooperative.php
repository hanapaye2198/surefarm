<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\Cooperative;
use App\Models\User;
use App\UserRole;

class UpdateCooperative
{
    public function __construct(private RecordAccessEvent $events) {}

    /**
     * @param  array{name: string, code?: string|null}  $data
     */
    public function handle(User $actor, Cooperative $cooperative, array $data): Cooperative
    {
        if ($actor->isSuspended() || ! $actor->canAccess(UserRole::Operations)) {
            abort(403);
        }

        $code = isset($data['code']) && trim($data['code']) !== ''
            ? trim($data['code'])
            : null;
        $name = trim($data['name']);
        $before = [
            'name' => $cooperative->name,
            'code' => $cooperative->code,
        ];

        $cooperative->update([
            'name' => $name,
            'code' => $code,
        ]);

        if ($before['name'] !== $cooperative->name || $before['code'] !== $cooperative->code) {
            $this->events->handle($actor, AccessEventAction::CooperativeUpdated, null, $cooperative, [
                'name_from' => $before['name'],
                'name_to' => $cooperative->name,
                'code_from' => $before['code'],
                'code_to' => $cooperative->code,
            ]);
        }

        return $cooperative;
    }
}
