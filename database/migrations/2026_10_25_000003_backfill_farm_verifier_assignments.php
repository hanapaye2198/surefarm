<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('farms')
            ->whereNotNull('assigned_verifier_id')
            ->orderBy('id')
            ->chunkById(500, function ($farms): void {
                foreach ($farms as $farm) {
                    $verifier = DB::table('users')
                        ->where('id', $farm->assigned_verifier_id)
                        ->where('role', 'field_verifier')
                        ->whereNull('suspended_at')
                        ->first(['id']);

                    if ($verifier === null) {
                        continue;
                    }

                    $hasAssignmentHistory = DB::table('farm_verifier_assignments')
                        ->where('farm_id', $farm->id)
                        ->exists();

                    // Once a farm has assignment history, that table is authoritative.
                    // Do not resurrect a stale legacy assignment for another verifier.
                    if ($hasAssignmentHistory) {
                        continue;
                    }

                    $assignedAt = $farm->assigned_at
                        ?? $farm->updated_at
                        ?? $farm->created_at
                        ?? now()->toDateTimeString();

                    DB::table('farm_verifier_assignments')->insert([
                        'user_id' => $verifier->id,
                        'farm_id' => $farm->id,
                        'assigned_by' => null,
                        'assigned_at' => $assignedAt,
                        'revoked_at' => null,
                        'created_at' => $assignedAt,
                        'updated_at' => $assignedAt,
                    ]);
                }
            });
    }

    public function down(): void
    {
        // Keep migrated assignments. An administrator may have edited them
        // after this migration and their access history must not be removed.
    }
};
