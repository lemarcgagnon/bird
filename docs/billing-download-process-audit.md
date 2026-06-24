# Billing and Download Process Audit

Date: 2026-06-24

Scope: WASM app download billing, PHP credit authorization, library downloads, export entitlement behavior, and admin-only diagnostics.

This report audits the current billing process from multiple angles: business model, user experience, HIG, security, KISS, DRY, CRUD/data integrity, and operational hardening.

Core product rule: every customer-facing fabrication or decor asset is billable unless it is explicitly bundled inside a previously purchased product entitlement. Admin diagnostics are never customer products.

## Executive summary

The product model is clear: the birdhouse app is the carrier, and revenue comes from downloadable fabrication assets and decor library files.

The current architecture has a good foundation: PHP owns account, credit, authorization, and consumption; the browser generates geometry locally; admin diagnostic exports are separate. Product-code billing now routes public fabrication exports through the same quote/authorize/consume flow, and export entitlements prevent repeat debits for the same user/product/model fingerprint.

The main remaining risk is trust boundary clarity. Because geometry is generated client-side, the server cannot fully prove that a submitted fingerprint matches the actual generated file. That is acceptable as a KISS business safeguard against accidental double-billing, but it is not anti-fraud. If abuse becomes real, move more canonical export-state validation server-side.

## Current billable download matrix

Implementation-state labels:

| Label | Meaning |
|---|---|
| Billable product | Customer-facing product charged through quote/authorize/consume. |
| Admin diagnostic | Internal diagnostic output, not a customer product. |

| Download | Current status | Revenue purpose | Notes |
|---|---:|---|---|
| Library decor file | Billable product | Core paid content | Server-hosted file, strongest billing path. |
| House STL | Billable product | Main fabrication model | `house_stl`, 3 credits. |
| Panels ZIP | Billable product | Fabrication-ready parts | `panels_zip`, 5 credits. |
| Door STL | Billable product | Fabrication asset | `door_stl`, 3 credits. |
| Female wall receiver STL | Billable product | Fabrication/mount asset | `female_wall_receiver_stl`, 3 credits. |
| Cutting plan SVG | Billable product | Fabrication plan | `plan_svg`, 1 credit. |
| Cutting plan PNG | Billable product | Fabrication plan image | `plan_png`, 1 credit. |
| Cutting plan PDF | Billable product | Fabrication plan document | `plan_pdf`, 2 credits. |
| Explosion PNG | Billable product | Assembly/support visual | `explosion_png`, 1 credit. |
| Calculations PDF | Billable product | Fabrication/calculation document | `calculations_pdf`, 2 credits. |
| Debug OBJ | Admin diagnostic | Diagnostic only | Must stay unavailable to clients. |
| Mesh report JSON | Admin diagnostic | Diagnostic only | Must stay unavailable to clients. |

## What works well

1. PHP remains the billing source of truth.

The browser does not directly decrement credits. It requests a quote, requests an authorization, generates the file locally, then consumes the authorization. That is the right ownership boundary.

2. Consumption happens after local file generation.

This avoids charging users when browser-side geometry generation fails before download.

3. Admin exports follow the same flow but cost zero.

This keeps admin behavior visible in logs and avoids special client-side bypasses for premium paths.

4. Library downloads are stronger than WASM exports.

The library file is server-hosted and streamed by PHP after authorization. That gives PHP direct control over the asset and makes the credit transaction easier to trust.

5. House STL export entitlement prevents normal double billing for quality changes.

The same house model/decor fingerprint can be downloaded again without charging again. STL decor quality is intentionally ignored in the house STL fingerprint, so Low, Medium, and High quality do not become three separate charges for the same design.

6. Debug downloads are separated from product downloads.

Debug OBJ and mesh-report JSON are admin diagnostics, not customer deliverables.

## Flaws and risks

### Critical

1. Client-side fingerprint is not anti-fraud.

The browser computes the fingerprint and the browser generates the file. A modified client can lie about the fingerprint. This is acceptable for preventing accidental double billing, but it is not a security proof.

