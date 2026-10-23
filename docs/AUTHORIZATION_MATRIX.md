# Authorization matrix

Roles are `admin`, `operations`, `field_verifier`, `cooperative_officer`, and `farmer`. A role does not grant national registry access.

Scope rules live in `App\Services\RegistryScope` and the route bindings in `App\Providers\AppServiceProvider`. Out-of-scope records return 404. An in-scope user with the wrong role receives 403 from role middleware.

| Capability | Admin | Operations | Field verifier | Cooperative officer | Farmer |
|---|---|---|---|---|---|
| Manage users, invitations, suspension, role | Yes, without a registry grant | No | No | No | No |
| Grant registry scope | Yes. Cannot grant scope to self. Cannot drop the last active admin platform grant. | No | No | No | No |
| Read the national registry | Only with an open platform grant | Only with an open platform grant | No | No | No |
| Read a province | With a province grant, or a platform grant | With a province grant, or a platform grant | No | No | No |
| Read assigned farms only | No, unless a grant or assignment says so | No, unless a grant says so | Open `farm_verifier_assignments` only | No | No |
| Read a cooperative's farmers and farms | With registry scope | With registry scope | No | Open `cooperative_officers` row for that cooperative | No |
| See government ID, bank account, financing, insurance | With registry scope | With registry scope | Hidden on the farmer profile and the farm page | Hidden on the farmer profile and the farm page | Own linked farmer and farms only |
| Register and edit farmers, farms, harvests, inventory | With operations access and scope | With scope | No | No | No |
| Enroll, suspend, or end cooperative membership | With operations access | Yes, for farmers inside scope | No | No | No |
| Decide farm verification | Through the verifier routes, because an administrator can open every role | No. The verifier routes return 403 | Starts and submits only an assigned farm | No | No |
| Public trace page | Anyone with the 40-character token | Same | Same | Same | Same |
| Placeholder modules | Authenticated | Authenticated | Authenticated | Authenticated | Authenticated |

`canAccess(Operations)` is true for administrators, so administrator accounts that also hold a registry grant can run operations writes.

Two-factor confirmation is required for administrator and operations when `AUTH_REQUIRE_TWO_FACTOR` is true. Field verifiers, cooperative officers, and farmers are not required to confirm it. PHPUnit sets the flag to false.

Suspended users are rejected at login and on the next request by `EnsureAccountIsActive`.
