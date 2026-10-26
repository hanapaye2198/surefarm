<?php

namespace App\Http\Requests;

use App\InsuranceIncidentCategory;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInsuranceClaimRequest extends FormRequest
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
            'incident_date' => ['required', 'date', 'before_or_equal:today'],
            'reported_on' => ['required', 'date', 'after_or_equal:incident_date', 'before_or_equal:today'],
            'category' => ['required', Rule::enum(InsuranceIncidentCategory::class)],
            'description' => ['required', 'string', 'max:5000'],
            'claimed_amount' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'client_token' => ['required', 'uuid'],
        ];
    }
}
