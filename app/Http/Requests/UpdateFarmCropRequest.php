<?php

namespace App\Http\Requests;

use App\CropRecordStatus;
use App\CropType;
use App\Models\FarmCrop;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateFarmCropRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->canAccess(UserRole::Operations);
    }

    protected function prepareForValidation(): void
    {
        $optional = [];

        foreach (['variety', 'area_hectares', 'planted_on', 'notes'] as $field) {
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
            'crop_type' => ['required', Rule::enum(CropType::class)],
            'variety' => ['nullable', 'string', 'max:120'],
            'area_hectares' => ['nullable', 'numeric', 'gt:0', 'lte:99999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'planted_on' => ['nullable', 'date'],
            'status' => ['required', Rule::enum(CropRecordStatus::class)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('crop_type')) {
                return;
            }

            $crop = $this->route('crop');
            $farm = $crop instanceof FarmCrop ? $crop->farm : null;

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
            'crop_type.required' => 'Crop is required.',
            'crop_type.enum' => 'Select a valid crop.',
            'variety.max' => 'Variety must be 120 characters or fewer.',
            'area_hectares.numeric' => 'Planted area must be a number.',
            'area_hectares.gt' => 'Planted area must be greater than 0.',
            'area_hectares.lte' => 'Planted area is too large.',
            'area_hectares.regex' => 'Planted area can have at most 2 decimal places.',
            'planted_on.date' => 'Planted date must be a valid date.',
            'status.required' => 'Crop status is required.',
            'status.enum' => 'Select a valid crop status.',
            'notes.max' => 'Notes must be 1000 characters or fewer.',
        ];
    }
}
