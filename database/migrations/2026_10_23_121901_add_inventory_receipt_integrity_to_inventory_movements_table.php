<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->string('client_token', 64)->nullable()->unique();
            $table->foreignId('reverses_movement_id')
                ->nullable()
                ->unique()
                ->constrained('inventory_movements')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reverses_movement_id');
            $table->dropUnique(['client_token']);
            $table->dropColumn('client_token');
        });
    }
};
