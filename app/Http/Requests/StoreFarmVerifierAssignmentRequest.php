<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreFarmVerifierAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && ! $user->isSuspended()
            && $user->role === UserRole::Admin;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'farm_code' => ['required', 'string', 'max:64'],
            'scheduled_for' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:today'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'farm_code.required' => 'Enter the farm ID to assign.',
            'scheduled_for.after_or_equal' => 'The scheduled date cannot be in the past.',
        ];
    }
}
