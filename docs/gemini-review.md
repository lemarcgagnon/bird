# Nichoir16 Advanced Code Review & Audit Report
**Date:** June 17, 2026
**Agent:** Gemini CLI (Multi-Agent Audit Team)

> Status note (2026-06-24): this is a historical external audit snapshot. Since this review, the current codebase already uses the HttpOnly SameSite=Lax `nichoir_account_session` cookie, clears the legacy `nichoir-auth-token` local-storage key in `app/app.js`, keeps a persistent Three.js viewer lifecycle, adds the major `user_id`/export indexes in `server-php/src/db.php`, clamps the taper path in WASM, and prefetches Stripe invoice data before the webhook DB transaction. Remaining points below should be read as follow-up recommendations unless reconfirmed against current code.

## 1. Executive Summary
Following an initial audit and a multi-agent deep-dive, the codebase was updated with a "Mission Control" architecture to support multi-WASM applications. This review has been updated to reflect these changes. The foundation remains solid, and the new architectural direction significantly improves extensibility.

---

## 2. Security & Hardening

### 2.1 Authentication Token Storage
*   **Historical Finding (Closed):** Earlier builds stored account auth state in `localStorage`. The current app now clears the legacy browser key and authenticates through the server-set HttpOnly cookie `nichoir_account_session`.
*   **Current State:** `server-php/src/auth.php` sets the cookie, browser requests use credentials, and the active cookie policy is `SameSite=Lax` rather than the stricter `SameSite=Strict` proposed here.

### 2.2 SVG Sanitization Strategy
*   **Problem:** The custom `assertSafeSvgText` function in `app/app.js` uses a "blacklist" of forbidden tags/attributes. Blacklists are prone to bypasses.
*   **Proposed Solution:** Implement a **Whitelist-based sanitizer**. Use a proven library like `DOMPurify` (client-side) or implement a strict tag whitelist in the Rust WASM layer before parsing.

### 2.3 App ID Validation (Mission Control)
*   **Strength:** The new `app_id` parameter in export flows is strictly validated in `server-php/src/credits.php` using both a regex and a server-side whitelist (`normalize_export_app_id`). This prevents injection of unauthorized app identifiers.

---

## 3. Performance & Scalability

### 3.1 WASM Geometry Complexity
*   **Problem:** The `add_heightmap_basis` function in `wasm/src/lib.rs` has an $O(N^2 \cdot M)$ complexity during point-in-polygon checks for SVG heightmaps.
*   **Proposed Solution:** Implement **Spatial Indexing** (e.g., Bounding Box check or Grid-based binning) to reduce the number of `point_in_poly_2d` calls.

### 3.2 Three.js Context Management
*   **Historical Finding (Closed):** Earlier builds recreated the `WebGLRenderer` and scene on repeated updates.
*   **Current State:** `app/app.js` now keeps a persistent `viewerState`, rebinds the mount when needed, and replaces/disposes mesh resources instead of rebuilding the renderer per parameter change.

### 3.3 Database Indexing
*   **Progress:** The original "Mission Control" update added `idx_export_authorizations_app_id`.
*   **Historical Finding (Closed for current schema):** The current schema in `server-php/src/db.php` now also carries the major `user_id`, payment, subscription, ticket, and export indexes that were missing when this review was written.

---

## 4. Reliability & Architectural Extensibility

### 4.1 "Mission Control" Architecture
*   **Observation:** The transition to a registry-based system in `credits.php` is a significant reliability win. It decouples the core billing/credit logic from specific WASM implementations.
*   **Future-Proofing:** Currently, `EXPORT_APPS` is a hardcoded PHP constant. As the ecosystem expands, moving this registry to the `app_settings` table would allow adding new WASM apps without redeploying code.

### 4.2 Negative Geometry Underflow
*   **Historical Finding (Closed):** Extreme taper values previously risked negative floor widths and overlapping panels.
*   **Current State:** The taper path has since been clamped in the Rust geometry logic.

### 4.3 Webhook Transaction Contention
*   **Historical Finding (Closed):** The earlier webhook flow could perform external Stripe API work inside the DB transaction.
*   **Current State:** `server-php/src/stripe_webhook.php` now enriches the Stripe object before the transaction begins.

---

## 5. Summary Table

| Finding | Category | Severity | Proposed Action |
| :--- | :--- | :--- | :--- |
| LocalStorage Tokens | Security | Medium | Switch to HttpOnly Cookies. |
| Multi-WASM Registry | Architecture | Positive | Transition to DB-backed registry in future. |
| $O(N^2)$ WASM Loop | Performance | Medium | Add Bounding Box / Spatial check. |
| Scene Re-init | Performance | High | Persist renderer; update BufferGeometry. |
| Missing user_id Indices| Performance | Medium | Add `CREATE INDEX` for foreign keys. |
| Taper Underflow | Reliability | Medium | Add `max(0.0)` clamping in Rust. |
| Lock Contention | Reliability | Medium | Move API calls outside of DB transactions. |

---

## 6. Final Recommendation
The "Mission Control" update was a major step forward, and several concrete gaps from this review are now closed in the current codebase. The remaining higher-value follow-up areas are SVG hardening, heavy WASM geometry hotspots, and the long-term question of whether the app registry should stay code-backed or move to data-backed configuration.
