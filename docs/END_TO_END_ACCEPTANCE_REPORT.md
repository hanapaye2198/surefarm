# End-to-end acceptance report

Recorded 2026-10-23 from this repository. HTTP feature tests are the evidence. No browser suite ran. A passing Pest file is not acceptance of a workflow the file does not cover.

Stack checked in the repo: PHP `^8.3` (this machine: 8.3.33), Laravel `^13.17`, Fortify `^1.37.2`, Inertia Laravel `^3`, Wayfinder `^0.1.14`, Pest `^4.7` with `pest-plugin-laravel` only, React 19, Inertia React 3, Tailwind 4, Leaflet 1.9. PHPStan level 7 via Larastan. There is no Playwright, Dusk, or `pestphp/pest-plugin-browser` dependency.

## Baseline before this batch

| Check | Result |
|---|---|
| `php artisan test --compact` | Passed. 241 tests, 2,246 assertions. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Passed after the batch. The frontend was not changed. |
| `vendor/bin/phpstan analyse` (level 7) | Failed. 363 errors. Pre-existing. Dominated by inventory quantity `float` versus decimal `string`, `nullsafe.neverNull`, and `list` versus `array` return types. The coverage fix is not among them. |
| `npm run check` (oxlint) | Not run. Application Control on this Windows machine blocks the native binding. |
| Browser end-to-end | Not configured. |
| `composer audit` / `npm audit` | Not run. |

## Workflow status

| Journey | Status | What was executed |
|---|---|---|
| A. Farmer registration | **Pass** | `FarmerRegistrationTest`, `FarmerProfileDetailsTest`, `AccountAccessTest`. Create, validation, generated id, cooperative enroll, profile, list. |
| B. Farm registration and verification | **Pass** | `FarmRegistrationTest`, `FarmBoundaryTest`, `FarmVerificationTest`, `RecordAccessTest`, `DashboardTest`. Boundary validation, assignment, history kept, operations cannot approve, dashboard queue counts active in-scope farms. |
| C. Harvest and inventory | **Pass** | `ProductionHarvestTest`, `InventoryIntegrityTest`, `InventoryProcessingTest`. Unit match, cent arithmetic, token idempotency, rollback, reversal, reconciliation. |
| D. Traceability | **Fail** | Lot creation, stock check, public token, and private-field hiding pass in `TraceabilityTest`. The public and internal pages read current source rows. A later edit of the farm or harvest changes the published story. No snapshot table exists. |
| E. Financial and insurance records | **Not implemented** | One mutable insurance row and one mutable financing row per save (`FarmCoverageTest`). No disbursement, repayment, claim, or correction ledger. Outstanding balance is the stored `loan_balance`. |
| F. Documents and reports | **Not implemented** | No document module and no report export. Farmer photos and farm drone images are private files served after scoped route binding. Crop, finance, insurance, logistics, and reports navigation items render `ModulePlaceholderController` and say they are a future release (`ModulePlaceholderTest`). |
| G. Farmer self-service | **Pass** | A linked farmer opens their own farm and receives 404 for another farmer's farm (`RecordAccessTest`, `FarmCoverageTest`). Farmers cannot register farmers, verify farms, or post financing. Documents, claims, and payouts do not exist. |

Growing seasons, warehouses, transfers, shipments, and notification preferences are not in the schema. The only queued notification found is the user invitation mail.

## Defect fixed in this batch

**Farm financing and insurance were returned to roles that the farmer profile already hides.**

`FarmerController::show` sets insurance and financing to empty arrays for a field verifier or cooperative officer, and nulls `government_id` and the bank account. `FarmController::show` still mapped `$farm->insurances` and `$farm->financings` for every viewer who could open the farm. The baseline test `field verifiers can view coverage and cannot change it` asserted `farm.insurances.0.covered_label` was `Yes`, so the leak was locked in.

Root cause: the farm page did not apply the same inspection rule as the farmer page.

