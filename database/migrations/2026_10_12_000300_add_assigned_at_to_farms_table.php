<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farms', function (Blueprint $table): void {
            $table->timestamp('assigned_at')->nullable()->after('assigned_verifier_id');
            $table->index(['assigned_verifier_id', 'assigned_at']);
        });
    }

    public function down(): void
    {
        Schema::table('farms', function (Blueprint $table): void {
            $table->dropIndex(['assigned_verifier_id', 'assigned_at']);
            $table->dropColumn('assigned_at');
        });
    }
};
