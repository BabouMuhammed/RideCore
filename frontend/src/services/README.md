# Integration boundary

Phase 2 implements typed API transport, sanitized errors and the encrypted credential adapter. Screens consume these contracts through the session controller; they do not manage JWTs or invent server authority.

Supported methods are registration, password login, identity, ride list/detail recovery and authenticated OTP request/verification. No driver, booking mutation, payment, rating, socket or Mapbox service is implemented here. Future adapters remain separate.
