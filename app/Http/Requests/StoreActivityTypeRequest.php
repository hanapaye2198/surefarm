<?php

namespace App\Http\Requests;

use App\ActivityCategory;
use App\ActivityTypeStatus;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreActivityTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->role === UserRole::Admin;
    }

    protected function prepareForValidation(): void
    {
        $optional = [];

        foreach (['code', 'description', 'category'] as $field) {
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
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:64', Rule::unique('activity_types', 'code')],
            'description' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', Rule::enum(ActivityCategory::class)],
            'status' => ['required', Rule::enum(ActivityTypeStatus::class)],
        ];
    }
}
