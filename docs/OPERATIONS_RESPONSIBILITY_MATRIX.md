# Operations responsibility matrix

A role in the software is not a named owner. Every row below needs a person assigned by the project owner before a pilot starts. Nobody is assigned today.

The administrator account can open every role-gated page. That does not make the administrator the approver of verification, stock, or money. Where two roles are listed, one person should not hold both for the same record.

| Duty | Does the work | Approves | Must not be the same person as | System support | Named owner |
|---|---|---|---|---|---|
| Create, suspend, and restore accounts | Administrator | Project owner | The account being changed | Invitation mail, suspension middleware | Unassigned |
| Grant platform or province scope | Administrator | Project owner | The user receiving the grant. Self-grant is blocked. | `RegistryGrant` | Unassigned |
| Assign or revoke a field verifier | Administrator | Verification lead | The verifier, for their own assignment | `farm_verifier_assignments` | Unassigned |
| Assign or revoke a cooperative officer | Operations or administrator | Cooperative lead | The officer | `cooperative_officers` | Unassigned |
| Register and correct a farmer | Operations, inside scope | Operations supervisor | The farmer's own user, for someone else's record | Farmer forms | Unassigned |
| Enroll, suspend, or end membership | Operations, for a farmer they can see | Operations supervisor | Cooperative officer. Officers cannot enroll. | Membership actions | Unassigned |
| Register a farm and its boundary | Operations | Operations supervisor | Field verifier | Farm and boundary actions | Unassigned |
| Record a verification decision | Assigned field verifier | Verification lead reviews disputes; the system stores every decision | Operations. The verifier routes return 403 for operations. | `FarmVerificationController` | Unassigned |
| Record a harvest and an inventory receipt | Operations | Inventory custodian | Field verifier and farmer. Both are refused on the write routes. | Inventory actions | Unassigned |
| Align a stored stock balance | Operations, with a reason | Inventory custodian | The person who entered the receipt being questioned | `AlignInventoryBalance` | Unassigned |
| Edit financing or insurance | Operations | Not approved. The row is overwritten. | — | Excluded from the pilot | Unassigned |
| Review a claim | — | — | — | Not implemented | Unassigned |
| Retrieve a photo or drone image | A user who can already open that farmer or farm | Operations supervisor for a copy outside the app | A user outside registry scope. The route returns 404. | `farmers.photo`, `farms.drone-image` | Unassigned |
| Accept an incident | First person who sees it | Incident owner | The person whose account is suspected, when the incident is account takeover | `docs/INCIDENT_RESPONSE_RUNBOOK.md` | Unassigned |
| Confirm a backup and a restore | Deployment engineer, on a copy | Project owner | The only person who knows `APP_KEY`, if no second copy exists | Not implemented in the app | Unassigned |
| Approve a deployment | Deployment engineer prepares | Project owner | — | `docs/DEPLOYMENT_RUNBOOK.md` | Unassigned |
| Approve a rollback | Deployment engineer executes | Project owner | — | Restore database and `APP_KEY` together | Unassigned |

Separation already enforced by the software:

- A user cannot change their own role or suspend themselves.
- The last active administrator cannot be removed, and cannot drop their own last platform grant.
- Operations cannot post a verification decision.
- Cooperative officers cannot enroll members.
- Farmers cannot register farmers, verify farms, or post receipts.
- Out-of-scope record ids return 404.
