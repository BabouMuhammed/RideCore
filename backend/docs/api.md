# REST API

Base URL: `http://localhost:5050/api`. Requests and responses use JSON. Protected endpoints require `Authorization: Bearer {{token}}`. Object IDs are 24 hexadecimal characters. Schema-validated request bodies reject unknown keys. Ride lifecycle actions without a documented body do not consume body fields. All distances are km; durations are minutes; new amounts are GMD numeric units. New rides and simulated payments persist `currency: "GMD"`; legacy records without currency remain GBP and are never converted or relabelled. All timestamps are UTC ISO strings.

Responses: `{ "success": true, "data": ... }`. Errors: `{ "success": false, "error": { "message": "..." } }`. Statuses: 200 success, 201 creation, 400 validation, 401 missing/invalid credentials or inactive account, 403 role/ownership/approval failure, 404 missing resource, 409 conflict/state rule, 413 oversized body, 429 rate limit, 500 safe internal error. Health returns service status directly.

## Authentication

| Method | Path           | Role            | Body / result                                                                           |
| ------ | -------------- | --------------- | --------------------------------------------------------------------------------------- |
| GET    | /health        | Public          | API/database status                                                                     |
| POST   | /auth/register | Public          | firstName, lastName, email, phone, password, optional role (rider/driver); returns user |
| POST   | /auth/login    | Public          | exactly one email/phone, plus password; returns user and token                          |
| GET    | /auth/me       | Any active user | Current user                                                                            |

Passwords: 8-72 characters and at most 72 UTF-8 bytes. Phone must use international `+` prefix with 8-15 digits; spaces, parentheses and hyphens are normalized away. Emails are trimmed and lowercased. Names and general short strings are trimmed and capped at 120 characters.

## Drivers

All endpoints require driver role and operate on the authenticated driver's resources.

| Method | Path                   | Body / result                                                                                                           |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | /drivers/me            | Returns profile and vehicle; vehicle can be null before onboarding                                                      |
| PUT    | /drivers/profile       | `{ "licenseNumber": "LIC001" }`; resets driver approval to pending and availability to offline                          |
| PUT    | /drivers/vehicle       | make, model, year, color, plateNumber, vehicleType, seats; creates/replaces own vehicle fields, resets vehicle approval |
| PATCH  | /drivers/location      | `{ "type": "Point", "coordinates": [-0.12, 51.5] }`                                                                     |
| PATCH  | /drivers/availability  | `{ "availabilityStatus": "online" }` or offline                                                                         |
| GET    | /drivers/ride-requests | Up to 50 compatible requested rides within the configured radius, nearest first; requires approved online driver        |

Coordinates are longitude (-180..180), latitude (-90..90). Vehicle type: economy, comfort, xl. Vehicle year: 1980 through next calendar year; seats: integer 1..12. Plates/licenses are normalized to uppercase; the MVP does not enforce country-specific licensing formats. Busy status is service-controlled. Location updates may occur while busy; profile/vehicle/availability edits may not.

## Rides

| Method | Path                | Role / rule                                                                                               |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------------- |
| POST   | /rides/estimate     | Any active user; ride input, returns distance, estimatedDuration, estimatedFare, currency, distanceMethod |
| POST   | /rides              | Rider; ride input, creates request                                                                        |
| GET    | /rides/me           | Current user's latest 50 rides                                                                            |
| GET    | /rides/:id          | Participant or admin                                                                                      |
| PATCH  | /rides/:id/accept   | Approved online driver with matching approved vehicle; no body                                            |
| PATCH  | /rides/:id/arriving | Assigned driver; accepted -> driver_arriving                                                              |
| PATCH  | /rides/:id/arrived  | Assigned driver; driver_arriving -> driver_arrived                                                        |
| PATCH  | /rides/:id/start    | Assigned driver; driver_arrived -> in_progress                                                            |
| PATCH  | /rides/:id/complete | Assigned driver; in_progress -> completed                                                                 |
| PATCH  | /rides/:id/cancel   | Participant/admin; before start; `{ "reason": "Plans changed" }`                                          |

Ride input (vehicleType defaults to economy):

```json
{
  "pickup": {
    "address": "Pickup, London",
    "location": { "type": "Point", "coordinates": [-0.12, 51.5] }
  },
  "destination": {
    "address": "Destination, London",
    "location": { "type": "Point", "coordinates": [-0.1, 51.52] }
  },
  "vehicleType": "economy"
}
```

