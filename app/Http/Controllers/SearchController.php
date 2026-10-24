<?php

namespace App\Http\Controllers;

use App\Models\Farm;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->canAccess(UserRole::Operations, UserRole::FieldVerifier)) {
            return response()->json([
                'available' => false,
                'results' => [],
                'message' => 'Search is available for operations and field verifier accounts.',
            ]);
        }

        $term = $request->string('q')->trim()->toString();

        if (mb_strlen($term) < 2) {
            return response()->json([
                'available' => true,
                'results' => [],
                'message' => null,
            ]);
        }

        $like = '%'.addcslashes($term, '%_\\').'%';

        $farmers = Farmer::query()
            ->where(function ($query) use ($like): void {
                $query->where('farmer_id', 'like', $like)
                    ->orWhere('first_name', 'like', $like)
                    ->orWhere('middle_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('municipality', 'like', $like)
                    ->orWhere('barangay', 'like', $like)
                    ->orWhere('province', 'like', $like);
            })
            ->orderBy('last_name')
            ->orderBy('id')
            ->limit(8)
            ->get()
            ->map(fn (Farmer $farmer): array => [
                'type' => 'farmer',
                'id' => $farmer->id,
                'title' => $farmer->fullName(),
                'subtitle' => trim($farmer->farmer_id.' · '.$farmer->locationLabel(), ' ·'),
                'href' => route('farmers.show', $farmer),
            ]);

        $farms = Farm::query()
            ->with('farmer')
            ->where(function ($query) use ($like): void {
                $query->where('farm_id', 'like', $like)
                    ->orWhere('farm_name', 'like', $like)
                    ->orWhere('municipality', 'like', $like)
                    ->orWhere('barangay', 'like', $like)
                    ->orWhere('province', 'like', $like)
                    ->orWhere('purok_sitio', 'like', $like)
                    ->orWhereHas('farmer', function ($query) use ($like): void {
                        $query->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('farmer_id', 'like', $like);
                    });
            })
            ->orderBy('farm_id')
            ->limit(8)
            ->get()
            ->map(fn (Farm $farm): array => [
                'type' => 'farm',
                'id' => $farm->id,
                'title' => $farm->displayName(),
                'subtitle' => trim($farm->farm_id.' · '.$farm->locationLabel(), ' ·'),
                'href' => route('farms.show', $farm),
            ]);

        return response()->json([
            'available' => true,
            'results' => $farmers->concat($farms)->values(),
            'message' => null,
        ]);
    }
}
