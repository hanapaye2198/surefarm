<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ReverseFinancingTransactionRequest extends FormRequest
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
            'occurred_on.required' => 'Reversal date is required.',
            'notes.required' => 'A reason for the reversal is required.',
            'client_token.required' => 'The reversal could not be identified. Submit the form again.',
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['occurred_on', 'notes', 'client_token'] as $key) {
            $value = $this->input($key);
            $this->merge([
                $key => $value === '' || $value === null ? null : (is_string($value) ? trim($value) : $value),
            ]);
        }
    }
}
