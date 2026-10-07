<?php

namespace App\Http\Requests;

use App\BankAccountStatus;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFarmerDetailsRequest extends FormRequest
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
        $recordingBankAccount = $this->boolean('has_bank_account');

        return [
            'date_of_birth' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'government_id' => ['nullable', 'string', 'max:64'],
            'has_bank_account' => ['boolean'],
            'bank_name' => [
                Rule::excludeUnless($recordingBankAccount),
                'required',
                'string',
                'max:255',
            ],
            'account_number' => [
                Rule::excludeUnless($recordingBankAccount),
                'required',
                'string',
                'max:32',
                'regex:/^[0-9\-\s]+$/',
            ],
            'account_name' => [
                Rule::excludeUnless($recordingBankAccount),
                'required',
                'string',
                'max:255',
            ],
            'bank_account_status' => [
                Rule::excludeUnless($recordingBankAccount),
                'nullable',
                Rule::enum(BankAccountStatus::class),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date_of_birth.date' => 'Enter a valid date of birth.',
            'date_of_birth.before' => 'Date of birth must be in the past.',
            'date_of_birth.after' => 'Enter a valid date of birth.',
            'bank_name.required' => 'Bank name is required.',
            'account_number.required' => 'Account number is required.',
            'account_number.regex' => 'Account number can only contain digits, spaces, and dashes.',
            'account_name.required' => 'Account name is required.',
            'bank_account_status.enum' => 'Choose a bank account status.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $governmentId = $this->string('government_id')->trim()->toString();
        $dateOfBirth = $this->string('date_of_birth')->trim()->toString();
        $bankName = $this->string('bank_name')->trim()->toString();
        $accountNumber = $this->string('account_number')->trim()->toString();
        $accountName = $this->string('account_name')->trim()->toString();

        $this->merge([
            'date_of_birth' => $dateOfBirth === '' ? null : $dateOfBirth,
            'government_id' => $governmentId === '' ? null : $governmentId,
            'has_bank_account' => $this->boolean('has_bank_account'),
            'bank_name' => $bankName === '' ? null : $bankName,
            'account_number' => $accountNumber === '' ? null : $accountNumber,
            'account_name' => $accountName === '' ? null : $accountName,
            'bank_account_status' => $this->filled('bank_account_status')
                ? $this->string('bank_account_status')->trim()->toString()
                : BankAccountStatus::Unverified->value,
        ]);
    }
}
