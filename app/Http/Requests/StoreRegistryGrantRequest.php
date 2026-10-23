<?php

namespace App\Http\Requests;

use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRegistryGrantRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && ! $user->isSuspended()
            && $user->role === UserRole::Admin;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'kind' => ['required', Rule::enum(RegistryGrantKind::class)],
            'province' => ['nullable', 'string', 'max:100', 'required_if:kind,province'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kind.required' => 'Choose the kind of access.',
            'province.required_if' => 'Enter the province this account may work in.',
        ];
    }
}
