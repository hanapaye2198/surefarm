<?php

use App\Actions\Fortify\CreateNewUser;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\UserInvitationNotification;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

test('a user inserted without a role receives the farmer role', function () {
    DB::table('users')->insert([
        'name' => 'Raw Account',
        'email' => 'raw-account@example.com',
        'password' => Hash::make('password'),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(User::query()->where('email', 'raw-account@example.com')->first()?->role)
        ->toBe(UserRole::Farmer);
});

test('the registration action assigns the farmer role', function () {
    $user = app(CreateNewUser::class)->create([
        'name' => 'Fallback User',
        'email' => 'fallback@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    expect($user->role)->toBe(UserRole::Farmer);
});

test('an administrator can invite a user and the token is not stored in plaintext', function () {
    Notification::fake();
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->post(route('user-invitations.store'), [
            'name' => "Ada <script>alert('xss')</script>",
            'email' => 'ada@example.com',
            'role' => UserRole::Operations->value,
        ])
        ->assertRedirect(route('users.index'));

    $invitation = UserInvitation::query()->firstOrFail();
    $url = null;

    Notification::assertSentOnDemand(
        UserInvitationNotification::class,
        function (UserInvitationNotification $notification) use (&$url, $invitation): bool {
            $url = $notification->acceptUrl;

            return str_contains($notification->acceptUrl, '/invitations/')
                && ! str_contains($notification->acceptUrl, $invitation->token_hash);
        },
    );

    expect($url)->toBeString()
        ->and($invitation->token_hash)->not->toBe(basename((string) $url))
        ->and($invitation->role)->toBe(UserRole::Operations);

    $mail = (new UserInvitationNotification(
        recipientName: $invitation->name,
        roleLabel: $invitation->role->label(),
        acceptUrl: (string) $url,
    ))->toMail(Notification::route('mail', $invitation->email))->render();

    $rendered = (string) $mail;

    expect($rendered)->toContain('Ada');
    expect($rendered)->not->toContain("<script>alert('xss')</script>");
});

test('an invited operations account is sent to set up security', function () {
    Notification::fake();
    $admin = User::factory()->create();
    $url = invitationUrl($admin, [
        'email' => 'ops@example.com',
        'role' => UserRole::Operations->value,
    ]);

    $this->post(route('logout'));

    $this->post($url, [
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('security.edit'));

    expect(User::query()->where('email', 'ops@example.com')->first()?->role)
        ->toBe(UserRole::Operations);
});

test('an invited person accepts once and cannot choose a different role', function () {
    Notification::fake();
    $admin = User::factory()->create();
    $url = invitationUrl($admin, [
        'email' => 'farmer@example.com',
        'role' => UserRole::Farmer->value,
    ]);

    $this->post(route('logout'));

    $this->post($url, [
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => UserRole::Admin->value,
    ])->assertRedirect(route('dashboard'));

    $user = User::query()->where('email', 'farmer@example.com')->firstOrFail();

    expect($user->role)->toBe(UserRole::Farmer)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(UserInvitation::query()->firstOrFail()->accepted_at)->not->toBeNull();

    $this->post(route('logout'));
    $this->get($url)->assertNotFound();
});

test('an invitation cannot be accepted after it expires or is revoked', function () {
    Notification::fake();
    $admin = User::factory()->create();
    $expiredUrl = invitationUrl($admin, ['email' => 'expired@example.com']);

    $this->travel(73)->hours();
    $this->post(route('logout'));
    $this->get($expiredUrl)->assertNotFound();
    $this->travelBack();

    $revokedUrl = invitationUrl($admin, ['email' => 'revoked@example.com']);
    $invitation = UserInvitation::query()->where('email', 'revoked@example.com')->firstOrFail();

    $this->actingAs($admin)
        ->delete(route('user-invitations.destroy', $invitation))
        ->assertRedirect(route('users.index'));

    $this->post(route('logout'));
    $this->get($revokedUrl)->assertNotFound();
});

test('a newer invitation replaces an open invitation for the same email', function () {
    Notification::fake();
    $admin = User::factory()->create();
    $first = invitationUrl($admin, ['email' => 'again@example.com']);
    $second = invitationUrl($admin, ['email' => 'again@example.com', 'role' => UserRole::FieldVerifier->value]);

    $this->post(route('logout'));
    $this->get($first)->assertNotFound();

    $this->post($second, [
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('dashboard'));

    expect(User::query()->where('email', 'again@example.com')->first()?->role)
        ->toBe(UserRole::FieldVerifier);
});

test('only an administrator can manage accounts', function (UserRole $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)
        ->get(route('users.index'))
        ->assertForbidden();

    $this->actingAs($user)
        ->post(route('user-invitations.store'), [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'role' => UserRole::Admin->value,
        ])
        ->assertForbidden();

    expect(User::query()->where('email', 'someone@example.com')->exists())->toBeFalse();
})->with([
    'operations' => UserRole::Operations,
    'field verifier' => UserRole::FieldVerifier,
    'farmer' => UserRole::Farmer,
]);

test('an administrator can view accounts without invitation secrets', function () {
    Notification::fake();
    $admin = User::factory()->create();
    invitationUrl($admin, ['email' => 'visible@example.com']);

    $this->actingAs($admin)
        ->get(route('users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('users/index')
            ->where('invitations.0.email', 'visible@example.com')
            ->missing('invitations.0.token_hash')
            ->missing('users.data.0.password')
            ->has('stats'));
});

test('an administrator cannot change their own role or suspend themselves', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->from(route('users.index'))
        ->patch(route('users.update', $admin), [
            'role' => UserRole::Operations->value,
        ])
        ->assertRedirect(route('users.index'))
        ->assertSessionHasErrors('role');

    $this->actingAs($admin)
        ->from(route('users.index'))
        ->post(route('users.suspension.store', $admin))
        ->assertRedirect(route('users.index'))
        ->assertSessionHasErrors('user');

    expect($admin->refresh()->role)->toBe(UserRole::Admin)
        ->and($admin->suspended_at)->toBeNull();
});

test('profile updates cannot change a role', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->patch(route('profile.update'), [
            'name' => 'Still Admin',
            'email' => $admin->email,
            'role' => UserRole::Farmer->value,
        ])
        ->assertRedirect(route('profile.edit'));

    expect($admin->refresh()->role)->toBe(UserRole::Admin)
        ->and($admin->name)->toBe('Still Admin');
});

test('the last active administrator cannot be deleted', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ])
        ->assertRedirect(route('profile.edit'))
        ->assertSessionHasErrors('password');

    expect($admin->fresh())->not->toBeNull();
});

test('an administrator can suspend and restore another account', function () {
    $admin = User::factory()->create();
    $staff = User::factory()->create(['role' => UserRole::Operations]);

    $this->actingAs($admin)
        ->post(route('users.suspension.store', $staff))
        ->assertRedirect(route('users.index'));

    expect($staff->refresh()->suspended_at)->not->toBeNull();

    $this->post(route('logout'));

    $this->post(route('login.store'), [
        'email' => $staff->email,
        'password' => 'password',
    ])->assertSessionHasErrors([
        'email' => 'This account is suspended.',
    ]);

    $this->assertGuest();

    $this->actingAs($admin)
        ->delete(route('users.suspension.destroy', $staff))
        ->assertRedirect(route('users.index'));

    expect($staff->refresh()->suspended_at)->toBeNull();

    $this->post(route('logout'));

    $this->post(route('login.store'), [
        'email' => $staff->email,
        'password' => 'password',
    ])->assertRedirect(route('dashboard', absolute: false));
});

test('a suspended session is ended on the next request', function () {
    $admin = User::factory()->create();
    $staff = User::factory()->create(['role' => UserRole::FieldVerifier]);

    $this->actingAs($admin)
        ->post(route('users.suspension.store', $staff));

    $this->actingAs($staff->fresh())
        ->get(route('farmers.index'))
        ->assertRedirect(route('login'));

    $this->assertGuest();
});

test('a wrong password does not reveal that an account is suspended', function () {
    $staff = User::factory()->create([
        'role' => UserRole::Operations,
        'suspended_at' => now(),
    ]);

    $this->post(route('login.store'), [
        'email' => $staff->email,
        'password' => 'wrong-password',
    ])->assertSessionHasErrors([
        'email' => trans('auth.failed'),
    ]);
});

test('administrator and operations access requires confirmed two-factor authentication', function () {
    config(['auth.require_two_factor' => true]);

    $admin = User::factory()->create();
    $operations = User::factory()->create(['role' => UserRole::Operations]);
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $confirmed = User::factory()->withTwoFactor()->create();

    $this->actingAs($admin)
        ->get(route('dashboard'))
        ->assertRedirect(route('security.edit'));

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk();

    $this->actingAs($admin)
        ->post(route('logout'))
        ->assertRedirect(route('home'));

    $this->actingAs($operations)
        ->get(route('farmers.index'))
        ->assertRedirect(route('security.edit'));

    $this->actingAs($verifier)
        ->get(route('farmers.index'))
        ->assertOk();

    $this->actingAs($confirmed)
        ->get(route('dashboard'))
        ->assertOk();
});

test('an administrator can request passkey registration options while setting up two-factor authentication', function () {
    config(['auth.require_two_factor' => true]);

    $admin = User::factory()->create(['role' => UserRole::Admin]);

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->getJson(route('passkey.registration-options'))
        ->assertOk()
        ->assertJsonStructure(['options']);
});

/**
 * @param  array<string, string>  $overrides
 */
function invitationUrl(User $admin, array $overrides = []): string
{
    test()->actingAs($admin)
        ->post(route('user-invitations.store'), [
            'name' => 'Invited Person',
            'email' => 'invited@example.com',
            'role' => UserRole::Operations->value,
            ...$overrides,
        ])
        ->assertRedirect(route('users.index'));

    $urls = [];

    Notification::assertSentOnDemand(
        UserInvitationNotification::class,
        function (UserInvitationNotification $notification) use (&$urls): bool {
            $urls[] = $notification->acceptUrl;

            return str_contains($notification->acceptUrl, '/invitations/');
        },
    );

    $url = $urls[array_key_last($urls)] ?? null;

    expect($url)->toBeString();

    return (string) $url;
}
