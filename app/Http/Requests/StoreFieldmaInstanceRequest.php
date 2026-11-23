<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFieldmaInstanceRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'slug' => [
                'required',
                'string',
                'max:120',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('fieldma_instances', 'slug'),
            ],
            'app_url' => ['required', 'url:http,https', 'max:255'],
            'db_ip' => ['required', 'string', 'max:255', 'regex:/^[a-zA-Z0-9.\-:]+$/'],
            'db_port' => ['required', 'integer', 'between:1,65535'],
            'db_database' => ['required', 'string', 'max:128', 'regex:/^[a-zA-Z0-9_$-]+$/'],
            'db_user' => ['required', 'string', 'max:128'],
            'db_password' => ['required', 'string', 'max:255'],
            'is_active' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->slug)) {
            $this->merge([
                'slug' => strtolower(trim($this->slug)),
            ]);
        }
    }
}
