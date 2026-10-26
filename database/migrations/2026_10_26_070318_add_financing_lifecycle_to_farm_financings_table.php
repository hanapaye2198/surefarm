<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Extend the existing farm financing grant. Existing rows stay
     * stated balances. No repayment history is invented for them.
     */
    public function up(): void
    {
        Schema::table('farm_financings', function (Blueprint $table) {
            $table->string('reference')->nullable()->unique();
            $table->foreignId('farm_production_id')->nullable()->constrained('farm_productions')->nullOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('purpose')->nullable();
            $table->string('currency', 3)->default('PHP');
            $table->string('interest_method')->default('none');
            $table->decimal('interest_rate', 8, 4)->nullable();
            $table->decimal('interest_amount', 12, 2)->default(0);
            $table->decimal('fee_amount', 12, 2)->default(0);
            $table->date('application_date')->nullable();
            $table->string('status')->default('recorded');
            $table->string('balance_source')->default('snapshot');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('rejection_reason')->nullable();
            $table->timestamp('disbursed_at')->nullable();
            $table->string('disbursement_reference')->nullable();
            $table->string('repayment_frequency')->nullable();
            $table->unsignedSmallInteger('installment_count')->nullable();
            $table->date('due_date')->nullable();
            $table->date('maturity_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('defaulted_at')->nullable();
            $table->foreignId('defaulted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('default_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('client_token', 64)->nullable()->unique();
            $table->index(['status', 'due_date']);
        });

        Schema::table('farm_financings', function (Blueprint $table) {
            $table->date('date_granted')->nullable()->change();
            $table->decimal('loan_balance', 12, 2)->nullable()->change();
        });

        Schema::table('farm_financings', function (Blueprint $table) {
            $table->dropForeign(['farm_id']);
            $table->foreign('farm_id')->references('id')->on('farms')->restrictOnDelete();
        });

        DB::table('farm_financings')
            ->whereNull('reference')
            ->orderBy('id')
            ->lazyById()
            ->each(function (object $row): void {
                DB::table('farm_financings')->where('id', $row->id)->update([
                    'reference' => sprintf('FIN-%06d', $row->id),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('farm_financings', function (Blueprint $table) {
            $table->dropForeign(['farm_id']);
            $table->foreign('farm_id')->references('id')->on('farms')->cascadeOnDelete();
            $table->dropForeign(['farm_production_id']);
            $table->dropForeign(['submitted_by']);
            $table->dropForeign(['approved_by']);
            $table->dropForeign(['rejected_by']);
            $table->dropForeign(['defaulted_by']);
            $table->dropForeign(['cancelled_by']);
            $table->dropUnique(['reference']);
            $table->dropUnique(['client_token']);
            $table->dropIndex(['status', 'due_date']);
            $table->dropColumn([
                'reference',
                'farm_production_id',
                'submitted_by',
                'purpose',
                'currency',
                'interest_method',
                'interest_rate',
                'interest_amount',
                'fee_amount',
                'application_date',
                'status',
                'balance_source',
                'reviewed_at',
                'approved_at',
                'approved_by',
                'rejected_at',
                'rejected_by',
                'rejection_reason',
                'disbursed_at',
                'disbursement_reference',
                'repayment_frequency',
                'installment_count',
                'due_date',
                'maturity_date',
                'notes',
                'completed_at',
                'defaulted_at',
                'defaulted_by',
                'default_reason',
                'cancelled_at',
                'cancelled_by',
                'client_token',
            ]);
        });

        Schema::table('farm_financings', function (Blueprint $table) {
            $table->date('date_granted')->nullable(false)->change();
            $table->decimal('loan_balance', 12, 2)->nullable(false)->change();
        });
    }
};
