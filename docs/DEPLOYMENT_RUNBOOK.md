# Deployment runbook

This is the procedure for this repository. No hosting provider, container, or production server is configured. A passing local build is not a deployment.

Checked on 2026-10-23 from this machine, without printing secrets:

| Item | What is actually configured |
|---|---|
| PHP | `composer.json` requires `^8.3`. This machine is 8.3.33. GitHub Actions uses 8.4. |
| PHP extensions present here | `pdo_mysql`, `pdo_sqlite`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `fileinfo`, `gd`, `sodium`, `zip` |
| Node | Actions uses 22. This machine built assets with 24.20.0. `package.json` does not pin a Node version. |
| Application | Laravel 13, Inertia Laravel 3, Fortify, Wayfinder. React 19, Tailwind 4, Leaflet. |
| Local runtime | `APP_ENV=local`, `APP_DEBUG=true`, `APP_URL=http://localhost:8000` |
| Database | MySQL on `127.0.0.1:3306`, database name `surefarm`. `.env.example` still shows SQLite. All 34 migrations are applied. |
| Session | `database`. `SESSION_SECURE_COOKIE` is unset, so the cookie is not marked secure. `SESSION_ENCRYPT` is false. |
| Cache and queue | Both `database`. Broadcasting is `log` and is not used by a pilot workflow. |
| Files | Default disk `local`, root `storage/app/private`, writable on this machine. The public disk is `storage/app/public`. |
| Mail | `log`. Invitation mail is not delivered to a mailbox. |
| Two-factor flag | `AUTH_REQUIRE_TWO_FACTOR` resolves true here. PHPUnit forces it false. |
| Scheduler | `routes/console.php` only registers `inspire`. No business job needs cron. |
| Trusted proxies | Not configured. |
| Backup tool | `mysqldump` is not on this PATH. |

## Production values

Set these on the host. Do not commit `.env`. Do not run `php artisan key:generate` on a database that already has encrypted government ids or account numbers.

| Key | Production value |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | The HTTPS origin, no trailing path |
| `APP_KEY` | The key that encrypted the database, from the backup set |
| `LOG_LEVEL` | `info` or `warning` |
| `AUTH_REQUIRE_TWO_FACTOR` | `true` |
| `SESSION_SECURE_COOKIE` | `true` |
| `SESSION_ENCRYPT` | `true` |
| `DB_CONNECTION` | The engine the host actually provides. This app's migrations have run on MySQL and on SQLite in tests. |
| `QUEUE_CONNECTION` | `database`, with a worker, if invitations must send |
| `MAIL_MAILER` | A real mailer. `log` keeps invitations on the server. |
| `FILESYSTEM_DISK` | `local` until an object store is chosen. Do not set the private disk visibility to public. |

Behind a reverse proxy, trust that proxy before relying on HTTPS detection. Otherwise secure cookies and generated URLs can be wrong. This repository does not set a trusted-proxy list.

`/up` and `/ready` are the only diagnostic routes. They do not require a login. `/ready` returns check names and `ok` or `failed`. It does not return SQL, paths, or exception text. Do not expose Telescope, Horizon, or a database admin tool. None of those are installed.

## What must be recoverable

Farmer and farm rows, boundaries, verification history, harvests, inventory movements, financing and insurance rows, traceability lots and events, access events, invitations, and files under `storage/app/private` (farmer photos and drone images). Sessions and cache rows can be discarded. `APP_KEY` is required to read `farmers.government_id` and `farmer_bank_accounts.account_number`.

There is no retention job. The project owner sets how long backups are kept and who can read them. Store the key apart from the database dump, with access limited to the people who may restore.

## Backup and the check that was actually run

`mysqldump` is not installed here, so no dump file was created or restored.

On 2026-10-23 the live `surefarm` database was copied with `CREATE TABLE ... LIKE` and `INSERT ... SELECT` into a new database, `surefarm_restore_drill`, on the same MySQL server. The copy was then dropped. The live database was not overwritten.

| Table | Live rows | Copy rows |
|---|---|---|
| farmers | 1 | 1 |
| farms | 3 | 3 |
| farm_boundaries | 1 | 1 |
| farm_verifications | 1 | 1 |
| farm_harvests | 3 | 3 |
| inventory_movements | 7 | 7 |
| farm_financings | 2 | 2 |
| farm_insurances | 2 | 2 |
| traceability_lots | 1 | 1 |
| farmer_bank_accounts | 1 | 1 |
| access_events | 0 | 0 |

