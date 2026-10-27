<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Coffee moves from cherry to parchment, then dried coffee, then green beans.
     */
    public function up(): void
    {
        $this->apply([
            'COFFEE_CHERRY' => [1, 'Fresh coffee cherry received from harvest.'],
            'PARCHMENT' => [2, 'Coffee cherry processed to parchment.'],
            'DRIED_COFFEE' => [3, 'Parchment dried before milling.'],
            'GREEN_BEANS' => [4, 'Dried coffee milled to green beans.'],
        ]);
    }

    /**
     * Restore the previous order: cherry, dried coffee, parchment, green beans.
     */
    public function down(): void
    {
        $this->apply([
            'COFFEE_CHERRY' => [1, 'Fresh coffee cherry received from harvest.'],
            'DRIED_COFFEE' => [2, 'Coffee dried after the cherry stage.'],
            'PARCHMENT' => [3, 'Dried coffee hulled to parchment.'],
            'GREEN_BEANS' => [4, 'Parchment milled to green coffee beans.'],
        ]);
    }

    /**
     * @param  array<string, array{0: int, 1: string}>  $stages
     */
    private function apply(array $stages): void
    {
        foreach ($stages as $code => [$sequence, $description]) {
            DB::table('inventory_processing_stages')
                ->where('code', $code)
                ->update([
                    'sequence' => $sequence,
                    'description' => $description,
                ]);
        }
    }
};
