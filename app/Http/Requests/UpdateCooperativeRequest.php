<?php

namespace App\Http\Requests;

use App\Models\Cooperative;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCooperativeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && ! $user->isSuspended()
            && $user->canAccess(UserRole::Operations);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $cooperative = $this->route('cooperative');

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'nullable',
                'string',
                'max:32',
                Rule::unique('cooperatives', 'code')->ignore($cooperative instanceof Cooperative ? $cooperative->id : null),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Cooperative name is required.',
            'code.unique' => 'That cooperative code is already in use.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $code = $this->input('code');

        $this->merge([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
            'code' => $code === '' || $code === null ? null : $code,
        ]);
    }
}
