<?php

namespace Database\Seeders;

use App\Actions\CreateTraceabilityLot;
use App\Actions\ProcessCoffeeInventory;
use App\Actions\ReceiveHarvestIntoInventory;
use App\ActivityStatus;
use App\BankAccountStatus;
use App\CooperativeStatus;
use App\CropType;
use App\FarmDevelopmentStage;
use App\FarmerStatus;
use App\FarmStatus;
use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\FinancingType;
use App\HarvestStatus;
use App\Models\ActivityType;
use App\Models\Cooperative;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\FarmBoundary;
use App\Models\FarmBoundaryUpdateRequest;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmHarvest;
use App\Models\FarmInsurance;
use App\Models\FarmProduction;
use App\Models\FarmVerification;
use App\Models\FarmVerifierAssignment;
use App\Models\Inventory;
use App\Models\InventoryProcessingStage;
use App\Models\TraceabilityLot;
use App\Models\User;
use App\ProductionStatus;
use App\PropertyOwnership;
use App\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    /**
     * Seed a Bukidnon and Davao walkthrough. Running it again updates the
     * same records. Demo logins use the password "password!".
     *
     * operations@surefarm.io — operations
     * verifier@surefarm.io — field verifier
     * juan.delacruz@surefarm.io — farmer, linked to SF-999-000-000-001
     */
    public function run(): void
    {
        $this->call([
            ActivityTypeSeeder::class,
            InventoryProcessingStageSeeder::class,
        ]);

        $operations = $this->user('operations@surefarm.io', 'SureFarm Operations', UserRole::Operations);
        $verifier = $this->user('verifier@surefarm.io', 'Elena Vasquez', UserRole::FieldVerifier);
        $farmerUser = $this->user('juan.delacruz@surefarm.io', 'Juan dela Cruz', UserRole::Farmer);

        $mountApo = $this->cooperative('DEMO-MAC', 'Mount Apo Coffee Growers Cooperative');
        $kapalong = $this->cooperative('DEMO-KAP', 'Kapalong Highland Farmers Association');

        $juan = $this->farmer($mountApo, $farmerUser, [
            'farmer_id' => 'SF-999-000-000-001',
            'first_name' => 'Juan',
            'middle_name' => 'Santos',
            'last_name' => 'dela Cruz',
            'date_of_birth' => '1984-03-12',
            'government_id' => 'DEMO-PSN-1001',
            'purok_sitio' => 'Sitio Kalasungay',
            'barangay' => 'Kalasungay',
            'municipality' => 'Malaybalay',
            'province' => 'Bukidnon',
            'mobile_number' => '09171234001',
            'email' => 'juan.delacruz@surefarm.io',
        ]);
        $juan->spouse()->updateOrCreate([], [
            'first_name' => 'Maria',
            'middle_name' => 'Elena',
            'last_name' => 'Cruz',
        ]);
        $juan->bankAccount()->updateOrCreate([], [
            'bank_name' => 'Land Bank of the Philippines',
            'account_number' => '1234567890',
            'account_name' => 'Juan Santos dela Cruz',
            'status' => BankAccountStatus::Verified,
        ]);

        $maria = $this->farmer($mountApo, null, [
            'farmer_id' => 'SF-999-000-000-002',
            'first_name' => 'Maria',
            'middle_name' => 'Luz',
            'last_name' => 'Santos',
            'date_of_birth' => '1979-08-04',
            'government_id' => 'DEMO-PSN-1002',
            'purok_sitio' => 'Purok 3',
            'barangay' => 'Lilingayon',
            'municipality' => 'Valencia',
            'province' => 'Bukidnon',
            'mobile_number' => '09181234002',
            'email' => 'maria.santos@example.com',
        ]);
        $maria->spouse()->updateOrCreate([], [
            'first_name' => 'Roberto',
            'middle_name' => null,
            'last_name' => 'Santos',
        ]);
        $maria->bankAccount()->updateOrCreate([], [
            'bank_name' => 'Development Bank of the Philippines',
            'account_number' => '2093847561',
            'account_name' => 'Maria Luz Santos',
            'status' => BankAccountStatus::Unverified,
        ]);

        $pedro = $this->farmer($kapalong, null, [
            'farmer_id' => 'SF-999-000-000-003',
            'first_name' => 'Pedro',
            'middle_name' => 'Antonio',
            'last_name' => 'Ramos',
            'date_of_birth' => '1991-01-19',
            'government_id' => 'DEMO-PSN-1003',
            'purok_sitio' => 'Purok Riverside',
            'barangay' => 'Marilog',
            'municipality' => 'Davao City',
            'province' => 'Davao del Sur',
            'mobile_number' => '09191234003',
            'email' => null,
        ]);

        $ana = $this->farmer($mountApo, null, [
            'farmer_id' => 'SF-999-000-000-004',
            'first_name' => 'Ana',
            'middle_name' => 'Grace',
            'last_name' => 'Bautista',
            'date_of_birth' => '1988-11-02',
            'government_id' => 'DEMO-PSN-1004',
            'purok_sitio' => 'Sitio Casisang',
            'barangay' => 'Casisang',
            'municipality' => 'Malaybalay',
            'province' => 'Bukidnon',
            'mobile_number' => '09201234004',
            'email' => 'ana.bautista@example.com',
        ]);

        $rosa = $this->farmer($kapalong, null, [
            'farmer_id' => 'SF-999-000-000-005',
            'first_name' => 'Rosa',
            'middle_name' => 'Elena',
            'last_name' => 'Mendoza',
            'date_of_birth' => '1972-06-28',
            'government_id' => 'DEMO-PSN-1005',
            'purok_sitio' => 'Purok 1',
            'barangay' => 'Kinuskusan',
            'municipality' => 'Bansalan',
            'province' => 'Davao del Sur',
            'mobile_number' => '09211234005',
            'email' => null,
        ]);

        $carlo = $this->farmer($kapalong, null, [
            'farmer_id' => 'SF-999-000-000-006',
            'first_name' => 'Carlo',
            'middle_name' => 'Jose',
            'last_name' => 'Villanueva',
            'date_of_birth' => '1995-09-15',
            'government_id' => 'DEMO-PSN-1006',
            'purok_sitio' => 'Sitio Bagontaas',
            'barangay' => 'Bagontaas',
            'municipality' => 'Valencia',
            'province' => 'Bukidnon',
            'mobile_number' => '09221234006',
            'email' => 'carlo.villanueva@example.com',
        ]);

        $kalasungay = $this->farm($juan, [
            'farm_id' => 'FARM-900001',
            'farm_name' => 'Kalasungay Coffee',
            'crop_type' => CropType::Coffee,
            'declared_area_hectares' => 2.50,
            'verified_area_hectares' => 2.46,
            'purok_sitio' => 'Sitio Kalasungay',
            'barangay' => 'Kalasungay',
            'municipality' => 'Malaybalay',
            'province' => 'Bukidnon',
            'latitude' => 8.1575000,
            'longitude' => 125.1278000,
            'verification_status' => FarmVerificationStatus::Verified,
            'status' => FarmStatus::Harvesting,
            'current_stage' => FarmDevelopmentStage::Harvest,
            'number_of_hills' => 3200,
            'data_validated' => true,
            'property_ownership' => PropertyOwnership::Owned,
            'contracted_value_estimated' => 185000,
            'input_support_amount' => 24000,
            'financing_support_amount' => 60000,
            'notes' => 'Demo farm with a completed harvest, processing chain, and traceability lot.',
        ]);

        $this->farm($juan, [
            'farm_id' => 'FARM-900002',
            'farm_name' => 'Malipayon Cacao',
            'crop_type' => CropType::Cacao,
            'declared_area_hectares' => 1.20,
            'verified_area_hectares' => null,
            'purok_sitio' => 'Purok Malipayon',
            'barangay' => 'Kalasungay',
            'municipality' => 'Malaybalay',
            'province' => 'Bukidnon',
            'latitude' => 8.1612000,
            'longitude' => 125.1314000,
            'verification_status' => FarmVerificationStatus::Pending,
            'status' => FarmStatus::UnderDevelopment,
            'current_stage' => FarmDevelopmentStage::LandPreparation,
            'number_of_hills' => 800,
            'data_validated' => false,
            'property_ownership' => PropertyOwnership::Leased,
            'contracted_value_estimated' => null,
            'input_support_amount' => null,
            'financing_support_amount' => null,
            'notes' => 'Newly registered cacao lot waiting for field verification.',
        ]);

        $santos = $this->farm($maria, [
            'farm_id' => 'FARM-900003',
            'farm_name' => 'Lilingayon Arabica',
            'crop_type' => CropType::Coffee,
            'declared_area_hectares' => 3.10,
            'verified_area_hectares' => 3.04,
            'purok_sitio' => 'Purok 3',
            'barangay' => 'Lilingayon',
            'municipality' => 'Valencia',
            'province' => 'Bukidnon',
            'latitude' => 7.9064000,
            'longitude' => 125.0945000,
            'verification_status' => FarmVerificationStatus::Verified,
            'status' => FarmStatus::Active,
            'current_stage' => FarmDevelopmentStage::Planting,
            'number_of_hills' => 4100,
            'data_validated' => true,
            'property_ownership' => PropertyOwnership::Owned,
            'contracted_value_estimated' => 240000,
            'input_support_amount' => 36000,
            'financing_support_amount' => 90000,
            'notes' => 'Verified arabica farm with financing and a harvest still planned.',
        ]);

        $this->farm($pedro, [
            'farm_id' => 'FARM-900004',
            'farm_name' => 'Riverside Corn',
            'crop_type' => CropType::Corn,
            'declared_area_hectares' => 1.75,
            'verified_area_hectares' => null,
            'purok_sitio' => 'Purok Riverside',
            'barangay' => 'Marilog',
            'municipality' => 'Davao City',
            'province' => 'Davao del Sur',
            'latitude' => 7.4700000,
            'longitude' => 125.2400000,
            'verification_status' => FarmVerificationStatus::Pending,
            'status' => FarmStatus::Active,
            'current_stage' => FarmDevelopmentStage::Planting,
            'number_of_hills' => null,
            'data_validated' => null,
            'property_ownership' => PropertyOwnership::Owned,
            'contracted_value_estimated' => null,
            'input_support_amount' => null,
            'financing_support_amount' => null,
            'notes' => 'Corn farm registered without a boundary.',
        ]);

        $bautista = $this->farm($ana, [
            'farm_id' => 'FARM-900005',
            'assigned_verifier_id' => $verifier->id,
            'assigned_at' => '2026-10-10 08:30:00',
            'farm_name' => 'Casisang Coffee',
            'crop_type' => CropType::Coffee,
            'declared_area_hectares' => 2.00,
            'verified_area_hectares' => null,
            'purok_sitio' => 'Sitio Casisang',
            'barangay' => 'Casisang',
            'municipality' => 'Malaybalay',
            'province' => 'Bukidnon',
            'latitude' => 8.1458000,
            'longitude' => 125.1196000,
            'verification_status' => FarmVerificationStatus::InProgress,
            'status' => FarmStatus::Active,
            'current_stage' => FarmDevelopmentStage::Planting,
            'number_of_hills' => 2500,
            'data_validated' => true,
            'property_ownership' => PropertyOwnership::IpLand,
            'contracted_value_estimated' => 120000,
            'input_support_amount' => 15000,
            'financing_support_amount' => null,
            'notes' => 'Assigned to the demo field verifier. The inspection is still open.',
        ]);

        $mendoza = $this->farm($rosa, [
            'farm_id' => 'FARM-900006',
            'farm_name' => 'Kinuskusan Coffee',
            'crop_type' => CropType::Coffee,
            'declared_area_hectares' => 4.00,
            'verified_area_hectares' => null,
            'purok_sitio' => 'Purok 1',
            'barangay' => 'Kinuskusan',
            'municipality' => 'Bansalan',
            'province' => 'Davao del Sur',
            'latitude' => 6.7864000,
            'longitude' => 125.2147000,
            'verification_status' => FarmVerificationStatus::Failed,
            'status' => FarmStatus::Active,
            'current_stage' => FarmDevelopmentStage::Harvest,
            'number_of_hills' => 1800,
            'data_validated' => true,
            'property_ownership' => PropertyOwnership::Leased,
            'contracted_value_estimated' => 96000,
            'input_support_amount' => null,
            'financing_support_amount' => null,
            'notes' => 'Declared area is much larger than the mapped boundary.',
        ]);

        $villanueva = $this->farm($carlo, [
            'farm_id' => 'FARM-900007',
            'farm_name' => 'Bagontaas Coffee',
            'crop_type' => CropType::Coffee,
            'declared_area_hectares' => 1.80,
            'verified_area_hectares' => null,
            'purok_sitio' => 'Sitio Bagontaas',
            'barangay' => 'Bagontaas',
            'municipality' => 'Valencia',
            'province' => 'Bukidnon',
            'latitude' => 7.9241000,
            'longitude' => 125.0712000,
            'verification_status' => FarmVerificationStatus::NeedsReview,
            'status' => FarmStatus::Active,
            'current_stage' => FarmDevelopmentStage::Planting,
            'number_of_hills' => 2100,
            'data_validated' => true,
            'property_ownership' => PropertyOwnership::Reserve,
            'contracted_value_estimated' => 110000,
            'input_support_amount' => 12000,
            'financing_support_amount' => 30000,
            'notes' => 'Boundary is close to the declaration, but the east line still needs review.',
        ]);

        $this->boundary($kalasungay, $verifier, 2.46, '2026-01-18 09:00:00');
        $this->boundary($santos, $verifier, 3.04, '2026-02-04 10:15:00');
        $this->boundary($bautista, $verifier, 1.96, '2026-10-12 14:00:00');
        $this->boundary($mendoza, $verifier, 2.10, '2026-03-22 11:40:00');
        $this->boundary($villanueva, $verifier, 1.72, '2026-04-08 08:20:00');

        $this->verification($kalasungay, $verifier, [
            'verification_reference' => 'VER-900001',
            'previous_status' => FarmVerificationStatus::InProgress,
            'measured_area_hectares' => 2.46,
            'result' => FarmVerificationResult::Verified,
            'remarks' => 'Boundary matches the planted coffee area.',
            'verified_at' => '2026-01-18 11:00:00',
        ]);
        $this->verification($santos, $verifier, [
            'verification_reference' => 'VER-900003',
            'previous_status' => FarmVerificationStatus::InProgress,
            'measured_area_hectares' => 3.04,
            'result' => FarmVerificationResult::Verified,
            'remarks' => 'Arabica block confirmed on site.',
            'verified_at' => '2026-02-04 15:30:00',
        ]);
        $this->verification($bautista, $verifier, [
            'verification_reference' => 'VER-900005',
            'previous_status' => FarmVerificationStatus::Pending,
            'measured_area_hectares' => null,
            'result' => null,
            'remarks' => null,
            'verified_at' => null,
            'mobile_workflow' => true,
        ]);
        $this->verification($mendoza, $verifier, [
            'verification_reference' => 'VER-900006',
            'previous_status' => FarmVerificationStatus::InProgress,
            'measured_area_hectares' => 2.10,
            'result' => FarmVerificationResult::Failed,
            'remarks' => 'Mapped area is well below the declared 4.00 hectares.',
            'verified_at' => '2026-03-22 16:05:00',
        ]);
        $this->verification($villanueva, $verifier, [
            'verification_reference' => 'VER-900007',
            'previous_status' => FarmVerificationStatus::InProgress,
            'measured_area_hectares' => 1.72,
            'result' => FarmVerificationResult::NeedsReview,
            'remarks' => 'East line overlaps a neighbor. Recapture that side before verifying.',
            'verified_at' => '2026-04-08 13:10:00',
        ]);

        FarmBoundaryUpdateRequest::query()->firstOrCreate(
            [
                'farm_id' => $kalasungay->id,
                'reason' => 'The north corner was replanted. Please recapture that side of the boundary.',
            ],
            [
                'farmer_id' => $juan->id,
                'requested_by' => $farmerUser->id,
                'status' => 'pending',
            ],
        );

        $this->activities($kalasungay, $operations, [
            ['land_preparation', '2025-11-03', ActivityStatus::Completed, 'Cleared and marked the coffee rows.', 'Juan dela Cruz', 2.50, 'ha', 8500],
            ['planting', '2025-11-20', ActivityStatus::Completed, 'Planted Robusta seedlings.', 'Kalasungay crew', 3200, 'hills', 18400],
            ['fertilizer_application', '2026-01-09', ActivityStatus::Completed, 'Applied organic fertilizer after establishment.', 'Juan dela Cruz', 400, 'kg', 6200],
            ['pest_control', '2026-01-27', ActivityStatus::Completed, 'Sprayed for coffee berry borer.', 'Elena Vasquez', 12, 'L', 2100],
            ['harvest', '2026-02-12', ActivityStatus::Completed, 'First pick of ripe cherry.', 'Kalasungay crew', 700, 'kg', 9800],
            ['post_harvest', '2026-02-14', ActivityStatus::Completed, 'Delivered cherry to the Malaybalay buying station.', 'Juan dela Cruz', 700, 'kg', 1500],
        ]);
        $this->activities($santos, $operations, [
            ['land_preparation', '2026-06-02', ActivityStatus::Completed, 'Prepared the arabica block for the 2026 season.', 'Maria Santos', 3.10, 'ha', 11000],
            ['planting', '2026-06-18', ActivityStatus::InProgress, 'Replanting gaps in the older rows.', 'Lilingayon crew', 600, 'hills', 4500],
        ]);
        $this->activity($this->farmByCode('FARM-900002'), $operations, 'land_preparation', '2026-09-01', ActivityStatus::Planned, 'Schedule clearing before the cacao seedlings arrive.', null, null, null, null);

        $kalasungayProduction = $this->production($kalasungay, '2026', 1500, ProductionStatus::Active, 'Main Robusta crop for the demo lot.');
        $this->production($santos, '2026', 900, ProductionStatus::Planned, 'First expected pick is still ahead.');

        $firstPick = $this->harvest($kalasungay, $kalasungayProduction, $operations, [
            'notes' => 'demo:kalasungay-first-pick',
            'harvest_date' => '2026-02-12',
            'quantity' => 700,
            'quality_grade' => 'Grade A',
            'status' => HarvestStatus::Completed,
        ]);
        $this->harvest($kalasungay, $kalasungayProduction, $operations, [
            'notes' => 'demo:kalasungay-second-pick',
            'harvest_date' => '2026-03-02',
            'quantity' => 500,
            'quality_grade' => 'Grade B',
            'status' => HarvestStatus::Completed,
        ]);
        $this->harvest($santos, $this->productionRecord($santos, '2026'), $operations, [
            'notes' => 'demo:lilingayon-planned-pick',
            'harvest_date' => '2026-11-20',
            'quantity' => 900,
            'quality_grade' => null,
            'status' => HarvestStatus::Planned,
        ]);

        FarmInsurance::query()->updateOrCreate(
            ['farm_id' => $kalasungay->id],
            ['covered' => true, 'amount' => 150000, 'term_months' => 12],
        );
        FarmInsurance::query()->updateOrCreate(
            ['farm_id' => $santos->id],
            ['covered' => true, 'amount' => 200000, 'term_months' => 12],
        );
        FarmInsurance::query()->updateOrCreate(
            ['farm_id' => $mendoza->id],
            ['covered' => false, 'amount' => null, 'term_months' => null],
        );

        FarmFinancing::query()->updateOrCreate(
            ['farm_id' => $kalasungay->id, 'date_granted' => '2025-11-15'],
            ['amount' => 60000, 'loan_balance' => 42500, 'financing_type' => FinancingType::Mm],
        );
        FarmFinancing::query()->updateOrCreate(
            ['farm_id' => $santos->id, 'date_granted' => '2026-05-20'],
            ['amount' => 90000, 'loan_balance' => 90000, 'financing_type' => FinancingType::Govt],
        );

        $this->coffeeChain($firstPick, $operations);
    }

    private function user(string $email, string $name, UserRole $role): User
    {
        $user = User::query()->firstOrNew(['email' => $email]);

        $user->forceFill([
            'name' => $name,
            'role' => $role,
            'password' => Hash::make('password!'),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        return $user;
    }

    private function cooperative(string $code, string $name): Cooperative
    {
        return Cooperative::query()->updateOrCreate(
            ['code' => $code],
            ['name' => $name, 'status' => CooperativeStatus::Active],
        );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function farmer(Cooperative $cooperative, ?User $user, array $attributes): Farmer
    {
        return Farmer::query()->updateOrCreate(
            ['farmer_id' => $attributes['farmer_id']],
            [
                ...$attributes,
                'cooperative_id' => $cooperative->id,
                'user_id' => $user?->id,
                'status' => FarmerStatus::Active,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function farm(Farmer $farmer, array $attributes): Farm
    {
        $verifierId = $attributes['assigned_verifier_id'] ?? null;
        $assignedAt = $attributes['assigned_at'] ?? now();
        unset($attributes['assigned_verifier_id'], $attributes['assigned_at']);

        $farm = Farm::query()->updateOrCreate(
            ['farm_id' => $attributes['farm_id']],
            [
                ...$attributes,
                'farmer_id' => $farmer->id,
            ],
        );

        if ($verifierId !== null) {
            FarmVerifierAssignment::query()->updateOrCreate(
                ['user_id' => $verifierId, 'farm_id' => $farm->id],
                [
                    'assigned_by' => null,
                    'assigned_at' => $assignedAt,
                    'revoked_at' => null,
                ],
            );
        }

        return $farm;
    }

    private function farmByCode(string $farmId): Farm
    {
        return Farm::query()->where('farm_id', $farmId)->firstOrFail();
    }

    private function boundary(Farm $farm, User $verifier, float $measuredHectares, string $capturedAt): void
    {
        $latitude = (float) $farm->latitude;
        $longitude = (float) $farm->longitude;

        FarmBoundary::query()->updateOrCreate(
            ['farm_id' => $farm->id],
            [
                'boundary_geojson' => $this->polygon($latitude, $longitude),
                'gps_point_accuracies' => [2.4, 1.8, 2.1, 1.9],
                'gps_measured_area_hectares' => $measuredHectares,
                'created_by' => $verifier->id,
                'updated_by' => $verifier->id,
                'captured_at' => $capturedAt,
            ],
        );
    }

    /**
     * @param  array{
     *     verification_reference: string,
     *     previous_status: FarmVerificationStatus,
     *     measured_area_hectares: float|null,
     *     result: FarmVerificationResult|null,
     *     remarks: string|null,
     *     verified_at: string|null,
     *     mobile_workflow?: bool
     * }  $attributes
     */
    private function verification(Farm $farm, User $verifier, array $attributes): void
    {
        $measured = $attributes['measured_area_hectares'];
        $declared = round((float) $farm->declared_area_hectares, 2);
        $difference = $measured === null ? null : round(abs($declared - $measured), 2);

        FarmVerification::query()->updateOrCreate(
            ['verification_reference' => $attributes['verification_reference']],
            [
                'farm_id' => $farm->id,
                'previous_status' => $attributes['previous_status'],
                'declared_area_hectares' => $declared,
                'measured_area_hectares' => $measured,
                'difference_hectares' => $difference,
                'variance_percentage' => $measured === null ? null : round(($difference / $declared) * 100, 2),
                'result' => $attributes['result'],
                'remarks' => $attributes['remarks'],
                'mobile_workflow' => $attributes['mobile_workflow'] ?? false,
                'verified_by' => $attributes['result'] === null ? null : $verifier->id,
                'verified_at' => $attributes['verified_at'],
            ],
        );
    }

    /**
     * @param  list<array{0: string, 1: string, 2: ActivityStatus, 3: string, 4: string|null, 5: float|null, 6: string|null, 7: float|null}>  $rows
     */
    private function activities(Farm $farm, User $creator, array $rows): void
    {
        foreach ($rows as [$code, $date, $status, $description, $performedBy, $quantity, $unit, $cost]) {
            $this->activity($farm, $creator, $code, $date, $status, $description, $performedBy, $quantity, $unit, $cost);
        }
    }

    private function activity(
        Farm $farm,
        User $creator,
        string $code,
        string $date,
        ActivityStatus $status,
        string $description,
        ?string $performedBy,
        ?float $quantity,
        ?string $unit,
        ?float $cost,
    ): void {
        $type = ActivityType::query()->where('code', $code)->firstOrFail();

        FarmActivity::query()->updateOrCreate(
            [
                'farm_id' => $farm->id,
                'activity_type_id' => $type->id,
                'activity_date' => $date,
            ],
            [
                'crop_type' => $farm->crop_type,
                'status' => $status,
                'description' => $description,
                'performed_by' => $performedBy,
                'quantity' => $quantity,
                'unit' => $unit,
                'cost_amount' => $cost,
                'created_by' => $creator->id,
            ],
        );
    }

    private function production(Farm $farm, string $period, float $expectedQuantity, ProductionStatus $status, string $notes): FarmProduction
    {
        return FarmProduction::query()->updateOrCreate(
            ['farm_id' => $farm->id, 'production_period' => $period],
            [
                'crop_type' => $farm->crop_type,
                'expected_quantity' => $expectedQuantity,
                'unit' => 'kg',
                'notes' => $notes,
                'status' => $status,
            ],
        );
    }

    private function productionRecord(Farm $farm, string $period): FarmProduction
    {
        return FarmProduction::query()
            ->where('farm_id', $farm->id)
            ->where('production_period', $period)
            ->firstOrFail();
    }

    /**
     * @param  array{notes: string, harvest_date: string, quantity: float, quality_grade: string|null, status: HarvestStatus}  $attributes
     */
    private function harvest(Farm $farm, FarmProduction $production, User $creator, array $attributes): FarmHarvest
    {
        return FarmHarvest::query()->updateOrCreate(
            ['farm_id' => $farm->id, 'notes' => $attributes['notes']],
            [
                'crop_type' => $farm->crop_type,
                'production_id' => $production->id,
                'harvest_date' => $attributes['harvest_date'],
                'quantity' => $attributes['quantity'],
                'unit' => 'kg',
                'quality_grade' => $attributes['quality_grade'],
                'status' => $attributes['status'],
                'created_by' => $creator->id,
            ],
        );
    }

    /**
     * Receive the first Kalasungay pick and walk it to a green-bean lot.
     * Cherry to green is about 18 percent: 700 kg becomes 126 kg, and 40 kg
     * is allocated to the public demo lot SF-DEMO-000001.
     */
    private function coffeeChain(FarmHarvest $harvest, User $creator): void
    {
        if (TraceabilityLot::query()->where('lot_code', 'SF-DEMO-000001')->exists()) {
            return;
        }

        if (Inventory::query()->where('harvest_id', $harvest->id)->exists()) {
            return;
        }

        $stages = InventoryProcessingStage::query()
            ->whereIn('code', ['COFFEE_CHERRY', 'DRIED_COFFEE', 'PARCHMENT', 'GREEN_BEANS'])
            ->get()
            ->keyBy('code');

        DB::transaction(function () use ($harvest, $creator, $stages): void {
            $cherry = app(ReceiveHarvestIntoInventory::class)->handle($harvest, [
                'quantity' => 700,
                'unit' => 'kg',
                'processing_stage_id' => $stages['COFFEE_CHERRY']->id,
                'location' => 'Malaybalay buying station',
                'received_date' => '2026-02-14',
                'notes' => 'Demo receipt from the first Kalasungay pick.',
            ], $creator->id);

            $dried = app(ProcessCoffeeInventory::class)->handle([
                'inventory_id' => $cherry->id,
                'input_quantity' => 700,
                'output_quantity' => 280,
                'destination_stage_id' => $stages['DRIED_COFFEE']->id,
                'processing_date' => '2026-02-28',
                'notes' => 'Sun-dried at the Malaybalay yard.',
            ], $creator->id);

            $parchment = app(ProcessCoffeeInventory::class)->handle([
                'inventory_id' => $dried->id,
                'input_quantity' => 280,
                'output_quantity' => 168,
                'destination_stage_id' => $stages['PARCHMENT']->id,
                'processing_date' => '2026-03-08',
                'notes' => 'Hulled to parchment.',
            ], $creator->id);

            $green = app(ProcessCoffeeInventory::class)->handle([
                'inventory_id' => $parchment->id,
                'input_quantity' => 168,
                'output_quantity' => 126,
                'destination_stage_id' => $stages['GREEN_BEANS']->id,
                'processing_date' => '2026-03-15',
                'notes' => 'Milled to green beans.',
            ], $creator->id);

            $lot = app(CreateTraceabilityLot::class)->handle([
                'inventory_id' => $green->id,
                'quantity' => 40,
                'unit' => 'kg',
                'notes' => 'Demo green-bean lot from Kalasungay Coffee.',
            ], $creator->id);

            $lot->update(['lot_code' => 'SF-DEMO-000001']);
        });
    }

    /**
     * @return array{type: string, coordinates: array<int, array<int, array<int, float>>>}
     */
    private function polygon(float $latitude, float $longitude): array
    {
        $delta = 0.0015;

        return [
            'type' => 'Polygon',
            'coordinates' => [[
                [$longitude, $latitude],
                [$longitude + $delta, $latitude],
                [$longitude + $delta, $latitude + $delta],
                [$longitude, $latitude + $delta],
                [$longitude, $latitude],
            ]],
        ];
    }
}
