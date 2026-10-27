# RideCore Rider — Phase 2 completion report

27 October 2026. Scope: Authentication and Session Restoration only. Phase 3 has not begun.

Phase 2 is implemented. Automated checks and isolated mobile/backend integration pass. Native APK compilation, physical-device behavior and native Mapbox/SecureStore runtime verification remain limited by the available Android environment; they are not claimed as successful device tests.

## 1. Files created and modified

New application files:

- `src/features/auth/phone.ts`, `validation.ts`, `components/AuthFields.tsx`.
- `src/features/auth/screens/SignInScreen.tsx`, `RegisterScreen.tsx`, `PhoneVerificationScreen.tsx`.
- `src/features/session/SessionController.ts`, `SessionProvider.tsx`, `BootstrapScreen.tsx`.
- `src/services/api.ts`, `contracts.ts`, `credential-store.ts`, `errors.ts`.

Modified application files:

- `src/application/AppProviders.tsx` mounts the real session provider.
- `src/navigation/RootNavigator.tsx`, `AuthNavigator.tsx`, `types.ts` implement conditional authenticated navigation and the optional verification route.
- `src/components/ui/Input.tsx` adds native input refs, country-prefix/trailing controls and preserves accessible feedback. `Icon.tsx` adds per-icon password visibility glyphs.
- Welcome displays invalid-session recovery feedback; Home acknowledges a real restored active ride; Account contains only authenticated identity, optional verification and local logout.
- The obsolete `AuthPlaceholderScreen.tsx` was removed; no legitimate test was deleted.

Other changes:

- Added `expo-secure-store` using Expo's SDK-compatible `~58.0.2` version and registered its native plugin. Updated `app.config.ts`, `package.json` and lockfile.
- Added six test files: `phone.test.ts`, `api.test.ts`, `session.test.ts`, `auth-ui.test.tsx`, `otp-ui.test.tsx`, `secure-store.test.ts`, plus shared `tests/fixtures.ts`.
- Retained the three Phase 1 test files; adapted navigation placeholder expectations to the authorized real forms and added the SecureStore native mock in `tests/setup.ts`.
- Added `scripts/verify-phase2-contract.mjs` and the `verify:backend-contract` command.
- Updated README, device checklist, feature/service boundary documentation and comments in `.env.example`. Added this report.
- Native Android output and verification artifacts are generated/ignored. No actual `.env` was created or modified. No backend file was modified.

## 2. Authentication architecture

Screens use validated payload builders and a typed API adapter. The explicit session controller owns the credential, bootstrap/recovery decisions and private ride/user state. React subscribes to its state through a context provider.

Only server-validated rider identity followed by successful ride discovery can enter the authenticated shell. Token existence, decoded JWT claims or a registration response never grant access. Credentials are not exposed in React session snapshots.

Cancellation generations discard obsolete responses. Serialized credential operations ensure logout deletion wins over a sign-in write already in flight. Private requests are aborted on logout or replacement bootstrap. Foreground return revalidates a ready session and reconciles the server's ride data.

## 3. Exact backend endpoints integrated

All paths below are relative to the configured `/api` base URL.

| Method | Path                | Request                                                  |
| ------ | ------------------- | -------------------------------------------------------- |
| POST   | `/auth/register`    | `{firstName,lastName,email,phone,password,role:"rider"}` |
| POST   | `/auth/login`       | `{email,password}` **or** `{phone,password}`             |
| GET    | `/auth/me`          | Bearer credential                                        |
| GET    | `/rides/me`         | Bearer credential                                        |
| GET    | `/rides/:id`        | Bearer credential; validated ride ID                     |
| POST   | `/auth/otp/request` | Bearer credential and `{}`                               |
| POST   | `/auth/otp/verify`  | Bearer credential and `{code}`                           |

The adapter validates response envelopes and expected data. No logout endpoint, driver lifecycle endpoint or unsupported authentication endpoint was invented. The isolated verification script creates one temporary ride solely as setup for a restoration test; there is no booking method or screen in the application.

## 4. Registration behavior

Collects only first name, last name, email, phone and password. Rider role is fixed by the payload builder, not selected by the user. Names/email are trimmed; email is lowercased. Passwords are never trimmed or silently changed.

