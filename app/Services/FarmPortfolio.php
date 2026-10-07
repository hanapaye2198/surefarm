<?php

namespace App\Services;

use App\CropType;
use App\FarmDevelopmentStage;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\PropertyOwnership;
use Illuminate\Support\Collection;

class FarmPortfolio
{
    public function __construct(private FarmAreaComparison $areas) {}

    /**
     * Totals are calculated from the farmer's farms. Declared area
     * and verified area stay in separate sums.
     *
     * @param  Collection<int, Farm>  $farms
     * @return array{
     *     registered_farms: int,
     *     declared_area_hectares: float,
     *     total_verified_hectares: float,
     *     verified_farms: int,
     *     pending_verification: int,
     *     active_crops: int
     * }
     */
    public function summary(Collection $farms): array
    {
        $verifiedFarms = $farms->where('verification_status', FarmVerificationStatus::Verified);

        return [
            'registered_farms' => $farms->count(),
            'declared_area_hectares' => round((float) $farms->sum(
                fn (Farm $farm): float => (float) $farm->declared_area_hectares,
            ), 2),
            'total_verified_hectares' => round((float) $verifiedFarms->sum(
                fn (Farm $farm): float => (float) ($farm->verified_area_hectares ?? 0),
            ), 2),
            'verified_farms' => $verifiedFarms->count(),
            'pending_verification' => $farms
                ->where('verification_status', FarmVerificationStatus::Pending)
                ->count(),
            'active_crops' => $farms
                ->where('status', FarmStatus::Active)
                ->map(fn (Farm $farm): string => $farm->crop_type->value)
                ->unique()
                ->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function card(Farm $farm, int $number, string $ownerName): array
    {
        $comparison = $this->areas->calculate(
            $farm->declared_area_hectares,
            $farm->boundary?->gps_measured_area_hectares,
        );

        return [
            'id' => $farm->id,
            'number' => $number,
            'number_label' => 'Farm '.str_pad((string) $number, 2, '0', STR_PAD_LEFT),
            'farm_id' => $farm->farm_id,
            'farm_name' => $farm->displayName(),
            'owner_name' => $ownerName,
            'crop' => $farm->crop_type->value,
            'crop_label' => $farm->crop_type->label(),
            'status' => $farm->status->value,
            'status_label' => $farm->status->label(),
            'verification_status' => $farm->verification_status->value,
            'current_stage' => $farm->current_stage?->value,
            'current_stage_label' => $farm->current_stage?->label() ?? 'Not provided',
            'property_ownership' => $farm->property_ownership?->value,
            'property_ownership_label' => $farm->property_ownership?->label() ?? 'Not provided',
            'location' => $farm->locationLabel() !== '' ? $farm->locationLabel() : 'Not provided',
            'address' => $farm->addressLabel() !== '' ? $farm->addressLabel() : 'Not provided',
            'declared_area_hectares' => (float) $farm->declared_area_hectares,
            'declared_area' => $this->areas->hectares((float) $farm->declared_area_hectares),
            'measured_area' => $comparison === null
                ? 'Not yet measured'
                : $this->areas->hectares($comparison['measured']),
            'verified_area' => $farm->verified_area_hectares === null
                ? 'Not yet verified'
                : $this->areas->hectares((float) $farm->verified_area_hectares),
            'difference' => $comparison === null ? '—' : $this->areas->hectares($comparison['difference']),
            'variance' => $comparison === null ? '—' : $this->areas->percent($comparison['variance']),
            'number_of_hills' => $farm->number_of_hills,
            'number_of_hills_label' => $farm->number_of_hills === null
                ? 'Not provided'
                : number_format($farm->number_of_hills),
            'geolocation' => $farm->hasGeolocation() ? 'Captured' : 'Not yet captured',
            'has_geolocation' => $farm->hasGeolocation(),
            'latitude' => $farm->latitude,
            'longitude' => $farm->longitude,
            'boundary_status' => $farm->boundary === null ? 'Not yet captured' : 'Captured',
            'data_validated' => match ($farm->data_validated) {
                true => 'Yes',
                false => 'No',
                default => 'Not provided',
            },
            'contracted_value' => $this->peso($farm->contracted_value_estimated),
            'input_support' => $this->peso($farm->input_support_amount),
            'financing_support' => $this->peso($farm->financing_support_amount),
            'drone_image_url' => $farm->drone_image_path === null
                ? null
                : route('farms.drone-image', $farm),
        ];
    }

    private function peso(mixed $amount): string
    {
        if ($amount === null || $amount === '') {
            return 'Not provided';
        }

        return '₱'.number_format((float) $amount, 2);
    }

    /**
     * @return array{
     *     crops: list<array{value: string, label: string}>,
     *     statuses: list<array{value: string, label: string}>,
     *     verification_statuses: list<array{value: string, label: string}>,
     *     stages: list<array{value: string, label: string}>,
     *     ownerships: list<array{value: string, label: string}>
     * }
     */
    public function filterOptions(): array
    {
        return [
            'crops' => $this->options(CropType::cases()),
            'statuses' => $this->options(FarmStatus::cases()),
            'verification_statuses' => array_values(collect(FarmVerificationStatus::cases())
                ->map(fn (FarmVerificationStatus $status): array => [
                    'value' => $status->value,
                    'label' => str_replace('_', ' ', ucfirst($status->value)),
                ])
                ->all()),
            'stages' => $this->options(FarmDevelopmentStage::cases()),
            'ownerships' => $this->options(PropertyOwnership::cases()),
        ];
    }

    /**
     * @param  list<CropType|FarmStatus|FarmDevelopmentStage|PropertyOwnership>  $cases
     * @return list<array{value: string, label: string}>
     */
    private function options(array $cases): array
    {
        return array_values(collect($cases)
            ->map(fn (CropType|FarmStatus|FarmDevelopmentStage|PropertyOwnership $case): array => [
                'value' => $case->value,
                'label' => $case->label(),
            ])
            ->all());
    }
}
