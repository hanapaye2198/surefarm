<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farm_verifications', function (Blueprint $table): void {
            $table->foreignId('boundary_captured_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('farm_verifications', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('boundary_captured_by');
        });
    }
};
