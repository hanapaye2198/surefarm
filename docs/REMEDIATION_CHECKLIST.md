# Remediation checklist

Reviewed 2026-10-23 against the repository, the audit documents, and the Pest suite. A page existing is not a completed workflow.

## Priority 1 — Security and data protection

| Finding | Status | Evidence |
|---|---|---|
| Public registration cannot create an account or choose a role | Verified complete | `tests/Feature/Auth/RegistrationTest.php`. Invitation acceptance cannot set a different role (`AccountAccessTest`). |
| Registry records outside the user's scope return 404 | Verified complete | Route binding in `AppServiceProvider`. `RecordAccessTest`. |
| Field verifiers and cooperative officers do not receive government id, bank account, financing, or insurance | Verified complete | `FarmerController::show`, `FarmController::show`. `FarmCoverageTest`, `CooperativeManagementTest`. |
| Government id and account number are encrypted at rest | Verified complete | `encrypted` casts. Migration `2026_10_23_131108`. Local ciphertext prefix `eyJp`. Model reads still work. |
| Farmer edit page returned the full account number | Verified complete | Fixed this phase. The edit props send an empty `account_number` and a last-four hint. A blank update keeps the stored number. `FarmerProfileDetailsTest` asserts the full number is absent. |
| Public trace lookup by sequential lot code | Verified complete | Token route, 40-character pattern, throttle 30/minute. `TraceabilityTest`. |
| Public trace page shows farm name, place, harvest quantity, stage, and verification status | Partially implemented | Accepted exposure for a token holder. It does not show phone, email, government id, bank data, or financing. |
| Login and invitation POST are throttled. Invitation GET is not | Partially implemented | `throttle:6,1` on login and invitation accept. Invitation show has no throttle. Low. |
| Session cookie secure flag and `APP_DEBUG=false` | Blocked by missing configuration | Local `.env` has `APP_DEBUG=true`. No production host was checked. |
| `APP_KEY` backup so encrypted identity values can be restored | Blocked by missing configuration | No restore drill. |

## Priority 2 — Data integrity

| Finding | Status | Evidence |
|---|---|---|
| Harvest receipt unit, cent arithmetic, remaining quantity, receipt token, reversal, and balance alignment | Verified complete | `InventoryIntegrityTest`. |
| Declared area stays separate from measured and verified area | Verified complete | `FarmBoundaryTest`, `FarmVerificationTest`. |
| Verification decisions keep earlier rows | Verified complete | `FarmVerificationTest`. |
| One open cooperative membership, with history after it ends | Verified complete | `CooperativeManagementTest`. |
| Financing and insurance edits replace the current row | Not implemented | No disbursement, repayment, or claim history. Deferred until the owner defines those rules. Excluded from the pilot. |
| Traceability page follows later edits of the farm and harvest | Partially implemented | Lots, tokens, and movement history exist. A frozen public snapshot does not. Current tests expect the live movement history. Owner decision required before changing it. |

## Priority 3 — Core workflow

| Stage | Status | Evidence |
|---|---|---|
| Farmer capture and profile | Verified complete | `FarmerRegistrationTest`, `FarmerProfileDetailsTest`. |
| Farm registration and boundary | Verified complete | `FarmRegistrationTest`, `FarmBoundaryTest`. |
| Verification assignment and decision | Verified complete | `RecordAccessTest`, `FarmVerificationTest`. Operations receive 403 on the verifier route. |
| Activities, production, and harvest | Verified complete | `FarmActivityTest`, `ProductionHarvestTest`. |
| Inventory receipt through lot and public token | Verified complete | `InventoryIntegrityTest`, `TraceabilityTest`. HTTP tests, not a browser pass. |
| Browser walkthrough of that chain | Not implemented | `pestphp/pest-plugin-browser` is not installed. |

## Priority 4 — Interface

| Finding | Status | Evidence |
|---|---|---|
| Verification counts on the dashboard link to the filtered list for that role | Verified complete | `DashboardTest`. |
| Crop, finance, insurance, logistics, and reports navigation | Partially implemented | The pages state they are a future release. They are not workflows. |
| Dashboard map loads every in-scope verified boundary | Partially implemented | No viewport limit. Not measured with a large dataset. |
| Account number field on the edit form | Verified complete | Placeholder is the masked hint. The value is empty. |

## Not a release

Backup, restore, a production host, business acceptance, and a financing ledger remain open. See `docs/PILOT_GO_NO_GO_CHECKLIST.md`. The decision there is still no-go.
