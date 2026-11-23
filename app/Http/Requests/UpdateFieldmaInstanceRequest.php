<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\FieldmaInstance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFieldmaInstanceRequest extends FormRequest
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
        /** @var FieldmaInstance $instance */
        $instance = $this->route('instance');

        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => [
                'required',
                'string',
                'max:120',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('fieldma_instances', 'slug')->ignore($instance->id),
            ],
            'app_url' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'db_ip' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:/^[a-zA-Z0-9.\-:]+$/'],
            'db_port' => ['sometimes', 'nullable', 'integer', 'between:1,65535'],
            'db_database' => ['required', 'string', 'max:128', 'regex:/^[a-zA-Z0-9_$-]+$/'],
            'db_user' => ['sometimes', 'nullable', 'string', 'max:128'],
            'db_password' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
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
