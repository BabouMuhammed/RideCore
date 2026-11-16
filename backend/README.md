# RIDE CORE backend

An academic ride-hailing REST API implemented as a modular Node.js / Express 5 monolith with MongoDB and Mongoose. Riders request rides, approved drivers fulfill them, and administrators review onboarding and accounts. REST, private authenticated Socket.IO and temporary token-authorized ride sharing use port 5050. No frontend, paid maps, or real payment gateway is included.

## Run locally

Use Node.js 24 LTS and npm. In PowerShell:

```powershell
cd C:\Users\m\Desktop\Ridecore\backend
npm ci
# Only for a fresh checkout with no .env:
# Copy-Item .env.example .env
npm run dev
```

Keep the existing `.env` and Atlas credentials. Add missing environment variables locally without sharing them. Generate a JWT secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and save it privately. Never commit it. Production command: `npm start`. Default port: **5050**. MongoDB must connect and indexes must initialize before the server accepts traffic. SIGINT/SIGTERM close HTTP and MongoDB connections. Startup failures exit with a nonzero status and safe diagnostics.

Transactions require MongoDB Atlas or a local replica set; standalone MongoDB is insufficient. For a separate local development database, start your own MongoDB replica set and use a URI with `replicaSet=rs0`. The automated tests start and clean up their own replica set.

## Environment

| Variable      | Purpose                                                   |
| ------------- | --------------------------------------------------------- |
| `MONGODB_URI` | Required private MongoDB connection URI; never logged     |
| `JWT_SECRET`  | Required secret, at least 32 characters; use high entropy |
| `PORT`        | Default 5050                                              |
| `NODE_ENV`    | development, test, or production                          |
| `CORS_ORIGIN` | Allowed browser origin; default http://localhost:3000     |

`.env.example` contains placeholders only. `.env` is ignored and was not modified by this implementation.

## Scripts

- `npm run dev`: Nodemon development server.
- `npm start`: production-style Node entry point.
- `npm test`: complete Vitest and Supertest suite.
- `npm run admin:create`: provision an administrator explicitly; never available through public registration.
- `npm run format`: format source, tests, and documentation.
- `npm run format:check`: check formatting.

## Architecture and layout

Requests pass through routes, authentication/authorization and Zod validation, thin controllers, domain services, and Mongoose models. Services own workflows; models own schema/index persistence. The application factory is independently testable without opening a TCP port or reading `.env`. Server and admin CLI entry points load environment configuration.

```text
backend/
  src/
    app.js, server.js, http-server.js
    config/       db.js, env.js, features.js, pricing.js
    controllers/  index.js, ride-shares.js
    middleware/   auth.js, validate.js
    models/       User.js, DriverProfile.js, Vehicle.js, Ride.js, RideShare.js,
                  Payment.js, Rating.js, PhoneOtp.js, shared.js, index.js
    realtime/     server.js, schemas.js, ride-events.js,
                  share-events.js, shared-rides.js
    routes/       index.js, schemas.js, shared-rides.js
    services/     auth.js, drivers.js, rides.js, pricing.js, payments.js,
                  admin.js, identity.js, nearby.js, tracking.js,
                  otp.js, otp-delivery.js, ride-shares.js,
                  share-snapshot.js, share-lifecycle.js
    utils/        errors.js
  scripts/        create-admin.js
  tests/          helpers.js, foundation.test.js, auth-driver.test.js,
                  rides.test.js, payments-ratings-admin.test.js,
                  verification.test.js, nearby.test.js, otp.test.js,
                  realtime.test.js, ride-shares.test.js, share-realtime.test.js
  docs/           api.md, demo.md, implementation-report.md, final-backend-audit.md
  .env            existing, untouched and ignored
  .env.example, .gitignore, package.json, package-lock.json, vitest.config.js
  node_modules/   ignored dependencies
  .cache/         ignored test binary cache
```

## Authentication and roles

Register as rider or driver, then log in to receive a two-hour HS256 JWT. Send `Authorization: Bearer <token>` on protected requests. JWT issuer/audience and algorithm are verified. Each request reloads the account to enforce suspension. No refresh tokens or password recovery is implemented. Mock phone OTP verification is available as described below. `phoneVerifiedAt` records mock phone verification; `isVerified` retains its existing general account meaning, distinct from phone and driver/vehicle approval.

