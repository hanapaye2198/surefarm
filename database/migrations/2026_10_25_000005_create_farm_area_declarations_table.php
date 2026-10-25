<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farm_area_declarations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->decimal('previous_area_hectares', 10, 2)->nullable();
            $table->decimal('declared_area_hectares', 10, 2);
            $table->string('event_type', 32);
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['farm_id', 'recorded_at']);
        });

        // Existing values become an explicitly labelled baseline. Their
        // earlier declaration history cannot be reconstructed reliably.
        $baselineTime = now();
        DB::table('farms')
            ->select(['id', 'declared_area_hectares'])
            ->orderBy('id')
            ->chunkById(500, function ($farms) use ($baselineTime): void {
                $rows = $farms->map(fn ($farm): array => [
                    'farm_id' => $farm->id,
                    'previous_area_hectares' => null,
                    'declared_area_hectares' => $farm->declared_area_hectares,
                    'event_type' => 'legacy_baseline',
                    'recorded_by' => null,
                    'recorded_at' => $baselineTime,
                    'created_at' => $baselineTime,
                    'updated_at' => $baselineTime,
                ])->all();

                if ($rows !== []) {
                    DB::table('farm_area_declarations')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_area_declarations');
    }
};
