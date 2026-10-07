<?php

namespace App\Http\Requests;

use App\CropType;
use App\Models\Farm;
use App\Models\User;
use App\ProductionStatus;
use App\Services\ProductionLedger;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreFarmProductionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->canAccess(UserRole::Operations);
    }

    protected function prepareForValidation(): void
    {
        $optional = [];

        foreach (['crop_type', 'production_period', 'notes'] as $field) {
            if ($this->input($field) === '') {
                $optional[$field] = null;
            }
        }

        if ($this->input('expected_quantity') === '' || $this->input('expected_quantity') === null) {
            $optional['expected_quantity'] = null;
        }

        if (! $this->filled('status')) {
            $optional['status'] = $optional['expected_quantity'] ?? $this->input('expected_quantity')
                ? ProductionStatus::Active->value
                : ProductionStatus::Planned->value;
        }

        if (! $this->filled('unit')) {
            $optional['unit'] = 'kg';
        }

        if ($optional !== []) {
            $this->merge($optional);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'farm_id' => ['required', 'integer', 'exists:farms,id'],
            'crop_type' => ['nullable', Rule::enum(CropType::class)],
            'production_period' => ['nullable', 'string', 'max:64'],
            'expected_quantity' => ['nullable', 'numeric', 'gt:0'],
            'unit' => ['required', 'string', Rule::in(ProductionLedger::UNITS)],
            'notes' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', Rule::enum(ProductionStatus::class)],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('crop_type')) {
                return;
            }

            $farm = Farm::query()->find($this->integer('farm_id'));

            if ($farm !== null && $farm->crop_type->value !== $this->string('crop_type')->toString()) {
                $validator->errors()->add('crop_type', 'The selected crop must belong to this farm.');
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'farm_id.required' => 'Farm is required.',
            'farm_id.exists' => 'Select a registered farm.',
            'expected_quantity.numeric' => 'Expected quantity must be a number.',
            'expected_quantity.gt' => 'Expected quantity must be greater than 0.',
            'unit.required' => 'Unit is required.',
            'unit.in' => 'Select kg, tons, or bags.',
            'status.enum' => 'Select a valid production status.',
        ];
    }
}
