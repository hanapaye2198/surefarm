<?php

namespace App\Http\Controllers;

use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\FarmProduction;
use App\Models\User;
use App\Services\FarmAreaComparison;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MobileFarmerController extends Controller
{
    public function farms(Request $request, FarmAreaComparison $areas): Response
    {
        $farmer = $this->farmer($request);

        return Inertia::render('mobile/farmer-farms', [
            'farmer_name' => $farmer->fullName(),
            'farms' => $farmer->farms()->with('boundary')->latest('id')->get()
                ->map(fn (Farm $farm): array => $this->farmRow($farm, $areas))
                ->values()->all(),
        ]);
    }

    public function showFarm(Request $request, Farm $farm, FarmAreaComparison $areas): Response
    {
        abort_unless($farm->farmer_id === $this->farmer($request)->id, 404);
        $farm->load(['boundary', 'verifications.verifier:id,name', 'verifications.photos.uploader:id,name']);
        $comparison = $areas->calculate($farm->declared_area_hectares, $farm->boundary?->gps_measured_area_hectares);

        return Inertia::render('mobile/farmer-farm', [
            'farm' => $this->farmRow($farm, $areas),
            'boundary' => $farm->boundary === null ? null : [
                'geojson' => $farm->boundary->boundary_geojson,
                'gps_measured_area_hectares' => (float) $farm->boundary->gps_measured_area_hectares,
                'captured_at' => $farm->boundary->captured_at?->format('M j, Y'),
            ],
            'history' => $farm->verifications->map(fn ($verification): array => $verification->present())->values()->all(),
            'comparison' => $comparison === null ? null : [
                'declared' => $areas->hectares($comparison['declared']),
                'measured' => $areas->hectares($comparison['measured']),
                'difference' => $areas->hectares($comparison['difference']),
            ],
            'google_maps_api_key' => config('services.google_maps.browser_api_key'),
        ]);
    }

    public function activities(Request $request): Response
    {
        $farmer = $this->farmer($request);

        $activities = FarmActivity::query()
            ->with([
                'farm:id,farm_id,farm_name,farmer_id',
                'farm.farmer:id,first_name,middle_name,last_name',
                'activityType:id,name',
                'creator:id,name',
            ])
            ->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmer->id))
            ->latest('activity_date')->latest('id')->limit(30)->get()
            ->map(fn (FarmActivity $activity): array => $activity->present())
            ->values()->all();

        $harvests = FarmHarvest::query()
            ->with([
                'farm:id,farm_id,farm_name,farmer_id,crop_type',
                'farm.farmer:id,first_name,middle_name,last_name',
                'production:id,production_period',
                'creator:id,name',
            ])
            ->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmer->id))
            ->latest('harvest_date')->latest('id')->limit(30)->get()
            ->map(fn (FarmHarvest $harvest): array => $harvest->present())
            ->values()->all();

        $productions = FarmProduction::query()
            ->with('farm:id,farm_id,farm_name,farmer_id,crop_type')
            ->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmer->id))
            ->latest('id')->limit(30)->get()
            ->map(fn (FarmProduction $production): array => $production->present())
            ->values()->all();

        return Inertia::render('mobile/farmer-activities', [
            'activities' => $activities,
            'harvests' => $harvests,
            'productions' => $productions,
        ]);
    }

    public function notifications(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->role === UserRole::Farmer, 403);

        return Inertia::render('mobile/farmer-notifications', [
            'notifications' => $user->notifications()->latest()->limit(30)->get()
                ->map(fn (DatabaseNotification $notification): array => [
                    'id' => $notification->id,
                    'title' => $notification->data['title'] ?? 'SureFarm update',
                    'message' => $notification->data['message'] ?? '',
                    'farm_name' => $notification->data['farm_name'] ?? null,
                    'status' => $notification->data['status'] ?? null,
                    'created_at' => $notification->created_at?->format('M j, Y g:i A'),
                    'read' => $notification->read_at !== null,
                ])->values()->all(),
        ]);
    }

    public function markNotificationRead(Request $request, string $notification): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->role === UserRole::Farmer, 403);
        $user->notifications()->whereKey($notification)->firstOrFail()->markAsRead();

        return $this->notifications($request);
    }

    public function profile(Request $request): Response
    {
        $farmer = $this->farmer($request);

        return Inertia::render('mobile/farmer-profile', [
            'farmer' => [
                'farmer_id' => $farmer->farmer_id,
                'name' => $farmer->fullName(),
                'first_name' => $farmer->first_name,
                'middle_name' => $farmer->middle_name,
                'last_name' => $farmer->last_name,
                'suffix' => $farmer->suffix,
                'date_of_birth' => $farmer->date_of_birth === null
                    ? null
                    : Carbon::parse($farmer->date_of_birth)->format('M j, Y'),
                'government_id' => $farmer->government_id,
                'email' => $farmer->email,
                'mobile_number' => $farmer->mobile_number,
                'address' => $farmer->addressLabel(),
                'purok_sitio' => $farmer->purok_sitio,
                'barangay' => $farmer->barangay,
                'municipality' => $farmer->municipality,
                'province' => $farmer->province,
                'sitio_purok_code' => $farmer->sitio_purok_code,
                'barangay_code' => $farmer->barangay_code,
                'lgu_code' => $farmer->lgu_code,
                'security_control_code' => $farmer->security_control_code,
                'photo_url' => $farmer->photo_path === null ? null : URL::temporarySignedRoute(
                    'api.mobile.media.farmer-photo',
                    now()->addMinutes(15),
                    ['farmer' => $farmer->id],
                ),
                'cooperative' => $farmer->cooperative?->name,
            ],
        ]);
    }

    public function updatePhoto(Request $request): RedirectResponse
    {
        $farmer = $this->farmer($request);
        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $path = $request->file('photo')?->store('farmers/photos', 'local');

        if (! is_string($path)) {
            return back()->withErrors(['photo' => 'The profile photo could not be saved.']);
        }

        $previousPath = $farmer->photo_path;
        $farmer->update(['photo_path' => $path]);

        if (is_string($previousPath) && $previousPath !== $path) {
            Storage::disk('local')->delete($previousPath);
        }

        return back();
    }

    public function photo(Request $request): StreamedResponse
    {
        $farmer = $this->farmer($request);

        abort_unless(
            $farmer->photo_path !== null && Storage::disk('local')->exists($farmer->photo_path),
            404,
        );

        return Storage::disk('local')->response($farmer->photo_path);
    }

    public function signedPhoto(Farmer $farmer): StreamedResponse
    {
        abort_unless(
            $farmer->photo_path !== null && Storage::disk('local')->exists($farmer->photo_path),
            404,
        );

        return Storage::disk('local')->response($farmer->photo_path);
    }

    private function farmer(Request $request): Farmer
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->role === UserRole::Farmer, 403);

        return $user->farmer()->with('cooperative')->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function farmRow(Farm $farm, FarmAreaComparison $areas): array
    {
        $comparison = $areas->calculate($farm->declared_area_hectares, $farm->boundary?->gps_measured_area_hectares);

        return [
            'id' => $farm->id,
            'farm_id' => $farm->farm_id,
            'farm_name' => $farm->displayName(),
            'crop' => $farm->crop_type->label(),
            'location' => $farm->locationLabel(),
            'declared_area' => $areas->hectares((float) $farm->declared_area_hectares),
            'measured_area' => $comparison === null ? null : $areas->hectares($comparison['measured']),
            'verified_area' => $farm->verified_area_hectares === null ? null : $areas->hectares((float) $farm->verified_area_hectares),
            'verification_status' => $farm->verification_status->value,
            'status' => $farm->status->value,
            'boundary_saved' => $farm->boundary !== null,
        ];
    }
}
