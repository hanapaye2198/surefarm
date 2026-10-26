# SureFarm release readiness audit

Audit date: 2026-10-23. Evidence is from the repository, the local MySQL database, and the checks listed below. A passing test suite is not production readiness.

## Release classification

**Blocked.**

Critical application controls exist for accounts, registry scope, inventory receipts, and cooperative membership. Government IDs and bank account numbers are encrypted at rest as of migration `2026_10_23_131108`. The release stays blocked because financing and insurance are still single mutable rows, traceability history still reads live source records, and backup, restore, and deployment have not been verified on a host. A lost `APP_KEY` makes the encrypted identity values unreadable.

## Checks executed in this batch

| Check                                                  | Result                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `php artisan test --compact`                           | Passed. 240 tests, 2214 assertions.                                                                                                                                                                                            |
| `vendor/bin/pint --dirty --format agent`               | Passed.                                                                                                                                                                                                                        |
| PHPStan level 7 on the traceability files touched here | Pre-existing errors remain in `CreateTraceabilityLot` and `TraceabilityJourney` (quantity float/string, date casts). The new public-token lines are not in that error list. A clean full-project PHPStan run was not produced. |
| `php artisan migrate --no-interaction`                 | Applied `2026_10_23_125631_add_public_token_to_traceability_lots_table`. The one existing lot received a token.                                                                                                                |
| TypeScript and frontend production build               | Not re-run. This batch did not change React components.                                                                                                                                                                        |
| Browser end-to-end suite                               | Not present. `pestphp/pest-plugin-browser` is not installed.                                                                                                                                                                   |
| Dependency vulnerability scan                          | Not run.                                                                                                                                                                                                                       |
| Backup restore drill                                   | Not verified. No backup host or credentials are configured in the repository.                                                                                                                                                  |

## Phase 9 checks (2026-10-23)

