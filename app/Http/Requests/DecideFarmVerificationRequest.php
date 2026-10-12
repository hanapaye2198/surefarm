<?php

namespace App\Http\Requests;

use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\User;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideFarmVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $farm = $this->route('farm');

        return $user instanceof User
            && $user->role === UserRole::FieldVerifier
            && $farm instanceof Farm
            && $farm->assigned_verifier_id === $user->id
            && $farm->verification_status === FarmVerificationStatus::InProgress;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'result' => ['required', Rule::enum(FarmVerificationResult::class)],
            'remarks' => ['required_if:result,failed,needs_review', 'nullable', 'string', 'max:2000'],
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
            'remarks.required_if' => 'Add an explanation for a failed or review-needed result.',
        ];
    }
}
