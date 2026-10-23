<?php

namespace App\Actions;

use App\AccessEventAction;
use App\CooperativeStatus;
use App\Models\Cooperative;
use App\Models\User;
use App\UserRole;

class RegisterCooperative
{
    public function __construct(private RecordAccessEvent $events) {}

    /**
     * @param  array{name: string, code?: string|null}  $data
     */
    public function handle(User $actor, array $data): Cooperative
    {
        $this->ensureManager($actor);

        $cooperative = Cooperative::query()->create([
            'name' => trim($data['name']),
            'code' => $this->code($data['code'] ?? null),
            'status' => CooperativeStatus::Active,
        ]);

        $this->events->handle($actor, AccessEventAction::CooperativeRegistered, null, $cooperative, [
            'code' => $cooperative->code,
        ]);

        return $cooperative;
    }

    private function code(mixed $code): ?string
    {
        if (! is_string($code)) {
            return null;
        }

        $code = trim($code);

        return $code === '' ? null : $code;
    }

    private function ensureManager(User $actor): void
    {
        if ($actor->isSuspended() || ! $actor->canAccess(UserRole::Operations)) {
            abort(403);
        }
    }
}
