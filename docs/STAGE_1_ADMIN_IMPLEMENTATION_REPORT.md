# Stage 1 administrator interface implementation

Date: 17 November 2026. Starting commit: `b765167`.

## Outcome

Implemented administration inside the existing RideCore Expo application. The welcome screen has **Admin sign in**. An active administrator uses the existing password login and verified `/auth/me` identity to enter **Overview, Drivers, Rides, Users and Payments**. No separate website, identity store, public admin registration or hardcoded credentials were added.

Rider/driver authentication calls retain their existing default behavior. Role-aware session restoration now admits administrators without running rider ride recovery, and root navigation mounts exactly the relevant role's application. Admin screens do not mount rider booking or driver GPS providers. Logout, unauthorized/expired sessions and unmounts discard admin UI state; late responses are ignored.

## Confirmed issues addressed

- The existing session allowlist rejected administrators and the root navigator lacked an admin branch.
- Rider bootstrap assumed that any non-driver session owned rider journeys. Administrators now bypass that path.
- Backend administrative operations existed without an application interface.
- Existing page-limited list endpoints could not supply global totals. A protected database-count/aggregation endpoint now supplies them.
- The driver client rejected `suspended`, even though existing server approval actions could produce it. The parser/type and onboarding indicator now support it.
- Role-denial copy incorrectly sent admins to external tools. Access failure copy now matches in-app administration.
- The previously documented rider-navigation test used wall-clock user interaction delays and repeatedly hit its 5-second timeout. Its assertions and timeout remain; interactions now use RNTL's supported timer driver, matching the existing auth UI tests.

## Functional behavior

**Driver and vehicle review:** Driver pages show submitted licence, account state, profile eligibility, availability and associated vehicle information. Expand Review application for independent profile/vehicle approve, reject and suspend actions. Missing records are explicit. Decisions use the correct profile/vehicle IDs, require confirmation, block duplicate submission and reconcile server records after success or an uncertain failure. Both approvals still gate driving; decisions leave the driver offline. No uploaded document verification or new KYC policy was introduced.

**Account management:** User pages show rider/driver account information and activation state. Disable/restore uses existing protected operations, preserving active-ride and self-management restrictions. Administrator records are read-only in this UI. Restoring a driver does not make them online.

**Ride monitoring:** Paginated real trip records show status, pickup/destination, category, fare/currency and request time. View trip loads existing admin-authorized detail for available participant names, vehicle and timestamps. Trips remain read-only; there are no admin trip-progression or payment controls.

**Payments:** Paginated records show actual method/status/amount/currency/reference and available dates, including pending/failed/refunded records without paidAt. Missing historical currency follows the existing GBP interpretation. Entries are clearly labeled simulated; neither cash records nor SIM references imply real transfers.

**Overview:** Eight global counts are retrieved from the database independently of 50-record list pages. Rider/driver registrations include disabled accounts, pending approvals count profiles rather than vehicles, and online counts require current stored eligibility across the platform rather than a rider radius. Counts are separate database observations, not a promised atomic snapshot. Errors are not displayed as zero.

All sections have refresh, loading, empty and API-error states. Record lists have Previous/Next pagination and page numbers. Data refreshes on section focus and after mutations. Large tables and decorative charts were avoided; the UI uses the existing RideCore typography, colors, controls, safe-area handling and compact lists.

## API and database changes

Added **GET `/api/admin/overview`**, protected by existing authentication and admin authorization. Normal envelope:

```json
{
  "success": true,
  "data": {
    "registeredRiders": 0,
    "registeredDrivers": 0,
    "pendingDriverApprovals": 0,
    "onlineDrivers": 0,
    "activeRides": 0,
    "completedRides": 0,
    "cancelledRides": 0,
    "recordedPayments": 0
  }
}
```

The JSON above documents field names and an empty-database example, not observed platform statistics. Exact definitions are in `backend/docs/api.md`.

