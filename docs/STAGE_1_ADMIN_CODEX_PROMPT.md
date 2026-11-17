# Stage 1: Administrator Interface Implementation

Prepared against commit `0765e5d` on 17 November 2026, after inspecting the current repository and `docs/FUNCTIONALITY_AUDIT.md`.

This is an implementation prompt for the next Codex run. This document does not claim the admin feature has been implemented. The latest user brief supersedes the audit's suggested order: **admin interface first, booking UX only after Stage 1 testing and review**.

Copy the prompt below in full.

---

You are implementing Stage 1 of the existing RideCore final-year project: a working administrator interface **inside the existing React Native/Expo application**. Complete the implementation, test it, document actual evidence and stop for review before Stage 2. Do not stop at proposing a design or generating another implementation prompt.

## 1. Scope and preservation rules

Read applicable `AGENTS.md` instructions, `docs/FUNCTIONALITY_AUDIT.md`, current package manifests and relevant source before editing. Inspect current Git status and preserve user changes, including existing untracked audit documentation. Baseline when this prompt was prepared: `0765e5d`; recheck it rather than assuming it remains current.

Preserve:

- Working rider/driver registration, sign-in, session restore, booking, active trips, maps, driver mode, sharing, receipts and ratings.
- Express/Mongoose/MongoDB backend, existing JWT identity/authorization, React Native/Expo/TypeScript/React Navigation frontend and existing API envelopes.
- RideCore tokens, typography, components and navigation conventions.
- Separate driver-profile and vehicle verification, approval conflicts, account activation restrictions and offline transitions.
- Current fare, payment, matching and ride state-machine contracts.
- Existing public registration restriction to rider/driver. Public admin registration must remain impossible.

Do not implement Stage 2 booking changes, saved places, payment preference, dispatch, SOS, surge, document uploads/KYC, payment providers or a new location-freshness policy. Do not migrate frameworks/databases, build a separate admin website, introduce a second identity store, add unnecessary packages or create fake statistics. Do not automatically commit, push or deploy. Never alter real/production user records during testing.

Stage 1 includes the small driver-client compatibility change needed to render the backend's existing `suspended` verification state. It does not authorize broad rider/driver redesign.

## 2. Inspect the actual code and contracts

Start with:

**Session/auth/navigation**

- `frontend/src/features/session/SessionController.ts`, `SessionProvider.tsx`, `BootstrapScreen.tsx`.
- `frontend/src/services/api.ts`, `contracts.ts`, `errors.ts`, `credential-store.ts`, `credential-store.web.ts`, `server-config.ts`.
- `frontend/src/features/auth/screens/WelcomeScreen.tsx`, `SignInScreen.tsx`, `RegisterScreen.tsx`, `features/auth/validation.ts`, `components/AuthFields.tsx`.
- `frontend/src/navigation/AuthNavigator.tsx`, `RootNavigator.tsx`, `RiderNavigator.tsx`, `DriverNavigator.tsx`, `types.ts`.
- `frontend/src/application/*`, `src/demo/*` for provider/session boundaries.

**Backend admin/security/data**

- `backend/src/routes/index.js`, `routes/schemas.js`, `controllers/index.js`.
- `backend/src/services/admin.js`, `auth.js`, `identity.js`, `drivers.js`, `nearby.js`, `rides.js`, `ride-detail.js`, `payments.js`.
- `backend/src/middleware/auth.js`, `validate.js`, models `User`, `DriverProfile`, `Vehicle`, `Ride`, `Payment` and shared serialization.
- `backend/scripts/create-admin.js`, `tests/helpers.js`, `tests/browser-server.js`, `tests/authorization.test.js`, `tests/payments-ratings-admin.test.js`, `tests/nearby.test.js`.

**UI/tests**

