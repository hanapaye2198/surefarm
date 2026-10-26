<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RecordFinancingRepaymentRequest extends FormRequest
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
        $money = ['required', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'];

        return [
            'occurred_on' => ['required', 'date', 'before_or_equal:today'],
            'amount' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'principal_amount' => $money,
            'interest_amount' => $money,
            'fee_amount' => $money,
            'payment_method' => ['nullable', 'string', 'max:40'],
            'external_reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'client_token' => ['required', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'occurred_on.required' => 'Payment date is required.',
            'occurred_on.before_or_equal' => 'Payment date cannot be in the future.',
            'amount.required' => 'Amount received is required.',
            'amount.gt' => 'Amount received must be greater than zero.',
            'amount.regex' => 'Amount received can have at most 2 decimal places.',
            'client_token.required' => 'The payment could not be identified. Submit the form again.',
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['principal_amount', 'interest_amount', 'fee_amount'] as $key) {
            if ($this->input($key) === '' || $this->input($key) === null) {
                $this->merge([$key => '0']);
            }
        }

        foreach (['occurred_on', 'amount', 'payment_method', 'external_reference', 'notes', 'client_token'] as $key) {
            $value = $this->input($key);

            if ($value === '') {
                $this->merge([$key => null]);
            } elseif (is_string($value)) {
                $this->merge([$key => trim($value)]);
            }
        }
    }
}