Client validation respects backend name/email limits, minimum eight-character password and bcrypt's maximum 72 UTF-8 bytes. Rider-facing messages use simple language. Server validation remains authoritative. Forms include appropriate keyboards, native focus progression, password visibility, pending/duplicate-submit protection and keyboard-aware safe-area layouts.

The successful token-less response shows **Account created**, then an explicit **Continue to sign in** action. It never saves a credential or opens authenticated tabs. Email may be prefilled; passwords are not carried in navigation parameters.

## 5. Gambian phone normalization and validation

One shared utility owns the country policy, normalization, validation and masking. The UI separates `GM +220` from the national input and uses the neutral placeholder **Enter phone number**.

Supported structural forms:

- Nine national digits: `87` + seven-digit existing number, `83` + seven-digit existing number, or `86` + seven-digit existing number.
- Seven national digits beginning 2–9, retaining legitimate unaffected/legacy structures during the current migration environment.
- Explicit `+220` and `00220` international input can be pasted. Spaces, parentheses and hyphens are safely removed.

The canonical identity is always `+220` plus the unchanged national digits. Other country codes, letters, unsupported symbols and invalid structures/lengths are rejected. No operator is guessed and no migration prefix is automatically inserted. Registration and phone login use the same builder dependency; Account and OTP use the same masking/normalization utility.

This is structural validation, not a carrier-allocation database or proof of subscriber ownership. The policy is centralized for later country expansion; no international country selector was built. Synthetic zero-tail fixtures are used rather than real contact/subscriber data.

