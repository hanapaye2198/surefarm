<?php

namespace App\Http\Requests;

use App\FarmVerificationResult;
use App\Models\User;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideFarmVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && $user->role !== UserRole::Farmer
            && $user->canAccess(UserRole::FieldVerifier);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'result' => ['required', Rule::enum(FarmVerificationResult::class)],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'result.required' => 'Choose a verification result.',
            'remarks.max' => 'Remarks must be 2000 characters or fewer.',
        ];
    }
}
