<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class DisburseFinancingRequest extends FormRequest
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
            'disbursement_reference' => ['required', 'string', 'max:120'],
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
            'occurred_on.required' => 'Disbursement date is required.',
            'occurred_on.before_or_equal' => 'Disbursement date cannot be in the future.',
            'disbursement_reference.required' => 'A disbursement reference is required.',
            'client_token.required' => 'The disbursement could not be identified. Submit the form again.',
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['occurred_on', 'disbursement_reference', 'notes', 'client_token'] as $key) {
            $value = $this->input($key);
            $this->merge([
                $key => $value === '' || $value === null ? null : (is_string($value) ? trim($value) : $value),
            ]);
        }
    }
}
