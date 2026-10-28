# Running and demonstrating the real Rider journey

## Preparation

1. Keep backend port 5050 and existing private environment/MongoDB replica set.
   Configure existing CORS_ORIGIN to match the exact web preview/viewer origin,
   then restart the backend in its terminal. The running development backend now uses the matching preview origin without any environment-file change. No backend source change is needed.
2. In frontend, copy .env.example to .env only if absent. Configure the three
   EXPO_PUBLIC runtime names listed in README locally, never in documentation.
   The device must reach the API host; it must end in /api.
3. Run backend `npm run dev`; run frontend
   `npm start -- --web --clear --port 8081`. Restart Metro after environment changes.
4. Native: install the EAS development APK or run `npm run android` with a complete
   SDK/JDK/device. Run `npm start -- --lan` and open the development client.
   Expo Go does not include native Mapbox.
5. Serve web export at the reachable configured recipient origin for another
   device. Localhost on another phone is that phone. Release hosts need HTTPS.
   No hosting deployment was performed by this task.

## Actual user/API flow

1. Register a rider with required fields, confirm creation and explicitly sign in.
   Optional Account phone verification uses a server-provided simulated code;
   never expect SMS.
2. Choose Pickup and Destination through current GPS, search or map pins with
   readable landmarks. Get all three backend GMD estimates, choose a category,
   review and explicitly request. No driver is assigned merely by requesting.
3. Use a separate legitimate test driver session via existing backend APIs:
   register/login, PUT /drivers/profile, PUT /drivers/vehicle. Sign in as an actual
   admin; approve returned profile and vehicle IDs through
   PATCH /admin/drivers/:id/verification and
   PATCH /admin/vehicles/:id/verification with verificationStatus approved.
   Never put admin credentials into the rider application.
4. Driver: PATCH /drivers/location with its actual GeoJSON point; PATCH
   /drivers/availability with availabilityStatus online; GET /drivers/ride-requests.
   Accept the compatible nearby request using PATCH /rides/:id/accept.
5. Driver: PATCH /rides/:id/arriving, /arrived, /start, /complete in that order.
   Observe each Rider sheet state. Actual driver sockets may send
   driver:location:update with rideId, latitude and longitude. No automatic fake
   movement loop or rider-side driver controls exist.
6. Before start, test rider cancellation with a reason/confirmation. No fee exists;
   cancellation is unavailable once started.
7. After acceptance, open Safety and sharing; create/share a link. Open it in a
   separate browser without rider authentication. Compare actual status/location,
   revoke and confirm data disappears. Expiry and ride end also terminate sharing.
   Existing capabilities cannot be recovered after leaving/restarting; revoke an
   existing share before generating another if necessary.
8. After real driver completion, review final fare and record cash or mock-wallet
   simulation. Repeat the same method to verify idempotency; another method
   conflicts. No real funds or external payment gateway are involved.
9. Submit an integer 1?5 rating and optional comment. Reload Activity/detail to
   confirm existing payment/rating. History preserves actual currency and status.
10. Test offline/reconnect and background/foreground restoration. Sign out during
    an active ride, then sign back in: backend ride state must be unchanged.

## Repeatable isolated verification

From frontend run `npm run verify:backend-contract` and `npm run verify:rider`.
The second executes 13 actual mobile/backend HTTP/socket checks, using disposable
MongoDB data and test-only driver/admin actions. Neither script uses the real
backend environment/database. This does not certify native GPS, live Mapbox
account access or physical-device UI; those require the checklist and configuration.