Action: Treat entitlements as customer-experience logic, not anti-fraud. If needed later, send a canonical model-state payload to PHP and have PHP compute the fingerprint independently.

2. Product catalog must remain the commercial source of truth.

The backend now carries `product_code` through quote, authorize, consume, logs, ledger references and entitlement checks. `export_type` remains file-format metadata only.

Action: Keep new billable products in `EXPORT_PRODUCTS` and do not reintroduce pricing decisions in JavaScript, WASM labels or route handlers.

3. Product bundling policy must stay explicit.

Door STL and female wall receiver STL are now explicit billable products (`door_stl`, `female_wall_receiver_stl`). They are no longer free by omission.

Action: If a future bundle is introduced, model it explicitly as a product or entitlement policy rather than bypassing quote/authorize/consume.

### Major

1. Entitlement scope needs product policy.

Right now, same model fingerprint re-download is free. This is good for fairness. But there needs to be a clear policy for what counts as "same model" for each export family.

Action: Define fingerprint normalization per product:

| Product | Ignore | Include |
|---|---|---|
| House STL | language, view mode, explode, unit, STL decor quality | dimensions, decor content, decor placement, door, wall mount, geometry options |
| Panels ZIP | language, view mode, explode | dimensions, board thickness, kerf, panel preset, cut settings |
| Plan PDF/SVG/PNG | language if layout is language-independent, view mode | dimensions, kerf, sheet size, cut settings |
| Calculations PDF | view mode, explode | dimensions, unit if displayed values differ, language if text differs |

Current implementation note: only the house STL path currently sends a quality-insensitive model fingerprint. Other billable products still need explicit product-specific fingerprint policy if repeat downloads should be free.

2. UI copy must make credit behavior explicit.

If a repeated same-model download is free, the UI should say so. Users should understand when they are spending credits and when they are re-downloading a previously purchased export.

Action: Add explicit status text when quote/authorize returns `previously_purchased=true`.

3. The `zip` export type is now billable.

This is correct for panels ZIP, but backend naming should distinguish panels ZIP from any future ZIP utility bundle.

Action: Use `product_code=panels_zip` before adding more ZIP products.

4. Credit ledger may omit zero-cost repeat downloads.

That is probably correct for accounting, but support may need visibility into repeat downloads.

Action: Store repeat download count in `export_entitlements` and expose it in admin support views later.

### Minor

1. Local fallback costs in JavaScript are estimates.

The backend is authoritative, but fallback constants can confuse future developers if not documented.

Action: Keep `EXPORT_COSTS` clearly labeled as UI fallback only.

2. Admin diagnostic protection depends on frontend check plus admin-only UI.

A frontend check is useful but not equivalent to a server route protection. Since these files are generated locally, full prevention is hard without moving debug generation behind PHP/admin.

Action: Keep diagnostics hidden and checked client-side now; if debug data becomes sensitive, move it to a server-admin-only endpoint.

## HIG and UX audit

### What works

1. The flow uses progressive disclosure.

Users ask for a download, then see authorization/credit status only when needed. This avoids cluttering the modeling flow.

2. Download buttons are grouped by purpose.

Model downloads and plan downloads are visually separated, which supports clarity.

3. Admin-only diagnostics are not mixed into the normal user workflow.

That preserves user confidence and avoids exposing internal tools.

### Needs improvement

1. Cost visibility should appear before action.

A paid button should either show cost or reveal it consistently before charging. Users should not be surprised after clicking.

Recommendation: Add a small credit badge beside billable buttons, for example `3 credits`, sourced from PHP `/api/apps` or quote data.

Acceptance criteria:

| UX requirement | Pass condition |
|---|---|
| Cost visibility | Every billable button shows cost before authorization or in a consistent pre-charge modal. |
| Repeat entitlement | Previously purchased exports say `Already purchased - free re-download`. |
| Credit balance | Success message shows updated credits after consume. |
| Insufficient credits | User receives one clear recovery path to buy credits or return. |
| Keyboard focus | Modal traps focus, returns focus to the initiating button, and works without mouse. |
| Screen reader text | Cost, product name, and charge/free state are readable via accessible labels. |

