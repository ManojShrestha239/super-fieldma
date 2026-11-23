<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TestConnectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'db_ip' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:/^[a-zA-Z0-9.\-:]+$/'],
            'db_port' => ['sometimes', 'nullable', 'integer', 'between:1,65535'],
            'db_database' => ['sometimes', 'nullable', 'string', 'max:128', 'regex:/^[a-zA-Z0-9_$-]+$/'],
            'db_user' => ['sometimes', 'nullable', 'string', 'max:128'],
            'db_password' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
