<?php

namespace App\Http\Requests;

use App\FinancingStatus;
use App\Models\User;
use App\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FinanceIndexRequest extends FormRequest
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
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::enum(FinancingStatus::class)],
            'farmer' => ['nullable', 'integer'],
            'province' => ['nullable', 'string', 'max:120'],
            'municipality' => ['nullable', 'string', 'max:120'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'as_of' => ['nullable', 'date', 'before_or_equal:today'],
            'queue' => ['nullable', Rule::in(['review', 'due', 'overdue'])],
            'sort' => ['nullable', Rule::in(['reference', 'status', 'amount', 'due_date', 'application_date', 'date_granted'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ];
    }

    protected function prepareForValidation(): void
    {
        $cleaned = [];

        foreach (['search', 'status', 'farmer', 'province', 'municipality', 'from', 'to', 'as_of', 'queue', 'sort', 'direction'] as $key) {
            $value = $this->input($key);
            $cleaned[$key] = is_string($value) ? trim($value) : $value;

            if ($cleaned[$key] === '') {
                $cleaned[$key] = null;
            }
        }

        $this->merge($cleaned);
    }
}
