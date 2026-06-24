# Nichoir16 KISS, DRY & No-Band-Aid Review
**Date:** June 17, 2026
**Focus:** Architectural Purity, Code Efficiency, Long-term Maintainability

> Status note (2026-06-24): this is a historical review snapshot. Since it was written, the current codebase already uses HttpOnly cookie auth, a static cache in `page_t()`, the major DB/export indexes in `server-php/src/db.php`, and a persistent Three.js viewer lifecycle in `app/app.js`. The remaining value of this memo is mostly around longer-term simplification and SVG hardening direction.

## 1. The KISS Principle (Keep It Simple, Stupid)

### 1.1 The WebGL Re-initialization "Anti-Pattern"
*   **Historical Violation (Closed):** Earlier `app.js` builds recreated the entire Three.js renderer/scene stack on repeated parameter changes.
*   **Current State:** The viewer now keeps a persistent `viewerState`, reuses the renderer/camera lifecycle, and swaps/disposes scene objects instead of tearing the whole viewer down.
*   **Remaining KISS Direction:** Keep geometry replacement/disposal simple and avoid drifting back to recreate-the-world rendering patterns.

### 1.2 Multi-WASM Registry (Mission Control)
*   **The Success:** The backend correctly ignores the complexity of geometry and focuses solely on `app_id` and credit policy. This is a perfect application of KISS—separation of concerns.
*   **The Future Risk:** Hardcoding the `EXPORT_APPS` array in PHP code is a "code-as-config" band-aid. 
*   **KISS Solution:** Move the registry to the `app_settings` table. Code should handle the logic; data should handle the configuration.

---

## 2. The DRY Principle (Don't Repeat Yourself)

### 2.1 SVG Sanitization Duplication
*   **The Violation:** Both `app.js` (JavaScript) and `lib.rs` (Rust) implement custom sanitization logic for SVG strings.
*   **The Band-Aid:** Double-checking in two languages because neither trust the other.
*   **DRY Solution:** Centralize sanitization. Since the WASM engine is the ultimate consumer of the SVG, it should be the **single source of truth** for what is "safe." The frontend should merely pass the string through.

### 2.2 Translation Array Allocation
*   **Historical Violation (Closed):** `page_t` previously rebuilt large FR/EN arrays on repeated calls.
*   **Current State:** `server-php/src/i18n.php` now reuses a static cache instead of reallocating the translation tables every time.

---

## 3. No-Band-Aid Strategy (Root Cause Fixes)

### 3.1 Database Scalability (The Indexing Gap)
*   **Historical Gap (Closed for current schema):** The original concern about missing `user_id` indexes was valid when this memo was written.
*   **Current State:** The current schema in `server-php/src/db.php` includes the major `user_id`, export, payment, ticket, and subscription indexes that were missing earlier.

### 3.2 Secure Token Handling
*   **Historical Gap (Closed):** The browser app no longer relies on a persistent bearer token in `localStorage`.
*   **Current State:** Account auth now uses the server-set HttpOnly cookie `nichoir_account_session`, and `app/app.js` clears the old `nichoir-auth-token` key on load.

### 3.3 WASM Processing Loops
*   **The Band-Aid:** Accepting UI lag during "Processing..." for complex SVGs.
*   **Root Cause Fix:** Replace $O(N^2)$ brute-force loops with spatial indexing (Bounding Boxes). Fix the algorithm, don't just "show a loader."

---

## 4. Final Verdict

### Structural Health: **7/10**
Nichoir16 is a clean, well-organized project. Several of the highest-maintenance band-aids identified here have since been removed; the remaining longer-term design pressure is mostly around SVG sanitization centralization and whether app registry/config should stay code-backed.

### Top 3 "No-Band-Aid" Priorities:
1.  **Centralize SVG trust decisions:** reduce split sanitization logic between JS and Rust.
2.  **Move Config to Data when justified:** transition the `EXPORT_APPS` registry to admin/data-backed config only if multi-app operations truly need it.
3.  **Keep the viewer lifecycle stable:** prevent regressions back to recreate-the-renderer patterns.

By removing these architectural shortcuts, the codebase will transition from a "working prototype" to a "robust platform."
