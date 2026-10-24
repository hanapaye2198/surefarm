<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\FarmerAnnouncementNotification;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;

class MobileAnnouncementController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $publisher = $request->user();
        abort_unless($publisher instanceof User && $publisher->canAccess(UserRole::Operations), 403);

        $announcement = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $recipients = User::query()
            ->where('role', UserRole::Farmer)
            ->whereHas('farmer');

        if (! $recipients->exists()) {
            return back()->withErrors([
                'announcement' => 'There are no linked farmer accounts to receive this announcement.',
            ]);
        }

        $notification = new FarmerAnnouncementNotification(
            $announcement['title'],
            $announcement['message'],
            $publisher->name,
        );

        $recipients->chunkById(100, function ($users) use ($notification): void {
            Notification::send($users, $notification);
        });

        return back();
    }
}
