# Known limitations

Accepted until a later change. None of these are hidden by removing navigation.

- Crop management, the finance module page, the insurance module page, logistics and export, and reports are future-release pages. Farm financing and farm insurance can still be recorded from a farm. Those records are single editable rows.
- Cooperative profiles store name, code, and status. Officers can view their cooperative and cannot enroll members.
- Harvest totals on a cooperative are completed harvest quantities grouped by unit. They are not a verified yield.
- Farmer, farm, lot, and verification identifiers are demo sequences.
- Government IDs and bank account numbers are encrypted with `APP_KEY`. Authorized operations screens still show the government ID, and the bank profile shows the last four digits. A lost application key makes the stored values unreadable. There is no separate key-management service.
- Public traceability shows farm name, municipality, province, harvest date, quantity, stage, and verification status to anyone who has the token. It does not show contact details, identity numbers, bank data, or financing.
- Traceability pages read current source rows. They are not frozen snapshots.
- The dashboard map loads verified boundaries for every in-scope farm.
- Error tracking is the application log. No external tracker is connected.
- The local `.env` used for development has `APP_DEBUG=true`. That file is not the production configuration.
- oxlint does not run on this Windows machine because Application Control blocks the native binding. CI on Ubuntu is the place that runs `npm run check`.
- Queue `after_commit` is false, and the local listener uses `--tries=1`.
- A same-server copy of the local MySQL database matched row counts on 2026-10-23 and was then deleted. `mysqldump` is not installed here, and no backup file has been restored onto another machine. `APP_KEY` has not been restored with that copy.