Clients never submit rider/driver IDs, fares, timestamps, active markers, or status changes. Ride returns its IDs, stops, estimate, status, and lifecycle timestamps as they become available. Driver requests omit the rider ID. Request discovery is proximity-filtered and ordered nearest pickup first. Acceptance rechecks the radius atomically.

## Payments and ratings

| Method | Path               | Role / body                                                                                       |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------- |
| POST   | /rides/:id/payment | Ride's rider after completion; `{ "method": "cash" }` or mock_wallet; 200 on creation and retries |
| GET    | /rides/:id/payment | Participant/admin; 404 until payment is recorded                                                  |
| POST   | /rides/:id/ratings | Participant after completion; `{ "rating": 5, "comment": "Great ride" }`; 201                     |

Payment repeats with the same method return the same document; another method conflicts. Rating must be an integer 1..5; optional comment is capped at 1000 characters. Reviewer and reviewee are assigned by the service. Cancellation reason is 1..500 characters. No card or wallet credentials accepted.

## Admin

Every admin endpoint requires an active admin account; role checks run before resource access.

| Method | Path                             | Body / result                                                              |
| ------ | -------------------------------- | -------------------------------------------------------------------------- |
| GET    | /admin/users                     | User list without password hashes                                          |
| GET    | /admin/drivers                   | Driver profiles; IDs identify verification targets                         |
| GET    | /admin/rides                     | Inspect rides                                                              |
| GET    | /admin/payments                  | Inspect simulated payments                                                 |
| PATCH  | /admin/drivers/:id/verification  | Profile ID; `{ "verificationStatus": "approved" }` (or rejected/suspended) |
| PATCH  | /admin/vehicles/:id/verification | Vehicle ID; same verification body                                         |
| PATCH  | /admin/users/:id/active          | User ID; `{ "isActive": false }` or true                                   |

Lists support `?page=1`, with 50 records per page, newest IDs first. Driver/vehicle IDs are obtained from driver onboarding responses or `/drivers/me`. Driver approval requires a license number. Admin changes take drivers offline. Verification and activation changes are blocked during active rides, and admins cannot change their own activation status.

## Nearby driver preview

`GET /api/drivers/nearby?lat=51.5&lng=-0.12` requires an active rider. Both query parameters are required finite numeric strings. Latitude must be -90..90 and longitude -180..180. Additional/duplicate query parameters are rejected. Returns up to 50 eligible drivers, nearest first, in the standard success envelope:

```json
{
  "success": true,
  "data": [
    {
      "driverId": "<user ObjectId>",
      "profileId": "<profile ObjectId>",
      "location": { "type": "Point", "coordinates": [-0.12, 51.5] },
      "vehicle": {
        "make": "Toyota",
        "model": "Prius",
        "vehicleType": "economy"
      },
      "ratingAverage": 4.5,
      "ratingCount": 10,
      "distanceKm": 0.25
    }
  ]
}
```

The search radius defaults to `DRIVER_SEARCH_RADIUS_KM=10` (server-configured, not client-selected; valid range greater than 0 through 100). Drivers must have an active driver account, approved profile and vehicle, online status, a valid location and no active assigned ride. Email, phone, license, plate and internal account fields are excluded. GeoJSON always uses **[longitude, latitude]**. These are spherical distances, not driving distances.

`GET /drivers/ride-requests` now searches requested pickup locations near the authenticated driver's position with the same radius and matching vehicle type. Missing location or existing active assignment returns 409; unapproved identity/vehicle returns 403. Out-of-range rides are omitted. `PATCH /rides/:id/accept` additionally rejects out-of-range pickups with 409 while retaining all existing transactional conflict protections.

## Mock OTP verification

| Method | Path              | Authentication               | Body                   |
| ------ | ----------------- | ---------------------------- | ---------------------- |
| POST   | /auth/otp/request | Active authenticated account | `{}`                   |
| POST   | /auth/otp/verify  | Active authenticated account | `{ "code": "123456" }` |

Verification always targets the phone already stored on the authenticated account. No arbitrary phone/user lookup is accepted. Registration sets `phoneVerifiedAt: null`. Successful verification sets an ISO timestamp visible through `/auth/me`; the existing general-purpose `isVerified` flag is unchanged. Existing accounts require no migration and phone verification is **not** a new prerequisite for requesting or accepting rides.

Request response:

```json
{
  "success": true,
  "data": {
    "message": "If verification is needed, a mock code has been generated",
    "expiresInSeconds": 300,
    "mockCode": "<six digits; development/test only>"
  }
}
```

`mockCode` is omitted in production and for already verified phones. The mock provider logs no codes and sends no SMS. **Production has no code retrieval or real delivery path; use a real SMS adapter before real phone ownership verification.** This is an academic demonstration of the challenge flow.

