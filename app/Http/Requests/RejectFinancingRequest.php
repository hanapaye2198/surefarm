<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RejectFinancingRequest extends FormRequest
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
            'reason' => ['required', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'A rejection reason is required.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $reason = $this->input('reason');
        $this->merge([
            'reason' => is_string($reason) ? trim($reason) : $reason,
        ]);

        if ($this->input('reason') === '') {
            $this->merge(['reason' => null]);
        }
    }
}
