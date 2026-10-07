<?php

namespace App\Http\Requests;

use App\ActivityStatus;
use App\ActivityTypeStatus;
use App\CropType;
use App\Models\FarmActivity;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateFarmActivityRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->canAccess(UserRole::Operations);
    }

    protected function prepareForValidation(): void
    {
        $optional = [];

        foreach (['crop_type', 'description', 'performed_by', 'unit', 'remarks'] as $field) {
            if ($this->input($field) === '') {
                $optional[$field] = null;
            }
        }

        foreach (['quantity', 'cost_amount'] as $field) {
            if ($this->input($field) === '' || $this->input($field) === null) {
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
        $activity = $this->route('activity');
        $currentTypeId = $activity instanceof FarmActivity ? $activity->activity_type_id : null;

        return [
            'activity_type_id' => [
                'required',
                'integer',
                Rule::exists('activity_types', 'id')->where(function ($query) use ($currentTypeId): void {
                    $query->where('status', ActivityTypeStatus::Active->value);

                    if ($currentTypeId !== null && (int) $this->input('activity_type_id') === (int) $currentTypeId) {
                        $query->orWhere('id', $currentTypeId);
                    }
                }),
            ],
            'crop_type' => ['nullable', Rule::enum(CropType::class)],
            'activity_date' => ['required', 'date'],
            'status' => ['required', Rule::enum(ActivityStatus::class)],
            'description' => ['nullable', 'string', 'max:500'],
            'performed_by' => ['nullable', 'string', 'max:255'],
            'quantity' => ['nullable', 'numeric', 'gte:0'],
            'unit' => ['nullable', 'string', 'max:32'],
            'cost_amount' => ['nullable', 'numeric', 'gte:0'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('crop_type')) {
                return;
            }

            $activity = $this->route('activity');

            if (! $activity instanceof FarmActivity) {
                return;
            }

            $farm = $activity->farm;

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
            'activity_type_id.required' => 'Activity type is required.',
            'activity_type_id.exists' => 'Select an active activity type.',
            'activity_date.required' => 'Activity date is required.',
            'activity_date.date' => 'Enter a valid activity date.',
            'status.required' => 'Activity status is required.',
            'status.enum' => 'Select a valid activity status.',
            'quantity.numeric' => 'Quantity must be a number.',
            'quantity.gte' => 'Quantity cannot be negative.',
            'cost_amount.numeric' => 'Cost must be a number.',
            'cost_amount.gte' => 'Cost cannot be negative.',
        ];
    }
}
