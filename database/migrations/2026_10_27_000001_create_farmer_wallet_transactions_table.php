<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farmer_wallet_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('farmer_id')->constrained()->cascadeOnDelete();
            $table->string('direction', 10);
            $table->string('status', 16)->default('pending');
            $table->unsignedBigInteger('amount_minor');
            $table->char('currency', 3)->default('PHP');
            $table->string('description');
            $table->string('reference')->unique();
            $table->string('provider', 32)->nullable();
            $table->string('provider_reference')->nullable()->unique();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();

            $table->index(['farmer_id', 'status', 'direction']);
            $table->index(['farmer_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_wallet_transactions');
    }
};
