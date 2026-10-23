<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('traceability_lots', function (Blueprint $table) {
            $table->string('public_token', 40)->nullable()->unique()->after('lot_code');
        });

        DB::table('traceability_lots')
            ->whereNull('public_token')
            ->orderBy('id')
            ->chunkById(100, function ($lots): void {
                foreach ($lots as $lot) {
                    DB::table('traceability_lots')->where('id', $lot->id)->update([
                        'public_token' => Str::random(40),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('traceability_lots', function (Blueprint $table) {
            $table->dropUnique(['public_token']);
            $table->dropColumn('public_token');
        });
    }
};
