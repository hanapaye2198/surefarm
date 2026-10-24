<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table): void {
            $table->string('suffix', 24)->nullable()->after('last_name');
            $table->string('sitio_purok_code', 3)->nullable()->after('purok_sitio');
            $table->string('barangay_code', 3)->nullable()->after('sitio_purok_code');
            $table->string('lgu_code', 3)->nullable()->after('barangay_code');
            $table->string('security_control_code', 3)->nullable()->after('lgu_code');
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table): void {
            $table->dropColumn([
                'suffix',
                'sitio_purok_code',
                'barangay_code',
                'lgu_code',
                'security_control_code',
            ]);
        });
    }
};
