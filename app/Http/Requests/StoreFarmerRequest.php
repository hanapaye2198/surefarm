<?php

namespace App\Http\Requests;

use App\BankAccountStatus;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFarmerRequest extends FormRequest
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
        $recordingSpouse = $this->boolean('has_spouse');
        $recordingBankAccount = $this->boolean('has_bank_account');

        return [
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'government_id' => ['nullable', 'string', 'max:64'],
            'purok_sitio' => ['required', 'string', 'max:255'],
            'barangay' => ['required', 'string', 'max:255'],
            'municipality' => ['required', 'string', 'max:255'],
            'province' => ['required', 'string', 'max:255'],
            'mobile_number' => ['required', 'string', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'cooperative_id' => ['nullable', 'integer', Rule::exists('cooperatives', 'id')],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            'has_spouse' => ['boolean'],
            'spouse_first_name' => [
                Rule::excludeUnless($recordingSpouse),
                'required',
                'string',
                'max:255',
            ],
            'spouse_middle_name' => [
                Rule::excludeUnless($recordingSpouse),
                'nullable',
                'string',
                'max:255',
            ],
            'spouse_last_name' => [
                Rule::excludeUnless($recordingSpouse),
                'required',
                'string',
                'max:255',
            ],
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
            'first_name.required' => 'First name is required.',
            'last_name.required' => 'Last name is required.',
            'purok_sitio.required' => 'Purok / sitio is required.',
            'barangay.required' => 'Barangay is required.',
            'municipality.required' => 'Municipality / city is required.',
            'province.required' => 'Province is required.',
            'mobile_number.required' => 'Mobile number is required.',
            'mobile_number.regex' => 'Enter a valid mobile number.',
            'email.email' => 'Enter a valid email address.',
            'photo.image' => 'Farmer photo must be a JPG or PNG image.',
            'photo.mimes' => 'Farmer photo must be a JPG or PNG image.',
            'photo.max' => 'Farmer photo must be 5 MB or smaller.',
            'spouse_first_name.required' => 'Spouse first name is required.',
            'spouse_last_name.required' => 'Spouse last name is required.',
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
        $email = $this->string('email')->trim()->toString();
        $middleName = $this->string('middle_name')->trim()->toString();
        $spouseMiddleName = $this->string('spouse_middle_name')->trim()->toString();

        $governmentId = $this->string('government_id')->trim()->toString();
        $dateOfBirth = $this->string('date_of_birth')->trim()->toString();
        $bankName = $this->string('bank_name')->trim()->toString();
        $accountNumber = $this->string('account_number')->trim()->toString();
        $accountName = $this->string('account_name')->trim()->toString();

        $this->merge([
            'first_name' => $this->string('first_name')->trim()->toString(),
            'middle_name' => $middleName === '' ? null : $middleName,
            'last_name' => $this->string('last_name')->trim()->toString(),
            'date_of_birth' => $dateOfBirth === '' ? null : $dateOfBirth,
            'government_id' => $governmentId === '' ? null : $governmentId,
            'purok_sitio' => $this->string('purok_sitio')->trim()->toString(),
            'barangay' => $this->string('barangay')->trim()->toString(),
            'municipality' => $this->string('municipality')->trim()->toString(),
            'province' => $this->string('province')->trim()->toString(),
            'mobile_number' => $this->string('mobile_number')->trim()->toString(),
            'email' => $email === '' ? null : $email,
            'cooperative_id' => $this->filled('cooperative_id') ? $this->integer('cooperative_id') : null,
            'has_spouse' => $this->boolean('has_spouse'),
            'spouse_middle_name' => $spouseMiddleName === '' ? null : $spouseMiddleName,
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