- `frontend/src/theme/tokens.ts`, `components/layout/Screen.tsx`, `BrandHeader.tsx`, `components/ui/*`, `components/feedback/ConfirmationDialog.tsx`.
- `frontend/src/services/driver-api.ts`, `features/driver/screens/DriverOnboarding.tsx`, `features/account/screens/AccountScreen.tsx`.
- `frontend/tests/session.test.ts`, `api.test.ts`, `navigation.test.tsx`, `auth-ui.test.tsx`, `fixtures.ts`, existing driver tests, verification scripts and device checklist.

Confirmed findings to account for:

1. `SessionController.allowed()` currently rejects admin. Its `restoreToken()` has a driver shortcut but otherwise performs rider-only ownership/active-ride recovery. Merely adding admin to the allowlist is insufficient.
2. `RootNavigator` currently has driver, rider and auth branches; a generic authenticated fallback currently enters the rider app.
3. API user roles are returned as strings. Existing session tests explicitly reject admin and unsupported roles; update the intentional admin expectation while retaining unsupported-role rejection.
4. Admin lists return raw resource arrays, up to 50 records per page. Driver list rows already include linked `vehicle` and limited `account` data. They do not supply trustworthy global totals.
5. Driver verification writes address a **DriverProfile ID**; vehicle writes address a **Vehicle ID**; activation writes address a **User ID**. Do not interchange them.
6. Backend driver/vehicle states include `pending`, `approved`, `rejected`, `suspended`; the current driver API parser and onboarding status UI omit suspended.
7. `ride-detail.js` already allows admin-authorized ride detail and supplies limited rider/driver presentation data. Avoid a duplicate trip-detail API.
8. Payments may have pending/paid/failed/refunded status. Rider payment parsing expects a paid record and is unsuitable for all administrative payment records. `paidAt` can be absent.

## 3. Existing API surface to reuse

All paths below include the `/api` prefix:

| Operation | Existing route | Notes |
| --- | --- | --- |
| Login | `POST /auth/login` | Existing email-or-phone/password contract, JWT response; no separate admin login API needed. |
| Authoritative session identity | `GET /auth/me` | Verify active account and role. |
| User list | `GET /admin/users?page=N` | Admin-only, max 50, array envelope. |
| Driver applications | `GET /admin/drivers?page=N` | Profiles with associated account and vehicle where present. |
| Ride list | `GET /admin/rides?page=N` | Persisted ride records. |
| Ride detail | `GET /rides/:id` | Existing authorization permits admin; read-only UI. |
| Payment list | `GET /admin/payments?page=N` | Recorded transactions; preserve statuses and currencies. |
| Driver verification | `PATCH /admin/drivers/:id/verification` | Body `{ verificationStatus: 'approved' \| 'rejected' \| 'suspended' }`. |
| Vehicle verification | `PATCH /admin/vehicles/:id/verification` | Same verification body. |
| Account activation | `PATCH /admin/users/:id/active` | Body `{ isActive: boolean }`. |

Confirm actual responses in code/tests before building adapters. Reuse `createTransport` for envelopes, errors, bearer header and abort support. Reuse `session.run()` to execute operations with the validated in-memory token; screens must not read credential storage directly.

## 4. Admin sign-in, session and navigation

Add a discreet **Admin sign in** text link on the existing welcome/auth interface. It opens a distinct `AdminSignIn` screen with RideCore form components, an email/password form (existing phone/password mode can be reused if straightforward), back navigation, inline errors, secure password entry and locked/loading submission. No admin registration link or embedded credentials.

Reuse the current login endpoint and session controller. A small explicit sign-in audience option or `signInAdmin` wrapper is acceptable; do not duplicate password/JWT/storage logic. The administrator entry must reject valid rider/driver credentials **before they become a persisted authenticated admin attempt**: check authoritative `/auth/me`, require active `admin`, and display a clear message on the login form without mounting rider/driver/private admin screens. Do not persist a mismatched token or overwrite valid credentials with it. Invalid credentials keep the same form usable for retry.

For regular rider/driver sign-in, retain current behavior. If an admin uses the normal sign-in form, route the verified identity to admin rather than treating it as a rider. Unsupported roles and inactive accounts remain denied. Never infer role from selected screen, email, cached flag or editable input.

