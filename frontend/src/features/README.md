# Rider feature boundaries

- auth/session: existing password auth, Gambia numbers, optional mock OTP and
  server-validated startup/local logout.
- map: MapLibre with OpenStreetMap tiles (native and web adapters), foreground permission, address/landmark
  search, current-location selection and pins.
- journey: authoritative controller/provider, state labels, contextual cancellation.
- home: persistent map and state-dependent booking/active/completion sheet.
- sharing: share/revoke and a separate unauthenticated recipient branch.
- receipt: completed-trip simulated payments and ratings.
- activity: actual latest history/detail and receipt recovery.
- account: real identity, optional verification and local logout only.

States are reached through authentication, actions, links and backend responses.
There is no gallery, screen selector, fake driver or synthetic ride progression.