2. Repeat-download messaging is missing.

A same-model entitlement download should say `Already purchased - free re-download` or equivalent.

Recommendation: Add a distinct status message when quote returns `previously_purchased=true`.

3. Product language should be consistent.

Use "Download", "Export", and "Purchase" deliberately:

| Term | Use for |
|---|---|
| Export | Browser generates a file from the current model. |
| Download | File is saved to the user's device. |
| Purchase / credits | Credits are consumed or entitlement is granted. |

4. Disabled or admin-only actions should explain why.

Admin-only debug actions should not just disappear if a future layout exposes them. They should either remain hidden or show `Admin only`.

5. Accessibility needs a billing-specific pass.

The current modal/status flow should be checked for focus trap, keyboard operation, screen-reader labels, and contrast. The core direction is sound, but billing flows need extra clarity because mistakes cost money.

## KISS audit

### Good KISS decisions

1. Quote, authorize, consume is simple and understandable.

2. Entitlements are a small table keyed by user, app, export type, and fingerprint.

3. Browser generation keeps the heavy geometry stack out of PHP.

4. Admin cost-zero exports reuse the same conceptual flow.

### KISS violations or pressure points

Root cause table:

| Root issue | Symptom | Corrective direction |
|---|---|---|
| Product identity drift | Future code may treat `pdf`, `png`, `zip`, `stl` as products again | Keep `product_code` as commercial identity and `export_type` as format only. |
| Fingerprint authority is client-side | Prevents accidental double billing but not manipulation | Move canonical hash to PHP if abuse risk rises. |
| Product policy drift | New buttons can bypass billing if they are not added to the backend catalog | Add every customer-facing download to `EXPORT_PRODUCTS` first. |
| Diagnostics are browser-generated | Admin-only protection is weaker than server-owned routes | Keep hidden/checks now; move sensitive diagnostics server-side if needed. |

1. Product identity must not fall back to file format.

`pdf` does not mean one product. It can mean plan PDF, calculations PDF, or future invoices. This is simple today but fragile tomorrow.

Fix: Preserve the current `product_code` path and reject unknown products instead of billing by raw `export_type`.

2. Fingerprint normalization in JavaScript can grow into a patchwork.

If each product adds one-off `delete` rules, it becomes band-aid logic.

Fix: Centralize a product fingerprint policy map.

3. Client-side trust is easy but weak.

It is KISS for user experience, not KISS for security. Keep that distinction explicit.

## DRY audit

### What is DRY

1. Backend helpers now centralize entitlement behavior.

The shared helper functions avoid duplicating "previously purchased" logic everywhere.

2. Download authorization helpers centralize account/admin flow.

The app uses shared authorization functions instead of each button manually calling PHP.

### DRY violations

1. Product billing decisions are scattered.

Some billing behavior lives in button wiring, some in export types, some in backend cost rules.

Fix: Introduce a single billing catalog:

```text
product_code
export_type
billable
entitlement_policy
credit_cost
admin_only
```

2. UI fallback prices can drift from backend prices.

Fix: Load product costs from PHP and render badges from server policy.

3. Fingerprint logic lives only in JS.

Fix: Document and eventually mirror canonical fingerprint policy in PHP.

## Band-aid violations

1. Frontend-only fingerprint authority.

This solves the immediate double-billing issue but does not provide hard verification.

2. Export type as product.

Using `stl`, `pdf`, `zip` as billing identities is a shortcut. It works until multiple paid products share the same file type.

3. Admin diagnostic protection mostly lives in frontend.

It is acceptable while diagnostics are generated locally and hidden, but it is not strong access control.

4. Customer downloads are explicitly modeled.

Door STL, female wall receiver STL, panels ZIP and calculations PDF are product-code billed. Debug OBJ and mesh report JSON remain diagnostics.

