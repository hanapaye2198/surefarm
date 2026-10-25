<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farm_harvests', function (Blueprint $table): void {
            $table->string('coffee_variety', 100)->nullable();
            $table->decimal('estimated_green_bean_quantity_kg', 12, 2)->nullable();
        });

        Schema::create('farm_harvest_photos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('farm_harvest_id')->constrained('farm_harvests')->cascadeOnDelete();
            $table->string('storage_path', 500);
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('file_size');
            $table->timestamp('captured_at')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['farm_harvest_id', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_harvest_photos');

        Schema::table('farm_harvests', function (Blueprint $table): void {
            $table->dropColumn(['coffee_variety', 'estimated_green_bean_quantity_kg']);
        });
    }
};