Support admin restoration from the existing credential store: verify `/auth/me`, then enter ready state with no rider active-ride lookup. Admin restoration must not call `/rides/me` or mount `JourneyProvider`/`DriverProvider`. Preserve controller epochs, abort handling, serialized storage operations, logout failure recovery and protection against late sign-in results after logout.

Make `RootNavigator` dispatch explicit verified roles: admin → AdminNavigator, driver → existing DriverNavigator, rider → existing rider navigator; unknown roles must fail closed. Add matching typed route params. Anonymous/back/deep-link navigation cannot mount the admin navigator. An admin screen guard is defense in depth; server authorization remains mandatory.

Provide sign-out in the admin shell using `session.logout()` and the existing confirmation pattern. On logout/identity rejection, discard all admin cached lists, selected records and counts; late responses must not repopulate them. Handle foreground restore, expired/inactive identity and network/storage recovery using existing conventions.

Update role-denial error copy that currently says admins must use external admin tools. Inspect transport/session handling of 401/403: expired/forbidden admin identity exits admin access; ordinary 409 mutation conflicts stay in the app with a useful explanation. Do not weaken existing ride permission handling to achieve this.

## 5. Minimal protected backend overview

Add **one** protected `GET /api/admin/overview` endpoint using the existing admin router, thin controller and admin service. Use the normal success/error envelope and existing authentication + `authorize('admin')` middleware. No schema/model migration should be needed.

Return named nonnegative integer counts from actual MongoDB records, not list lengths or constants. Suggested contract:

```ts
type AdminOverview = {
  registeredRiders: number;
  registeredDrivers: number;
  pendingDriverApprovals: number;
  onlineDrivers: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  recordedPayments: number;
};
```

Define and document semantics:

- Registered riders/drivers: User records with that role, including disabled accounts; exclude admin users.
- Pending driver approvals: pending DriverProfile records joined to existing driver accounts; counts basic profile approvals, not pending vehicles. Label this clearly; a separate vehicle review remains on the driver screen. Missing licence is visible and approval remains blocked by existing rules.
- Online drivers: currently eligible online drivers platform-wide: active driver account, approved profile and approved vehicle, status online, valid stored location, no active assigned ride. Match existing eligibility criteria, without imposing a new freshness policy here. This count is not nearby supply and must not be described as fresh GPS or a radius-based rider count.
- Active rides: `active: true`; completed/cancelled use their actual persisted statuses. Do not invent matched/searching states in storage.
- Recorded payments: count Payment records across actual statuses; this is transaction count, not money moved or revenue. No cross-currency sum.

Use bounded aggregation/count queries. No downloading all pages to compute totals. A refresh should show actual latest counts after mutations; on errors show unknown/error/retry rather than zero. Avoid claiming an atomic cross-collection snapshot if separate queries are used.

Preserve existing list envelopes and pagination behavior. Extend protected list filtering/search only if needed for a coherent implementation; use validated/allowlisted fields and bounded text, escape any regex input, and do not accept arbitrary MongoDB query objects. Never silently redefine existing routes to a new pagination shape. Pagination with Previous/Next and a page number is sufficient when totals are unavailable; a full 50-record page may require checking the next page. Do not label an incompletely loaded page as the full system dataset.

## 6. Functional administration screens

Build an admin navigator with **Overview, Drivers, Rides, Users, Payments** sections. Follow existing tab/stack conventions with readable labels and sensible safe-area spacing. Small screens use compact record cards/lists, not wide desktop-only tables. Use existing Inter type, colors, icons, buttons and confirmation dialogs; no decorative charts or new dashboard design system.

Suggested structure (adapt filenames if established patterns justify it):