Reused existing `/auth/login`, `/auth/me`, `/admin/users`, `/admin/drivers`, `/admin/rides`, `/admin/payments`, `/admin/drivers/:id/verification`, `/admin/vehicles/:id/verification`, `/admin/users/:id/active` and `/rides/:id`. Existing list envelopes and mutation bodies are unchanged.

No schema changes, new collections, migrations, payment rules, fare rules, matching policy or actual configured user-record changes. Test mutations used only disposable MongoDB replica sets.

## Files changed

| Area | Files |
| --- | --- |
| Backend | `backend/src/services/admin.js`, `src/controllers/index.js`, `src/routes/index.js` |
| Admin frontend | `frontend/src/services/admin-api.ts`, `src/features/admin/AdminProvider.tsx`, `src/features/admin/AdminScreens.tsx`, `src/navigation/AdminNavigator.tsx` |
| Sign-in/session/navigation | `frontend/src/features/auth/screens/AdminSignInScreen.tsx`, `WelcomeScreen.tsx`, `features/session/SessionController.ts`, `BootstrapScreen.tsx`, `navigation/AuthNavigator.tsx`, `RootNavigator.tsx`, `types.ts`, `services/errors.ts` |
| Driver compatibility | `frontend/src/services/driver-api.ts`, `src/features/driver/screens/DriverOnboarding.tsx` |
| Tests | `backend/tests/admin-overview.test.js`, `frontend/tests/admin-api.test.ts`, `admin-ui.test.tsx`, `session.test.ts`, `auth-ui.test.tsx`, `navigation.test.tsx` |
| Isolated verification | `frontend/scripts/verify-admin.mjs`, `frontend/package.json` (`verify:admin`) |
| Documentation | `backend/docs/api.md`, `frontend/README.md`, this report |

Paths in shortened cells are relative to the backend/frontend root named at the start of the cell. Existing audit/prompt documents are retained.

## Verification

Historical baseline in the functionality audit: backend 284/284, frontend 209/210 with a navigation timeout and a separate navigation retry of 5/5; frontend typecheck passed. The first tests in this implementation session were started before edits but overlapped feature development, so they are not represented as a pristine checkout baseline. Their two failures were obsolete expectations that all administrators be rejected. Final results below refer to explicit post-change checks.

| Check | Actual result |
| --- | --- |
| Backend full suite | Passed: 13 files, 288 tests; 171.41 seconds on the sequential retry. |
| Frontend full suite | Passed: 21 suites, 231 tests. |
| Frontend typecheck | Passed on the final source. |
| Frontend lint | Passed with zero errors/warnings after addressing the refresh-dependency warning. |
| Web production export | Passed on the final source. |
| Focused backend admin tests | Passed: 4 tests, including global counts beyond 50 records and actual approval/matching/account workflow. |
| Focused admin UI retry | Passed: 7 tests. The earlier run found duplicate Sign out queries; confirmation now uses Confirm sign out. |
| `npm run verify:admin` | Passed: 7 isolated full-stack checks using actual frontend session/API adapters, HTTP backend and disposable MongoDB. |
| Impeccable detector on new admin UI/auth/navigation targets | Passed, no mechanical findings (`[]`). |
| Browser check (emulated iPhone 13, real backend) | Passed: admin sign-in, all five sections load, and a pending driver's profile and vehicle were approved through the UI. Physical device not yet tested. |

An earlier full backend run, concurrent with the frontend tests and Metro export, passed 248 tests but skipped 40 after one disposable MongoDB instance missed its 10-second startup deadline. The subsequent full sequential run passed all 288. The concurrent frontend run passed 227/230 and hit 5-second timeouts in navigation, demo and booking interaction tests. These earlier failures are recorded rather than treated as passing runs; resource contention is a likely contributor, not a proven sole cause. The navigation timer-driver change is described above.

