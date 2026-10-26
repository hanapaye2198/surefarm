<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insurance_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_insurance_id')->nullable()->constrained('farm_insurances')->restrictOnDelete();
            $table->foreignId('insurance_claim_id')->nullable()->constrained('insurance_claims')->restrictOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->index(['farm_insurance_id', 'insurance_claim_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurance_documents');
    }
};
