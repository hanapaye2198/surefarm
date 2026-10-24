<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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
        if (! Schema::hasColumn('farmers', 'user_id')) {
            Schema::table('farmers', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            });
        }

        Schema::table('farmers', function (Blueprint $table) {
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
            $table->dropIndex(['province']);
        });

        $mobileLinkMigration = '2026_10_11_090000_add_mobile_links_to_farmers_and_farms';
        $earlierOwnsUserId = Schema::hasTable('migrations')
            && DB::table('migrations')->where('migration', $mobileLinkMigration)->exists();

        if (! $earlierOwnsUserId && Schema::hasColumn('farmers', 'user_id')) {
            Schema::table('farmers', function (Blueprint $table) {
                $table->dropUnique(['user_id']);
                $table->dropConstrainedForeignId('user_id');
            });
        }
    }
};
