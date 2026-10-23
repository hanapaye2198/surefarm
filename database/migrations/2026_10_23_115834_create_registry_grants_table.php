<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Record who may see the registry, separately from their role.
     *
     * Accounts that already exist as administrator or operations were
     * created when that role itself opened the national registry. This
     * migration records one platform grant for each of those accounts so
     * current development data keeps working. New invitations do not
     * receive a grant here.
     */
    public function up(): void
    {
        Schema::create('registry_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 32);
            $table->string('province', 100)->nullable();
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'kind', 'revoked_at']);
        });

        $now = now();

        DB::table('users')
            ->whereIn('role', ['admin', 'operations'])
            ->orderBy('id')
            ->pluck('id')
            ->each(function (int|string $userId) use ($now): void {
                DB::table('registry_grants')->insert([
                    'user_id' => $userId,
                    'kind' => 'platform',
                    'province' => null,
                    'granted_by' => null,
                    'revoked_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('registry_grants');
    }
};
