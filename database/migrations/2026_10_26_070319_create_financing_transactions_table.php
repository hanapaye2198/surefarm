<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only financing ledger. Posted amounts are not rewritten.
     * A correction is a reversal row that points at the original.
     */
    public function up(): void
    {
        Schema::create('financing_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_financing_id')->constrained('farm_financings')->restrictOnDelete();
            $table->string('reference')->nullable()->unique();
            $table->string('group_reference', 64)->nullable();
            $table->string('type');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3);
            $table->string('component');
            $table->string('direction');
            $table->date('occurred_on');
            $table->string('payment_method', 40)->nullable();
            $table->string('external_reference', 120)->nullable();
            $table->string('reconciliation_status')->default('recorded');
            $table->timestamp('reconciled_at')->nullable();
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reverses_transaction_id')->nullable()->constrained('financing_transactions')->restrictOnDelete();
            $table->string('idempotency_key', 64)->nullable()->unique();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['farm_financing_id', 'occurred_on']);
            $table->index('group_reference');
            $table->index(['type', 'occurred_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financing_transactions');
    }
};
