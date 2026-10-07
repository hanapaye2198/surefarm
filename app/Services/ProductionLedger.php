<?php

namespace App\Services;

use App\HarvestStatus;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\FarmProduction;
use App\ProductionStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Expected production stays on the production row. Actual harvest is
 * the sum of completed harvests that share the same unit. Quantities
 * are never converted between units.
 */
class ProductionLedger
{
    /**
     * Stored as text. These are the units offered in the demo.
     * Quantities are not converted between them.
     *
     * @var list<string>
     */
    public const UNITS = ['kg', 'tons', 'bags'];

    /**
     * @return array{
     *     expected: float|null,
     *     actual: float,
     *     remaining: float|null,
     *     exceeds: bool,
     *     progress: int|null,
     *     expected_label: string,
     *     actual_label: string,
     *     remaining_label: string,
     *     message: string|null
     * }
     */
    public function compare(float|string|null $expectedQuantity, float $actual, ?string $unit): array
    {
        $actual = round($actual, 2);
        $expected = $expectedQuantity === null || $expectedQuantity === ''
            ? null
            : round((float) $expectedQuantity, 2);

        if ($expected === null) {
            return [
                'expected' => null,
                'actual' => $actual,
                'remaining' => null,
                'exceeds' => false,
                'progress' => null,
                'expected_label' => '—',
                'actual_label' => $this->quantityLabel($actual, $unit),
                'remaining_label' => '—',
                'message' => null,
            ];
        }

        $remaining = round($expected - $actual, 2);
        $exceeds = $actual > $expected;

        return [
            'expected' => $expected,
            'actual' => $actual,
            'remaining' => $remaining,
            'exceeds' => $exceeds,
            'progress' => $expected > 0 ? (int) min(100, round(($actual / $expected) * 100)) : null,
            'expected_label' => $this->quantityLabel($expected, $unit),
            'actual_label' => $this->quantityLabel($actual, $unit),
            'remaining_label' => $exceeds
                ? 'Over by '.$this->quantityLabel(abs($remaining), $unit)
                : $this->quantityLabel($remaining, $unit),
            'message' => $exceeds ? 'Actual harvest exceeds expected production.' : null,
        ];
    }

    public function quantityLabel(float|string|null $amount, ?string $unit): string
    {
        if ($amount === null || $amount === '') {
            return '—';
        }

        $formatted = $this->formatNumber((float) $amount);
        $unit = trim((string) $unit);

        return $unit === '' ? $formatted : "{$formatted} {$unit}";
    }

    public function formatNumber(float $number): string
    {
        $rounded = round($number, 2);

        if (abs($rounded - round($rounded)) < 0.001) {
            return number_format($rounded, 0);
        }

        return number_format($rounded, 2);
    }

    /**
     * @return array<string, mixed>
     */
    public function farmSummary(Farm $farm): array
    {
        return $this->summarize(
            FarmProduction::query()->where('farm_id', $farm->id),
            FarmHarvest::query()->where('farm_id', $farm->id),
        );
    }

    /**
     * Totals across this farmer's farms. Nothing is stored on the farmer.
     *
     * @return array<string, mixed>
     */
    public function farmerSummary(Farmer $farmer): array
    {
        $farmIds = Farm::query()->where('farmer_id', $farmer->id)->pluck('id');

        $summary = $this->summarize(
            FarmProduction::query()->whereIn('farm_id', $farmIds),
            FarmHarvest::query()->whereIn('farm_id', $farmIds),
        );

        $summary['harvesting_farms'] = $this->harvestingFarms(
            FarmHarvest::query()->whereIn('farm_id', $farmIds),
        );

        return $summary;
    }

    /**
     * @return array<string, mixed>
     */
    public function dashboardSummary(): array
    {
        $summary = $this->summarize(
            FarmProduction::query(),
            FarmHarvest::query(),
        );

        $summary['harvesting_farms'] = $this->harvestingFarms(FarmHarvest::query());

        return $summary;
    }

