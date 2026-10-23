<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreCooperativeMembershipRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && ! $user->isSuspended()
            && $user->canAccess(UserRole::Operations);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'farmer_code' => ['required', 'string', 'max:64'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'farmer_code.required' => 'Farmer ID is required.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $code = $this->input('farmer_code');

        $this->merge([
            'farmer_code' => is_string($code) ? trim($code) : $code,
        ]);
    }
}
