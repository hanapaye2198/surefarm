<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farmer_wallet_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('farmer_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 24);
            $table->string('status', 16)->default('pending');
            $table->unsignedBigInteger('amount_minor');
            $table->char('currency', 3)->default('PHP');
            $table->string('provider', 80);
            $table->text('account_name')->nullable();
            $table->text('account_reference')->nullable();
            $table->string('description');
            $table->string('reference')->unique();
            $table->text('review_notes')->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('provider_reference')->nullable()->unique();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['farmer_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_wallet_requests');
    }
};
