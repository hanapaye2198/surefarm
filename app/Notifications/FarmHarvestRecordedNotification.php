<?php

namespace App\Notifications;

use App\Models\FarmHarvest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class FarmHarvestRecordedNotification extends Notification
{
    use Queueable;

    public function __construct(private FarmHarvest $harvest) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        return [
            'farm_id' => $this->harvest->farm?->id,
            'farm_name' => $this->harvest->farm?->displayName(),
            'status' => $this->harvest->status->value,
            'kind' => 'harvest',
            'title' => 'Harvest recorded',
            'message' => sprintf(
                '%s was recorded for %s.',
                $this->harvest->quantityLabel(),
                $this->harvest->farm?->displayName() ?? 'your farm',
            ),
        ];
    }
}
