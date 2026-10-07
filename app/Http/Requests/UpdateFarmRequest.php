<?php

namespace App\Http\Requests;

use App\FarmStatus;
use Illuminate\Validation\Rule;

class UpdateFarmRequest extends StoreFarmRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'status' => ['required', Rule::enum(FarmStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'status.required' => 'Farm status is required.',
        ];
    }
}
