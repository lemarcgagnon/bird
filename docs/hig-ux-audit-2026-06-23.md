# HIG/UX audit - 2026-06-23

## Scope

This audit covers the PHP public site, account area, admin back-office, static JS shell, and Rust/WASM-rendered app UI. It is based on source review plus desktop/mobile screenshots of:

- Public home, library, account.
- WASM app at desktop and narrow widths.
- Admin support and admin library fixture views.

The goal is not more visual polish on isolated screens. The current weakness is system-level UX consistency: shared CSS is reused across unrelated contexts, state handling is not designed first, and dense operational surfaces still inherit marketing-page structure.

## Product Direction

Nichoir has three different products in one codebase, and each needs its own UX contract.

1. Public site: explain value quickly, show the actual 3D/product result, move people to the app/account/library.
2. WASM app: dense precision tool for repeated use, with compact controls and a strong 3D workspace.
3. Admin/account backend: operational dashboard for support, billing, credits, library management, and audit trails.

The current UI often uses the same cards, tab chips, headings, and buttons for all three. That is the root cause of the awkward responsive behavior.

## Critical Findings

### 1. The responsive model is not designed as a system

Symptoms:

- Public nav needed an emergency hamburger fix.
- Admin tabs wrap into multiple chip rows on narrow screens.
- Admin support tables become unreadable on mobile.
- WASM narrow layout squeezes desktop tabs, truncating labels like `Calcu...` and `Comp...`.
- Library CTA buttons became tall blocks because `.hero-actions` was reused in a non-hero layout.

Required direction:

- Define separate layout primitives: `marketing-hero`, `section-actions`, `toolbar-actions`, `table-actions`, `admin-shell`, `app-shell`.
- Stop reusing `.hero-actions` for normal section controls.
- Tables stay tables on desktop, but must become card rows on mobile for account/admin/support/history views.
- WASM needs a real compact shell: viewer first, editor as drawer/bottom sheet, non-truncated tab labels or icon+label bottom nav.

### 2. Account UX is state-blind

Logged-out users currently see profile editing before login/create/activation. That is backwards.

Required direction:

- Guest state: show Sign in, Create account, Activate account as the primary workflow.
- Logged-in state: show profile, credits, billing, library downloads, support.
- Pending activation state: focus the activation form and resend action.
- Error states must be human-readable, not raw API codes.

### 3. Admin uses marketing page chrome

The admin dashboard still has a public header, huge `Admin` title, large metric cards, public footer, and wrapped tab chips. For a back-office, this wastes vertical space and reduces scanning speed.

Required direction:

- Give admin its own compact shell.
- Use a sticky admin header with logout and current section.
- Use side navigation or a compact section menu on desktop; use a drawer/select-style section switcher on mobile.
- Convert metric cards to a compact KPI strip.
- Remove the public footer from admin pages.

### 4. WASM app controls are too small and too decorative

The app is closer to the right tool identity than the public site, but it relies on 9-11px labels, monospace everywhere, floating overlays, and truncated tabs.

Required direction:

- Use system sans for UI labels; keep monospace only for numeric inputs/readouts.
- Raise baseline control text to at least 12-13px, with 44px touch targets.
- Make tabs semantic and non-truncated.
- Move viewer controls into a collapsible/anchored toolbar on narrow screens.
- Keep the 3D model visually dominant; overlays should not cover it by default on mobile.

### 5. Feedback and status states are inconsistent

Examples:

- Public library empties the loading message but leaves a styled empty notice line.
- Account page shows raw backend error codes in several paths.
- WASM decor/library statuses are plain text in some places without `role=status` or `role=alert`.
- Admin POST notices are query-param flash messages with uneven severity styling.

Required direction:

- Create one notice/status component with variants: info, success, warning, error.
- Hide empty notices completely.
- Map backend error codes to localized user copy.
- Use `role=status` for normal async progress and `role=alert` for blocking errors.

### 6. Visual system is too one-note

The current public/admin palette is mostly cream, tan, and orange. The app dark mode works better, but the product still reads as one hue family.

Required direction:

- Keep orange as brand/action color.
- Add neutral surface contrast and one secondary semantic color family for status/info.
- Reduce large rounded cards. Cards should generally stay at 8px radius or less unless a specific component needs more.
- Use actual product visuals: 3D birdhouse/app preview on home, real STL preview in library, clear thumbnail preview affordance.

