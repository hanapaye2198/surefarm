<?php

namespace App\Http\Requests;

use App\Models\User;
use App\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class DestroyFarmBoundaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->role === UserRole::Admin;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
