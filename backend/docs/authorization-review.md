# Authorization review

Scope: authorization only. No payment transaction redesign, Cloudinary work, deployment or account maintenance was performed.

## Checkout and policy

The working tree was clean at the start; the branch was already one commit ahead of its upstream. No AGENTS.md was present in the workspace or its ancestor directories. No separate local operation/safety review artifact was found; the supplied findings were checked against this checkout's source and callers.

This application defines `rider`, `driver`, and `admin`, with no customer/staff model or staff controller. `/api/auth/become-admin`, `/api/auth/become-staff`, and `/api/auth/fire-staff` are absent, not public handlers needing new guards. They remain unregistered and return 404 for anonymous callers and every existing role. Tests lock down that absence for self and other-user targets. No role-changing controller or generic User update route exists. `/api/auth/me` is read-only.

The established workflow is public rider/driver onboarding, pending driver profile/vehicle approval by an administrator, and administrator activation/deactivation of other users. Admin provisioning is a trusted operator CLI action, not HTTP promotion. The README and demo describe controlled initial setup. A policy for staff roles, HTTP role changes, existing-user promotion, and delegated administrator creation remains undefined; no such capability was added.

## Input hardening and compatibility

Registration previously accepted a restricted `role` enum (rider/driver only); it did not allow admin registration. It now rejects every `role` field and accepts `accountType` (rider/driver, default rider), mapped explicitly to the stored role. Existing callers sending `role` receive 400 and must update. Response roles and login/token contracts are unchanged. Driver self-registration remains established onboarding, with approval required before going online/accepting rides.

Registration validates even direct service input and explicitly constructs allowed User fields. Driver profile and vehicle services explicitly construct update fields instead of spreading caller objects, preventing ownership or privileged field injection by future internal callers. Their HTTP schemas already rejected unknown fields. The admin CLI uses explicit fields as well. Frontend payload types, builder, transport, request examples, seed and disposable verification callers use the new contract. No new general account/profile update endpoint was introduced.

## Route audit

All paths below are relative to `/api`. No missing HTTP authorization guard was confirmed in the current route set. Existing database identity and ownership checks were preserved and regression tested.

| Endpoint                                                                                                                                        | Enforced permission                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `POST /auth/register`, `POST /auth/login`                                                                                                       | Public; strict input, no privileged registration fields                                                    |
| `GET /auth/me`, `POST /auth/otp/request`, `POST /auth/otp/verify`                                                                               | Current active database user; OTP tied to own registered phone                                             |
| `GET /admin/users`, `/admin/drivers`, `/admin/rides`, `/admin/payments`                                                                         | Current active admin                                                                                       |
| `PATCH /admin/drivers/:id/verification`, `/admin/vehicles/:id/verification`                                                                     | Current active admin; explicit status only                                                                 |
| `PATCH /admin/users/:id/active`                                                                                                                 | Current active admin; explicit activation only; no self change or active-ride change                       |
| `GET /drivers/nearby`                                                                                                                           | Current active rider                                                                                       |
| `GET /drivers/me`, `PUT /drivers/profile`, `/drivers/vehicle`, `PATCH /drivers/location`, `/drivers/availability`, `GET /drivers/ride-requests` | Current active driver; own resources; approval/availability checks for online/requests                     |
| `POST /rides/estimate`, `GET /rides/me`                                                                                                         | Current active user; own ride listing                                                                      |
| `POST /rides`                                                                                                                                   | Current active rider                                                                                       |
| `GET /rides/:id`, `GET /rides/:id/payment`                                                                                                      | Current active participant or admin                                                                        |
| `PATCH /rides/:id/accept`                                                                                                                       | Current active approved online driver; availability and ride compatibility                                 |
| `PATCH /rides/:id/arriving`, `/arrived`, `/start`, `/complete`                                                                                  | Current active assigned driver; valid state transition                                                     |
| `PATCH /rides/:id/cancel`                                                                                                                       | Current active participant or admin; cancellable state                                                     |
| `POST /rides/:id/payment`                                                                                                                       | Current active owning rider, completed ride; confirmation is simulated, no provider call                   |
| `POST /rides/:id/ratings`                                                                                                                       | Current active rider/driver who participated; completed ride                                               |
| `POST /rides/:id/share`, `DELETE /rides/:id/share`                                                                                              | Current active owning rider                                                                                |
| `GET /shared-rides/:token`                                                                                                                      | Deliberately public read-only capability; valid current unexpired/unrevoked share and active eligible ride |

