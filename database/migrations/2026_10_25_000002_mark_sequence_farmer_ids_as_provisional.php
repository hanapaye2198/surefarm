<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('farmers')
            ->select(['id', 'farmer_id'])
            ->orderBy('id')
            ->chunkById(500, function ($farmers): void {
                foreach ($farmers as $farmer) {
                    $id = (int) $farmer->id;

                    if ($farmer->farmer_id !== $this->legacyId($id)) {
                        continue;
                    }

                    $provisionalId = $this->provisionalId($id);
                    if (DB::table('farmers')->where('farmer_id', $provisionalId)->where('id', '!=', $id)->exists()) {
                        throw new \RuntimeException("Cannot mark farmer {$id} as provisional because its new ID is already in use.");
                    }

                    DB::table('farmers')->where('id', $id)->update(['farmer_id' => $provisionalId]);
                }
            });
    }

    public function down(): void
    {
        DB::table('farmers')
            ->select(['id', 'farmer_id'])
            ->orderBy('id')
            ->chunkById(500, function ($farmers): void {
                foreach ($farmers as $farmer) {
                    $id = (int) $farmer->id;

                    if ($farmer->farmer_id !== $this->provisionalId($id)) {
                        continue;
                    }

                    $legacyId = $this->legacyId($id);
                    if (DB::table('farmers')->where('farmer_id', $legacyId)->where('id', '!=', $id)->exists()) {
                        throw new \RuntimeException("Cannot restore farmer {$id}'s previous ID because it is already in use.");
                    }

                    DB::table('farmers')->where('id', $id)->update(['farmer_id' => $legacyId]);
                }
            });
    }

    private function legacyId(int $sequence): string
    {
        $digits = str_pad((string) $sequence, 12, '0', STR_PAD_LEFT);

        return sprintf(
            'SF-%s-%s-%s-%s',
            substr($digits, 0, 3),
            substr($digits, 3, 3),
            substr($digits, 6, 3),
            substr($digits, 9, 3),
        );
    }

    private function provisionalId(int $sequence): string
    {
        return 'SF-PROV-'.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);
    }
};
