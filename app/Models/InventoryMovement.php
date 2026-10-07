<?php

namespace App\Models;

use App\InventoryMovementType;
use App\Services\ProductionLedger;
use Database\Factories\InventoryMovementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property InventoryMovementType $movement_type
 */
#[Fillable([
    'inventory_id',
    'destination_inventory_id',
    'source_stage_id',
    'destination_stage_id',
    'quantity',
    'output_quantity',
    'unit',
    'movement_type',
    'direction',
    'movement_date',
    'reference_type',
    'reference_id',
    'notes',
    'created_by',
])]
class InventoryMovement extends Model
{
    /** @use HasFactory<InventoryMovementFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'output_quantity' => 'decimal:2',
            'movement_type' => InventoryMovementType::class,
            'movement_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Inventory, $this>
     */
    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class);
    }

    /**
     * @return BelongsTo<Inventory, $this>
     */
    public function destinationInventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class, 'destination_inventory_id');
    }

    /**
     * @return BelongsTo<InventoryProcessingStage, $this>
     */
    public function sourceStage(): BelongsTo
    {
        return $this->belongsTo(InventoryProcessingStage::class, 'source_stage_id');
    }

    /**
     * @return BelongsTo<InventoryProcessingStage, $this>
     */
    public function destinationStage(): BelongsTo
    {
        return $this->belongsTo(InventoryProcessingStage::class, 'destination_stage_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return array<string, mixed>
     */
    public function present(): array
    {
        $ledger = app(ProductionLedger::class);

        return [
            'id' => $this->id,
            'movement_date' => $this->movement_date->format('M j, Y'),
            'movement_date_long' => $this->movement_date->format('F j, Y'),
            'movement_type' => $this->movement_type->value,
            'movement_type_label' => $this->movement_type->label(),
            'quantity_label' => $ledger->quantityLabel($this->quantity, $this->unit),
            'output_label' => $this->output_quantity === null
                ? null
                : $ledger->quantityLabel($this->output_quantity, $this->unit),
            'source_stage' => $this->sourceStage?->name,
            'destination_stage' => $this->destinationStage?->name,
            'direction' => $this->direction,
            'notes' => $this->notes,
            'created_by' => $this->creator?->name,
            'summary' => $this->summary($ledger),
        ];
    }

    private function summary(ProductionLedger $ledger): string
    {
        $input = $ledger->quantityLabel($this->quantity, $this->unit);
        $output = $this->output_quantity === null
            ? null
            : $ledger->quantityLabel($this->output_quantity, $this->unit);

        return match ($this->movement_type) {
            InventoryMovementType::Receipt => 'Received '.$input.' as '.($this->destinationStage?->name ?? 'inventory').'.',
            InventoryMovementType::Processing => 'Processed '.$input.' of '.($this->sourceStage?->name ?? 'coffee').' into '.($output ?? $input).' of '.($this->destinationStage?->name ?? 'the next stage').'.',
            InventoryMovementType::Adjustment => ucfirst((string) ($this->direction ?? 'adjusted')).' by '.$input.'.',
            InventoryMovementType::Damage => 'Marked '.$input.' as damaged.',
            InventoryMovementType::Release => $this->reference_type === 'traceability_lot'
                ? 'Allocated '.$input.' to a traceability lot.'
                : 'Released '.$input.'.',
        };
    }
}