## CRUD and data integrity audit

### Create

Current creates:

| Data | Created when |
|---|---|
| `export_authorizations` | User/admin authorizes a billable export. |
| `credit_ledger` | Credits are debited or bonus top-up is granted. |
| `export_entitlements` | Successful consume records a paid/free entitlement. |
| `library_download_authorizations` | User authorizes a library file. |
| `library_downloads` | User consumes a library download. |

Needs review:

1. Keep product identity on every export authorization.

2. Keep the fingerprint on authorization and entitlement.

3. Ensure repeat downloads continue to increase `download_count`.

### Read

Current reads:

| Read | Purpose |
|---|---|
| Quote | Shows cost or insufficient credits before authorization. |
| Authorization lookup | Validates token before consumption. |
| Entitlement lookup | Determines if same export is free. |
| Ledger read | Account history. |

Needs review:

1. Admin should be able to read entitlements per user.

2. Support should see product code, fingerprint, cost, and download count.

Required admin/support read model:

| Field | Why it matters |
|---|---|
| user id / email | Support identity. |
| product code | Tells what was sold. |
| export type | Tells file format. |
| authorization id | Links charge event to token. |
| entitlement id | Links repeat downloads to original purchase. |
| fingerprint | Confirms same-model grouping. |
| credit cost | Explains debit or free re-download. |
| download count | Shows repeat usage. |
| created / consumed timestamps | Supports dispute resolution. |
| failure reason | Supports recovery after failed consume. |

### Update

Current updates:

| Update | Purpose |
|---|---|
| Authorization status | authorized -> processing -> consumed. |
| User credits | Debit billable export. |
| Entitlement count | Repeat download count. |

Needs review:

1. If consume fails after authorization enters `processing`, recovery behavior should be explicit.

This is Priority 1, not a minor cleanup. A payment system needs a deterministic recovery state for interrupted consumes.

2. Zero-cost repeat consumes should still leave a useful audit trace.

### Delete

Current deletes:

No normal delete path is needed for billing records.

Needs review:

1. Do not delete ledgers or entitlements except by admin database maintenance.

2. Add retention policy if production privacy requirements demand it.

## Security and abuse review

### Good

1. Server owns credits.

2. Token consumption is one-shot.

3. Authorization has expiry.

4. Admin sessions have zero-cost path without touching client credits.

### Weak

1. Client can lie about fingerprint.

2. Client can modify JS to call local exporters directly, but cannot debit or grant credits.

3. Client-side local file generation means PHP cannot guarantee file content.

4. A user could potentially reuse a paid fingerprint for a different local export if they manipulate the client.

### Strengthening options

| Level | Approach | Cost | Benefit |
|---|---|---:|---|
| KISS | Keep current client fingerprint | Low | Prevents accidental double billing. |
| Stronger | Send canonical model state to PHP and hash server-side | Medium | Prevents simple fingerprint lying. |
| Strongest | Server validates/generates paid files | High | Strongest billing/content proof, but heavy architecture change. |

Recommended now: use the KISS approach, but label it correctly in docs and logs.

Revenue-control interpretation: the current client fingerprint is a customer-fairness mechanism, not a monetization enforcement layer. It is acceptable for honest-user re-downloads, but it should not be the final protection if paid download abuse appears.

## Recommended product billing policy

### Billable

1. `library_decor`

2. `house_stl`

3. `panels_zip`

4. `plan_svg`

5. `plan_png`

6. `plan_pdf`

7. `explosion_png`

8. `calculations_pdf`

9. `door_stl`

10. `female_wall_receiver_stl`

### Admin-only/free

1. `debug_obj`

2. `mesh_report_json`

### Bundling policy

Door STL and female wall receiver STL are currently separate billable products. Any future bundle must be represented explicitly in backend product/entitlement policy.

## Recommended next implementation steps

### Priority 1

1. Keep `product_code` mandatory for every customer-facing download button.

