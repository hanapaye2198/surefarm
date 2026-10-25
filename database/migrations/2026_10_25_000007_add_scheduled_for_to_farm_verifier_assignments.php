<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farm_verifier_assignments', function (Blueprint $table) {
            $table->date('scheduled_for')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('farm_verifier_assignments', function (Blueprint $table) {
            $table->dropIndex(['scheduled_for']);
            $table->dropColumn('scheduled_for');
        });
    }
};