| Check                                                                | Result                                                                                                                                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php artisan test --compact`                                         | Passed. 241 tests, 2,304 assertions.                                                                                                                                                                  |
| `vendor/bin/pint --dirty --format agent`                             | Passed.                                                                                                                                                                                               |
| PHPStan on `Farmer`, `FarmerBankAccount`, and the identity migration | Passed. Full-project PHPStan was not re-run; the previous run reported 363 pre-existing errors.                                                                                                       |
| `php artisan migrate --no-interaction`                               | Applied `2026_10_23_131108_encrypt_farmer_identity_secrets`. The one stored government id and the one stored account number now start with the Laravel ciphertext prefix. The model still reads them. |
| TypeScript and frontend build                                        | Not re-run. This change did not touch React.                                                                                                                                                          |
| Browser end-to-end, backup restore, dependency scan                  | Not run.                                                                                                                                                                                              |

## Verified earlier: public trace token

Public traceability no longer looks up lots by the sequential code `SF-YEAR-000001`.

- `traceability_lots.public_token` is a 40-character random value, unique, and assigned when a lot is created.
- `GET /trace/{token}` accepts only that shape and is limited to 30 requests per minute.
- `GET /trace/SF-2026-000001` does not return the public record. Covered by `tests/Feature/TraceabilityTest.php`.
- The public payload still omits phone, email, government ID, bank account, financing amounts, and lot notes. The human lot code remains visible after a valid token is presented.
- Existing printed QR codes that used the sequential code will not resolve until they are reprinted from the lot page. The lot page builds the URL from `public_token`.

## Verified completed features

These paths have working routes, actions, and feature tests in the repository.

- Invitation-only provisioning, least-privilege farmer default, suspension, and role changes that cannot be self-served. Administrator and operations accounts require confirmed two-factor authentication when `AUTH_REQUIRE_TWO_FACTOR` is true. Tests force that flag false.
- Registry scope: platform grant, province grant, field-verifier assignment, farmer self-record, and cooperative-officer assignment. Out-of-scope ids return 404.
- Farmer and farm registration, boundaries, verification decisions, activities, production, and harvests.
- Inventory receipt rules: same unit as the harvest, integer-cent quantities, remaining receivable, idempotent receipt token, reversal movement, and stored-balance alignment without a new movement.
- Cooperative registry, one open membership per farmer, membership history, and officer assignments.
- Request id, log redaction of password, government id, and account number keys, `/up` liveness, and `/ready` dependency checks that omit connection details.

## Partially implemented

| Area               | What exists                                                                                                          | What does not                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Financing          | A farm financing row can be created and edited by operations inside registry scope.                                  | No disbursement or repayment ledger. `loan_balance` is a mutable decimal column.                                                  |
| Insurance          | A coverage row can be created and edited.                                                                            | No claim workflow, expiry job, or document pack.                                                                                  |
| Traceability       | Lots, events, QR, and a public page.                                                                                 | Events point at live harvest and inventory rows. Editing those rows changes what a later reader calculates. There is no snapshot. |
| Documents          | Farmer photos and drone images are served through authorized controller actions on the local disk.                   | No general private document model, version history, or access log for downloads.                                                  |
| Dashboard          | Counts and map points come from scoped queries.                                                                      | Verified boundaries are loaded without a viewport limit.                                                                          |
| Queues             | Default connection is `database`. Invitations implement `ShouldQueue`. `composer dev` runs `queue:listen --tries=1`. | `after_commit` is false. Retry and failed-job operations are not covered by tests.                                                |
| Navigation modules | Crop management, finance, insurance, logistics and export, and reports open an explicit future-release page.         | They are not workflows. The links remain in the sidebar.                                                                          |

## Missing

- Crop seasons, input applications, and pest observations as their own workflow.
- Warehouses, transfers, shipments, and buyers.
- Report filters and authorized exports.
- A farmer home beyond the scoped registry pages a linked farmer can already open.
- A tested backup of `APP_KEY` together with the database. Identity values are encrypted with that key.
- An external error tracker. `ERROR_TRACKING_DRIVER=log` only writes the application log.
- Backup, restore, and a deployment host.

## Security findings

| Finding                                                             | Severity                                | Status                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sequential public lot codes                                         | High                                    | Verified and resolved. Lookup is the random token.                                                                                                                                                                                                                                                 |
| Government ID and bank account stored as plaintext strings          | High                                    | Resolved in code on 2026-10-23. Both columns use the `encrypted` cast. The local database migration rewrote the one stored id and the one stored account number; the model still returns them to authorized operations code. Field verifiers and cooperative officers still receive neither value. |
| Financing and insurance rows can be overwritten                     | High for history                        | Verified and unresolved.                                                                                                                                                                                                                                                                           |
| Public trace rate limit                                             | Medium                                  | Verified and resolved at 30/minute.                                                                                                                                                                                                                                                                |
| `local` filesystem disk has `serve` enabled                         | Medium                                  | Inspected. The disk is private, so `ServeFile` requires a valid signature. Unsigned requests are rejected. Photos are still loaded through authorized controllers. The route was not penetration-tested.                                                                                           |
| `APP_DEBUG=true` in the local `.env`                                | Medium for a deployed copy of that file | Not a production host. Unresolved until a real deploy sets `APP_DEBUG=false`.                                                                                                                                                                                                                      |
| Invitation accept `POST` is throttled. The invitation `GET` is not. | Low                                     | Verified and unresolved.                                                                                                                                                                                                                                                                           |

## Data-integrity risks

- Inventory receipt, reversal, and reconciliation rules are implemented and tested.
- Lot creation still assigns `Inventory::$quantity` from a formatted string. PHPStan reports that assignment. The traceability tests still pass.
- Demo id generators (`SF-…-000001` style) remain bound for farmers, farms, verification references, and lot codes. They use a locked latest-row read. They are not an official numbering scheme.
- No automated check compares financing balances to a movement table, because that table does not exist.

## Performance

Not measured with query plans in this batch. Code inspection shows the dashboard `verifiedLands()` query loads every verified boundary GeoJSON for farms in scope, with no viewport filter.

## Infrastructure not verified

- Queue workers outside `composer dev`.
- Scheduler. `routes/console.php` only registers `inspire`.
- Mail delivery. `.env.example` uses the `log` mailer.
- SMS. No provider is configured.
- Backups and restore.
- HTTPS, secure session cookies, and a production `APP_DEBUG=false` host.
- CI on GitHub for this commit. `.github/workflows/tests.yml` runs `composer ci:check` on pushes to `main`. `npm run check` uses oxlint, which this Windows machine cannot run.

## Remediation order

1. Back up `APP_KEY` with the database before any pilot. Identity values cannot be read without that key.
2. Replace mutable financing and insurance rows with historical entries before any balance is treated as authoritative.
3. Snapshot traceability facts when a lot is published.
4. Add viewport limits for boundary maps.
5. Confirm backups and a deploy host before any controlled release.
