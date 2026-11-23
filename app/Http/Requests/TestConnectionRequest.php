<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\FieldmaInstance;
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
        $hasExistingInstance = $this->route('instance') instanceof FieldmaInstance;

        return [
            'db_ip' => [$hasExistingInstance ? 'sometimes' : 'required', 'string', 'max:255', 'regex:/^[a-zA-Z0-9.\-:]+$/'],
            'db_port' => [$hasExistingInstance ? 'sometimes' : 'required', 'integer', 'between:1,65535'],
            'db_database' => [$hasExistingInstance ? 'sometimes' : 'required', 'string', 'max:128', 'regex:/^[a-zA-Z0-9_$-]+$/'],
            'db_user' => [$hasExistingInstance ? 'sometimes' : 'required', 'string', 'max:128'],
            'db_password' => [$hasExistingInstance ? 'nullable' : 'required', 'string', 'max:255'],
        ];
    }
}
