<?php

namespace App\Http\Requests;

use App\CropType;
use App\HarvestStatus;
use App\Models\FarmHarvest;
use App\Models\User;
use App\Services\ProductionLedger;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateFarmHarvestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->canAccess(UserRole::Operations);
    }

    protected function prepareForValidation(): void
    {
        $optional = [];

        foreach (['quality_grade', 'notes', 'coffee_variety', 'estimated_green_bean_quantity_kg'] as $field) {
            if ($this->input($field) === '') {
                $optional[$field] = null;
            }
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
            'harvest_date' => ['required', 'date'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit' => ['required', 'string', Rule::in(ProductionLedger::UNITS)],
            'coffee_variety' => ['nullable', 'string', 'max:100'],
            'estimated_green_bean_quantity_kg' => ['nullable', 'numeric', 'gt:0', 'max:9999999999.99'],
            'quality_grade' => ['nullable', 'string', 'max:64'],
            'status' => ['required', Rule::enum(HarvestStatus::class)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $harvest = $this->route('harvest');

            if (! $harvest instanceof FarmHarvest) {
                return;
            }

            if ($harvest->status === HarvestStatus::Completed && $this->input('status') === HarvestStatus::Cancelled->value) {
                $validator->errors()->add('status', 'A completed harvest stays in the production history.');
            }

            if ($harvest->farm?->crop_type !== CropType::Coffee
                && ($this->filled('coffee_variety') || $this->filled('estimated_green_bean_quantity_kg'))) {
                $validator->errors()->add('coffee_variety', 'Coffee variety and green bean estimate apply only to coffee farms.');
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
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
