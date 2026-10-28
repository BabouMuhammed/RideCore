# RideCore Rider integration report

28 October 2026. This report distinguishes implemented/automatically verified
behavior from native device and provider configuration that still needs validation.

The Rider application is implemented against the existing backend. It is **not yet
certified ready for the FYP demonstration**: live Mapbox credentials/account access,
persistent API/viewer configuration and physical Android checks remain.
No backend modification was required.

## 1. Completed features

- Existing real registration/password login, Gambia phone normalization, optional
  mocked OTP, SecureStore and server-validated session restoration are retained.
- Scrollable authentication forms, sensible PC width and native-first layouts.
- Native Mapbox and a PC web adapter, foreground-only GPS permission, denied
  permission recovery, address search, reverse lookup, confirmed pins/landmarks.
- Planned Mapbox driving geometry, with GMD fares from the backend only.
- Economy/comfort/xl estimate and explicit request confirmation. One-active rules
  remain backend-authoritative; uncertain POST results reconcile instead of
  automatically creating another request.
- Persistent map, state-dependent sheets, real assignment/vehicle information,
  all actual lifecycle states, real driver samples, reconnect/rejoin/REST recovery.
- Nearby-driver snapshots distinguish no currently eligible category match from
  unknown availability. No accepted driver or arrival ETA is fabricated.
- Reason/confirmation cancellation before start, without invented fees.
- Share/revoke, expiring read-only recipient branch, public status/location and
  end/expiry removal. Public recipients do not need a rider session.
- Completed-trip receipt, cash/mock-wallet simulation, duplicate protection and
  1–5/comment rating; latest history/detail and existing payment/rating recovery.
- Account shows actual identity, optional verification and legitimate local logout.

## 2. Frontend architecture

`SessionController` validates identity/role and restores server ride state before
authenticated navigation. Native storage is unchanged SecureStore; web storage is
development-only localStorage behind the same interface. Credentials are excluded
from React state snapshots.

`JourneyController` owns real active/terminal ride state and history, tracks actual
socket samples, reconciles hints through REST and drops late results on disposal.
Its provider polls every 10 seconds while active as a fallback. Booking is withheld
until initial ride reconciliation finishes; an authoritative active ride supersedes
an open location-selection sheet.

Home preserves the map beneath a native state-driven bottom sheet. Web uses an
equivalent constrained scroll presentation. Contextual cancellation/sharing remain
over the current trip. Coordinates never become rider inputs or user-facing values.

Public URL-fragment routing branches before private providers mount. It uses only
public snapshots/the separate read-only namespace. Lifecycle hints reconcile REST;
validated public GPS broadcasts update locally rather than issuing an HTTP request
per GPS tick. REST polling and server grant checks remain fallback authority.

## 3. Backend integrations

The unchanged backend remains authoritative for fares, identity, eligibility,
matching, one-active uniqueness, lifecycle, cancellation, payment and rating.
Requested trips stay unassigned until a real eligible driver accepts. The app
does not accept/progress rides, manufacture drivers or generate moving GPS data.

Display-only street geometry does not change the academic straight-line backend
tariff. New fares/payments are GMD. Historical GBP records retain their currency.

## 4. API endpoints used

All paths below are relative to the configured `/api` base.

| Method | Path                   | Purpose                                               |
| ------ | ---------------------- | ----------------------------------------------------- |
| POST   | `/auth/register`       | Exact rider registration; no automatic authentication |
| POST   | `/auth/login`          | Email/password or phone/password                      |
| GET    | `/auth/me`             | Authoritative identity/role                           |
| POST   | `/auth/otp/request`    | Optional authenticated mocked verification            |
| POST   | `/auth/otp/verify`     | Six-digit verification                                |
| GET    | `/drivers/nearby`      | Rider-authorized availability snapshot                |
| POST   | `/rides/estimate`      | Backend category fare                                 |
| POST   | `/rides`               | Real request                                          |
| GET    | `/rides/me`            | Bootstrap/history, latest 50                          |
| GET    | `/rides/:id`           | Authoritative detail, safe driver/vehicle, own rating |
| PATCH  | `/rides/:id/cancel`    | Nonblank reason, before start                         |
| POST   | `/rides/:id/share`     | Create expiring capability                            |
| DELETE | `/rides/:id/share`     | Revoke sharing                                        |
| GET    | `/shared-rides/:token` | Unauthenticated read-only snapshot                    |
| GET    | `/rides/:id/payment`   | Existing simulated payment                            |
| POST   | `/rides/:id/payment`   | Cash/mock-wallet, method only                         |
| POST   | `/rides/:id/ratings`   | Integer rating and optional comment                   |