## Surface Findings

### Public Site

Keep:

- Clear bilingual navigation.
- Main routes are simple and understandable.
- Mobile hamburger is now structurally better.

Fix:

- Home hero has too much blank vertical space on desktop and no real product visual.
- Hero card is abstract; replace with app screenshot/3D preview or actual outcome.
- Library flow CTA layout is wrong on desktop because the buttons inherit hero action sizing.
- Library loaded state leaves an empty notice bar.
- Library STL thumbnail should open 3D preview directly; the preview button can remain as a secondary redundant action.
- Public site lacks the visible theme toggle required by the HIG skill baseline.

### Account

Keep:

- Account tabs are semantically closer than before.
- Tables are acceptable for desktop billing/history views.

Fix:

- Profile form must not be first for logged-out users.
- Login/logout in same row is confusing; logout should only render when logged in.
- Activation should be a specific state, not another always-visible card.
- Billing buttons need plan/package context before action.
- Tables need mobile card rendering.
- Messages need better placement near the action that caused them.

### WASM App

Keep:

- Split between 3D workspace and controls is the right desktop model.
- Theme toggle exists and persists.
- Download gate modal has focus handling and clear primary/secondary actions.
- Three.js STL preview controls are now more complete.

Fix:

- Mobile shell should not be a squeezed desktop shell.
- Tabs need semantic roles, selected state, and labels that do not truncate.
- `choice_button()` should emit `type="button"` and `aria-pressed`.
- Range + number paired controls need clearer accessible names and units.
- Tiny 9-10px labels should be raised.
- Viewer control overlay should collapse or move on mobile.
- Decor library panel in the app should use the same preview behavior and language as public library.

### Admin

Keep:

- Support-first default is correct.
- Client modal is the right pattern for deep client detail.
- Admin library card conversion is the right direction.

Fix:

- Replace public-page shell with admin shell.
- Replace wrapped admin tabs with real admin navigation.
- Convert support/client/billing/export/log tables to responsive row cards on mobile.
- Make priority/status badges visible, not plain table text.
- Make destructive actions use consistent confirmation UI and danger styling.
- Settings need fieldsets and grouped actions, especially Stripe, SMTP, DB and credit policy.
- Logs need filters, severity badges, and compact details.

## Implementation Plan

### Pass 1 - Foundation

1. Add component classes for actions, notices, badges, toolbar, tablist, responsive data cards, and admin shell.
2. Remove cross-context reuse of `.hero-actions`.
3. Define status/notice variants and hide empty notices.
4. Normalize button variants: primary, secondary, quiet, danger, icon, compact.

### Pass 2 - Public + Account

1. Replace home abstract hero card with real app/product visual.
2. Fix library loaded state and thumbnail-preview interaction.
3. Redesign account page around guest, pending, and logged-in states.
4. Convert account history/support tables to mobile cards.

### Pass 3 - WASM App

1. Update Rust-rendered tabs/choice controls for semantics and `type="button"`.
2. Raise text/control sizing and reduce monospace usage.
3. Redesign narrow shell: viewer toolbar collapsed, editor drawer/bottom panel, non-truncated section navigation.
4. Standardize app decor library preview/download interactions.

### Pass 4 - Admin

1. Build admin-only shell without public footer.
2. Convert admin nav to desktop side/top section nav and mobile drawer/select.
3. Convert key admin tables to mobile row cards.
4. Tighten admin metric strip and support queue scanning.
5. Group settings forms and normalize confirmations.

### Pass 5 - Accessibility and Validation

1. Keyboard pass through public nav, account tabs, admin tabs, app tabs, modals, and viewer controls.
2. Screen-reader pass for dialogs, tabs, status messages, file upload/dropzone, and STL preview controls.
3. Contrast pass for light/dark app and public/admin light theme.
4. Screenshot regression pass at 390, 768, 1024, and 1440 px.
5. Run PHP lint, `node --check app/app.js`, `cargo check`, and app smoke tests after implementation.

## First Fixes To Do

Start with these because they remove systemic breakage:

1. Split action layouts: replace `.hero-actions` misuse with `.section-actions`.
2. Hide empty public library notice after load.
3. Make public/WASM library thumbnails open 3D preview.
4. Add responsive data-card rendering for account/admin tables.
5. Redesign account logged-out state.
6. Add admin shell and remove public footer from admin.
7. Redesign WASM mobile shell and tab semantics.