Verification success is 200 with `data.message: "Phone verified"`. Incorrect, expired, reused, or attempt-exhausted codes return the same generic 400. Valid-looking six-digit input is required; code must be a string to preserve leading zeroes. Request cooldown/limits return 429. All normal auth errors remain 401.

Defaults: expiry 300 seconds, resend cooldown 60 seconds, maximum 5 guesses per challenge, maximum 5 requests per account per 15 minutes. Dedicated IP limits are 5 requests and 15 verifies per 15 minutes, in addition to the existing auth router limit. Account request counters survive process restart; HTTP limits are process-local. Resend replaces the challenge and resets that challenge's attempts; expiry is enforced in code independently of eventual TTL cleanup. Hashes are HMAC-SHA256 bound to account, phone, random nonce and a domain label using the existing JWT secret; raw codes are not persisted. Rotating that secret invalidates outstanding challenges. Successful consumption and verification timestamp changes are transactional and single-use under concurrent requests.

## Socket.IO protocol

Socket.IO attaches to the **same HTTP server and port 5050** as REST, at the default `/socket.io` path. Use a Socket.IO client, not a raw WebSocket client. Connect with `auth: { token: '<existing JWT>' }`; never put tokens in URLs. The server derives identity/role from the verified token and active account. Missing, invalid, expired or inactive credentials produce `connect_error` with message `Authentication required` and `error.data.status=401`. Client-supplied identity/role is ignored.

Token trust checks are shared with REST. Identity is rechecked on every incoming operation, and a timer disconnects expiring tokens. Only allowed browser origins may open the transport. The maximum socket packet is 8 KB, and application events are limited to 20 per account per second across sockets. Use a modest 1-5 location updates per second for demos.

Client events support acknowledgements: `{ success: true, data: ... }` or `{ success: false, error: { status, message } }`. Use an acknowledgement timeout and handle errors. No ack callback is required, but without it the client receives no operation result.

| Direction           | Event                  | Payload / behavior                                                                           |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Client -> server    | ride:join              | `{ rideId }`; rider or assigned driver only, active ride; acknowledges normalized rideId     |
| Client -> server    | ride:leave             | `{ rideId }`; removes this socket from the room                                              |
| Client -> server    | driver:location:update | `{ rideId, latitude, longitude, heading?, speed? }`; assigned driver and trackable ride only |
| Server -> ride room | driver:location        | Sanitized location payload plus server ISO timestamp                                         |
| Server -> ride room | ride:accepted          | `{ rideId, status: "accepted", timestamp }`                                                  |
| Server -> ride room | ride:driver-arriving   | `{ rideId, status: "driver_arriving", timestamp }`                                           |
| Server -> ride room | ride:driver-arrived    | `{ rideId, status: "driver_arrived", timestamp }`                                            |
| Server -> ride room | ride:started           | `{ rideId, status: "in_progress", timestamp }`                                               |
| Server -> ride room | ride:completed         | `{ rideId, status: "completed", timestamp }`                                                 |
| Server -> ride room | ride:cancelled         | `{ rideId, status: "cancelled", timestamp }`                                                 |

Room names are server-controlled `ride:<normalized ObjectId>`. Arbitrary room names and unrelated subscribers are rejected; there is no special admin subscription access. Riders may join requested rides before acceptance. Drivers join once assigned. Terminal rides reject joins, and existing room membership is removed after the terminal event.

Tracking accepts only the assigned driver while status is accepted, driver_arriving, driver_arrived or in_progress. Completed/cancelled rides reject updates with 409. Coordinates are finite numbers within the usual ranges; heading is degrees in [0,360), speed is metres/second in [0,100]. Unknown payload fields and malformed IDs return 400; unrelated users return 403. Timestamps come from the server.

Valid broadcasts may be frequent, but MongoDB driver-location persistence is throttled using the driver's stored `locationPersistedAt` timestamp: at most one socket location write per `LOCATION_PERSIST_INTERVAL_MS` (default 5000). Reconnects or multiple sockets cannot reset this throttle. REST location updates persist immediately and refresh the same timestamp. The final sample within a throttle window is not guaranteed to be saved, and no historical tracking is stored. Ride eligibility/status is revalidated for every tracking operation; broadcasts are transient snapshots, not a durable location log.

REST services remain authoritative. The six status events are published only after their state-changing transaction commits, outside any retry callback. Socket events cannot accept/start/complete/cancel rides. Disconnecting changes no ride or availability state. On reconnect, refresh authentication as needed, explicitly rejoin the active ride, then fetch `GET /rides/:id` to reconcile any missed events. Socket.IO is not configured for durable delivery/replay or multiple backend processes.