There is no invented logout endpoint, refresh endpoint, profile editor or driver
lifecycle mutation in the rider client. Test driver/admin calls exist only in the
disposable integration script and manual test instructions.

## 5. Socket.IO events used

Authenticated root namespace: auth token in the handshake, `ride:join` and cleanup
on disconnect/disposal. Reconnection rejoins before authoritative REST recovery.

Receives: `ride:accepted`, `ride:driver-arriving`, `ride:driver-arrived`,
`ride:started`, `ride:completed`, `ride:cancelled`, `driver:location`.

Public `/shared-rides` namespace: `share:join`; receives `share:ride-status`,
`share:location`, `share:ended`. It does not attach a rider JWT. Revocation/expiry/end
remove recipient trip data. GPS samples are range/timestamp validated and ordered.

The Rider never emits `driver:location:update` or any driver transition. The test
harness uses real test driver credentials to verify those server-controlled paths.

## 6. Files/modules added or materially changed

- `src/components/layout/Screen.tsx`: bounded scroll layout.
- `src/components/ui/Icon.tsx`: preserve native accessibility and use web SVG
  aria-hidden rather than an invalid native-only DOM attribute.
- `src/components/sheets/JourneySheet*`: persistent native/web sheet foundations.
- `src/services/api.ts`, `errors.ts`: reusable bounded transport and safe errors.
- `src/services/journey-api.ts`, `mapbox.ts`, `realtime.ts`: typed rider/provider
  adapters; no driver mutation API.
- `src/features/map/*`: native/web canvas, address/pin/GPS selection.
- `src/features/journey/*`: controller/provider, cancellation and presentation.
- `src/features/home/screens/BookingHome.tsx`, `HomeScreen.tsx`: actual journey.
- `src/features/sharing/*`, `receipt/Receipt.tsx`, Activity: sharing, payments,
  rating, history/detail. Account/auth behavior remains supported functionality only.
- `App.tsx`, `PublicEntry*`, `RootNavigator.tsx`: legitimate private/public routing.
- `SessionController.ts`: existing authorized request boundary reused by adapters.
- Tests: map, journey API/controller/UI, realtime and recipient UI; original auth
  and navigation assertions updated to real functionality, not removed.
- `scripts/verify-rider-journey.mjs`: actual mobile/backend HTTP/socket harness.
- Expo config/dependencies: SDK-compatible Expo Location, compatible Mapbox GL 2.x
  for web, its types and Socket.IO client. Existing SecureStore/Mapbox/EAS ID retained.
- `.easignore` at repository/frontend roots: excludes secrets, server data and
  verification artifacts; frontend-only No VCS upload is inspected separately.
- TS/Jest/Metro ignore generated verification copies so build-inspection archives
  cannot create duplicate packages or copied-source test/type discovery.
- README, environment-name template, journey/report and device documentation.

An unrelated two-blank-line edit in the historical `PHASE_2_REPORT.md` appeared
during work; it is preserved and not included in implementation commits.

## 7. Backend changes

**None.** SHA-256 source/configuration comparison: **70 before, 70 after, zero
differences**. No route/controller/service/schema/model/middleware/test/business
rule/dependency/environment file was modified. Actual port remains **5050**.

Browser origin configuration is required, not a missing backend contract. Existing
`CORS_ORIGIN` can support the intended preview/viewer without a code change. Real
database data was not used by automated integration; all fixtures were disposable.

## 8. Tests and exact pass/fail totals

**16 frontend files, 179 passed, 0 failed.** All legitimate original cases remain;
placeholder expectations now assert real screens. New regressions cover initial
reconciliation priority, truthful category availability, public GPS streaming
without per-sample HTTP requests, recovery of an uncertain payment result, and
monotonic GPS reconciliation across
REST/socket updates after reconnect.

Strict TypeScript and lint pass. Changed files are formatted. The full formatting
check flags only an unrelated two-blank-line edit in historical PHASE_2_REPORT.md;
that concurrent edit is deliberately preserved rather than overwritten.

Unchanged backend: **11 files, 241 passed, 0 failed**.
Actual mobile/backend HTTP/socket integration: **13 checks passed, 0 failed**.
The separate auth contract harness also passes all **four Gambian numbering structures** through real registration, phone login, mocked OTP and restoration.

