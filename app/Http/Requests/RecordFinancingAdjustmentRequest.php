<?php

namespace App\Http\Requests;

use App\FinancingComponent;
use App\FinancingDirection;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordFinancingAdjustmentRequest extends FormRequest
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
            'occurred_on' => ['required', 'date', 'before_or_equal:today'],
            'amount' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'component' => ['required', Rule::enum(FinancingComponent::class)],
            'direction' => ['required', Rule::enum(FinancingDirection::class)],
            'notes' => ['required', 'string', 'max:2000'],
            'client_token' => ['required', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'occurred_on.required' => 'Adjustment date is required.',
            'amount.required' => 'Adjustment amount is required.',
            'amount.gt' => 'Adjustment amount must be greater than zero.',
            'notes.required' => 'An adjustment needs a note explaining the change.',
            'client_token.required' => 'The adjustment could not be identified. Submit the form again.',
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['occurred_on', 'amount', 'component', 'direction', 'notes', 'client_token'] as $key) {
            $value = $this->input($key);
            $this->merge([
                $key => $value === '' || $value === null ? null : (is_string($value) ? trim($value) : $value),
            ]);
        }
    }
}
