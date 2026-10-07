<?php

namespace App\Actions;

use App\BankAccountStatus;
use App\Contracts\FarmerIdGenerator;
use App\FarmerStatus;
use App\Models\Farmer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class RegisterFarmer
{
    public function __construct(private FarmerIdGenerator $farmerIds) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?UploadedFile $photo): Farmer
    {
        $storedPath = null;

        try {
            return DB::transaction(function () use ($data, $photo, &$storedPath): Farmer {
                if ($photo !== null) {
                    $storedPath = $photo->store('farmers/photos');

                    if ($storedPath === false) {
                        throw new \RuntimeException('Farmer photo could not be stored.');
                    }
                }

                $farmer = Farmer::query()->create([
                    'farmer_id' => 'TMP-'.Str::uuid()->toString(),
                    'first_name' => $data['first_name'],
                    'middle_name' => $data['middle_name'] ?? null,
                    'last_name' => $data['last_name'],
                    'date_of_birth' => $data['date_of_birth'] ?? null,
                    'government_id' => $data['government_id'] ?? null,
                    'photo_path' => $storedPath,
                    'purok_sitio' => $data['purok_sitio'],
                    'barangay' => $data['barangay'],
                    'municipality' => $data['municipality'],
                    'province' => $data['province'],
                    'mobile_number' => $data['mobile_number'],
                    'email' => $data['email'] ?? null,
                    'cooperative_id' => $data['cooperative_id'] ?? null,
                    'status' => FarmerStatus::Active,
                ]);

                $farmer->update([
                    'farmer_id' => $this->farmerIds->fromSequence($farmer->id),
                ]);

                $hasSpouse = filter_var($data['has_spouse'] ?? false, FILTER_VALIDATE_BOOLEAN);

                if ($hasSpouse) {
                    $farmer->spouse()->create([
                        'first_name' => $data['spouse_first_name'],
                        'middle_name' => $data['spouse_middle_name'] ?? null,
                        'last_name' => $data['spouse_last_name'],
                    ]);
                }

                $hasBankAccount = filter_var($data['has_bank_account'] ?? false, FILTER_VALIDATE_BOOLEAN);

                if ($hasBankAccount) {
                    $farmer->bankAccount()->create([
                        'bank_name' => $data['bank_name'],
                        'account_number' => $data['account_number'],
                        'account_name' => $data['account_name'],
                        'status' => $data['bank_account_status'] ?? BankAccountStatus::Unverified,
                    ]);
                }

                return $farmer->load(['spouse', 'cooperative', 'bankAccount']);
            });
        } catch (Throwable $exception) {
            if (is_string($storedPath)) {
                Storage::delete($storedPath);
            }

            throw $exception;
        }
    }
}
