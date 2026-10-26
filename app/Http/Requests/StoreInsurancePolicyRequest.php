<?php

namespace App\Http\Requests;

use App\Models\Farm;
use App\Models\FarmProduction;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInsurancePolicyRequest extends FormRequest
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
            'farm_id' => ['required', 'integer', Rule::exists(Farm::class, 'id')],
            'farm_production_id' => ['nullable', 'integer', Rule::exists(FarmProduction::class, 'id')],
            'provider' => ['required', 'string', 'max:160'],
            'policy_type' => ['required', 'string', 'max:120'],
            'amount' => ['required', 'numeric', 'gt:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'insured_area' => ['nullable', 'numeric', 'gt:0', 'lte:999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'premium_amount' => ['required', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'coverage_start' => ['required', 'date'],
            'coverage_end' => ['required', 'date', 'after_or_equal:coverage_start'],
            'terms' => ['nullable', 'string', 'max:5000'],
            'exclusions' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'client_token' => ['required', 'uuid'],
        ];
    }
}