Sources checked: [PURA's 2026 numbering-plan publication](https://pura.gm/national-numbering-plan-2026-migration-governance-framework/) and [Twilio's current Gambian numbering guidance](https://www.twilio.com/en-us/guidelines/gm/sms), which identifies the migrated prefixes and unchanged Gamcel numbering. The implementation also follows the user's explicit requirement to preserve supported seven-digit input without guessing a conversion.

## 6. Login behavior

The rider explicitly selects Email or Phone and enters a password. Exactly one identifier is sent. Phone login shares registration normalization; email login normalizes email without changing the password.

Incorrect credentials remain safe inline feedback. A returned credential is saved securely, then validated with `/auth/me`; successful login alone does not bypass identity/ride bootstrap. Role mismatch clears the credential and presents a rider-account message. No social login, password recovery, passwordless flow or OTP login exists.

## 7. SecureStore and session behavior

The app uses Expo SecureStore exclusively for the credential, with a named keychain service and `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Android backup exclusions are configured through the plugin; no biometric login was added. User profiles, active rides, passwords and OTP challenges are not persisted as application caches.

Native storage errors produce recovery states. Failed credential writes are rolled back. Failed deletion blocks the shell and offers deletion retry, rather than falsely claiming logout succeeded. Native at-rest behavior itself still requires a real device; the adapter calls/options are tested. See [Expo SecureStore documentation](https://docs.expo.dev/versions/latest/sdk/securestore/).

## 8. Startup/bootstrap behavior

Native splash → real loading → secure credential lookup.

- Missing credential → Welcome/authentication.
- Stored credential → `/auth/me` → rider validation → ride-list/detail restoration → Rider shell.
- Server-invalid/expired credential → secure deletion → authentication with understandable feedback.
- Network/server failure → retry/recovery; the credential is preserved.
- Storage failure → recovery, not an assumed logout.

The native splash dismisses on application layout so a genuine loading/recovery screen can render. No artificial startup delay or preview selector exists. Ready sessions are revalidated when the app returns to the foreground.

## 9. Rider-role validation

`/auth/me` is authoritative. Only `role === "rider"` and active account status can continue. Drivers, administrators and unsupported roles cannot enter Rider tabs. The credential is removed on mismatch. Role changes discovered during verification are handled in the same way. No client-side JWT decoding is treated as authorization.

## 10. Active-ride restoration

After validating the rider, `/rides/me` is read. Active states are exactly:

`requested`, `accepted`, `driver_arriving`, `driver_arrived`, `in_progress`.

Completed/cancelled records are terminal. One active candidate is fetched through `/rides/:id`; its current detail is authoritative, including a newer terminal state. Ownership and ID are checked. Multiple active candidates or inconsistent data produce recovery rather than a guessed choice. Failures preserve the credential and block incomplete bootstrap.

The real active record is retained in memory and acknowledged with a simple Home notice. There is no active-ride map, simulated progression, invented ETA or driver mutation. Discovery uses the backend's existing latest-50-record contract; no new endpoint or pagination contract was introduced.

## 11. OTP and mocked delivery

Optional authenticated verification is reachable from Account. It uses six digits and the backend's exact payloads. Phone is not resent: the backend binds the request to the authenticated user's already canonical registered phone.

The UI explicitly says delivery is simulated and **No SMS is sent**. A simulated code is shown only if the backend actually supplies `mockCode`. Without it, the UI explains that no simulated code is available; it fabricates nothing. No code is logged or persisted.

Expiry uses the returned `expiresInSeconds`, conservatively measured from request start to avoid extending validity by network delay. Expired codes cannot be submitted locally; the server remains authoritative. Wrong/expired/exhausted-attempt errors are safely handled, and successful verification refreshes `/auth/me`. A failed refresh enters recovery so an already-consumed code is not treated as a new authentication state.

The current backend does **not** expose its configured resend cooldown or remaining attempts. The UI uses a local 60-second guard matching the default, honors longer `Retry-After` responses and handles server cooldown/rate rejection. It does not claim a server-derived resend countdown or remaining-attempt count. Configurable server limits are never bypassed. OTP is not a booking gate.

## 12. Logout behavior

Local logout aborts pending private work, clears SecureStore, private user/ride state and authenticated navigation, then returns to authentication. A late request or delayed credential write cannot resurrect the session. There are no realtime subscriptions in this phase.

Logout does not cancel or modify a ride, call a nonexistent logout endpoint or claim server token revocation. The isolated integration verifies the backend ride stays `requested` after local logout. Failed secure deletion explicitly requires retry before logout is complete.

## 13. Error handling

Typed errors distinguish incorrect credentials, validation/conflict, invalid phone structure, authentication rejection, network/server failures, role mismatch, secure-storage failures, OTP errors/cooldown/rate limits and malformed contract data. Restoration distinguishes identity and ride-discovery failures.

UI messages never display raw server exceptions, stack traces, URLs/endpoints, JWTs or secrets. Fetch uses bounded timeouts/cancellation and authenticated headers only where required. Production API URLs require HTTPS; local HTTP is permitted only in development. Missing/invalid configuration produces safe feedback.

## 14. Test results

**9 files; 115 passed; 0 failed.** All 15 Phase 1 cases remain. Placeholder expectations were updated to the authorized real forms; no legitimate case was deleted. Phase 2 adds 100 cases. UI interaction clocks are deterministic using Testing Library's supported timer driver; business assertions and default Jest timeout were not relaxed.

| File                    | Passed |
| ----------------------- | -----: |
| `navigation.test.tsx`   |      5 |
| `controls.test.tsx`     |      7 |
| `confirmation.test.tsx` |      3 |
| `phone.test.ts`         |     28 |
| `api.test.ts`           |     22 |
| `session.test.ts`       |     33 |
| `auth-ui.test.tsx`      |     10 |
| `otp-ui.test.tsx`       |      6 |
| `secure-store.test.ts`  |      1 |

Coverage includes exact payloads, registration without authentication, both login modes, role gating, valid/missing/invalid/expired credential paths, network/server recovery, active/terminal ride handling, authoritative detail, secure-storage failure, logout cleanup/races, OTP expiry/cooldown/errors and honest delivery messaging.

The separate `npm run verify:backend-contract` also passed **four synthetic numbering structures** using the actual mobile payload/API/session code over HTTP against the unchanged disposable backend. It verifies real registration, phone login, `/auth/me`, ride discovery, random server-generated mock OTP verification, local logout and authoritative active-ride detail without ride cancellation. It does not use backend `.env` or the real database.

## 15. Gambian phone-number test results

The 28-case phone/auth-payload validation suite passes. It includes all three migrated nine-digit formats, supported seven-digit input, `+220`/`00220` normalization, formatting tolerance, invalid lengths/prefixes/characters/empty input, no guessed migration, consistent registration/login/masked OTP identity, exact rider registration payload and unchanged passwords/UTF-8 limits.

The real isolated backend accepted the three migrated formats and a seven-digit structure, using the same canonical identities through registration, phone login and verification. No phone compatibility blocker was found.

## 16. TypeScript, lint and formatting

Strict TypeScript passes. Lint passes without errors/warnings. Prettier checks pass after final documentation formatting. No validation, compiler strictness, lint rule or backend security rule was disabled. The contract script's sibling backend imports require read access outside a restricted frontend-only sandbox; normal local lint or the authorized verification environment supplies it.

## 17. Build/run result

- Expo Doctor: **20/20 checks pass**.
- Expo SDK dependency check: dependencies up to date; offline mode is explicitly a limited validation.
- Android prebuild with SecureStore: **passes**. Backup-rule references and library resources are present; debug cleartext networking is configured for local development.
- Android production export/Hermes: **passes**, 1,655 modules and approximately **3.8 MB** bytecode.
- Expo development server: started successfully; `/status` returned `packager-status:running`, then the verification server was stopped.
- Native Android run: **blocked before APK compilation/installation**. No connected device or launchable emulator; configured tools location lacks SDK platforms/build-tools. Java 23 is installed; React Native recommends a compatible JDK such as 17.

No physical device, iOS binary, native Mapbox rendering or native SecureStore encryption behavior was verified. A new development client must be built to include SecureStore. No cloud build or additional infrastructure was created.

## 18. Security/privacy considerations

Only the credential is persisted, through SecureStore. Private session snapshots exclude it. Passwords and OTP challenges remain transient; phone displays are masked where appropriate. SecureStore data is excluded from Android backup. Logout handles storage failure and asynchronous races rather than assuming deletion succeeded.

Identity, role, active ride and verification remain server-authoritative. No private data, response body or credential is logged by application code. HTTP configuration containing embedded credentials is rejected; production requires HTTPS. No `.env` secrets were printed, hardcoded, copied or modified. No Mapbox token was requested or used.

**npm audit still reports 3 high-severity entries** in the Expo → Expo CLI → Zod chain (`expo`, `@expo/cli`, `zod`), as in Phase 1. These are unresolved tooling advisories, not a clean security audit. No forced SDK downgrade or incompatible Zod major override was applied. See [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Existing toolchain deprecation warnings also remain; review upstream compatible fixes before release.

## 19. Known limitations and local setup

- Set `EXPO_PUBLIC_API_URL` locally before using the real app. For an Android emulator, a typical value is `http://10.0.2.2:5050/api`; physical devices need a reachable host address. Release builds require HTTPS. No hidden fallback/mock API was added, and actual `.env` files were not changed.
- Install/configure a full Android SDK, compatible JDK and emulator/device, then rebuild the development client. Native behavior, keyboard/focus, font scaling and TalkBack still need the device checklist.
- Mock OTP does not prove real SMS delivery or subscriber ownership. Production-mode backend responses without a code cannot complete a simulated verification in the UI; verification remains optional.
- Exact configured OTP cooldown/remaining attempts are absent from the response; enforcement stays on the backend. In-memory challenges are not restored after a full restart or a foreground bootstrap that remounts the screen.
- There is no refresh-token or server logout/revocation endpoint. Server-rejected credentials return to sign-in; local logout does not revoke copies elsewhere.
- Active-ride discovery uses the existing latest-50 list contract. No live map/realtime interface exists yet.
- Native identifiers/EAS project/signing remain provisional/unconfigured. No production-readiness or native-device success is claimed from passing Jest/Metro checks alone.

## 20. Genuine backend compatibility blockers

**None discovered.** The nine-digit Gambian canonical formats work with the existing backend. Its token-less registration, password login, rider identity, ride restoration and authenticated OTP contracts integrate without changes.

Missing OTP resend/attempt metadata and the ride-list window are documented nonblocking contract limitations, not reasons to change the backend without approval. No backend change was made or requested to make tests pass.

## 21. Backend preservation confirmation

SHA-256 comparison: **70 files before, 70 after, zero differences**. This includes source, tests, models, routes, controllers, middleware, services, configuration and documentation without printing secret contents. Dependency/cache directories were excluded from the source comparison. No backend dependency installation or code/configuration modification occurred.

All verification data lived in a disposable MongoDB replica set. Its temporary HTTP listener used an ephemeral test port; the actual backend remains configured on **5050**. No real database, backend environment file or actual ride was modified.

## 22. Phase 3 next — approval required

Phase 3 would implement native Mapbox Home, location permission and denied-permission recovery, current location, address/landmark search and pickup/destination map-pin selection. It would configure the public native Mapbox token locally without exposing it, and maintain address-based Rider UX without latitude/longitude fields.

**Stopped after Phase 2. No Phase 3 implementation has begun. Awaiting approval.**
