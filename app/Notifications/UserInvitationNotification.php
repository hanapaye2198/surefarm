<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UserInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $recipientName,
        public string $roleLabel,
        public string $acceptUrl,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $hours = (int) config('auth.invitation_ttl_hours');

        return (new MailMessage)
            ->subject('You are invited to SureFarm')
            ->greeting('Hello '.$this->recipientName)
            ->line('You have been invited to join SureFarm as '.$this->roleLabel.'.')
            ->action('Accept invitation', $this->acceptUrl)
            ->line('This invitation expires in '.$hours.' hours and can be used once.')
            ->line('If you were not expecting this invitation, you can ignore this email.');
    }
}
