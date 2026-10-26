<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insurance_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_insurance_id')->constrained('farm_insurances')->restrictOnDelete();
            $table->string('reference')->nullable()->unique();
            $table->date('incident_date');
            $table->date('reported_on');
            $table->string('category');
            $table->text('description');
            $table->decimal('claimed_amount', 12, 2);
            $table->string('currency', 3);
            $table->decimal('approved_amount', 12, 2)->nullable();
            $table->text('assessment')->nullable();
            $table->string('status');
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->string('settlement_reference')->nullable();
            $table->decimal('settlement_amount', 12, 2)->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->foreignId('settled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->string('client_token', 64)->nullable()->unique();
            $table->timestamps();
            $table->index(['farm_insurance_id', 'status']);
            $table->index(['status', 'incident_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurance_claims');
    }
};