Coverage includes exact auth payloads, Gambia formats, no token after registration,
server-validated sessions/roles, expired/missing credentials, network/storage
recovery, safe logout races, all category fares, uncertain/duplicate requests,
authoritative detail/lifecycle, real room joins/rejoins, GPS validation/order,
cancellation, both simulated payment methods/idempotency/conflict, ratings/history,
public sharing/revocation/end and malformed/unauthorized responses.

## 9. Web validation

Web export passed with actual Mapbox GL/CSS (approximately 3.2 MB JS). The existing
8081 Metro server needed a verified frontend-only restart after dependency changes;
its stale module cache had produced HTTP 500. It now bundles the actual app.

Real isolated Edge review passed: 320 px form scrolls, no horizontal overflow and
submission remains reachable. Screenshots were inspected at mobile/desktop widths.
Native-only SVG accessibility attributes were corrected for web.

A clean real browser workflow against the existing disposable backend passed:
registration, explicit password sign-in, identity/ride bootstrap, authenticated mock
OTP, actual empty Activity and local logout with credential removal. It recorded
zero uncaught JavaScript exceptions/application console errors. This test exposed
and fixed a web-only confirmation-focus crash: web uses the DOM ref while native
findNodeHandle behavior is preserved. Its regression test reproduces the unsupported
web API failure. No real account or ride was created in the real database.

No fake frame, gallery or screen selector was used. Generated screenshots/profiles
are ignored. Mapbox branding/attribution is positioned above the journey sheets;
live provider rendering still needs the locally configured public token.

Live backend health is 200. The original browser CORS mismatch was corrected by
restarting only the verified RideCore development process with its existing public
CORS_ORIGIN setting matching the preview. No backend source, environment file,
secret or port was changed. The PC Metro process uses an environment-based local
API URL. Actual browser health is 200 and an intentional invalid-credential sign-in returns the correct safe message, with **zero browser exceptions/error logs**. No real account or ride was created by that check. Persist matching host/origin settings locally for future restarts and
configure device-reachable hosts for native use.

## 10. Android/native validation

- Expo Doctor: **20/20 passed** after retrying a transient remote TLS failure.
- Android prebuild: passed; foreground location only, existing SecureStore backup
  exclusions retained. No background location capability was added.
- Android Hermes export: passed, **1,853 modules, approximately 4.3 MB**. A sandbox
  execution denial was resolved by authorized compiler execution.
