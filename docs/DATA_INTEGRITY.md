# Data integrity

## Inventory

Implemented in `ReceiveHarvestIntoInventory`, `ReverseHarvestReceipt`, `UpdateFarmHarvest`, and `AlignInventoryBalance`.

- A receipt uses the harvest unit. Kilograms, tons, and bags are not converted.
- Quantities are compared in integer cents.
- The remaining receivable quantity is checked inside a `lockForUpdate` transaction.
- The same receipt token and the same payload return the existing inventory row. A different payload is rejected.
- A reversal is a new movement. The original receipt stays.
- A reversal is refused when a later movement exists or on-hand quantity is below the receipt.
- After a net receipt, the harvest unit cannot change, the harvest quantity cannot drop below the received cents, and the harvest cannot leave completed.
- Aligning a stored balance sets the quantity column to the movement total and writes an access event. It does not insert a movement.
- A negative movement total is refused.
- Legacy receipts whose unit differs from the harvest are listed and are not rewritten.

## Identity numbers

Farmer, farm, verification, and lot codes come from the demo generators bound in `AppServiceProvider`. Lot codes are allocated with `lockForUpdate` on the latest yearly code. They are human labels. They are not the public trace key.

`farmers.government_id` and `farmer_bank_accounts.account_number` use Eloquent's `encrypted` cast, the same `Crypt::encrypt($value, false)` payload the migration writes. Null stays null. Authorized PHP still receives the original string. The columns are omitted from model serialization. Field verifiers and cooperative officers do not receive either value in farmer or farm pages.

## Cooperative membership

A farmer has at most one open membership. `open_slot` is unique and holds the farmer id while the membership is open. Ending the membership clears `farmers.cooperative_id` only when it still points at that cooperative. History rows stay.

## Financing

Unresolved. `farm_financings.loan_balance` is one decimal column. Edits replace it. There is no disbursement or repayment table, and amounts are not stored as integer minor units.

## Insurance

Unresolved. A policy is one mutable `farm_insurances` row. There is no claim history.

## Traceability

A lot stores quantity, unit, and foreign keys. `TraceabilityJourney` reads the current farm, harvest, and inventory movement when it builds a page. Those source rows can still change. Public access uses `public_token`, not the sequential lot code. The public page does not include phone, email, government ID, bank account, financing amounts, or lot notes.

## Documents

Farmer photos and drone images are stored on the local disk and returned by authorized controllers. There is no separate document ledger.
