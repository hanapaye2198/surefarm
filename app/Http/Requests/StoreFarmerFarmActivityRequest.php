<?php

namespace App\Http\Requests;

use App\ActivityStatus;
use App\ActivityTypeStatus;
use App\Models\User;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFarmerFarmActivityRequest extends FormRequest
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

        foreach (['description', 'performed_by', 'unit', 'remarks', 'quantity'] as $field) {
            if ($this->input($field) === '') {
                $optional[$field] = null;
            }
        }

        if (! $this->filled('status')) {
            $optional['status'] = ActivityStatus::Completed->value;
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
            'activity_type_id' => [
                'required',
                'integer',
                Rule::exists('activity_types', 'id')->where('status', ActivityTypeStatus::Active->value),
            ],
            'activity_date' => ['required', 'date'],
            'status' => ['required', Rule::enum(ActivityStatus::class)],
            'description' => ['nullable', 'string', 'max:500'],
            'performed_by' => ['nullable', 'string', 'max:255'],
            'quantity' => ['nullable', 'numeric', 'gte:0'],
            'unit' => ['nullable', 'string', 'max:32'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

}
