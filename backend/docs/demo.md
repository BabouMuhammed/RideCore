# Manual Postman demo

Set Postman `baseUrl` to `http://localhost:5050/api`. Create variables `riderToken`, `driverToken`, `adminToken`, `driverProfileId`, `vehicleId`, `rideId`. For authenticated requests use Bearer Token with the appropriate variable. Set body mode to raw JSON.

1. Start the API with `npm run dev` from `backend`. Check `GET {{baseUrl}}/health` returns connected.
2. Register a rider: `POST {{baseUrl}}/auth/register`:

```json
{
  "firstName": "Demo",
  "lastName": "Rider",
  "email": "rider@example.test",
  "phone": "+447700900101",
  "password": "Demo-rider-pass-123",
  "accountType": "rider"
}
```

3. Register a driver at the same endpoint:

```json
{
  "firstName": "Demo",
  "lastName": "Driver",
  "email": "driver@example.test",
  "phone": "+447700900102",
  "password": "Demo-driver-pass-123",
  "accountType": "driver"
}
```

4. Log in each account with `POST /auth/login`, e.g. `{ "email": "rider@example.test", "password": "Demo-rider-pass-123" }`. Save `data.token` as riderToken/driverToken.
5. Using driverToken, `PUT /drivers/profile` with `{ "licenseNumber": "DEMO-LICENSE-001" }`. Save `data._id` as driverProfileId. Then `PUT /drivers/vehicle`:

```json
{
  "make": "Toyota",
  "model": "Prius",
  "year": 2022,
  "color": "Blue",
  "plateNumber": "DEMO001",
  "vehicleType": "economy",
  "seats": 4
}
```

Save `data._id` as vehicleId. `GET /drivers/me` also returns both IDs. Both resources start pending.

6. Provision an admin once from a separate PowerShell terminal in `backend`. Use an unused email/phone. These are process variables; no `.env` editing or credentials are required in source files:

```powershell
$env:ADMIN_EMAIL = 'admin@example.test'
$env:ADMIN_PHONE = '+447700900103'
$adminCredential = Read-Host 'New admin password (8-72 characters)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminCredential).Password
try { npm run admin:create } finally { Remove-Item Env:ADMIN_PASSWORD; $adminCredential.Dispose() }
```

Log the admin in through `POST /auth/login` using the password you entered and save adminToken. The public register route deliberately rejects the admin role. The CLI refuses duplicate email/phone and does not promote existing users.

7. Using adminToken, send `PATCH /admin/drivers/{{driverProfileId}}/verification` and `PATCH /admin/vehicles/{{vehicleId}}/verification`, each with `{ "verificationStatus": "approved" }`.
8. Using driverToken, set location: `PATCH /drivers/location` with `{ "type": "Point", "coordinates": [-0.12, 51.5] }`. Then `PATCH /drivers/availability` with `{ "availabilityStatus": "online" }`.
9. Using riderToken, optionally estimate with `POST /rides/estimate`, then request with `POST /rides`, using this body for both:

```json
{
  "pickup": {
    "address": "Demo pickup, London",
    "location": { "type": "Point", "coordinates": [-0.12, 51.5] }
  },
  "destination": {
    "address": "Demo destination, London",
    "location": { "type": "Point", "coordinates": [-0.1, 51.52] }
  },
  "vehicleType": "economy"
}
```

Save the created ride's `data._id` as rideId. Distances are straight-line Haversine estimates, not road routing.

10. Using driverToken, `GET /drivers/ride-requests`, then `PATCH /rides/{{rideId}}/accept` with no body. Driver becomes busy. Repeating accept returns 409.
11. Using driverToken, send these PATCH requests with no body, in order:
    - `/rides/{{rideId}}/arriving`
    - `/rides/{{rideId}}/arrived`
    - `/rides/{{rideId}}/start`
    - `/rides/{{rideId}}/complete`

The final ride is completed with finalFare equal to estimatedFare; driver becomes offline. Verify with `GET /rides/{{rideId}}` and `GET /drivers/me`.

12. Using riderToken, `POST /rides/{{rideId}}/payment` with `{ "method": "mock_wallet" }` (cash is also supported). This creates a paid simulated payment; no money moves. Repeat it to demonstrate the same payment ID/reference. Inspect with `GET /rides/{{rideId}}/payment`.
13. Using riderToken, `POST /rides/{{rideId}}/ratings` with `{ "rating": 5, "comment": "Great demo ride" }`. Using driverToken, send `{ "rating": 4 }` to rate the rider. Repeating either rating returns 409. `GET /drivers/me` shows the updated driver rating aggregate.
14. With adminToken, inspect `/admin/users`, `/admin/drivers`, `/admin/rides`, `/admin/payments`. Test non-admin access returns 403. To demonstrate cancellation, create another rider request and call `PATCH /rides/{{rideId}}/cancel` with `{ "reason": "Plans changed" }` before the ride starts.