## Share My Ride: temporary trusted-person tracking

The sharing link grants temporary read-only access to a specific ride, not permanent access to the rider or driver's location. Possession of the link is authorization; viewers need no account. Sharing is an intentional rider action. Keep links private, use HTTPS in deployment, and redact token-bearing paths from reverse-proxy/access/analytics logs. The application does not log request URLs or share payloads.

| Method | Path                 | Access and behavior                                                      |
| ------ | -------------------- | ------------------------------------------------------------------------ |
| POST   | /rides/:id/share     | Owning active rider only; body absent or `{}`; returns a new token once  |
| DELETE | /rides/:id/share     | Owning active rider only; no body; idempotently revokes the current link |
| GET    | /shared-rides/:token | No JWT; valid unexpired share token authorizes one sanitized snapshot    |

Creation requires an assigned driver and an active ride in accepted, driver_arriving, driver_arrived or in_progress. Requested/unassigned, completed and cancelled rides return 409. Other riders/drivers/admins cannot create or revoke on behalf of the rider (403); missing/invalid JWT is 401. Malformed private ride IDs remain 400. Client-selected token, expiry or other body fields are rejected with 400.

Creation returns 201:

```json
{
  "success": true,
  "data": {
    "token": "<43-character random base64url token>",
    "sharePath": "/track/<same token>",
    "expiresAt": "<ISO UTC expiry>"
  }
}
```

The backend does not host `/track/...` or build its frontend page in this phase. The future frontend appends sharePath to its own origin; no frontend domain is hardcoded into sharing services. The raw token is returned only on successful creation. Normal ride/admin responses and public snapshots do not contain it. A repeat POST while the current link remains active returns 409 without re-disclosing a token. If the token is lost or a replacement is needed, DELETE then POST; the previous token stays invalid. Expired links can be replaced directly. Revocation returns 200 `{ "success": true, "data": { "revoked": true } }`, including repeated revocation or no current share.

A unique ride index allows one share record/current token per ride. Tokens use 32 cryptographically random bytes (256 bits), encoded as 43 base64url characters. Only the SHA-256 digest is persisted/indexed; the raw token is neither stored nor logged. Generation metadata prevents old live viewers from inheriting a replacement token's authorization. Token validation is case-sensitive. Ride/user IDs, token hashes and private JWTs are not substitute share credentials.

Public success is 200 with the following explicit DTO:

```json
{
  "success": true,
  "data": {
    "rideStatus": "accepted",
    "driver": { "firstName": "Demo", "rating": 4.5 },
    "vehicle": {
      "make": "Toyota",
      "model": "Prius",
      "color": "Blue",
      "plateNumber": "DEMO001"
    },
    "location": {
      "latitude": 51.501,
      "longitude": -0.121,
      "updatedAt": "<server ISO UTC sample time>"
    },
    "trip": {
      "pickup": {
        "address": "Demo pickup",
        "latitude": 51.5,
        "longitude": -0.12
      },
      "destination": {
        "address": "Demo destination",
        "latitude": 51.52,
        "longitude": -0.1
      }
    },
    "sharing": { "expiresAt": "<ISO UTC expiry>" }
  }
}
```

`location` is null until the assigned driver publishes an authorized ride-specific `driver:location:update`. It never falls back to DriverProfile.currentLocation or `/drivers/location` updates, which may represent a different/off-duty context. Public location comes from the latest throttled sample on this Ride; there is no trail/history endpoint. Driver/vehicle can be null if related data is unavailable. Only first name/rating and vehicle make/model/color/plate are intentionally disclosed to identify the vehicle for safety. Contacts, rider identity, full names, user/ride/share IDs, license/documents, account flags, passwords, OTPs, payments, token hashes/generations and complete persistence documents are omitted.

Invalid, malformed, unknown, expired, revoked and terminal-ride share tokens uniformly return 404 `{ "success": false, "error": { "message": "Shared ride unavailable" } }`. No arbitrary ride-ID lookup or existence information is offered. URL decode errors are sanitized rather than echoing the token. Share REST responses include `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`.

`RIDE_SHARE_TTL_SECONDS` defaults to 14400 (4 hours), valid integer 60-86400. Every snapshot/join/broadcast verifies the current hash/generation, active share, no revocation, expiry and eligible ride; TTL cleanup is not authorization. Metadata cleanup is eligible one day after token expiry and may be delayed by MongoDB. Completion/cancellation end active shares in the same transaction as the ride transition and clear the ride-specific location sample. Rider revocation commits before its room is invalidated and the DELETE response is sent.

