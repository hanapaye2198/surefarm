# Data governance

These rules match the application as it exists. They are not a legal opinion. The project owner and a qualified adviser must confirm which privacy, consent, retention, and agricultural-reporting rules apply before any real farmer record is collected. If the deployment is in the Philippines, that review should include whether the Data Privacy Act and National Privacy Commission guidance apply. This file does not decide that they do.

Until that review and a backup drill are finished, store synthetic data only.

## Ownership

| Record | System behavior | Accountable role | Named person |
|---|---|---|---|
| Farmer identity and contact fields | Operations inside registry scope creates and edits them. | Operations supervisor | Unassigned |
| Government id and bank account | Encrypted at rest. Shown to operations. Hidden from verifiers, cooperative officers, and other farmers. | Operations supervisor | Unassigned |
| Cooperative membership | One open membership. History is kept when it ends. Officers can view and cannot enroll. | Operations supervisor | Unassigned |
| Farm boundary and declared area | Operations writes. A boundary change does not by itself change declared area or verification. | Operations supervisor | Unassigned |
| Verification decision | Field verifier on an assigned farm. Previous decisions stay in `farm_verifications`. | Verification lead | Unassigned |
| Harvest and inventory movements | Operations. Receipts, reversals, and alignments follow `docs/DATA_INTEGRITY.md`. | Inventory custodian | Unassigned |
| Financing and insurance rows | Editable in place. Not approved for pilot use. | Unassigned, and excluded | Unassigned |
| Photos and drone images | Private disk, authorized download routes. | Operations supervisor | Unassigned |

The administrator provisions accounts. The administrator does not automatically approve a verification, a stock alignment, or a financing edit.

## Collection

Collect the fields the registration form already requires. Do not add identity-document images, dependents, or political or religious information. The product owner decides whether government id and bank account are required for a later pilot or remain optional, which is how the form works today.

A farmer account is linked by an administrator to a farmer id. The application does not attach an account because the name, phone, or email matches.

## Correction

- Correct a misspelled name or address through the farmer or farm edit form. That overwrites the current value. It does not write a field-level history row.
- Do not delete a completed harvest. The harvest tests reject leaving the completed status and reducing quantity below what was received.
- Correct a receipt with a reversal movement, not by editing the original movement.
- Correct a stored stock cache with reconciliation, which sets the cache to the movement total and records the reason. It does not invent a movement.
- Verification mistakes are a new verification record. Do not delete the earlier decision.
- Financing and insurance edits replace the current row. Do not use them as the official financial history.

## Duplicates

The application does not detect a second farmer with the same government id or the same name. Farmer ids are unique because the demo generator locks the latest sequence. A duplicate person can still exist under two ids. The operations supervisor reviews suspected duplicates manually. There is no merge tool. Do not delete one record to hide the other.

## Membership and boundaries

Ending a membership closes it and clears `farmers.cooperative_id` only when it still points at that cooperative. It does not move the farmer's farms to another cooperative. An inactive cooperative cannot take a new member.

Replacing a boundary keeps one boundary row and can change the measured area. It does not change declared hectares or the verification status. Removing a boundary is limited to an administrator and clears measured area only.

## Sensitive access

- Verifiers and cooperative officers do not receive government id, bank account, insurance, or financing on the farmer page or the farm page.
- Farmers receive their own farm financing and insurance. They do not receive another farmer's.
- Public traceability uses the 40-character token. It does not use the sequential lot code. It still shows farm name, municipality, province, harvest date, quantity, stage, and verification status.
- Logs redact keys that contain government id, account number, password, and token. The database values are ciphertext. Application exceptions can still contain other farmer fields.

## Retention, export, and incidents

No retention period is configured. No archive job exists. No report export exists. Do not copy the database to a laptop or a chat as a substitute.

An export, a support copy, or a restore drill needs the project owner's written approval and must include `APP_KEY` only in the backup channel, not in email or a ticket.

Suspected disclosure, a lost key, or an inventory mismatch is handled with `docs/INCIDENT_RESPONSE_RUNBOOK.md`. Do not delete historical movements, verification rows, or membership history as a cleanup step.
