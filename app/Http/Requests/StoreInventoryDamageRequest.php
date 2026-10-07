<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreInventoryDamageRequest extends FormRequest
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
            'quantity.required' => 'Damaged quantity is required.',
            'quantity.gt' => 'Damaged quantity must be greater than zero.',
            'reason.required' => 'A reason is required.',
            'movement_date.required' => 'Damage date is required.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'quantity' => $this->blankToNull('quantity'),
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
