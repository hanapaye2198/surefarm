<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Private financing files. Downloads go through an authorized route.
     */
    public function up(): void
    {
        Schema::create('financing_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_financing_id')->constrained('farm_financings')->restrictOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['farm_financing_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financing_documents');
    }
};
