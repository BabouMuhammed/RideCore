# Implementation history

The latest [final backend audit](final-backend-audit.md) supersedes this earlier phase report. Nearby discovery, Socket.IO, mock OTP and secure temporary Share My Ride have since been implemented; references below to their deferral describe the previous baseline.

# Backend implementation report

The later [final backend audit](final-backend-audit.md) records the complete contract freeze review, 29 added tests and two regression fixes.

## Delivered

The existing backend was extended in place into a modular Express 5 REST API. MongoDB connects before HTTP startup, and the health endpoint retains its original message with database status added. The implementation includes rider/driver registration, JWT login and current user, driver onboarding and approval, location/availability, transactional ride workflows, configurable fare estimates, simulated payments, two-way ratings, and protected administration.

The six models are User, DriverProfile, Vehicle, Ride, Payment, and Rating. Separate model files and shared persistence helpers keep these independent of workflow services. The full folder structure is in [README](../README.md#architecture-and-layout).

All API endpoints and their roles, input shapes, and state rules are documented in [api.md](api.md). They cover `/api/health`, `/api/auth/*`, `/api/drivers/*`, `/api/rides/*`, and `/api/admin/*`. Driver profile and vehicle onboarding endpoints and an explicit admin provisioning CLI make the end-to-end flow demonstrable without editing database records by hand.

## Security controls

- Bcrypt cost 12; password hashes excluded from JSON and ordinary queries.
- Two-hour JWTs with verified algorithm, issuer, audience, and active account checks.
- Strict boundary validation, normalized email/international phone, and ObjectId checks.
- Role/ownership checks; public registration cannot create administrators.
- Helmet, restricted browser origin, body limits, per-IP API/auth rate limiting.
- Safe JSON errors, no production stacks, no request bodies/tokens/URIs in HTTP logs.
- Unique partial active-ride indexes, conditional transitions, and MongoDB transactions.
- Unique payment-per-ride and rating-per-reviewer indexes with safe concurrency handling.
- Environment validation, safe startup failure, and shutdown handling.

## Validation

**Previous baseline `npm test`: 107 passed, 0 failed across 5 test files.** The suite was rerun successfully during follow-up verification. The suite uses Vitest, Supertest, and an isolated real MongoDB replica set, including concurrent acceptance, ride creation, payments, rating aggregates, and administrative/onboarding conflicts. Atlas was not used for integration testing. Earlier targeted runs passed 9 foundation/pricing tests, 23 authentication/driver tests, and 41 ride/payment/rating/admin tests before additional concurrency coverage was added.

Source syntax checks passed for all 26 application/script files, formatting checks passed, and the installed dependency tree was valid.

Dependency installation reported zero known vulnerabilities at the time of implementation. This is not a substitute for deployment security review.

## Warnings and configuration required

The latest environment validation passed, including `JWT_SECRET`, with port 5050. The existing `.env` was preserved without modification. MongoDB credentials were not changed or exposed.

MongoDB transactions require Atlas or a replica set. Tests use this machine's installed MongoDB 8.2.1 executable; on another machine, supply `MONGOMS_SYSTEM_BINARY` or allow the test runner to download its test binary. The initial sandbox/download setup failures were resolved by using the installed executable; they were infrastructure setup failures, not removed tests.

Live verification connected successfully to the configured Atlas cluster. The API already running on port 5050 returned HTTP 200 with database status connected. A second server correctly exited with code 1 because the port was occupied; its startup log was corrected to announce readiness only after the listening event. No live demonstration records or admin account were created. Provision the admin explicitly using the documented CLI when ready to demonstrate.

## Assumptions and remaining scope

All requested MVP domains are implemented. The following deliberate limitations remain:

- Pricing uses Haversine straight-line distance, a fixed speed, GBP, configurable vehicle multipliers, and final fare equal to the estimate; no road routing/traffic provider.
- Payments only record simulated cash/mock-wallet settlement; no real money, cards, balance enforcement, refund endpoints, or provider integration.
- Driver verification is manual academic review of submitted license/vehicle fields; no external document validation.
- Email/SMS verification, password reset, token refresh/revocation lists, real-time tracking, frontend, and automatic dispatch are deferred.
- Nearby discovery is prepared as a geospatial service; request discovery currently lists up to 50 matching vehicle-type requests without proximity filtering.
- Rate limiting is process-local. Admin lists paginate; personal ride history and request lists cap results at 50 without pagination cursors.
- Active rides block user suspension and driver/vehicle re-verification. Cancellation is allowed only before the ride starts. Completion/cancellation leaves the driver offline until explicitly enabled again.

## Run and demonstrate

```powershell
cd C:\Users\m\Desktop\Ridecore\backend
npm run dev
```

Use `npm start` to run without Nodemon. The latest local environment validation passed. [demo.md](demo.md) contains the complete Postman flow: rider and driver registration/login, driver license and vehicle submission, admin creation/approval, location and online status, ride estimation/request/acceptance/progression/completion, simulated payment, and ratings from both participants.