For Postman scripting, copy a response value into an environment variable with `pm.environment.set("rideId", pm.response.json().data._id)`; login responses use `.data.token`.

These credentials are demo examples only. Use different, private passwords in deployed environments. For repeated demos reuse the accounts rather than attempting duplicate registration, and use the new ride ID for each ride.

## Nearby driver demo

After the original onboarding/approval steps, set the driver's GeoJSON location to `[-0.12,51.5]` and go online. As the rider, call `GET /drivers/nearby?lat=51.5&lng=-0.12`; inspect only the safe map fields and distanceKm. Request a ride from the nearby pickup, then confirm it appears in `GET /drivers/ride-requests` using the driver's token.

Before accepting, move the still-online driver to `[-0.12,52]` (more than 50 km away). Repeat the rider preview and driver request list: this driver/request pairing is excluded with the default 10 km radius. Direct acceptance of that distant ride returns 409. Move back to the pickup and acceptance succeeds. A pending/offline/busy/inactive driver is omitted from preview as appropriate. Configure `DRIVER_SEARCH_RADIUS_KM` privately if you need another radius; its default is sufficient without editing `.env`.

## Live tracking and state notification demo

Socket.IO must use the existing JWT and the same `http://localhost:5050` server. The examples below are terminal client snippets for demonstration, not frontend files. The test client dependency is already available in the backend development installation.

After the rider creates a requested ride, set process variables in a PowerShell terminal in `backend` (use only demo tokens):

```powershell
$env:DEMO_RIDER_TOKEN = '<rider JWT>'
$env:DEMO_RIDE_ID = '<ride ObjectId>'
node --input-type=module -e "import { io } from 'socket.io-client'; const s = io('http://localhost:5050', { auth: { token: process.env.DEMO_RIDER_TOKEN } }); s.on('connect', () => s.emit('ride:join', { rideId: process.env.DEMO_RIDE_ID }, console.log)); for (const name of ['driver:location', 'ride:accepted', 'ride:driver-arriving', 'ride:driver-arrived', 'ride:started', 'ride:completed', 'ride:cancelled']) s.on(name, data => console.log(name, data)); s.on('connect_error', error => console.log(error.message));"
```

Keep the rider client running. Accept via the driver's REST endpoint; the rider receives `ride:accepted`. In another backend terminal, set driver token and the same ride ID, then publish one location:

```powershell
$env:DEMO_DRIVER_TOKEN = '<assigned driver JWT>'
$env:DEMO_RIDE_ID = '<same ride ObjectId>'
node --input-type=module -e "import { io } from 'socket.io-client'; const s = io('http://localhost:5050', { auth: { token: process.env.DEMO_DRIVER_TOKEN } }); s.on('connect', () => s.emit('driver:location:update', { rideId: process.env.DEMO_RIDE_ID, latitude: 51.501, longitude: -0.121, heading: 120, speed: 8 }, console.log)); s.on('connect_error', error => console.log(error.message));"
```

The rider terminal receives `driver:location` with server timestamp. Change coordinates and repeat to simulate marker movement. Valid broadcasts can be more frequent than persistence; the driver profile stores a sample at most once every 5 seconds by default. Heading is degrees [0,360), speed is metres/second [0,100].

Progress the ride through arriving, arrived, start and complete using REST. Observe each corresponding ride event. After completion, another tracking update returns 409; a room join also returns 409. For cancellation, use a separate pre-start ride and observe `ride:cancelled`. Both terminal events remove room membership.

Disconnect/restart a client before completion, reconnect using its JWT and rejoin the same active ride. The ride and availability remain unchanged. Fetch `GET /rides/:id` after rejoining to recover state missed while disconnected. An expired JWT requires login again and a new connection. An unrelated user's join or tracking attempt returns 403. Stop demo clients with Ctrl+C and clear their token process variables when finished.

## Mock OTP demo

1. Register/login a demo user as usual. `/auth/me` shows `phoneVerifiedAt: null`.
2. With that user's bearer token, `POST /auth/otp/request` with `{}`. This always targets their stored phone; there is no arbitrary phone lookup.
3. In `NODE_ENV=development` (or isolated test mode), read `data.mockCode`. It is a six-digit string and expires after 300 seconds by default. Never expect this field in production.
4. `POST /auth/otp/verify` with `{ "code": "<the returned six digits>" }`. Success is 200; `/auth/me` now shows a phoneVerifiedAt timestamp.
5. Repeat verification: generic 400. On another unverified account, demonstrate a wrong code, expiry, five-attempt lockout, and a repeat request within 60 seconds returning 429.
6. Password login continues to work with email or normalized phone. Phone verification does not block the original ride flow.