All 34 tables were copied. The stored government-id prefix matched (`eyJp`) and the full value was not printed. This does not prove a file can be restored onto another machine, and it does not prove `APP_KEY` was backed up.

Until a dump file is restored on an isolated server and one identity value decrypts, backup recovery stays unverified. The pilot remains no-go.

A later file backup, once a dump tool exists, is:

1. Write a SQL dump of the application database to storage that is not the application disk.
2. Copy `storage/app/private`.
3. Copy `APP_KEY` into a separate restricted store.
4. On an empty database, load the dump. Point a spare application copy at it with the same `APP_KEY`.
5. Open one known farmer as operations and confirm the government id decrypts. Compare the row counts above.
6. Discard the spare copy. Do not point the live application at the spare database.

## Deploy

1. Confirm `GET /ready` on the current release, and confirm a backup from the section above exists for this database. If it does not, stop.
2. `composer install --no-dev --optimize-autoloader`
3. `npm ci` and `npm run build`
4. Review `php artisan migrate --pretend` before applying anything. Do not use `migrate:fresh` or `db:wipe`.
5. `php artisan migrate --force` only on the host that owns that database.
6. `php artisan config:cache`, `php artisan route:cache`, and `php artisan view:cache`
7. Confirm `storage/app/private` and `storage/framework` are writable by the PHP user and are not world-readable.
8. Restart PHP. Restart the queue worker so it loads the new code. A production worker needs a chosen `--tries` and `--timeout`. The repository does not set those numbers. The local listener uses `--tries=1`. `config/queue.php` has `after_commit` false, so a job can start before its transaction commits.
9. Cron is not required for the current code. Do not add `schedule:run` until a real scheduled command exists.
10. Smoke-test the list below.

Invitation delivery is the only queued notification. Inspect failures with `php artisan queue:failed`. Retry with `php artisan queue:retry {id}` only when that invitation is still open.

## Smoke checks

1. `GET /up` returns 200 and does not include a database status.
2. `GET /ready` returns 200 with `database`, `storage`, and `queue` set to `ok`, and `Cache-Control` contains `no-store`.
3. A guest `GET /login` returns the login page. `GET /register` does not open a registration form.
4. An invitation can be accepted once. The same token then fails.
5. `GET /trace/SF-2026-000001` does not show a farm. A real `public_token` URL does, and it does not show a phone number or government id.
6. A field verifier or cooperative officer opening a farmer does not receive a government id or a full account number.

## Rollback and forward recovery

Rolling code back does not roll schema back. Take the backup before `migrate`.

| Migration | What it does | If the new code must be removed |
|---|---|---|
| `2026_10_23_125631_add_public_token_to_traceability_lots_table` | Adds a unique token and fills existing lots. | Keep the column. The previous release looks up `lot_code` and would publish sequential URLs again. |
| `2026_10_23_131108_encrypt_farmer_identity_secrets` | Widens two columns and encrypts them with `APP_KEY`. | Restore the pre-migration backup with the same key. `down` decrypts only when that key is still the application key, then shrinks the columns. A wrong key leaves ciphertext that does not fit the old string length. |

Do not rotate `APP_KEY` until a re-encryption has been tried on a copy. Losing the key makes government ids and account numbers unreadable. There is no second key.

## Rate limits already in the application

Login attempts are throttled by Fortify. Invitation acceptance is `throttle:6,1`. Creating invitations is `throttle:10,1`. The public trace route is `throttle:30,1`. Readiness is `throttle:60,1`. The invitation show page is not throttled.

## Capacity

Registry lists used by farmers, farms, harvests, inventory, activities, production, verification, and traceability paginate 10 rows. Cooperatives and users paginate 15. The dashboard still loads every in-scope farm coordinate and every in-scope verified boundary. That was not timed against a large set. A safe check is to load a copy of the database with synthetic farms and measure `GET /dashboard` and the size of `verified_lands`. Do not cache verification or inventory totals in front of the database until that measurement says the query is the problem.

## Logs

The default channel is a single file. This repository does not rotate it. The host should. `LogRedactor` redacts context keys that contain a password, token, government id, or account number. Exception text can still contain other farmer fields. `ERROR_TRACKING_DRIVER=log` means there is no external tracker. Do not set another driver until that tracker is installed.
