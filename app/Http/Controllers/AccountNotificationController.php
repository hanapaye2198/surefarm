<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class AccountNotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(403);
        }

        return response()->json([
            'available' => true,
            'unread_count' => $user->unreadNotifications()->count(),
            'notifications' => $user->notifications()
                ->latest()
                ->limit(15)
                ->get()
                ->map(fn (DatabaseNotification $notification): array => $this->present($user, $notification))
                ->values(),
        ]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(403);
        }

        $record = $user->notifications()->whereKey($notification)->firstOrFail();
        $record->markAsRead();

        return response()->json([
            'unread_count' => $user->unreadNotifications()->count(),
            'notification' => $this->present($user, $record->fresh() ?? $record),
        ]);
    }

    /**
     * @return array{id: string, title: string, message: string, created_at: string|null, read: bool, href: string|null, kind: string, tone: string}
     */
    private function present(User $user, DatabaseNotification $notification): array
    {
        $data = $notification->data;
        $farmId = $data['farm_id'] ?? null;
        $href = null;

        if ((is_int($farmId) || (is_string($farmId) && ctype_digit($farmId)))
            && $user->canAccess(UserRole::Operations, UserRole::FieldVerifier)) {
            $href = route('farms.show', ['farm' => $farmId]);
        }

        $kind = is_string($data['kind'] ?? null) ? $data['kind'] : 'update';
        $status = is_string($data['status'] ?? null) ? $data['status'] : null;

        return [
            'id' => $notification->id,
            'title' => is_string($data['title'] ?? null) ? $data['title'] : 'SureFarm update',
            'message' => is_string($data['message'] ?? null) ? $data['message'] : '',
            'created_at' => $notification->created_at?->format('M j, Y g:i A'),
            'read' => $notification->read_at !== null,
            'href' => $href,
            'kind' => $kind,
            'tone' => $this->tone($kind, $status),
        ];
    }

    private function tone(string $kind, ?string $status): string
    {
        if ($status === 'failed') {
            return 'critical';
        }

        if (in_array($status, ['needs_review', 'pending'], true)) {
            return 'warning';
        }

        if (in_array($status, ['verified', 'completed'], true) || $kind === 'harvest') {
            return 'success';
        }

        if ($kind === 'announcement') {
            return 'info';
        }

        return 'neutral';
    }
}