    /**
     * @return array{total_expected: string, farms_in_production: int, active_crops: int, current_period: string}
     */
    public function productionIndexSummary(): array
    {
        $expected = FarmProduction::query()
            ->whereNotNull('expected_quantity')
            ->selectRaw('unit, SUM(expected_quantity) as total')
            ->groupBy('unit')
            ->pluck('total', 'unit');

        $cropCount = DB::table('farm_productions')
            ->join('farms', 'farms.id', '=', 'farm_productions.farm_id')
            ->where('farm_productions.status', ProductionStatus::Active->value)
            ->selectRaw('count(distinct coalesce(farm_productions.crop_type, farms.crop_type)) as aggregate')
            ->value('aggregate');

        $period = FarmProduction::query()
            ->whereNotNull('production_period')
            ->where('production_period', '!=', '')
            ->orderByDesc('id')
            ->value('production_period');

        return [
            'total_expected' => $this->unitTotalsLabel($expected),
            'farms_in_production' => (int) FarmProduction::query()
                ->where('status', ProductionStatus::Active)
                ->distinct()
                ->count('farm_id'),
            'active_crops' => (int) $cropCount,
            'current_period' => $period ?: '—',
        ];
    }

    /**
     * @return array{total_harvest: string, harvesting_farms: int, completed_harvests: int, current_period: string}
     */
    public function harvestIndexSummary(): array
    {
        $harvested = FarmHarvest::query()
            ->where('status', HarvestStatus::Completed)
            ->selectRaw('unit, SUM(quantity) as total')
            ->groupBy('unit')
            ->pluck('total', 'unit');

        $latest = FarmHarvest::query()
            ->orderByDesc('harvest_date')
            ->orderByDesc('id')
            ->first();

        return [
            'total_harvest' => $this->unitTotalsLabel($harvested),
            'harvesting_farms' => $this->harvestingFarms(FarmHarvest::query()),
            'completed_harvests' => FarmHarvest::query()->where('status', HarvestStatus::Completed)->count(),
            'current_period' => $latest?->harvest_date?->format('Y') ?? '—',
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recentHarvests(int $limit = 5): array
    {
        return FarmHarvest::query()
            ->with(['farm.farmer'])
            ->orderByDesc('harvest_date')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (FarmHarvest $harvest): array => $harvest->summaryRow())
            ->values()
            ->all();
    }

    /**
     * @param  Builder<FarmProduction>  $productions
     * @param  Builder<FarmHarvest>  $harvests
     * @return array<string, mixed>
     */
    private function summarize($productions, $harvests): array
    {
        $expected = (clone $productions)
            ->whereNotNull('expected_quantity')
            ->selectRaw('unit, SUM(expected_quantity) as total')
            ->groupBy('unit')
            ->pluck('total', 'unit');

        $actual = (clone $harvests)
            ->where('status', HarvestStatus::Completed)
            ->selectRaw('unit, SUM(quantity) as total')
            ->groupBy('unit')
            ->pluck('total', 'unit');

        $hasRecords = (clone $productions)->exists() || (clone $harvests)->exists();

        if (! $hasRecords) {
            return $this->emptyBalance();
        }

        $unit = $this->primaryUnit($expected, $actual);

        if ($unit === null) {
            return $this->emptyBalance();
        }

        $balance = $this->compare(
            $expected->has($unit) ? (string) $expected[$unit] : null,
            round((float) ($actual[$unit] ?? 0), 2),
            $unit,
        );

        $balance['has_records'] = true;

        return $balance;
    }

    /**
     * @param  Builder<FarmHarvest>  $harvests
     */
    private function harvestingFarms($harvests): int
    {
        return (int) (clone $harvests)
            ->where('status', '!=', HarvestStatus::Cancelled)
            ->distinct()
            ->count('farm_id');
    }

    /**
     * @param  Collection<string, mixed>  $totals
     */
    private function unitTotalsLabel(Collection $totals): string
    {
        if ($totals->isEmpty()) {
            return '—';
        }

        $ordered = $totals->sortBy(fn (mixed $total, string $unit): int => $unit === 'kg' ? 0 : 1);

        return $ordered
            ->map(fn (mixed $total, string $unit): string => $this->quantityLabel($total, $unit))
            ->implode(' · ');
    }

    /**
     * @param  Collection<string, mixed>  $expected
     * @param  Collection<string, mixed>  $actual
     */
    private function primaryUnit(Collection $expected, Collection $actual): ?string
    {
        $units = $expected->keys()->merge($actual->keys())->unique()->filter();

        if ($units->contains('kg')) {
            return 'kg';
        }

        $first = $units->first();

        return is_string($first) ? $first : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyBalance(): array
    {
        return [
            'expected' => null,
            'actual' => 0,
            'remaining' => null,
            'exceeds' => false,
            'progress' => null,
            'expected_label' => '—',
            'actual_label' => '—',
            'remaining_label' => '—',
            'message' => null,
            'has_records' => false,
        ];
    }
}
