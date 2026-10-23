# Pilot go / no-go checklist

Decision on 2026-10-23: **no-go**.

A document, a green Pest run, or an encrypted column does not start the pilot. Real farmer data stays out. Synthetic data on a developer machine is ordinary development, not a pilot.

## Must be true before a go decision

| # | Check | Result on 2026-10-23 |
|---|---|---|
| 1 | Critical identity storage is not plaintext | Met in code. `government_id` and `account_number` use the `encrypted` cast. Local migration `2026_10_23_131108` rewrote the existing values. Pest: 241 passed, 2,304 assertions. |
| 2 | `APP_KEY` and the database were backed up and restored onto a copy, and one identity value decrypted | Not done. On 2026-10-23 a same-server table copy matched counts and the ciphertext prefix, then that copy was dropped. No dump file was restored, and the key was not moved to another machine. |
| 3 | Host uses HTTPS, `APP_DEBUG=false`, `APP_ENV=production`, and `SESSION_SECURE_COOKIE=true` | Not verified. Local `.env` has `APP_DEBUG=true`. |
| 4 | `/up` and `/ready` were called on that host | Not verified. Local checks existed in an earlier phase. They are not a pilot host. |
| 5 | Queue worker retry and mail delivery were tried with a real invitation | Not done. Listener tries once. Mail driver is log. |
| 6 | Financing and insurance are either excluded in writing or replaced by a ledger | Excluded. Ledger is not implemented. |
| 7 | The project owner has accepted live traceability pages or a snapshot has been added | Not accepted. Pages follow current farm and harvest rows. |
| 8 | Named owners exist for every row in `docs/OPERATIONS_RESPONSIBILITY_MATRIX.md` | All unassigned. |
| 9 | Counsel has confirmed what identity data may be collected and for how long | Not done. |
| 10 | Each in-scope scenario in `docs/USER_ACCEPTANCE_TESTS.md` has an actual result from the role that performs it | All Not tested. |
| 11 | No open defect allows one farmer to read another farmer's identity, financing, or farm | Met by the current feature tests for scope and coverage. Not re-checked in a browser. |
| 12 | Placeholder modules are still labeled as a future release | Met. Crop, finance, insurance, logistics, and reports are not workflows. |

## Stop a running exercise the same day if

- A government id or full account number appears in a log, ticket, or public page.
- `/ready` reports the database failed and writes are still being accepted.
- Inventory reconciliation shows a negative movement total.
- A user outside an assignment can open a farm.
- The only copy of `APP_KEY` or the database is lost.

Stopping means disable new registration, suspend affected accounts, and follow `docs/INCIDENT_RESPONSE_RUNBOOK.md`. Do not delete historical rows to make the problem disappear.

## Metrics

Targets are blank on purpose. The project owner writes the threshold before it can fail a release. A high completion rate does not override a failed security or inventory check.

| Metric | Calculation | Source | Period | Proposed target |
|---|---|---|---|---|
| Critical workflow completion | Scenarios marked Pass divided by scenarios in scope, by role | `docs/USER_ACCEPTANCE_TESTS.md` | The exercise window | Owner sets the minimum. Any failed security scenario fails the pilot regardless of this ratio. |
| Open defects by severity | Count of unresolved defects tagged critical, high, or low | Incident log | At the go/no-go meeting | Owner sets the allowed high count. Critical count must be zero. |
| Farmer record completeness | Farmers in the exercise missing a required name or address field, divided by farmers created | `farmers` table | End of the window | Owner sets the maximum. |
| Verification turnaround | Median time from verifier assignment `assigned_at` to the first `farm_verifications` row | Those two tables | The window | Owner sets the maximum. No scheduling module exists, so this is assignment to decision, not a promised visit time. |
| Inventory discrepancies | Count of inventory rows whose stored quantity differs from the signed movement sum | `InventoryStock::discrepancies` | End of the window | Owner sets the maximum. A negative total is a stop, not a target. |
| Duplicate people | Suspected duplicate farmers confirmed by the operations supervisor, divided by farmers created | Manual review. No detector exists. | The window | Owner sets the maximum. |
| Unauthorized access failures | Count of UAT-FR-05, UAT-FM-05, UAT-FM-06, and UAT-ME-02 that are not Pass | UAT sheet | The window | Must be zero. |
| Failed jobs | Count of rows in `failed_jobs` | That table | The window | Owner sets the maximum. |
| Usability notes | Count of comments from verifiers, officers, and farmers that blocked a task | UAT actual-result column | The window | Owner sets what must be fixed before a wider release. Task time is not collected. No baseline exists. |

Report accuracy and notification delivery have no source until reports and a real mailer exist. Do not score them.
