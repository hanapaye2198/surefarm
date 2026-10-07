<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Services\ProductionLedger;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTraceabilityLotRequest extends FormRequest
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
            'inventory_id' => ['required', 'integer', 'exists:inventories,id'],
            'quantity' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'unit' => ['required', 'string', Rule::in(ProductionLedger::UNITS)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'inventory_id.required' => 'Source inventory is required.',
            'quantity.required' => 'Quantity is required.',
            'quantity.gt' => 'Quantity must be greater than zero.',
            'quantity.regex' => 'Quantity can have at most two decimal places.',
            'unit.required' => 'Unit is required.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $notes = $this->input('notes');

        $this->merge([
            'notes' => is_string($notes) && trim($notes) === '' ? null : $notes,
        ]);
    }
}
