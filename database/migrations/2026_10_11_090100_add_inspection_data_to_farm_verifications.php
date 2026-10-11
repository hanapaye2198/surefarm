<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farm_verifications', function (Blueprint $table): void {
            $table->decimal('measured_area_hectares', 10, 2)->nullable()->change();
            $table->decimal('difference_hectares', 10, 2)->nullable()->change();
            $table->decimal('variance_percentage', 8, 2)->nullable()->change();
            $table->json('inspection_checklist')->nullable();
        });

        Schema::create('farm_verification_photos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('farm_verification_id')->constrained()->cascadeOnDelete();
            $table->string('evidence_type', 32);
            $table->string('storage_path');
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('file_size');
            $table->timestamp('captured_at')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('farm_verification_photos');

        Schema::table('farm_verifications', function (Blueprint $table): void {
            $table->dropColumn('inspection_checklist');
            // Keep area snapshots nullable so rolling back does not falsify
            // an unfinished verification that has no captured boundary yet.
        });
    }
};
