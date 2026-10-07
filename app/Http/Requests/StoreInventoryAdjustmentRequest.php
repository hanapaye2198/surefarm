<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInventoryAdjustmentRequest extends FormRequest
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
            'direction' => ['required', Rule::in(['increase', 'decrease'])],
            'reason' => ['required', 'string', 'max:2000'],
            'movement_date' => ['required', 'date'],
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
            'direction.required' => 'Choose whether to increase or decrease the quantity.',
            'reason.required' => 'A reason is required.',
            'movement_date.required' => 'Adjustment date is required.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'quantity' => $this->blankToNull('quantity'),
            'direction' => $this->blankToNull('direction'),
            'reason' => $this->blankToNull('reason'),
            'movement_date' => $this->blankToNull('movement_date'),
        ]);
    }

    private function blankToNull(string $key): mixed
    {
        $value = $this->input($key);

        return $value === '' || $value === null ? null : $value;
    }
}
