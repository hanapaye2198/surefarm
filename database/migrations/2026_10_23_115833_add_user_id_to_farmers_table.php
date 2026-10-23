<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Link a farmer record to an account only when an administrator
     * records that link. Existing rows stay unlinked. Nothing is inferred
     * from name, phone, or email.
     */
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->index('province');
        });

        Schema::table('farms', function (Blueprint $table) {
            $table->index('province');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('farms', function (Blueprint $table) {
            $table->dropIndex(['province']);
        });

        Schema::table('farmers', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropIndex(['province']);
        });
    }
};