- EAS development build submitted: **d63e40a7-abb3-44b8-aade-888531f6ce95**.
  [Build status](https://expo.dev/accounts/baboumaha/projects/ridecore-rider/builds/d63e40a7-abb3-44b8-aade-888531f6ce95).
  Cloud result: **FINISHED / successful APK build**, including Kotlin/C++ compilation and APK packaging. Local APK: `.verification/RideCore-Rider-development-d63e40a7.apk`,
  **397,821,053 bytes**. Download completed; ZIP CRC, Android manifest, DEX bytecode
  and Mapbox native libraries were verified. SHA-256:
  `E4E2F777D0A2ADF728892C766D2763201DE86473DA384D818AB057AF1A5F6C34`. This is a development client; it loads the latest Rider JavaScript from Metro, not a frozen standalone production release.
- ADB reports **zero authorized connected Android devices**. No physical Android device or iOS signed binary was verified. No native GPS,
  SecureStore encryption or live Mapbox rendering is claimed from exports/tests.

The original default archive encountered a locked local browser file. Automatic
approval review rejected an unsafe retry; deeper inspection also found Git metadata.
A safer frontend-only No VCS archive was inspected exhaustively: **107 files, zero
backend/Git/verification/private environment/credential files**. That corrected
archive was approved and uploaded (234 KB). No backend files were uploaded by it.

## 11. Remaining limitations

- Current frontend `.env` is absent; public Mapbox/API/viewer configuration must
  be set locally/EAS. Live provider access/permanent geocoding was not tested.
- Recipient viewer hosting/reachable origin must be configured; no deployment or
  public hostname is invented. The read-only recipient implementation is present.
- Mapbox landmark/address coverage varies. Riders can use map pins and landmarks.
- Nearby availability is a snapshot, not a guarantee. The backend has no terminal
  no-driver/timeout state; requests remain open until acceptance/cancellation.
- No reliable driver ETA; no fabricated countdown. Last GPS sample time is shown.
- Planned road geometry is separate from server straight-line fare calculation.
- Mock OTP is not real SMS/ownership verification; cooldown/remaining-attempt
  metadata is not exposed. Existing server limits remain authoritative.
- Share tokens are deliberately not persisted/recoverable; revoke an existing
  share before replacing it after losing the local capability.
- No refresh token/server logout revocation; local logout does not cancel rides.
- Latest-50 history only; legacy currency is preserved.
- Physical native accessibility, gestures, keyboard, network recovery and storage
  require the device checklist. iOS signing/device validation remains separate.

## 12. Intentionally unsupported features

Social/passwordless login, password recovery/reset, editable profile/photo upload,
driver/admin app, cards/Apple Pay/Wave/bank gateway, real wallet balances, chat,
masked calling, emergency dispatch, push notifications, scheduling, multi-stop
editing, cancellation fees and synthetic drivers/locations/lifecycle shortcuts.

## 13. Security considerations

Native SecureStore and its device-only options are unchanged. Browser storage is
development/UI preview only. Tokens/passwords/OTP/share capabilities are not logged
or committed; public share access never reuses a rider JWT. API timeouts/abort,
sanitized errors, server role checks and production HTTPS enforcement remain.

Share tokens live in fragments, not server access-log paths/query strings. The
public branch uses no-referrer policy and read-only server contracts; expiry/end
clear displayed trip data. Tracking never falls back to off-duty driver location.

Dependency audit: **15 unresolved entries: 12 low, 3 high**; high entries remain
`expo`, `@expo/cli`, `zod` in the existing toolchain chain. No forced upgrade or
`npm audit fix --force` was used. This is not a clean security audit or a claim of
production web authentication readiness.

## 14. Required environment variable names

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `EXPO_PUBLIC_SHARE_WEB_URL`
- `CORS_ORIGIN` (existing backend configuration)
- `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (private native build-time credential if required)
- `EAS_NO_VCS`, `EAS_PROJECT_ROOT` (frontend-only archive packaging)

Existing backend private configuration is preserved; no actual value is reproduced.

## 15. Exact local run steps

See README configuration first. In `backend`: `npm ci`, then `npm run dev`, with
existing MongoDB/private environment and the matching browser origin. Keep 5050.

In `frontend`: `npm ci`, configure the public runtime names locally, then
`npm start -- --web --clear --port 8081`. For Android install the development client
and run `npm start -- --lan`, or use `npm run android` with a full SDK/JDK/device.
Use a device-reachable API host. Expo Go cannot load native Mapbox.

For cloud development builds from frontend, set EAS_NO_VCS and EAS_PROJECT_ROOT
as shown in README, then `eas build --platform android --profile development`.

## 16. Exact journey test steps

[RIDER_JOURNEY.md](RIDER_JOURNEY.md) gives the full real-user/test-driver sequence,
including existing profile/vehicle approval, actual driver-side transitions,
recipient link/revoke, receipt, payment/rating and recovery.

Repeatable automated commands: `npm test`, `npm run verify:backend-contract`,
`npm run verify:rider`; in backend run `npm test`. The integration harness uses
actual mobile adapters against temporary backend data, not UI mock progression.

## 17. Before FYP demonstration

1. Persist public runtime names and matching CORS for reachable device/viewer hosts. The running PC development connection is already corrected.
2. Confirm Mapbox token restrictions, account access and permanent geocoding with
   actual Gambian locations; verify tiles, pins, road route and attribution.
3. Obtain/install the current Android development APK and complete the native
   checklist against the reachable backend; no physical run has been claimed.
4. Prepare legitimate rider/driver/admin test accounts, approved vehicle/profile,
   actual availability and manual driver actions. No rider-side shortcuts exist.
5. Host the recipient viewer where the recipient can reach it and verify expiry,
   revocation and end on a separate browser/device.
6. Review unresolved dependency advisories before release; do not force fixes.

Implementation/testing is substantially complete, but RideCore must not be called
fully demonstrated or production-ready until the remaining configuration and
native/provider checks succeed.

Provider/build references: [Mapbox Geocoding](https://docs.mapbox.com/api/search/geocoding/),
[Expo Location](https://docs.expo.dev/versions/latest/sdk/location/),
[EAS archive rules](https://docs.expo.dev/build-reference/easignore/).
