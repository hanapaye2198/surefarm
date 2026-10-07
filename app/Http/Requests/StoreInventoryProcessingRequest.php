<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInventoryProcessingRequest extends FormRequest
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
            'inventory_id' => ['required', 'integer', Rule::exists('inventories', 'id')],
            'input_quantity' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'output_quantity' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'destination_stage_id' => ['required', 'integer', Rule::exists('inventory_processing_stages', 'id')->where('status', 'active')],
            'processing_date' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'inventory_id.required' => 'Choose the coffee inventory to process.',
            'input_quantity.required' => 'Input quantity is required.',
            'input_quantity.gt' => 'Input quantity must be greater than zero.',
            'output_quantity.required' => 'Output quantity is required.',
            'output_quantity.gt' => 'Output quantity must be greater than zero.',
            'destination_stage_id.required' => 'Choose the destination stage.',
            'processing_date.required' => 'Processing date is required.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'inventory_id' => $this->blankToNull('inventory_id'),
            'input_quantity' => $this->blankToNull('input_quantity'),
            'output_quantity' => $this->blankToNull('output_quantity'),
            'destination_stage_id' => $this->blankToNull('destination_stage_id'),
            'processing_date' => $this->blankToNull('processing_date'),
            'location' => $this->blankToNull('location'),
            'notes' => $this->blankToNull('notes'),
        ]);
    }

    private function blankToNull(string $key): mixed
    {
        $value = $this->input($key);

        return $value === '' || $value === null ? null : $value;
    }
}
