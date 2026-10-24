<?php

namespace App\Notifications;

use App\Models\Farm;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class FarmVerificationStatusNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Farm $farm,
        private string $status,
        private string $message,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        return [
            'farm_id' => $this->farm->id,
            'farm_code' => $this->farm->farm_id,
            'farm_name' => $this->farm->displayName(),
            'status' => $this->status,
            'title' => 'Farm verification update',
            'message' => $this->message,
        ];
    }
}
