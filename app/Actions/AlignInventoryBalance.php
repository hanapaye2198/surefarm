<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\Inventory;
use App\Models\User;
use App\Services\InventoryStock;
use App\Support\DecimalQuantity;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AlignInventoryBalance
{
    public function __construct(
        private InventoryStock $stock,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * Set the stored on-hand quantity to the sum of recorded movements.
     * This does not create a stock movement.
     */
    public function handle(Inventory $inventory, User $actor, string $reason): Inventory
    {
        return DB::transaction(function () use ($inventory, $actor, $reason): Inventory {
            $inventory = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            $stored = DecimalQuantity::cents($inventory->quantity);
            $movementTotal = $this->stock->movementCents($inventory);

            if ($stored === $movementTotal) {
                throw ValidationException::withMessages([
                    'reason' => 'This balance already matches its movements.',
                ]);
            }

            if ($movementTotal < 0) {
                throw ValidationException::withMessages([
                    'reason' => 'The movement total is negative. Correct the movements before changing the stored balance.',
                ]);
            }

            $inventory->update([
                'quantity' => DecimalQuantity::fromCents($movementTotal),
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InventoryBalanceCorrected, null, $inventory, [
                'stored_before' => DecimalQuantity::fromCents($stored),
                'movement_total' => DecimalQuantity::fromCents($movementTotal),
                'unit' => $inventory->unit,
                'reason' => $reason,
            ]);

            return $inventory;
        });
    }
}
