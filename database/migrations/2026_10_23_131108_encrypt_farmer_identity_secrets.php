<?php

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table): void {
            $table->text('government_id')->nullable()->change();
        });

        Schema::table('farmer_bank_accounts', function (Blueprint $table): void {
            $table->text('account_number')->change();
        });

        $this->protect('farmers', 'government_id', true);
        $this->protect('farmer_bank_accounts', 'account_number', false);
    }

    public function down(): void
    {
        $this->reveal('farmers', 'government_id');
        $this->reveal('farmer_bank_accounts', 'account_number');

        Schema::table('farmers', function (Blueprint $table): void {
            $table->string('government_id', 64)->nullable()->change();
        });

        Schema::table('farmer_bank_accounts', function (Blueprint $table): void {
            $table->string('account_number', 32)->change();
        });
    }

    private function protect(string $table, string $column, bool $nullable): void
    {
        DB::table($table)->orderBy('id')->chunkById(100, function ($rows) use ($table, $column, $nullable): void {
            foreach ($rows as $row) {
                $current = $row->{$column};

                if ($current === null || $current === '') {
                    if ($nullable && $current === '') {
                        DB::table($table)->where('id', $row->id)->update([$column => null]);
                    }

                    continue;
                }

                if (! is_string($current)) {
                    continue;
                }

                $sealed = $this->seal($current);

                if ($sealed !== $current) {
                    DB::table($table)->where('id', $row->id)->update([$column => $sealed]);
                }
            }
        });
    }

    private function reveal(string $table, string $column): void
    {
        DB::table($table)->orderBy('id')->chunkById(100, function ($rows) use ($table, $column): void {
            foreach ($rows as $row) {
                $current = $row->{$column};

                if (! is_string($current) || $current === '') {
                    continue;
                }

                try {
                    $plain = Crypt::decrypt($current, false);
                } catch (DecryptException) {
                    continue;
                }

                if (is_string($plain) && $plain !== $current) {
                    DB::table($table)->where('id', $row->id)->update([$column => $plain]);
                }
            }
        });
    }

    private function seal(string $value): string
    {
        try {
            Crypt::decrypt($value, false);

            return $value;
        } catch (DecryptException) {
            return Crypt::encrypt($value, false);
        }
    }
};