```text
frontend/src/navigation/AdminNavigator.tsx
frontend/src/features/auth/screens/AdminSignInScreen.tsx
frontend/src/services/admin-api.ts
frontend/src/features/admin/AdminProvider.tsx or a small shared controller/hooks
frontend/src/features/admin/screens/AdminOverviewScreen.tsx
frontend/src/features/admin/screens/AdminDriversScreen.tsx
frontend/src/features/admin/screens/AdminRidesScreen.tsx
frontend/src/features/admin/screens/AdminUsersScreen.tsx
frontend/src/features/admin/screens/AdminPaymentsScreen.tsx
frontend/src/features/admin/components/   # only genuinely shared pieces
```

Do not add a global state framework or create unnecessary layers. Type and validate the actual admin DTOs, including optional/missing historical fields. Avoid casting raw responses through rider-only parsers.

### Overview

Render all eight live counts with clear labels, last-loaded/refresh feedback and navigation to the relevant section. Provide loading, retry and no-data states. Do not flash invented zeros while loading. Never show cached data from a previous session.

### Driver management

Paginate registered profile records; show driver account name/status, submitted licence number, profile verification, availability and associated vehicle make/model/year/color/plate/category/seats/verification when present. If records or associations are absent, show missing/incomplete information and disable the unavailable action rather than crashing or inventing details.

Allow review with **Approve profile**, **Reject profile**, **Suspend profile**, **Approve vehicle**, **Reject vehicle** (vehicle suspend may also be exposed if consistent with existing backend). Keep the two verification controls and ID types separate. Show current state, require clear confirmation for eligibility-changing actions, disable repeated taps while pending and refresh authoritative data on success. On uncertain mutation response, reconcile the record and do not automatically repeat the PATCH.

Approval must never take the driver online. Explain that both approvals and account activation are needed before the driver can intentionally go online. Missing licence approval and active-assigned-trip conflicts remain enforced on the backend and displayed clearly. No document upload, full KYC or claimed licence authenticity check.

Fix existing `Verification` parser/type and onboarding status presentation to handle `suspended` on both profile and vehicle responses. A suspended driver should see their actual restricted status and cannot go online; do not change backend eligibility or resubmission policy.

### Ride management

List actual requested/accepted/driver_arriving/driver_arrived/in_progress/completed/cancelled rides. Requested can be labeled Pending request; active group includes actual active states. Show pickup, destination, ride ID, category, status, requested time and recorded fare/currency. Use existing admin-authorized ride detail for additional rider/driver first names, vehicle and available timestamps. Missing/unassigned driver is a real state.

Show only permitted available information; do not invent contacts, ETA, route distance or coordinates. Admin trip management is **inspection only**: do not add controls that force participant-only transitions or record payment. Handle list/detail loading, deleted records, empty pages, failures and retry.

### User management

Paginate user records and distinguish rider/driver/admin role and active/disabled status. Display basic account fields already provided to admin. Allow disabling/restoring rider/driver accounts through existing `/active` endpoint with confirmation and per-record pending state. Do not introduce arbitrary role editing, public admin creation or account deletion.

Preserve backend prevention of self-activation changes and changes affecting active rides. Explain conflicts; a successful reactivation must not take a driver online. If admin records are visible in the list, keep them read-only in this UI. Do not expose passwords, hashes, JWTs or OTP secrets.

### Payment monitoring

Read-only paginated transactions: record/ride identifiers, method, status, amount, recorded currency, reference and paid/created time when available. Handle all model statuses and absent paidAt; apply existing documented legacy GBP interpretation where currency is missing, without converting stored values or mislabeling them GMD.

Clearly label records produced by the current simulated payment service as **simulated payment records**; even cash records with `SIM-` references do not prove a real collection/transfer. Do not advertise real revenue, charge, refund or settle anything. Do not introduce payment processing changes.

### Shared UX/data behavior

