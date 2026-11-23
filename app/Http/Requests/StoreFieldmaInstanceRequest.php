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
            'app_url' => ['nullable', 'url:http,https', 'max:255'],
            'db_ip' => ['nullable', 'string', 'max:255', 'regex:/^[a-zA-Z0-9.\-:]+$/'],
            'db_port' => ['nullable', 'integer', 'between:1,65535'],
            'db_database' => ['required', 'string', 'max:128', 'regex:/^[a-zA-Z0-9_$-]+$/'],
            'db_user' => ['nullable', 'string', 'max:128'],
            'db_password' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $slug = is_string($this->slug) ? strtolower(trim($this->slug)) : '';

        $this->merge([
            'slug' => $slug,
            'app_url' => $this->filled('app_url') ? $this->input('app_url') : config('fieldma.default_app_url'),
            'db_ip' => $this->filled('db_ip') ? $this->input('db_ip') : config('fieldma.default_db_host'),
            'db_port' => $this->filled('db_port') ? (int) $this->input('db_port') : (int) config('fieldma.default_db_port'),
            'db_user' => $this->filled('db_user') ? $this->input('db_user') : config('fieldma.default_db_user'),
            'db_password' => $this->filled('db_password') ? $this->input('db_password') : config('fieldma.default_db_password'),
            'is_active' => $this->has('is_active') ? $this->boolean('is_active') : true,
        ]);
    }
}
