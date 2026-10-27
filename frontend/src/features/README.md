# Feature boundaries

Authentication and session restoration are implemented in Phase 2. Home/Activity remain structural; Account contains only identity, optional phone verification and local sign-out needed by authentication.

The server is authoritative for role, account status and ride state. The session controller fetches and retains the real active ride without presenting a map, simulating progression or calling driver lifecycle endpoints. Booking, map/location, realtime, sharing, payments and ratings require their approved later phases.
