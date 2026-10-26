<?php

namespace App\Http\Requests;

use App\FinancingInterestMethod;
use App\FinancingRepaymentFrequency;
use App\FinancingType;
use App\Models\Farm;
use App\Models\FarmProduction;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreFinancingApplicationRequest extends FormRequest
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
            'farm_id' => ['required', 'integer', Rule::exists(Farm::class, 'id')],
            'farm_production_id' => ['nullable', 'integer', Rule::exists(FarmProduction::class, 'id')],
            'financing_type' => ['required', Rule::enum(FinancingType::class)],
            'purpose' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'interest_method' => ['required', Rule::enum(FinancingInterestMethod::class)],
            'interest_rate' => ['nullable', 'numeric', 'gt:0', 'lte:100', 'regex:/^\d+(\.\d{1,4})?$/'],
            'interest_amount' => ['required', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'fee_amount' => ['required', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'application_date' => ['required', 'date', 'before_or_equal:today'],
            'repayment_frequency' => ['nullable', Rule::enum(FinancingRepaymentFrequency::class)],
            'installment_count' => ['nullable', 'integer', 'min:1', 'max:360'],
            'due_date' => ['nullable', 'date'],
            'maturity_date' => ['nullable', 'date'],
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
            'farm_id.required' => 'Choose a farm.',
            'purpose.required' => 'Financing purpose is required.',
            'amount.required' => 'Principal amount is required.',
            'amount.gt' => 'Principal amount must be greater than zero.',
            'amount.regex' => 'Principal amount can have at most 2 decimal places.',
            'currency.regex' => 'Currency must be a 3-letter code.',
            'interest_method.required' => 'Choose whether this agreement charges interest.',
            'interest_amount.required' => 'Interest amount is required.',
            'fee_amount.required' => 'Fee amount is required. Use 0 when there is no fee.',
            'application_date.required' => 'Application date is required.',
            'application_date.before_or_equal' => 'Application date cannot be in the future.',
            'client_token.required' => 'The application could not be identified. Submit the form again.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $frequency = $this->input('repayment_frequency');
            $count = $this->input('installment_count');
            $needsCount = in_array($frequency, [
                FinancingRepaymentFrequency::Monthly->value,
                FinancingRepaymentFrequency::Quarterly->value,
            ], true);

            if ($needsCount && ($count === null || $count === '')) {
                $validator->errors()->add('installment_count', 'Enter the number of installments.');
            }

            $due = $this->input('due_date');
            $application = $this->input('application_date');

            if (is_string($due) && is_string($application) && $due !== '' && $due < $application) {
                $validator->errors()->add('due_date', 'Due date cannot be before the application date.');
            }

            $maturity = $this->input('maturity_date');

            if (is_string($maturity) && $maturity !== '' && is_string($due) && $due !== '' && $maturity < $due) {
                $validator->errors()->add('maturity_date', 'Maturity date cannot be before the due date.');
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $currency = $this->input('currency');

        $this->merge([
            'farm_id' => $this->blankToNull('farm_id'),
            'farm_production_id' => $this->blankToNull('farm_production_id'),
            'purpose' => $this->blankToNull('purpose'),
            'amount' => $this->blankToNull('amount'),
            'currency' => is_string($currency) ? strtoupper(trim($currency)) : $currency,
            'interest_rate' => $this->blankToNull('interest_rate'),
            'interest_amount' => $this->input('interest_amount') === '' || $this->input('interest_amount') === null ? '0' : $this->input('interest_amount'),
            'fee_amount' => $this->input('fee_amount') === '' || $this->input('fee_amount') === null ? '0' : $this->input('fee_amount'),
            'application_date' => $this->blankToNull('application_date'),
            'repayment_frequency' => $this->blankToNull('repayment_frequency'),
            'installment_count' => $this->blankToNull('installment_count'),
            'due_date' => $this->blankToNull('due_date'),
            'maturity_date' => $this->blankToNull('maturity_date'),
            'notes' => $this->blankToNull('notes'),
            'client_token' => $this->blankToNull('client_token'),
        ]);
    }

    private function blankToNull(string $key): mixed
    {
        $value = $this->input($key);

        return $value === '' || $value === null ? null : $value;
    }
}