Public registration accepts `accountType` (`rider` or `driver`, default `rider`), never `role`. It cannot create admins or set privileged fields. Clients previously sending `role` must switch to `accountType`; response `role` fields are unchanged. Driver signup creates a pending profile and does not grant approval.

Initial administrators are provisioned only by a trusted operator with server and database access. Verify the intended database configuration before running `npm run admin:create` from `backend`. The admin CLI requires `ADMIN_EMAIL`, `ADMIN_PHONE`, and `ADMIN_PASSWORD` in its process environment; optional `ADMIN_FIRST_NAME` and `ADMIN_LAST_NAME` customize the name. Supply the password through a hidden prompt rather than shell history and clear it afterward; see [demo](docs/demo.md). It creates a new administrator and does not elevate or replace an existing account. Log in normally and verify `/api/auth/me` before using admin endpoints. Restrict access to the CLI, database credentials, and server environment to trusted operators. Never use the development seed for initial production administration.

There is no HTTP role-promotion/demotion policy or staff role. `/auth/become-admin`, `/auth/become-staff`, and `/auth/fire-staff` are unregistered (404), including for administrators. Administrators can approve driver/vehicle resources and activate/deactivate other accounts through the explicit admin routes; these operations do not change account roles. Adding staff or HTTP role management requires a separate policy decision. See the [authorization review](docs/authorization-review.md) for the audited routes and regression coverage.

Drivers receive a pending profile at registration. They supply a license and vehicle, and an admin approves each separately. Editing either resets its approval and takes the driver offline. A location is required to go online. Clients cannot choose `busy`; acceptance does that. Profile/vehicle edits, suspension, and verification changes are rejected while a ride is active. Reactivation does not restore previous availability. Drivers must explicitly go online again after completion/cancellation.

## Ride lifecycle and concurrency

```text
requested -> accepted -> driver_arriving -> driver_arrived -> in_progress -> completed
```

Only the assigned driver can advance a ride, one step at a time. Participants or an admin may cancel before `in_progress` with a reason. Started and terminal rides cannot be cancelled. Pickup/destination each include an address and GeoJSON Point with `[longitude, latitude]` coordinates.

Partial unique indexes enforce one active ride per rider and per assigned driver. Acceptance changes ride and availability together in a MongoDB transaction. Conditional updates enforce prior state. User/profile writes serialize acceptance and creation against suspension and approval/edit changes. Completion/cancellation atomically free the driver and clear the active marker. Historical rides remain available to their participants and admins. Drivers discover up to 50 matching requests within a configurable local radius. Rider map preview exposes nearby eligible drivers through a safe projection. Automatic dispatch remains deferred.

## Pricing and payments

Configuration is in `src/config/pricing.js`. New-ride GMD fare is `(75 + 25 * distanceKm + 5 * minutes) * vehicleMultiplier`, rounded to two decimal places. This is an academic GMD tariff, not foreign-exchange conversion or an asserted commercial tariff. Ride and payment records persist their currency. Historical records with no currency remain legacy GBP; they are never relabelled or converted. Multipliers: economy 1, comfort 1.3, xl 1.6. Distance uses **Haversine straight-line kilometres**, not road distance; estimated time assumes a constant 30 km/h. Full-precision distance/time are used in the formula. This is an approximation, with no traffic, surge, route, tax, toll, cancellation charge, or actual travel measurement. Final fare equals the original estimate.

After completion, the rider records `cash` or `mock_wallet` payment. Both are marked paid with a clearly simulated `SIM-` reference; cash records an academic confirmation, not bank settlement. Amount and participants come from the ride. A unique ride index and duplicate-key handling make retries/concurrent calls idempotent; changing the method after payment returns 409. Real funds, cards, wallet balances, refunds, and gateway processing are not implemented. Payment schema statuses reserve future failure/refund workflows.

Both participants may rate the other once after completion. Rating target is derived from the ride. A unique ride/reviewer index blocks duplicates. Insertion and driver rating sum/count/average updates share a transaction.

## API and demo

See [endpoint documentation](docs/api.md), [Postman walkthrough](docs/demo.md), and [implementation report](docs/implementation-report.md). Success responses use `{ success: true, data: ... }`; errors use `{ success: false, error: { message } }`. Health retains its original message and adds service/database status (200 connected, 503 disconnected).

