<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Services\ProductionLedger;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreHarvestInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->canAccess(UserRole::Operations);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'quantity' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'unit' => ['required', Rule::in(ProductionLedger::UNITS)],
            'processing_stage_id' => ['required', 'integer', Rule::exists('inventory_processing_stages', 'id')->where('status', 'active')],
            'location' => ['nullable', 'string', 'max:255'],
            'received_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'receipt_token' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'quantity.required' => 'Quantity is required.',
            'quantity.gt' => 'Quantity must be greater than zero.',
            'quantity.regex' => 'Quantity can have at most 2 decimal places.',
            'unit.required' => 'Unit is required.',
            'processing_stage_id.required' => 'Choose a processing stage.',
            'received_date.required' => 'Received date is required.',
        ];
    }

    /**
     * @return array{quantity: numeric-string|float|int, unit: string, processing_stage_id: int, location?: string|null, received_date: string, notes?: string|null, receipt_token?: string|null}
     */
    public function receiptData(): array
    {
        $data = $this->validated();
        $quantity = $data['quantity'] ?? null;

        if ((! is_string($quantity) && ! is_int($quantity) && ! is_float($quantity)) || ! is_numeric($quantity)) {
            throw new \LogicException('Validated inventory quantity must be numeric.');
        }

        $unit = $data['unit'] ?? null;
        $stageId = $data['processing_stage_id'] ?? null;
        $receivedDate = $data['received_date'] ?? null;

        if (! is_string($unit) || (! is_int($stageId) && ! (is_string($stageId) && ctype_digit($stageId))) || ! is_string($receivedDate)) {
            throw new \LogicException('Validated inventory receipt fields have unexpected types.');
        }

        $location = $data['location'] ?? null;
        $notes = $data['notes'] ?? null;
        $receiptToken = $data['receipt_token'] ?? null;

        if (($location !== null && ! is_string($location))
            || ($notes !== null && ! is_string($notes))
            || ($receiptToken !== null && ! is_string($receiptToken))) {
            throw new \LogicException('Validated inventory optional fields must be strings or null.');
        }

        return [
            'quantity' => $quantity,
            'unit' => $unit,
            'processing_stage_id' => (int) $stageId,
            'location' => $location,
            'received_date' => $receivedDate,
            'notes' => $notes,
            'receipt_token' => $receiptToken,
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'quantity' => $this->blankToNull('quantity'),
            'unit' => $this->blankToNull('unit'),
            'processing_stage_id' => $this->blankToNull('processing_stage_id'),
            'location' => $this->blankToNull('location'),
            'received_date' => $this->blankToNull('received_date'),
            'notes' => $this->blankToNull('notes'),
            'receipt_token' => $this->blankToNull('receipt_token'),
        ]);
    }

    private function blankToNull(string $key): mixed
    {
        $value = $this->input($key);

        return $value === '' || $value === null ? null : $value;
    }
}
