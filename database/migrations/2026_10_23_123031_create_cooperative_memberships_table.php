<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cooperative_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cooperative_id')->constrained()->restrictOnDelete();
            $table->foreignId('farmer_id')->constrained()->restrictOnDelete();
            $table->string('status', 32);
            $table->date('joined_on')->nullable();
            $table->date('ended_on')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->unsignedBigInteger('open_slot')->nullable()->unique();
            $table->string('origin', 32);
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['cooperative_id', 'status']);
            $table->index('farmer_id');
        });

        DB::table('farmers')
            ->whereNotNull('cooperative_id')
            ->orderBy('id')
            ->chunkById(100, function ($farmers): void {
                $now = now();

                foreach ($farmers as $farmer) {
                    DB::table('cooperative_memberships')->insert([
                        'cooperative_id' => $farmer->cooperative_id,
                        'farmer_id' => $farmer->id,
                        'status' => 'active',
                        'joined_on' => $farmer->created_at === null ? null : substr((string) $farmer->created_at, 0, 10),
                        'ended_on' => null,
                        'suspended_at' => null,
                        'open_slot' => $farmer->id,
                        'origin' => 'migration',
                        'recorded_by' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cooperative_memberships');
    }
};