JWT authentication verifies signature, algorithm, issuer, audience, expiry and subject, then reloads User by subject and rejects missing/inactive accounts. Authorization uses that database role, not claims. Demotion therefore takes effect on subsequent requests with an existing token. Socket authentication uses the same verifier and rechecks on incoming operations; tracking additionally requires the assigned driver. Public share sockets use separate read-only capability checks.

A confirmed gap existed in private socket broadcasts: cached room membership allowed a disabled passive subscriber to keep receiving locations and ride state notifications. Both outbound event paths now verify current token/account and ride participation per recipient before disclosure. Disabled/deleted/expired identities are disconnected; accounts that no longer participate leave the room. Notification permission checks are serialized to retain ride-state event order. No polling job is added: passive sockets are revoked on the next attempted disclosure or incoming action (and on existing token-expiry timers). Already delivered data and concurrent in-flight operations cannot be retroactively revoked. Public share links retain their explicitly granted capability policy.

## Validation

`tests/authorization.test.js` is HTTP/database integration coverage against the disposable MongoDB replica set from `tests/helpers.js`, with synthetic accounts and reset collections. Authentication, domain services, and persistence are not mocked. It checks unavailable role routes, all admin route guards, allowed admin workflows, unchanged records after forbidden requests, registration/profile/vehicle field injection, direct service field policy, signed stale role claims, demoted/disabled users and payment confirmation authorization.

Frontend Jest tests use mocked transport/session adapters; these are not database integration tests. The backend contract verifier starts its own disposable database and local HTTP server to exercise the real frontend transport and registration payload against the backend. Validation commands/results are recorded in the task report after execution. No production database, email provider, payment gateway or real account is used. The admin and development seed CLIs are updated but are not executed against configured databases.

Results:

- Backend `npm test`: **12 files, 284 tests passed**, including real MongoDB and Socket.IO integration tests. The earlier targeted auth/authorization/verification run also passed all 92 tests.
- Backend formatting check of changed runtime/test files, administrator CLI, README and this report: passed. `git diff --check`: passed. Existing unrelated formatting was preserved in the seed and frontend files.
- Frontend `npm run typecheck` and `npm run lint`: **passed** after restoring missing dependencies.
- Frontend `npm test -- --watch=false`: **17 suites passed, 2 failed; 207 tests passed, 2 timed out (209 total)**. The unchanged navigation and offline demo tests exceeded Jest's default five-second limit. Targeted rerun `npm test -- --watch=false --testTimeout=30000 --runTestsByPath tests/navigation.test.tsx tests/demo.test.tsx`: **both suites and all 6 tests passed**. The default timeout/configuration was not changed. These are mocked frontend tests, not database integration tests.
- `npm run verify:backend-contract`: failed before starting database tests because the existing verifier does not compile the `services/server-config` dependency. No successful cross-stack verifier run is claimed; this unrelated harness issue was left unchanged.
- Frontend dependencies were restored successfully with `npm ci --ignore-scripts --no-audit --no-fund` (1,383 packages). An independent install in the user's VS Code terminal changed `frontend/package-lock.json`; that concurrent workspace change was preserved and is not part of the authorization implementation. This task did not edit manifests or lockfiles. No lifecycle scripts were run by the successful restore.

## Changed files

- `backend/src/routes/schemas.js`: reject registration role and accept onboarding account type.
- `backend/src/services/auth.js`: validate service input and construct explicit account fields.
- `backend/src/services/drivers.js`: construct explicit profile/vehicle update fields.
- `backend/src/realtime/server.js`: revalidate private notification recipients.
- `backend/scripts/create-admin.js`: construct explicit administrator fields.
- `backend/scripts/seed-dev.js`: use the new registration contract.
- `backend/tests/authorization.test.js`: new authorization integration regressions.
- `backend/tests/realtime.test.js`: stale subscriber and demoted driver regressions.
- `backend/tests/helpers.js`, `backend/tests/auth-driver.test.js`, `backend/tests/verification.test.js`: update registration fixtures while retaining stored role assertions.
- `frontend/src/services/contracts.ts`, `frontend/src/features/auth/validation.ts`, `frontend/src/features/auth/screens/RegisterScreen.tsx`: update registration payload types and builder.
- `frontend/src/services/api.ts`: send explicit allowed registration fields.
- `frontend/tests/api.test.ts`, `frontend/tests/auth-ui.test.tsx`, `frontend/tests/phone.test.ts`: update contract assertions and test allowed transport fields for both onboarding types.
- `frontend/scripts/verify-rider-journey.mjs`: update disposable end-to-end registration calls.
- `backend/README.md`, `backend/docs/api.md`, `backend/docs/demo.md`, `backend/docs/authorization-review.md`: document setup, policy, compatibility, audit and validation.
