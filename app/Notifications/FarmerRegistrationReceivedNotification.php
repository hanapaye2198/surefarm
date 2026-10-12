<?php

namespace App\Notifications;

use App\Models\Farmer;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class FarmerRegistrationReceivedNotification extends Notification
{
    use Queueable;

    public function __construct(private Farmer $farmer) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        return [
            'farmer_id' => $this->farmer->id,
            'farmer_code' => $this->farmer->farmer_id,
            'title' => 'Farmer registration received',
            'message' => 'Your SureFarm farmer profile has been linked to this account.',
        ];
    }
}
