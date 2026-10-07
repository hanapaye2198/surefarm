<?php

namespace App\Http\Requests;

use App\FinancingType;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFarmFinancingRequest extends FormRequest
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
            'amount' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'date_granted' => ['required', 'date'],
            'loan_balance' => ['required', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'financing_type' => ['required', Rule::enum(FinancingType::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amount.required' => 'Financing amount is required.',
            'amount.gt' => 'Financing amount must be greater than zero.',
            'amount.regex' => 'Financing amount can have at most 2 decimal places.',
            'date_granted.required' => 'Date granted is required.',
            'loan_balance.required' => 'Loan balance is required.',
            'loan_balance.gte' => 'Loan balance cannot be negative.',
            'loan_balance.regex' => 'Loan balance can have at most 2 decimal places.',
            'financing_type.required' => 'Financing type is required.',
            'financing_type.enum' => 'Financing type must be MM or Govt.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'amount' => $this->blankToNull('amount'),
            'date_granted' => $this->blankToNull('date_granted'),
            'loan_balance' => $this->blankToNull('loan_balance'),
            'financing_type' => $this->blankToNull('financing_type'),
        ]);
    }

    private function blankToNull(string $key): mixed
    {
        $value = $this->input($key);

        return $value === '' || $value === null ? null : $value;
    }
}
