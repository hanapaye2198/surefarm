<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Services\FarmBoundaryGeometry;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class SaveFarmBoundaryRequest extends FormRequest
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
            'boundary_geojson' => ['required', 'array'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $message = app(FarmBoundaryGeometry::class)->message($this->input('boundary_geojson'));

                if ($message !== null) {
                    $validator->errors()->add('boundary_geojson', $message);
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'boundary_geojson.required' => 'Enter a polygon boundary.',
            'boundary_geojson.array' => 'Enter a polygon boundary.',
        ];
    }
}