The mock adapter sends no SMS and logs no code. Production responses omit the mock code entirely; without a real provider, production has no usable OTP delivery path. This demonstration validates the challenge workflow, not real phone ownership. No real phone credentials or SMS billing are involved.

## FYP demonstration: Share My Ride / trusted tracking

This demonstration uses the existing API and terminal Socket.IO clients; no frontend is implemented. In the future UI, the rider's "Share My Ride" button will call the creation endpoint and share its relative path. No messaging/SMS/email is sent by the backend.

1. Register/login rider and driver, submit the driver profile/vehicle, approve both using the admin, set a nearby valid location and go online using the earlier flow.
2. Rider requests a ride. Driver accepts; the ride is now accepted with an assigned driver.
3. As the owning rider, `POST /api/rides/{{rideId}}/share` with `{}` (or no body). Save data.token privately once and inspect data.sharePath `/track/<token>` plus expiresAt. The future frontend prefixes its own domain; `/track/...` is not a backend page.
4. The rider intentionally shares the link with a trusted person. For this backend demo, give that person the demo token and API base URL. They need no RIDE CORE account or JWT.
5. In a separate Postman request with **no Authorization header**, `GET /api/shared-rides/{{shareToken}}`. Inspect the sanitized ride, driver first name/rating, vehicle make/model/color/plate and trip details. Location starts null until a ride-specific socket sample arrives; the driver's general location is not used.
6. In a backend terminal, connect a trusted-viewer client to the separate public namespace. Use only a disposable demo token; do not log or save real share links in shell history or third-party tooling:

```powershell
$env:DEMO_SHARE_TOKEN = '<token returned once by the creation endpoint>'
node --input-type=module -e "import { io } from 'socket.io-client'; const s = io('http://localhost:5050/shared-rides'); s.on('connect', () => s.emit('share:join', { token: process.env.DEMO_SHARE_TOKEN }, result => console.log(result.success ? result.data : result.error))); for (const name of ['share:location', 'share:ride-status', 'share:ended']) s.on(name, data => console.log(name, data)); s.on('connect_error', error => console.log(error.message));"
```

7. Use the existing assigned-driver Socket.IO client on the private root namespace to publish `driver:location:update` with the correct rideId. The trusted viewer receives only latitude, longitude and updatedAt in share:location. REST snapshot location now reflects the latest throttled ride-specific sample. No rider/driver contact information, private IDs, tokens or payment/OTP data appear.
8. Progress REST actions arriving, arrived and start. The trusted viewer sees safe share:ride-status events. The authenticated rider's existing private client continues receiving its original private events independently.
9. Complete the ride. The trusted viewer receives `{ reason: "ride_completed" }` in share:ended and loses room membership. The ride-specific persisted sample is cleared.
10. Try reopening via public REST, rejoining the current socket, or reconnecting with the old token: all active tracking attempts return 404 Shared ride unavailable. Moving the same driver on a later journey cannot reactivate the old link.
11. Demonstrate cancellation with another shareable pre-start ride: cancellation sends share:ended with reason ride_cancelled and immediately invalidates access.
12. Demonstrate manual revocation on a separate active ride: as owning rider, `DELETE /api/rides/{{rideId}}/share`. The viewer receives reason revoked. Public REST/rejoin fail immediately. DELETE is idempotent. To replace the link, POST again after revocation; the new token works and the old one remains invalid.
13. Demonstrate expiry by configuring `RIDE_SHARE_TTL_SECONDS=60` in a **temporary test/demo process environment**, not by exposing/changing real secrets; restart the demo process if changing configuration. After expiry, viewers receive reason expired and token access fails regardless of TTL cleanup. The default is 4 hours.

Adversarial demo: use a ride ID/user ID/hash/random string instead of a token (404); attempt another rider/driver creating or revoking (403); emit ride:join or driver:location:update on the public namespace (403); add rideId/room fields to share:join (404). A public namespace connection without a successful token join receives no tracking. Do not brute-force the running service; isolated automated tests cover request/join rate limits.

Stop terminal clients with Ctrl+C, clear the demo token process variable (`Remove-Item Env:DEMO_SHARE_TOKEN`), and revoke any still-active demo link. Tokens are bearer secrets: anyone holding a valid forwarded link can view this one journey until it ends, expires or is revoked. Already received snapshots/screenshots cannot be erased remotely.