2. Keep the backend billing catalog as the only commercial source of truth.

3. Keep the app requesting products by code, never by raw file format.

4. Add user-facing copy for repeat entitlements: `Already purchased - free re-download`.

5. If bundles are added, implement them as explicit backend entitlement rules.

6. Add explicit processing-failure recovery behavior.

### Priority 2

1. Add admin view for export entitlements.

2. Add tests for:

Same house STL Low then High consumes one paid debit.

Changed decor content creates a new paid debit.

Panels ZIP is billed.

Calculations PDF is billed.

Door STL is billed or covered by a paid bundle entitlement.

Female wall receiver STL is billed or covered by a paid bundle entitlement.

Debug OBJ and mesh report are admin-only.

3. Add migration verification for SQLite and MySQL.

### Priority 3

1. Move fingerprint canonicalization to PHP if fraud risk rises.

2. Add per-product pricing.

3. Add invoice-style customer history showing purchased exports.

## Final assessment

The billing direction is now coherent only if the core product rule is enforced: every customer-facing fabrication or decor asset is billable unless explicitly bundled inside a paid entitlement. Revenue comes from library files and fabrication downloads, while diagnostics remain admin-only. The architecture is usable and pragmatic, but it needs one more product-model pass: stop treating file format as product identity, and introduce product codes with explicit billable/admin/bundled policy.

The current entitlement implementation is a good KISS step for customer fairness. It should not be mistaken for anti-fraud security.

## Root architecture fix applied

The export billing path now uses `product_code` as the commercial identity. `export_type` is retained only as file-format metadata.

Authoritative product codes are defined server-side in `server-php/src/credits.php` with explicit credit costs:

- `house_stl`, `door_stl`, `female_wall_receiver_stl`: STL fabrication products.
- `panels_zip`: panel STL package.
- `plan_svg`, `plan_png`, `explosion_png`, `plan_pdf`, `calculations_pdf`: plan/report products.

The quote, authorize, consume, ledger, audit log, and entitlement paths now carry the same `product_code`. Repeat-download entitlement checks are keyed by `(user_id, app_id, product_code, export_fingerprint)`, so a repeated identical product can be free while a different product in the same file format remains billable.

Existing databases are upgraded with a `product_code` column and a legacy backfill from old `export_type` values. This prevents old entitlement rows from becoming invisible after the architecture change.

The WASM client now sends product codes for all public download buttons while keeping the export fingerprint focused on model/export geometry. Client-side costs are fallback display values only; the server quote remains authoritative.

## Admin reporting fix applied

Admin reporting now exposes export consumption by billable product instead of broad file extension.

Visible admin changes:

- Global metrics distinguish requested exports, consumed exports, and consumed export credits.
- Recent export rows show authorization ID, client, `product_code`, file format, charged cost, billing outcome, entitlement download count, and consumed timestamp.
- Product rollup shows authorizations, consumed downloads, charged downloads, free repeat downloads, and total consumed credits per product.
- Client export detail shows the same product/file/outcome/entitlement-count information for an individual account.

Downloadable admin reports now include:

- `product_code`
- `file_format`
- `credit_cost`
- `billing_outcome`
- `entitlement_download_count`
- `first_authorization_id`
- `first_credit_cost`
- `export_fingerprint`
- authorization creation, expiry, and consumption timestamps

This closes the old reporting gap where admin exports could only show `export_type`, making STL/PNG/PDF products indistinguishable from each other.

## Existing database constraint migration

The runtime schema upgrade now also removes the old entitlement uniqueness rule that keyed repeat access by `(user_id, app_id, export_type, export_fingerprint)`.

Why this matters: keeping that old constraint would still make two different products with the same file format and fingerprint collide, for example `plan_png` versus `explosion_png`, or multiple STL products.

SQLite databases are rebuilt for `export_entitlements` when the old unique key is detected. MySQL databases drop the old unique index only when its column order matches the old file-format key, then add the product-key unique index `uniq_export_entitlements_product_fingerprint`.
