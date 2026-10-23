<?php

namespace App\Support;

class LogRedactor
{
    /**
     * Fragments matched against a normalized log key.
     *
     * @var list<string>
     */
    private const FRAGMENTS = [
        'password',
        'token',
        'secret',
        'authorization',
        'cookie',
        'government_id',
        'account_number',
        'bank_account',
        'bank_name',
        'account_name',
        'recovery_code',
        'two_factor',
        'api_key',
        'credential',
    ];

    /**
     * @param  array<array-key, mixed>  $values
     * @return array<array-key, mixed>
     */
    public function redact(array $values): array
    {
        $redacted = [];

        foreach ($values as $key => $value) {
            if (is_string($key) && $this->isSensitive($key)) {
                $redacted[$key] = '[redacted]';

                continue;
            }

            $redacted[$key] = is_array($value) ? $this->redact($value) : $value;
        }

        return $redacted;
    }

    private function isSensitive(string $key): bool
    {
        $normalized = strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', $key));

        foreach (self::FRAGMENTS as $fragment) {
            if ($normalized === $fragment || str_contains($normalized, $fragment)) {
                return true;
            }
        }

        return false;
    }
}