Admin lists use `?page=1` with 50 records per page. Ride history and driver request lists return at most 50 records. These MVP ride lists do not yet expose pagination cursors.

## Security

Helmet, explicit CORS origin, 32 KB JSON limit, per-IP rate limits (500 API requests / 15 minutes; 30 auth requests / 15 minutes), strict Zod request schemas, validated ObjectIds, normalized email/international phone, bcrypt cost 12, JWT verification, role and ownership checks, password exclusion, safe central errors, and unique database indexes are applied. Only the trusted admin provisioning script can create admin accounts. Errors never include stack traces or database error text. HTTP logs omit URLs, headers, and request bodies. Request IP forwarding is not trusted by default; configure Express proxy trust only for your actual trusted deployment proxy.

Rate limits are process-local, suitable for this single-process MVP. Driver licenses and vehicle plates are recorded for academic review; no external identity/vehicle verification is performed. Production infrastructure (TLS, network restrictions, backups, secret rotation, monitoring) remains a deployment responsibility.

## Testing

```powershell
npm test
```

Integration tests use a disposable, single-node replica set via `mongodb-memory-server`, exercising real MongoDB transactions, indexes, and concurrent requests through Supertest. They never load `.env` or use Atlas. Test fixtures use faster bcrypt only for seeded accounts; API registration still hashes at production cost 12. On this machine the tests detect the installed MongoDB 8.2.1 executable. The integration verification passed 241 tests across 11 test files: all 234 previous tests plus 7 currency/read-contract regressions. See [the final audit report](docs/final-backend-audit.md) for current totals. Automatic install-time MongoDB downloads are disabled in package configuration. Elsewhere the first test run downloads MongoDB 7.0.24 into ignored `.cache/mongodb-binaries`, requiring internet access. To use an existing binary, set `MONGOMS_SYSTEM_BINARY` to its full path. The version-mismatch warning is harmless when a compatible newer binary is supplied. MongoDB temporary data is removed on shutdown.

Coverage includes auth/authorization, validation, driver approval and availability, pricing, the ride lifecycle, conflicting concurrent requests/acceptance, payments, ratings and aggregates, admin restrictions, body limits, and safe responses. These are integration and unit checks, not performance, security penetration, or live Atlas deployment tests.

## Nearby drivers