Fix: those two arrays are empty when the viewer's role is `field_verifier` or `cooperative_officer`. Operations, administrators with registry scope, and the linked farmer still receive the records. Writes stay on the operations routes and still return 403 or 404.

The authorization matrix row for verification was also wrong. Operations receive 403 from `farm-verification.update` (`FarmVerificationTest`). The matrix now says that. Administrators can open those routes because `canAccess` allows every role.

## Authorization coverage already in the suite

Guests are redirected from the registry. Suspended sessions die on the next request. Out-of-scope farmer, farm, harvest, inventory, and lot ids return 404 through `RegistryScope` route binding. A verifier cannot open or start verification on an unassigned farm. A province grant cannot enroll a farmer in another province. An administrator without a platform grant cannot read the registry. Farmers cannot change role, link a different farmer, or post coverage onto someone else's farm. Public `/trace/{lot_code}` does not resolve; the public route requires a 40-character token and is throttled `30,1`.

Not retested as new cases this batch: invitation GET throttling (still absent; POST is `6,1`), sort-column injection (cooperative and user sorts are whitelisted), and a full cross-product of every write route against every role. Those existing tests remain the evidence. This batch did not find a second confirmed authorization hole.

## Navigation

| Item | Destination | Notes |
|---|---|---|
| Dashboard, Farmers, Farms, Verification, Cooperatives, Activities, Production, Harvest, Inventory, Processing, Traceability, Users, Activity types, Settings | Real routes | Role lists in `app-sidebar.tsx`. Administrators see every item because `userCanAccess` returns true for `admin`. |
| Crop Management, Finance, Insurance, Logistics & Export, Reports | Placeholder page | Visible, and the page says the module is a future release. Farm-level insurance and financing forms still exist on the farm. |
| Cooperative officer | Farmers, Farms, Cooperatives, Dashboard | Activities, harvest, inventory, and traceability routes allow the role, and the sidebar does not list them. |

## Data consistency

Dashboard verification counts use the active-farm scope and match `DashboardTest`, including an inactive pending farm staying out of the pending queue. Harvest totals in cooperative and production screens are stored quantities grouped by unit. Inventory reconciliation compares the stored quantity with the signed movement sum. Financing does not have a ledger to reconcile. Traceability totals follow the current rows, which is the Journey D failure.

## Browser, accessibility, and performance

Not tested in a browser this batch. The local administrator session requires confirmed two-factor authentication, and no browser runner is installed. Adding Playwright was not justified for the payload bug: the assertion is on the Inertia props, and this machine already blocks a native lint binary.

No query timings were captured. The dashboard still loads every in-scope verified boundary. That remains a known limitation, not a measured regression.

## Checks after the fix

| Command | Result |
|---|---|
| `vendor/bin/pint --dirty --format agent` | Passed. |
| `php artisan test --compact tests/Feature/FarmCoverageTest.php` | Passed. 5 tests, 178 assertions. |
| `php artisan test --compact` | Passed. 241 tests, 2,302 assertions. |
| `npx tsc --noEmit` | Passed before the PHP-only change. |
| `npm run build` | Passed. |
| PHPStan level 7 | Failed, 363 errors, pre-existing. |
| Browser end-to-end | Not run. |
| Migrations | No migration in this batch. |

## Release blockers that remain

- Government ids and bank account numbers are encrypted at rest as of `2026_10_23_131108`. A lost `APP_KEY` still makes them unreadable, and that key has not been backed up in a verified drill.
- Financing and insurance are editable rows, not ledgers. Claims do not exist.
- Traceability history is live source data.
- No document vault, report export, shipment, or warehouse workflow.
- No backup or restore has been executed.
- No browser acceptance run.
- PHPStan level 7 is not clean.
- Public trace still shows farm name, place, harvest quantity, stage, and verification status to anyone holding the token.

## Next test

Confirm that editing a farm name or harvest quantity after lot creation changes `TraceabilityJourney` output, then decide whether a stored snapshot is the required fix. Do not invent lifecycle events that were never recorded.