`RIDE_SHARE_RATE_LIMIT_MAX` defaults to 120 requests per IP per minute (integer 1-600), in addition to the existing API limit. Use sockets for live updates and a modest fallback snapshot interval, such as 10 seconds. Token lookup limits also cover malformed/failed requests.

### Public Socket.IO namespace

Connect a separate Socket.IO client to namespace `/shared-rides` on the same server/port 5050. This namespace allows a connection without a JWT but grants **no subscription or location access until share:join validates a token**. The private root namespace `/` still requires its existing JWT authentication and participant-only `ride:<id>` rooms. Share tokens cannot authenticate there. The public namespace cannot join private rooms or publish driver/ride mutation events; such events receive a 403 acknowledgement.

| Direction                   | Namespace     | Event             | Payload / result                                                                                 |
| --------------------------- | ------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| Client -> server            | /shared-rides | share:join        | `{ token }`, no rideId/room/userId allowed; success ack contains the same sanitized snapshot DTO |
| Client -> server            | /shared-rides | share:leave       | `{}` or no payload; leaves this socket's subscription; ack data `{ left: true }`                 |
| Server -> public share room | /shared-rides | share:location    | `{ latitude, longitude, updatedAt }` only                                                        |
| Server -> public share room | /shared-rides | share:ride-status | `{ rideStatus, timestamp }` only; non-terminal transitions                                       |
| Server -> public share room | /shared-rides | share:ended       | `{ reason }`; removes current viewers from the room                                              |

Acknowledgements use `{ success: true, data }` or `{ success: false, error: { status, message } }`. Failed/malformed joins return 404 Shared ride unavailable; excess attempts return 429. Room IDs are internal and never returned: `share:<internal share ID>:<generation>`. A socket holds at most one public subscription. Join/leave operations are serialized so overlapping requests cannot leave stale membership. Only the token selects the ride; extra rideId/room fields fail validation.

Ended reasons are revoked, expired, ride_completed, ride_cancelled, or unavailable (fail-closed revalidation). Existing public viewers receive share:ended on revocation/expiry/completion/cancellation and leave their room. They remain transport-connected without tracking authorization; a valid current token is required to join again. Per-share timers notify idle viewers at expiry; every access still independently checks expiry. Disconnect changes no ride/share/availability state. Reconnect and rejoin only while the same token remains valid; the join ack refreshes the snapshot. Never log tokens or persist them in analytics/third-party URLs.

Public connection attempts are capped per IP per minute at min(RIDE_SHARE_RATE_LIMIT_MAX,60). Join/leave attempts share a per-IP cap of min(RIDE_SHARE_RATE_LIMIT_MAX,30), charged before work queues. Forbidden event attempts are also limited. Location broadcasts do not consume the join quota. The existing packet/origin protections apply. Limits and notifications are process-local; this MVP supports one backend process.

The trusted person cannot change rides, update GPS, impersonate participants, access authenticated REST endpoints, or receive private events. A token for ride A cannot select ride B, and a terminated ride's link cannot follow its driver into later journeys. Cached/delivered data and screenshots cannot be recalled; a forwarded/stolen link remains a bearer credential until revoked/expired/ended. No recipient identity verification, durable event replay, permanent tracking, SOS or emergency integration is included.

## Additive frontend integration fields

`GET /rides/:id` retains participant/admin authorization and existing IDs, then supplies `driverDetails` (firstName, verificationStatus, rating), safe `vehicle` fields (make, model, color, plateNumber, vehicleType, seats, verificationStatus), `riderDetails.firstName` only for the driver/admin viewer, and `myRating` for the requesting user only. No email, phone, licence document, password or other user's rating comment is included. Missing identities/vehicle are null. Returned detail currency is explicit, using GBP for historical currency-less records.

`GET /admin/drivers?page=N` retains its 50-profile page and adds each profile's `vehicle` and `account` (id, firstName, lastName, isActive) for administrative review. This introduces no new route and no public visibility. Vehicle listing in the frontend derives from these actual driver pages; it does not imply a platform-wide total.

Pricing for new rides is the academic GMD tariff `(75 + 25 * km + 5 * estimatedMinutes) * multiplier`, rounded to two decimals. This is deliberately denominated in GMD, not an exchange-rate conversion. Previously recorded values remain in their original units. The Payment collection is a simulated payment record, not a double-entry ledger or gateway. No new ledger, refund, refresh, logout, geocoding or road-routing endpoint is introduced.
