# Controlled pilot plan

Date: 2026-10-23. Decision: **no-go**.

SureFarm is not eligible for a controlled pilot that stores real farmer identity, bank, farm, or harvest records. This plan describes the limit. It does not approve a start date, a site, or a participant list.

## Why the pilot is stopped

| Blocker                                                                                 | Class                                 | Evidence                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database and file restore have never been executed                                      | External infrastructure               | `docs/DEPLOYMENT_RUNBOOK.md`. No backup command in the repository has been restored and checked.                                                        |
| Financing and insurance can be overwritten                                              | Unresolved business requirement       | `loan_balance` and the insurance row are single editable records. No disbursement, repayment, or claim table exists.                                    |
| A published traceability page follows later edits of the farm and harvest               | Pilot limitation requiring a decision | `TraceabilityJourney` reads current rows. `TraceabilityTest` expects processing history from inventory movements. A frozen snapshot is not implemented. |
| No host has been checked for HTTPS, `APP_DEBUG=false`, secure cookies, workers, or mail | External infrastructure               | Local `.env` has `APP_DEBUG=true`. Mail is the log driver.                                                                                              |
| No role has completed a business acceptance session                                     | High-priority operational blocker     | Automated tests are not user sign-off. `docs/USER_ACCEPTANCE_TESTS.md` leaves every actual result blank.                                                |

Identity storage was a critical blocker and is fixed in this repository: `government_id` and `account_number` are encrypted with `APP_KEY`. That fix does not authorize a pilot. The key has not been backed up in a restore drill. Losing it makes those fields unreadable.

## In scope only after a later go decision

Workflows that already have routes, actions, and feature tests:

- Invitation-only accounts, suspension, and role changes. Administrator and operations accounts require confirmed two-factor authentication when `AUTH_REQUIRE_TWO_FACTOR` is true.
- Farmer registration, search, and cooperative enrollment inside registry scope.
- Farm registration, boundary validation, verifier assignment, and verification history.
- Harvest registration, inventory receipt, reversal, and reconciliation.
- Traceability lot creation and the public token page, with the live-read limitation above.
- Cooperative directory, one open membership, and officer view access.

Roles that exist: administrator, operations, field verifier, cooperative officer, farmer.

## Out of scope

Do not ask pilot users to treat these as working workflows:

- Crop management, the finance module page, the insurance module page, logistics and export, and reports. Those screens say they are a future release.
- Disbursements, repayments, claims, and payouts.
- A general document vault and authorized exports.
- Warehouses, transfers, and shipments.
- Growing seasons as their own records.
- An immutable public traceability certificate.

Farm-level financing and insurance forms exist. They stay out of the pilot until historical entries replace in-place edits.

## People, places, and records

The number of farmers, cooperatives, and locations is a project-owner decision. This repository does not set it.

Until privacy, backup, and restore have been verified, the only records allowed in the application are synthetic. Do not type a real government id, bank account, phone number, or farm boundary that identifies a living farmer.

Who may later approve access and what may be collected is also a project-owner decision, with counsel. See `docs/DATA_GOVERNANCE.md`.

## How a future exercise would be watched

- Issues go to the named incident owner in `docs/OPERATIONS_RESPONSIBILITY_MATRIX.md`. That owner is currently unassigned.
- A critical security or inventory defect stops data entry the same day.
- Success is every in-scope scenario in `docs/USER_ACCEPTANCE_TESTS.md` marked pass by the role that performs it, with no open critical defect, and a restore drill recorded. A passing Pest suite is not that mark.
- Rollback is `docs/DEPLOYMENT_RUNBOOK.md` plus the stop rule in `docs/PILOT_GO_NO_GO_CHECKLIST.md`. Code rollback does not undo schema. Restore the database and `APP_KEY` together.

## Current technical evidence

`php artisan test --compact` on 2026-10-23: 241 passed, 2,304 assertions. Pint passed. PHPStan on the identity models and migration passed. Full-project PHPStan remains unclean from earlier runs (363 errors). No browser suite ran.