The new full-stack harness uses actual transpiled TypeScript adapters, including server URL validation, in memory. Only the React Native platform boundary is represented as web and native SecureStore is guarded against use. Credentials are held in a disposable in-memory store; no private environment configuration is loaded. It does not verify browser rendering or the device keystore.

Executed full-stack scenarios:

1. Admin login, global counts and secure session restoration.
2. Actual public rider/driver registration, rider/driver denial at admin endpoints and rejection of driver credentials by the admin form's session path before storage.
3. Separate profile and vehicle approval, one-approval denial, valid location, offline-after-approval and intentional online eligibility.
4. Nearby driver discovery, compatible request discovery and acceptance; admin trip detail and refusal to disable an active-trip driver.
5. Existing driver trip progression through completion; existing rider mock-wallet recording and actual read-only admin payment/trip/count adapters.
6. Suspended profile and vehicle parsed by the real driver adapter; driving remains denied.
7. Account disable/restore, disabled identity rejection, offline restoration and admin logout/credential clearing.

The existing `verify:rider` and `verify:backend-contract` scripts have the missing generated server-config dependency documented in the audit. They were not repaired as part of this admin implementation and are not claimed as passing. The new `verify:admin` avoids that omission through its scoped in-memory module loader.

## Access and manual testing

1. Keep the existing backend configuration. From `backend`, start/restart `npm run dev` if the running server is not watching source changes; `/api/admin/overview` must be served by the updated code.
2. From `frontend`, use the existing Expo command (`npm start -- --web --port 8081` for browser review). Reload the current web/development client. An old standalone APK with bundled JS needs a new local build before it contains the feature.
3. On Welcome, tap **Admin sign in**. Sign in with an **existing active admin email and password**. There are no new default/hardcoded credentials.
4. If an administrator has not been provisioned, use existing `backend/scripts/create-admin.js` via `npm run admin:create`, supplying private ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD and optional name values for the intended database. Do not recreate an existing administrator or put these secrets into frontend configuration/source. This implementation did not run provisioning against your database.
5. Confirm all five sections load, refresh and paginate. Verify actual counts against an isolated fixture with more than 50 users; the automated test includes this case.
6. In Drivers, review a pending application. Approve profile alone and verify online is still denied, then approve vehicle. Confirm driver stays offline until their own Go online action. In a separate driver client, set a valid nearby location and go online; a rider can discover/request and the driver can accept.
7. In Users, disable/restore an idle test rider/driver. Verify blocked active-ride changes and administrator records remain read-only. Never use real users for this check without separate authorization.
8. Inspect ride detail and payment status/reference/currency. Confirm the payment page says simulated. Test network failure/retry, an empty list and expiry/invalid credentials.
9. Sign out and verify private screens disappear. Sign in again, refresh/reopen and verify restoration. Use a separate non-admin account to confirm no admin navigation or API access.
10. Test 390×844 and narrow device layouts, large text, scrolling, keyboard entry, confirmation focus and actual iOS/Android back/navigation behavior. These physical/browser checks remain manual, not completed evidence.

Repeat the isolated API/session workflow safely from `frontend` with `npm run verify:admin`. It chooses an ephemeral loopback port and temporary database and cleans up afterward.

## Limitations and scope

- Browser/device rendering still needs the manual checks above. RNTL interaction tests render native components with the established test mocks, not a physical phone.
- Lists retain existing 50-record pages and do not add global search/filter infrastructure. Exactly full pages may enable Next even when the next page is empty; Previous returns safely.
- Driver data remains self-reported; no document authenticity claim is made.
- Online metrics reflect stored availability and eligibility; existing coordinate freshness/background limitations remain unchanged.
- Payments remain simulated. Missing historical currency follows existing GBP rules, not a conversion.
- The API is a modular monolith and counts are separate reads. No new deployment/infrastructure was added.
- Stage 2 booking improvements and other proposal gaps are deferred.
- No commit, push or deployment was performed. Review the local diff before any later publication.
