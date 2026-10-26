<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('farmers', 'user_id')) {
            Schema::table('farmers', function (Blueprint $table): void {
                $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('farms', 'assigned_verifier_id')) {
            Schema::table('farms', function (Blueprint $table): void {
                $table->foreignId('assigned_verifier_id')->nullable()->constrained('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('farms', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('assigned_verifier_id');
        });

        Schema::table('farmers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
