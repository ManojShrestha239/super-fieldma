<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthAndShellTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_from_dashboard_to_login(): void
    {
        $response = $this->get('/');

        $response->assertRedirect(route('login'));
    }

    public function test_login_page_renders_for_guests(): void
    {
        $response = $this->get('/login');

        $response->assertOk();
    }

    public function test_provisioned_admin_can_sign_in_and_view_dashboard(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@fieldma.local',
        ]);

        $response = $this->post('/login', [
            'email' => $admin->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticatedAs($admin);

        $dashboard = $this->actingAs($admin)->get('/');
        $dashboard->assertOk();
        $this->assertTrue($admin->isAdmin());
    }

    public function test_viewer_role_is_not_admin(): void
    {
        $viewer = User::factory()->create([
            'role' => UserRole::Viewer,
        ]);

        $this->assertFalse($viewer->isAdmin());
        $this->actingAs($viewer)->get('/')->assertOk();
    }

    public function test_invalid_credentials_are_rejected(): void
    {
        User::factory()->create([
            'email' => 'ops@fieldma.local',
        ]);

        $response = $this->from('/login')->post('/login', [
            'email' => 'ops@fieldma.local',
            'password' => 'wrong-password',
        ]);

        $response->assertRedirect('/login');
        $response->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $response->assertRedirect(route('login'));
        $this->assertGuest();
    }
}
