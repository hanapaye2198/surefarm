<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Existing rows stay stated coverage notes. No policy, premium,
     * or claim is invented for them.
     */
    public function up(): void
    {
        Schema::table('farm_insurances', function (Blueprint $table) {
            $table->string('reference')->nullable()->unique();
            $table->foreignId('farm_production_id')->nullable()->constrained('farm_productions')->nullOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('provider')->nullable();
            $table->string('policy_type')->nullable();
            $table->string('currency', 3)->default('PHP');
            $table->decimal('insured_area', 12, 2)->nullable();
            $table->decimal('premium_amount', 12, 2)->default(0);
            $table->date('coverage_start')->nullable();
            $table->date('coverage_end')->nullable();
            $table->text('terms')->nullable();
            $table->text('exclusions')->nullable();
            $table->string('status')->default('recorded');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('rejection_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->text('notes')->nullable();
            $table->string('client_token', 64)->nullable()->unique();
            $table->index(['status', 'coverage_end']);
        });

        Schema::table('farm_insurances', function (Blueprint $table) {
            $table->dropForeign(['farm_id']);
            $table->foreign('farm_id')->references('id')->on('farms')->restrictOnDelete();
        });

        DB::table('farm_insurances')
            ->whereNull('reference')
            ->orderBy('id')
            ->lazyById()
            ->each(function (object $row): void {
                DB::table('farm_insurances')->where('id', $row->id)->update([
                    'reference' => sprintf('INS-%06d', $row->id),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('farm_insurances', function (Blueprint $table) {
            $table->dropForeign(['farm_id']);
            $table->foreign('farm_id')->references('id')->on('farms')->cascadeOnDelete();
            $table->dropForeign(['farm_production_id']);
            $table->dropForeign(['submitted_by']);
            $table->dropForeign(['approved_by']);
            $table->dropForeign(['rejected_by']);
            $table->dropForeign(['cancelled_by']);
            $table->dropUnique(['reference']);
            $table->dropUnique(['client_token']);
            $table->dropIndex(['status', 'coverage_end']);
            $table->dropColumn([
                'reference',
                'farm_production_id',
                'submitted_by',
                'provider',
                'policy_type',
                'currency',
                'insured_area',
                'premium_amount',
                'coverage_start',
                'coverage_end',
                'terms',
                'exclusions',
                'status',
                'reviewed_at',
                'approved_at',
                'approved_by',
                'rejected_at',
                'rejected_by',
                'rejection_reason',
                'cancelled_at',
                'cancelled_by',
                'activated_at',
                'notes',
                'client_token',
            ]);
        });
    }
};
