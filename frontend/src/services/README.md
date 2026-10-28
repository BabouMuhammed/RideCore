# Integration boundaries

`api.ts` owns cancellable, bounded HTTP transport and existing auth contracts.
`journey-api.ts` adds typed rider estimates, creation, detail/history, cancellation,
sharing/public snapshots, simulated payments and ratings. No driver transitions.

Native credential-store.ts retains device-only Expo SecureStore. The .web.ts
adapter uses localStorage for development/UI review only. Neither grants identity;
SessionController validates credentials and role through the backend.

`mapbox.ts` supplies permanent geocoding and planned street geometry. Coordinates
remain internal; backend fares are authoritative. `realtime.ts` authenticates
Socket.IO, rejoins rooms and forwards validated location samples/status hints.
Controllers reconcile ride status through REST, with regular fallback polling.

Public sharing uses a separate read-only namespace/snapshot without rider JWTs.
Share capabilities are transient and never written to credential storage.
