<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreFarmInsuranceRequest extends FormRequest
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
            'covered' => ['required', 'boolean'],
            'amount' => ['nullable', 'required_if:covered,true', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'term_months' => ['nullable', 'required_if:covered,true', 'integer', 'min:1', 'max:240'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'covered.required' => 'Choose whether crop insurance covers this farm.',
            'amount.required_if' => 'Insurance amount is required when the farm is covered.',
            'amount.gt' => 'Insurance amount must be greater than zero.',
            'amount.regex' => 'Insurance amount can have at most 2 decimal places.',
            'term_months.required_if' => 'Insurance term is required when the farm is covered.',
            'term_months.integer' => 'Insurance term must be a whole number of months.',
            'term_months.min' => 'Insurance term must be at least 1 month.',
            'term_months.max' => 'Insurance term cannot be longer than 240 months.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $covered = filter_var($this->input('covered'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        $this->merge([
            'covered' => $covered,
            'amount' => $covered === true ? $this->blankToNull('amount') : null,
            'term_months' => $covered === true ? $this->blankToNull('term_months') : null,
        ]);
    }

    private function blankToNull(string $key): mixed
    {
        $value = $this->input($key);

        return $value === '' || $value === null ? null : $value;
    }
}
