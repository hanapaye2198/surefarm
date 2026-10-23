<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add suspension and stop new rows from defaulting to administrator.
     * Existing role values are left unchanged.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('suspended_at')->nullable()->after('role');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('farmer')->change();
        });
    }

    /**
     * Reverse the migrations.
     *
     * Restores the previous column default. Do not use this rollback on a
     * production database that already relies on least-privilege accounts.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('admin')->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('suspended_at');
        });
    }
};
