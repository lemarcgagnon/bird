# Nichoir16 KISS, DRY & No-Band-Aid Review
**Date:** June 17, 2026
**Focus:** Architectural Purity, Code Efficiency, Long-term Maintainability

## 1. The KISS Principle (Keep It Simple, Stupid)

### 1.1 The WebGL Re-initialization "Anti-Pattern"
*   **The Violation:** `app.js` destroys and recreates the entire Three.js `WebGLRenderer` and `Scene` on every parameter change.
*   **The Band-Aid:** Using `cleanupViewer()` to wipe the slate clean instead of properly updating existing objects.
*   **KISS Solution:** Initialize the renderer **once**. Update only the `geometry.attributes` of existing meshes. Simplicity in the rendering loop leads to better performance and fewer edge cases.

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
*   **The Violation:** The `page_t` function in `i18n.php` re-allocates massive associative arrays (FR/EN) on every single call.
*   **The Band-Aid:** Relying on PHP's memory management to clean up the mess thousands of times per request.
*   **DRY Solution:** Use `static` variables or a single configuration file that returns the array once. Stop redefining the same data structures repeatedly.

---

## 3. No-Band-Aid Strategy (Root Cause Fixes)

### 3.1 Database Scalability (The Indexing Gap)
*   **The Band-Aid:** Relying on the small initial dataset to hide the lack of indices on foreign keys (`user_id`).
*   **Root Cause Fix:** Add explicit indices to `credit_ledger`, `subscriptions`, and `payments`. A database without indices is a ticking performance bomb.

### 3.2 Secure Token Handling
*   **The Band-Aid:** Storing auth tokens in `localStorage` because it is "easier" to implement in JavaScript.
*   **Root Cause Fix:** Use `HttpOnly` cookies. This solves the security problem at the protocol level rather than trying to "sanitize" every possible XSS vector in the UI.

### 3.3 WASM Processing Loops
*   **The Band-Aid:** Accepting UI lag during "Processing..." for complex SVGs.
*   **Root Cause Fix:** Replace $O(N^2)$ brute-force loops with spatial indexing (Bounding Boxes). Fix the algorithm, don't just "show a loader."

---

## 4. Final Verdict

### Structural Health: **7/10**
Nichoir16 is a clean, well-organized project, but it is currently "held together" by several high-maintenance band-aids in the frontend rendering and backend translation logic.

### Top 3 "No-Band-Aid" Priorities:
1.  **Stop Re-initializing WebGL:** Move to a persistent renderer with attribute updates.
2.  **Move Config to Data:** Transition the `EXPORT_APPS` registry to the DB.
3.  **Harden the Protocol:** Switch from `localStorage` to `HttpOnly` cookies.

By removing these architectural shortcuts, the codebase will transition from a "working prototype" to a "robust platform."
