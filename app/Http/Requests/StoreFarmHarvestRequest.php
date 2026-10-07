<?php

namespace App\Http\Requests;

use App\CropType;
use App\HarvestStatus;
use App\Models\Farm;
use App\Models\FarmProduction;
use App\Models\User;
use App\Services\ProductionLedger;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreFarmHarvestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->canAccess(UserRole::Operations);
    }

    protected function prepareForValidation(): void
    {
        $optional = [];

        foreach (['crop_type', 'quality_grade', 'notes'] as $field) {
            if ($this->input($field) === '') {
                $optional[$field] = null;
            }
        }

        if ($this->input('production_id') === '' || $this->input('production_id') === null) {
            $optional['production_id'] = null;
        }

        if (! $this->filled('status')) {
            $optional['status'] = HarvestStatus::Completed->value;
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
            'production_id' => ['nullable', 'integer', 'exists:farm_productions,id'],
            'harvest_date' => ['required', 'date'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit' => ['required', 'string', Rule::in(ProductionLedger::UNITS)],
            'quality_grade' => ['nullable', 'string', 'max:64'],
            'status' => ['required', Rule::enum(HarvestStatus::class)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $farm = Farm::query()->find($this->integer('farm_id'));

            if ($farm !== null && $this->filled('crop_type') && $farm->crop_type->value !== $this->string('crop_type')->toString()) {
                $validator->errors()->add('crop_type', 'The selected crop must belong to this farm.');
            }

            if (! $this->filled('production_id')) {
                return;
            }

            $production = FarmProduction::query()->find($this->integer('production_id'));

            if ($production === null) {
                return;
            }

            if ($farm !== null && $production->farm_id !== $farm->id) {
                $validator->errors()->add('production_id', 'The selected production record must belong to this farm.');
            }

            if ($this->filled('crop_type') && $production->crop_type !== null && $production->crop_type->value !== $this->string('crop_type')->toString()) {
                $validator->errors()->add('crop_type', 'The selected crop must match the production record.');
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
            'harvest_date.required' => 'Harvest date is required.',
            'harvest_date.date' => 'Enter a valid harvest date.',
            'quantity.required' => 'Quantity is required.',
            'quantity.numeric' => 'Quantity must be a number.',
            'quantity.gt' => 'Quantity must be greater than 0.',
            'unit.required' => 'Unit is required.',
            'unit.in' => 'Select kg, tons, or bags.',
            'status.required' => 'Harvest status is required.',
            'status.enum' => 'Select a valid harvest status.',
        ];
    }
}