`DRIVER_SEARCH_RADIUS_KM` defaults to 10 km. MongoDB `2dsphere` indexes support nearby driver discovery from a pickup/map origin and reverse lookup of requested pickups near the current driver. Results are nearest first, eligibility-filtered before the 50-result cap, with no contact/license/plate details. `GET /api/drivers/nearby?lat=...&lng=...` requires rider authentication. Driver request discovery and atomic acceptance use the same radius. All GeoJSON uses **longitude before latitude**. See [API details](docs/api.md#nearby-driver-preview).

## Real-time transport

Socket.IO is attached by `src/http-server.js` to the same Express HTTP server on port 5050. The realtime adapter reuses shared JWT identity verification, authorizes ride rooms, validates driver tracking, and broadcasts REST state changes after commit. Clients connect with `auth.token`, join their own active ride, and rejoin/reconcile with REST after reconnect. Disconnects never mutate ride state. Persistence is throttled to one driver-location write per 5 seconds by default while location broadcasts can be more frequent. This is a single-process MVP with ephemeral events and no replay/Redis adapter.

The [API reference](docs/api.md#socketio-protocol) defines all client/server events, acknowledgements, units, limits and authorization. The [demo](docs/demo.md) includes terminal-based Socket.IO examples, without frontend implementation.

## Mock phone OTP

Authenticated users request and verify their own stored phone with `/api/auth/otp/request` and `/api/auth/otp/verify`. Phone verification is optional for existing ride flows. `phoneVerifiedAt` starts null and appears through `/auth/me` after successful verification. Six-digit codes are stored as domain-separated keyed hashes with random nonces, expire after 5 minutes, are consumed once, and have attempt/cooldown/account/IP limits.

Only development/test responses expose `data.mockCode`. No codes are logged, and production responses never contain them. No SMS is sent: production cannot complete real phone verification until the mock delivery adapter is replaced with an actual provider. This is a demo verification flow, not proof of real phone possession. Login remains password-based and now accepts exactly one normalized email or phone.

Additional optional settings, all validated at startup and listed in `.env.example`:

| Variable                     | Default | Allowed values             |
| ---------------------------- | ------- | -------------------------- |
| DRIVER_SEARCH_RADIUS_KM      | 10      | greater than 0 through 100 |
| LOCATION_PERSIST_INTERVAL_MS | 5000    | integer 1000-60000         |
| OTP_TTL_SECONDS              | 300     | integer 30-600             |
| OTP_RESEND_COOLDOWN_SECONDS  | 60      | integer 1-300              |
| OTP_MAX_ATTEMPTS             | 5       | integer 1-10               |

No new required secret is introduced. OTP hashes use the existing strong JWT secret with a separate domain label. Do not copy real `.env` values into documentation. Existing MongoDB data requires no destructive migration; startup creates the new pickup geospatial and OTP indexes.

## Share My Ride / trusted tracking

The sharing link grants temporary read-only access to a specific ride, not permanent access to the rider or driver's location. Only the owning rider may intentionally create/revoke a link after driver assignment and before the ride ends. It returns a relative `/track/<token>` path; no frontend page is built here. Viewers need no account but must possess a valid 256-bit random token. Only its SHA-256 hash is stored. One current token exists per ride; replacement is explicit revoke then create, or create after expiry.

`POST /api/rides/:id/share`, `DELETE /api/rides/:id/share`, and `GET /api/shared-rides/:token` implement the REST flow. The separate Socket.IO namespace `/shared-rides` accepts share:join proof and emits minimized share:location, share:ride-status and share:ended events. It never admits anonymous viewers to private ride rooms. Private JWT/role/participant protections are unchanged.

Public data is intentionally limited to journey status/stops, driver first name/rating, vehicle make/model/color/plate, current ride-specific GPS sample and expiry. GPS is null before an authorized ride-specific update; the driver's general/off-duty location is never a fallback. No historical trail, contact data, private IDs, payment/OTP data, hashes or raw token is returned publicly. The token appears only in the creation response. Headers prevent caching/referrer propagation by the API; infrastructure/frontend must also redact token-bearing paths and use HTTPS.

Expiry, revocation and ride completion/cancellation stop sharing. Every access/join/broadcast validates current share and ride eligibility; expiry does not depend on eventual TTL deletion. Completion/cancellation end shares in their transaction and clear the ride sample. Connected public viewers are removed and notified; old generations cannot inherit a replacement's access. Token holders may forward/screenshot data, which cannot be recalled. Single-process socket notifications/rate limits remain an MVP limitation.

Optional startup settings (no new required secret or dependency):

| Variable                  | Default                            | Validation       |
| ------------------------- | ---------------------------------- | ---------------- |
| RIDE_SHARE_TTL_SECONDS    | 14400 (4 hours)                    | integer 60-86400 |
| RIDE_SHARE_RATE_LIMIT_MAX | 120 public REST requests/IP/minute | integer 1-600    |

Public socket join/leave attempts are capped at min(rate limit,30)/IP/minute; connection attempts at min(rate limit,60). The global API limit also applies. Prefer live sockets and a modest REST fallback interval. Detailed threat model, DTOs, errors, event contracts and the full safety demo are in [api.md](docs/api.md), [demo.md](docs/demo.md), and the [final audit](docs/final-backend-audit.md).

## Frontend integration contract

See `../frontend/docs/api-integration-matrix.md` and the full integration report. Existing GET `/rides/:id` now includes participant-authorized safe first names, driver verification/rating, vehicle display fields and the requesting user's own rating. IDs and ownership checks are unchanged. Existing GET `/admin/drivers` includes the associated vehicle and safe account summary so vehicle verification can use its existing PATCH endpoint without inventing a list endpoint.

`npm test` remains the complete backend suite. `tests/browser-server.js` is an explicit test-mode-only, disposable browser harness: it never loads `.env`, never connects to Atlas, and uses test-only ports 5054/3004. It cannot run without `RIDECORE_BROWSER_TEST=1` and `NODE_ENV=test`. Normal application ports remain 5050/3000. No production credentials are included in the frontend build.
