<?php

namespace App\Http\Requests;

use App\CropType;
use App\HarvestStatus;
use App\Models\Farm;
use App\Models\User;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreFarmerHarvestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && $user->role === UserRole::Farmer
            && $user->farmer()->exists();
    }

    protected function prepareForValidation(): void
    {
        $optional = [];

        foreach (['production_id', 'quality_grade', 'notes'] as $field) {
            if ($this->input($field) === '') {
                $optional[$field] = null;
            }
        }

        foreach (['coffee_variety', 'estimated_green_bean_quantity_kg'] as $field) {
            if ($this->input($field) === '') {
                $optional[$field] = null;
            }
        }

        if ($this->input('photos_metadata') === '') {
            $optional['photos_metadata'] = null;
        } elseif (is_string($this->input('photos_metadata'))) {
            $metadata = json_decode($this->input('photos_metadata'), true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $optional['photos_metadata'] = $metadata;
            }
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

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $user = $this->user();
        $farmerId = $user instanceof User ? $user->farmer()->value('id') : null;

        return [
            'farm_id' => [
                'required',
                'integer',
                Rule::exists('farms', 'id')->where('farmer_id', $farmerId),
            ],
            'crop_type' => ['nullable', Rule::enum(CropType::class)],
            'coffee_variety' => ['nullable', 'string', 'max:100'],
            'estimated_green_bean_quantity_kg' => ['nullable', 'numeric', 'gt:0', 'max:9999999999.99'],
            'production_id' => [
                'nullable',
                'integer',
                Rule::exists('farm_productions', 'id')->where('farm_id', $this->integer('farm_id')),
            ],
            'harvest_date' => ['required', 'date'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit' => ['required', 'string', Rule::in(['kg', 'tons', 'bags'])],
            'quality_grade' => ['nullable', 'string', 'max:64'],
            'status' => [
                'required',
                Rule::in([HarvestStatus::InProgress->value, HarvestStatus::Completed->value]),
            ],
            'notes' => ['nullable', 'string', 'max:1000'],
            'photos' => ['nullable', 'array', 'max:6'],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'photos_metadata' => ['nullable', 'array', 'max:6'],
            'photos_metadata.*.captured_at' => ['nullable', 'date'],
            'photos_metadata.*.latitude' => ['nullable', 'required_with:photos_metadata.*.longitude', 'numeric', 'between:-90,90'],
            'photos_metadata.*.longitude' => ['nullable', 'required_with:photos_metadata.*.latitude', 'numeric', 'between:-180,180'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('farm_id')) {
                return;
            }

            $user = $this->user();
            $farmerId = $user instanceof User ? $user->farmer()->value('id') : null;
            $farm = Farm::query()
                ->whereKey($this->integer('farm_id'))
                ->where('farmer_id', $farmerId)
                ->first();

            if ($farm !== null && $this->filled('crop_type') && $farm->crop_type !== CropType::tryFrom((string) $this->input('crop_type'))) {
                $validator->errors()->add('crop_type', 'The harvest crop must match your farm.');
            }

            if ($farm !== null
                && ($this->filled('coffee_variety') || $this->filled('estimated_green_bean_quantity_kg'))
                && $farm->crop_type !== CropType::Coffee) {
                $validator->errors()->add('coffee_variety', 'Coffee variety and green bean estimate apply only to coffee farms.');
            }

            $photos = $this->file('photos', []);
            $metadata = $this->input('photos_metadata');
            if (is_array($metadata) && count($metadata) !== count(is_array($photos) ? $photos : [])) {
                $validator->errors()->add('photos_metadata', 'Photo details must match the selected harvest photos.');
            }
        });
    }
}
