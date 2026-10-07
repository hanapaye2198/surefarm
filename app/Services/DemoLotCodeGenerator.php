<?php

namespace App\Services;

use App\Contracts\LotCodeGenerator;
use App\Models\TraceabilityLot;

/**
 * DEMO lot code allocator.
 *
 * Formats the yearly sequence as SF-2026-000001. It is not an official
 * SureFarm numbering scheme and can be replaced by binding a different
 * LotCodeGenerator implementation.
 */
class DemoLotCodeGenerator implements LotCodeGenerator
{
    public function next(): string
    {
        $prefix = 'SF-'.now()->year.'-';
        $latest = TraceabilityLot::query()
            ->where('lot_code', 'like', $prefix.'%')
            ->orderByDesc('lot_code')
            ->lockForUpdate()
            ->value('lot_code');

        $sequence = 1;

        if (is_string($latest) && preg_match('/(\d{6})$/', $latest, $matches) === 1) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return $prefix.str_pad((string) $sequence, 6, '0', STR_PAD_LEFT);
    }
}
