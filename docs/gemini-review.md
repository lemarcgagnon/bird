# Nichoir16 Advanced Code Review & Audit Report
**Date:** June 17, 2026
**Agent:** Gemini CLI (Multi-Agent Audit Team)

## 1. Executive Summary
Following an initial audit and a multi-agent deep-dive, the codebase was updated with a "Mission Control" architecture to support multi-WASM applications. This review has been updated to reflect these changes. The foundation remains solid, and the new architectural direction significantly improves extensibility.

---

## 2. Security & Hardening

### 2.1 Authentication Token Storage
*   **Problem:** Auth tokens are currently stored in `localStorage` (`app/app.js`). This makes them accessible to any script running on the page, including potential XSS vectors.
*   **Proposed Solution:** Transition to **HttpOnly, Secure, SameSite=Strict Cookies**. Modify `server-php/src/auth.php` to emit a `Set-Cookie` header on login and remove the token from the JSON response body.

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
*   **Problem:** `app/app.js` recreates the entire WebGLRenderer and Scene on every parameter update, causing GPU pressure and UI stuttering.
*   **Proposed Solution:** **Persist the Renderer and Scene**. Update `BufferGeometry` attributes rather than disposing of the entire world.

### 3.3 Database Indexing
*   **Progress:** The "Mission Control" update correctly added `idx_export_authorizations_app_id`.
*   **Remaining Problem:** Tables like `credit_ledger`, `subscriptions`, and `payments` still lack indices on the `user_id` foreign key.
*   **Proposed Solution:** Add `CREATE INDEX IF NOT EXISTS idx_..._user_id` to the migration for all relational tables.

---

## 4. Reliability & Architectural Extensibility

### 4.1 "Mission Control" Architecture
*   **Observation:** The transition to a registry-based system in `credits.php` is a significant reliability win. It decouples the core billing/credit logic from specific WASM implementations.
*   **Future-Proofing:** Currently, `EXPORT_APPS` is a hardcoded PHP constant. As the ecosystem expands, moving this registry to the `app_settings` table would allow adding new WASM apps without redeploying code.

### 4.2 Negative Geometry Underflow
*   **Problem:** Extreme taper values can result in negative floor widths, causing overlapping panels.
*   **Proposed Solution:** Apply **Clamping** in the Rust geometry logic: `floor_w = (params.w - taper_diff).max(0.0)`.

### 4.3 Webhook Transaction Contention
*   **Problem:** `stripe_webhook.php` performs external Stripe API calls inside a database transaction while holding a `FOR UPDATE` lock.
*   **Proposed Solution:** Move API calls **outside the transaction**. Fetch invoice data *before* starting the DB transaction.

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
The "Mission Control" update is a major step forward, demonstrating excellent attention to validation and scalability (e.g., the new `app_id` index). Addressing the remaining **Performance** (Three.js) and **Security** (Cookie-based auth) gaps will make Nichoir16 a fully production-ready multi-app platform.
