# Incident response runbook

Use this when something is wrong in an environment that holds SureFarm data. No incident owner is assigned. Until `docs/OPERATIONS_RESPONSIBILITY_MATRIX.md` names one, the project owner holds the duty.

Do not delete verification history, membership history, inventory movements, or traceability lots as a general response. Do not run `migrate:fresh`.

For every case, record the time, the request id from the `X-Request-Id` header or the log context, who reported it, and what was changed during recovery.

## 1. Unauthorized account access

1. Detection. A user reports a session they did not start, or an access event shows a role, grant, or link they did not expect.
2. Containment. An administrator suspends that account. Suspension ends the next request. Do not share the password in chat. Replace it through the invited user or the password reset that already exists.
3. Owner. Administrator acts. Incident owner approves restoring the account.
4. Evidence. Keep `access_events` and the application log. Do not truncate them.
5. Recovery. Revoke grants and verifier assignments that the account should not have. Confirm the last active administrator remains.
6. Verification. The suspended user receives the same login failure as a wrong password. After restore, they can sign in and cannot see another farmer's farm.
7. Follow-up. Write which grants were revoked. If a government id or account number was displayed, treat that as disclosure in the next section.

## 2. Suspicious data disclosure

1. Detection. A public trace page, a log, a ticket, or an export contains a government id, a full bank account, or another farmer's financing.
2. Containment. Remove the file or ticket copy. Do not unpublish a lot by deleting it if the movement history is the stock record. Take the public URL out of circulation by keeping the token private. Rotating `APP_KEY` makes stored identity values unreadable and is not a first step.
3. Owner. Incident owner. Operations supervisor identifies which farmer is affected.
4. Evidence. Save the response or log line with secrets redacted in the ticket. The application log redacts known secret keys; the database value is ciphertext.
5. Recovery. Fix the page or query that exposed the value. Re-test with `FarmCoverageTest` and `TraceabilityTest` expectations: verifiers and officers do not receive coverage, and the public payload omits identity and bank fields.
6. Verification. Repeat the request as the affected role and as a guest.
7. Follow-up. Tell the project owner. Counsel decides whether the farmer must be notified. This runbook does not make that legal decision.

## 3. Inventory that does not match its movements

1. Detection. Reconciliation lists a stored quantity that differs from the signed movement sum, or a receipt was entered twice without a token.
2. Containment. Stop further receipts for that harvest until the custodian looks at it.
3. Owner. Inventory custodian. Operations may run the alignment only after the custodian agrees.
4. Evidence. Export is not available. Record the inventory id, the movement ids, and the reason text. Do not paste quantities into a public channel if they are commercially sensitive for the pilot.
5. Recovery. If a receipt should not have happened and no later movement exists, reverse it. If the cache is wrong and the movements are right, align the cache. If the movement total is negative, the alignment refuses. Leave it and correct with a reviewed movement, not a manual SQL update.
6. Verification. Reconciliation shows no discrepancy for that inventory id. The harvest remaining receivable matches received cents.
7. Follow-up. Note whether the receipt token was missing, which is what allows a double submit.

## 4. Incorrect financing or insurance values

1. Detection. A user reports a balance or coverage amount that replaced an earlier amount.
2. Containment. Stop further edits to that row. The application does not keep the previous balance.
3. Owner. Project owner. There is no financial custodian function in the software.
4. Evidence. The current row is all the database has. A database backup from before the edit is the only earlier copy, and no backup drill has been run.
5. Recovery. Do not invent a reversing transaction in the form. Restore the value only from a backup or from a written source the owner accepts, and record the correction in the incident log. The form will overwrite the row again.
6. Verification. The farm page shows the restored figures to operations and hides them from verifiers and officers.
7. Follow-up. Keep financing and insurance out of the pilot until a ledger exists.

## 5. Failed background jobs

1. Detection. `php artisan queue:failed`, or invitation mail never arrives. The local listener uses `--tries=1`. `after_commit` is false, so a job can run before its transaction commits.
2. Containment. Leave the failed row in `failed_jobs`.
3. Owner. Deployment engineer.
4. Evidence. Failed job id, exception class, and the time. Do not copy the mail body into a ticket if it contains the invitation URL.
5. Recovery. Invitation delivery is the only queued notification. Retry with `php artisan queue:retry {id}` only when the invitation is still open. If the invitation was replaced or revoked, do not retry.
6. Verification. The invited person can open the current link once.
7. Follow-up. Production needs a retry count and a timeout chosen for that job. Those numbers are not set.

## 6. Missing photo or drone image

1. Detection. The farmer or farm page returns 404 for a file that the record still points at.
2. Containment. Do not clear `photo_path` or `drone_image_path` until the file is confirmed gone.
3. Owner. Operations supervisor.
4. Evidence. The storage path and the response status. The local disk root is `storage/app/private`.
5. Recovery. Restore the file from a backup onto the same path. There is no second copy in the application.
6. Verification. The same authorized user can open `farmers.photo` or `farms.drone-image`. A user outside scope still receives 404.
7. Follow-up. The unsigned `/storage/{path}` route on the private disk rejects the request. Do not switch the disk to public visibility to make the image load.

## 7. Database outage

1. Detection. `GET /ready` returns 503 and the database check is `failed`. `GET /up` can still return 200. Use `/ready` for traffic.
2. Containment. Stop writes. Do not restart workers in a loop.
3. Owner. Deployment engineer.
4. Evidence. The `/ready` JSON and the log line. The probe logs the check name and the exception class, not the SQL.
5. Recovery. Restore database service. Do not point the application at an empty database.
6. Verification. `/ready` returns 200 with database, storage, and queue set to `ok`. A known farmer page loads for an in-scope user.
7. Follow-up. Record the outage length. If the database was replaced, confirm `APP_KEY` matches the copy or identity fields will not decrypt.

## 8. Failed deployment

1. Detection. The new release fails `/ready`, or migrations error.
2. Containment. Leave the previous process running if it is still up. Do not run `migrate:fresh`.
3. Owner. Project owner approves. Deployment engineer executes.
4. Evidence. The deploy log and the migration name.
5. Recovery. Roll back code only with a decision about schema. The identity migration widens two columns and encrypts them. The public-token migration adds `public_token`. Rolling code back without the matching schema will break identity reads or public trace. Restore the database backup taken before `migrate`, and restore the same `APP_KEY`.
6. Verification. `/up` and `/ready` match the runbook smoke checks. A farmer with an identity value still opens for operations.
7. Follow-up. Keep the failed build. Do not declare the pilot resumed.

## 9. Lost or corrupted data

1. Detection. Rows missing after a restore, or identity fields throw a decrypt error.
2. Containment. Stop the application from accepting new farmer records.
3. Owner. Project owner.
4. Evidence. The backup file name, the time it was taken, and the error class.
5. Recovery. Restore the last backup that was actually opened and checked, onto an isolated database first. Confirm a known farmer id, a known inventory movement, and one government id decrypt. Then switch the application. If no checked backup exists, stop. Do not recreate farmers from memory and mark them as the original records.
6. Verification. The isolated copy passes the three checks above before it becomes the live database.
7. Follow-up. The absence of a checked backup is itself the incident to report. It is also why the pilot is no-go.