- All sections have loading, successful empty, API failure/retry, refresh and pagination states. Preserve data with a clear stale/error indication where appropriate; never disguise a failed fetch as an empty dataset.
- Protect against outdated page/detail responses overwriting a newer selection. Cancel or ignore unmounted/session-invalid requests; prevent simultaneous duplicate actions.
- Invalidate/refresh overview and affected list/detail data after successful approval/account changes and when revisiting sections. Ensure actions remain usable after refresh.
- Use accessible labels/roles, clear status text (not color alone), keyboard-safe forms, existing touch-target sizing and mobile-safe scrolling. Test at 390×844 and a narrow viewport; browser preview is not a substitute for native testing.
- No rider booking or driver tracking provider should run behind admin screens. The existing offline rider demo must not become a fake admin backend or expose invented admin metrics.

## 7. Testing and evidence

Run baseline checks before changes and relevant tests after each coherent implementation step. The prior audit ran backend 284/284 successfully; frontend 209/210 with one navigation timeout and a separate 5/5 navigation retry; typecheck passed. These are historical baselines, not proof your changes pass.

Both existing Node full-stack verification scripts previously failed before scenarios with missing transpiled `./server-config`. Do not quietly report them green or weaken production server configuration. If a small test-only harness repair is necessary for the admin scenario, keep it scoped, account for React Native/SecureStore imports, document it and run the repaired harness; otherwise use the existing disposable browser/backend setup or a new narrowly scoped integration test. Do not spend this stage rebuilding unrelated verification infrastructure.

### Backend tests (disposable MongoDB only)

Extend existing Vitest/Supertest tests rather than duplicating the service architecture:

1. Overview auth: unauthenticated → 401; rider/driver → 403; active admin → actual counts. Disabled/expired admin denied.
2. Use more than 50 records across roles/states to prove counts are global, admins excluded from rider totals, pending-profile meaning correct and payment count includes appropriate actual statuses. Include joined online eligibility exclusions (inactive account, pending/rejected vehicle, busy/offline driver, active ride).
3. Profile and vehicle approvals are independent; either missing prevents online eligibility. Approval leaves availability offline. Existing missing-licence and active-ride conflicts persist.
4. Reject/suspend updates are protected; inactive users cannot authenticate/use private APIs. Existing self-management and active-ride account restrictions remain intact.
5. Existing admin lists stay backward compatible and page correctly. Sensitive fields remain absent. Test any added query validation/filters.
6. Isolated workflow: register driver → submit licence/vehicle → admin approves separately → valid location → driver intentionally goes online → nearby rider sees eligible driver → compatible request can be accepted. No configured real user data.

### Frontend tests

Add meaningful tests for admin adapter/controller/screens using existing Jest patterns:

1. Admin sign-in link opens correct form; existing public auth routes still work; form has no admin registration option.
2. Valid admin logs in and restores without calling rider ride discovery or mounting rider/driver providers; valid rider/driver credentials entered on admin form are rejected without storing/mounting an admin session. Invalid credentials, disabled account, unsupported role, rate/network/storage errors and retry are safe.
3. Logout/session expiry clear token and admin state; stale API/login responses cannot restore private data. Existing rider/driver restore/race-condition tests remain meaningful; replace only the now-obsolete expectation that all admin identities are rejected.
4. Verified roles map to correct navigators, tabs/details/back actions work, and anonymous/non-admin contexts cannot mount admin operations.
5. Actual overview DTO values render; loading does not imply zero; failed requests show retry; refresh after mutation updates data.
6. Correct profile/vehicle/user IDs and exact request payloads are used; profile/vehicle controls remain separate; duplicate taps are blocked; conflicts/retries do not silently change state.
7. Suspended profile AND vehicle parse and render in the driver app without crashes or approval bypass.
8. Lists support empty/error/missing-associated-record/page states and ignore stale responses. Payment monitor renders non-paid statuses, absent paidAt, GMD/legacy GBP correctly and visibly states simulation.

### Browser/device checks

Use isolated temporary DB/accounts. Inspect `backend/tests/browser-server.js` before launch; its explicit test flags, port 5054 and CORS origin `http://localhost:3004` must match the test UI. Do not alter private configuration or stop unrelated processes to make tests work. Do not run `seed:dev` against the developer's configured database.

