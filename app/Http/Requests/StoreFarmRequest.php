<?php

namespace App\Http\Requests;

use App\CropType;
use App\FarmDevelopmentStage;
use App\Models\User;
use App\PropertyOwnership;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFarmRequest extends FormRequest
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
            'farm_name' => ['nullable', 'string', 'max:255'],
            'crop_type' => ['required', Rule::enum(CropType::class)],
            'declared_area_hectares' => ['bail', 'required', 'numeric', 'gt:0', 'lte:99999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'purok_sitio' => ['nullable', 'string', 'max:255'],
            'barangay' => ['nullable', 'string', 'max:255'],
            'municipality' => ['nullable', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'current_stage' => ['nullable', Rule::enum(FarmDevelopmentStage::class)],
            'number_of_hills' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'data_validated' => ['nullable', 'boolean'],
            'property_ownership' => ['nullable', Rule::enum(PropertyOwnership::class)],
            'contracted_value_estimated' => ['nullable', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'input_support_amount' => ['nullable', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'financing_support_amount' => ['nullable', 'numeric', 'gte:0', 'lte:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'drone_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'crop_type.required' => 'Crop type is required.',
            'crop_type.enum' => 'Select a valid crop type.',
            'declared_area_hectares.required' => 'Declared farm area is required.',
            'declared_area_hectares.numeric' => 'Declared farm area must be a number.',
            'declared_area_hectares.gt' => 'Declared farm area must be greater than 0.',
            'declared_area_hectares.lte' => 'Declared farm area is too large.',
            'declared_area_hectares.regex' => 'Declared farm area can have at most 2 decimal places.',
            'latitude.numeric' => 'Enter a valid latitude.',
            'latitude.between' => 'Latitude must be between -90 and 90.',
            'longitude.numeric' => 'Enter a valid longitude.',
            'longitude.between' => 'Longitude must be between -180 and 180.',
            'current_stage.enum' => 'Select a valid farm stage.',
            'number_of_hills.integer' => 'Number of hills must be a whole number.',
            'number_of_hills.min' => 'Number of hills cannot be negative.',
            'property_ownership.enum' => 'Select a valid property ownership.',
            'contracted_value_estimated.numeric' => 'Contracted value must be a number.',
            'contracted_value_estimated.regex' => 'Contracted value can have at most 2 decimal places.',
            'input_support_amount.numeric' => 'Input support must be a number.',
            'input_support_amount.regex' => 'Input support can have at most 2 decimal places.',
            'financing_support_amount.numeric' => 'Financing support must be a number.',
            'financing_support_amount.regex' => 'Financing support can have at most 2 decimal places.',
            'drone_image.image' => 'Drone image must be a JPG, PNG, or WebP image.',
            'drone_image.max' => 'Drone image must be 5 MB or smaller.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'farm_name' => $this->blankToNull('farm_name'),
            'purok_sitio' => $this->blankToNull('purok_sitio'),
            'barangay' => $this->blankToNull('barangay'),
            'municipality' => $this->blankToNull('municipality'),
            'province' => $this->blankToNull('province'),
            'latitude' => $this->blankToNull('latitude'),
            'longitude' => $this->blankToNull('longitude'),
            'notes' => $this->blankToNull('notes'),
            'status' => $this->blankToNull('status'),
            'current_stage' => $this->blankToNull('current_stage'),
            'number_of_hills' => $this->blankToNull('number_of_hills'),
            'data_validated' => $this->nullableBoolean('data_validated'),
            'property_ownership' => $this->blankToNull('property_ownership'),
            'contracted_value_estimated' => $this->blankToNull('contracted_value_estimated'),
            'input_support_amount' => $this->blankToNull('input_support_amount'),
            'financing_support_amount' => $this->blankToNull('financing_support_amount'),
        ]);
    }

    private function blankToNull(string $key): mixed
    {
        $value = $this->input($key);

        if (! is_string($value)) {
            return $value;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function nullableBoolean(string $key): mixed
    {
        $value = $this->input($key);

        if ($value === null || $value === '') {
            return null;
        }

        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        return $parsed === null ? $value : $parsed;
    }
}