Actually exercise: admin login → all five sections → profile and vehicle approvals → refresh counts → account disable/restore → logout → session restoration; separate rider/driver contexts show correct permissions and driver offline/approval behavior. Where practical verify matching/acceptance against the same isolated data. Inspect network status/errors and console output without logging credentials/tokens.

Record viewport/device/build, exact tested interactions and failures. Run native Android/iOS checks if a device/build is available; mark them **not executed** otherwise. Do not claim functionality is verified solely from mocked UI tests or passing typecheck. If browser tooling is unavailable, finish code and automated checks, give exact manual steps and state the unverified acceptance items explicitly.

### Commands

Use project scripts, including:

```powershell
# backend/
npm test

# frontend/
npm run typecheck
npm run lint
npm test -- --silent
npm run export:web
```

Check formatting on changed files with existing tools; avoid formatting unrelated files or treating known pre-existing formatting as a new change. Run existing integration scripts when applicable and report their real results. Repeat failures with focused tests when justified; do not simply increase timeouts or remove assertions to obtain green output. No dependency installation unless genuinely required by the inspected environment.

## 8. Acceptance criteria and Stage 1 review gate

1. An active, explicitly provisioned administrator can use the in-app Admin sign in form, restore their session, reach all five functional sections and log out.
2. Public users cannot register admin accounts; rider/driver credentials cannot enter the admin portal; every old/new admin API remains server-authorized.
3. Eight overview metrics reflect actual global database counts beyond 50 rows with documented semantics and honest loading/error states.
4. Admin can inspect submitted driver/vehicle data and independently approve/reject/suspend supported resources using the correct IDs. Both approvals still gate availability, and approval never makes a driver online.
5. Driver/vehicle `suspended` responses render safely in existing driver mode. Account disabled/restored behavior and active-ride/self-protection restrictions remain enforced.
6. Ride, user and payment sections use actual paginated records with useful available detail and functioning navigation, refresh, empty and error states. Payment monitoring is explicitly simulated and read-only.
7. Existing rider/driver auth, booking, active-ride recovery, maps, sharing and payment lifecycle are preserved; no Stage 2 changes or fake metrics/markers are introduced.
8. Automated tests and practical isolated integration/device evidence are reported truthfully; unavailable manual checks are explicitly listed. Passing unit tests alone does not certify the phone experience.
9. No real/production users were altered, credentials hardcoded, unrelated dependencies added, or changes automatically committed/pushed/deployed.

Create `docs/STAGE_1_ADMIN_IMPLEMENTATION_REPORT.md` containing: issues/root causes; implementation summary; files modified; DB changes (expected none); exact API additions/compatibility; tests added; actual command results/counts and comparison with baseline; browser/native scenarios actually executed; manual instructions; remaining limitations and risks; commit reference only if one was explicitly authorized and created.

Update relevant API/frontend usage documentation for the protected overview contract, admin sign-in and existing admin provisioning command. Explain provisioning uses `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD` and optional name environment values through `backend/scripts/create-admin.js`; do not print secrets or run it against the current configured database without explicit authorization. Existing admins should sign in, not be recreated.

Finish with the concrete Stage 1 outcome and review evidence. **Stop before Stage 2 booking UX implementation or generating its full prompt**; the user wants Stage 1 tested and reviewed first.

## Expected implementation change summary

- Frontend: discreet admin auth entry/form, role-aware session restore and navigation, typed admin transport/data state, five working admin sections, logout/error/accessibility handling and suspended-driver compatibility.
- Backend: one protected overview endpoint with service/controller and tests; existing list/mutation APIs reused, with only justified backward-compatible additions.
- Persistence: reuse existing models; no new collections, destructive migrations or real data changes expected.
- Verification/documentation: auth/authorization, true counts, approval/activation and UI regression coverage; isolated workflow proof; API/usage documentation and implementation report.
- Deferred: all booking UX, payment-processing, map freshness/dispatch and wider proposal enhancements.
