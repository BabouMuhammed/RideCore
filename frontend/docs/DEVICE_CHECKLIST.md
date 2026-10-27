# Device smoke checks through Phase 2

These are pending native-device checks, not claims of automated coverage.

- Build/install a new Android development client including SecureStore. Configure a device-reachable API URL; backend port remains 5050.
- Cold launch: original native RideCore splash, genuine loading/bootstrap and the correct auth/session state. No gallery, screen selector, fake phone frame or authenticated bypass.
- Register a synthetic rider using required fields. Success must confirm account creation and lead to sign-in; it must not open authenticated tabs automatically.
- Sign in by email and by the same canonical Gambian phone identity. Check seven-digit and migrated nine-digit formats, neutral placeholders and the separate +220 prefix.
- Verify password visibility, keyboard next/done focus, small displays, font scaling and TalkBack. System bars/cutouts must not obscure 48dp controls.
- Restart with a stored credential: loading, server identity validation, actual ride-list/detail discovery, then Rider Home.
- Offline restart must preserve the credential and offer retry. Invalid/expired server authentication must clear the credential and return to authentication.
- Drivers/admins/unsupported roles must not enter Rider tabs.
- Optional OTP must clearly describe simulated delivery, mask the registered number and respect six digits, expiry, cooldown and server errors. Do not expect an SMS. Verification is not a booking gate.
- Sign out with an active ride; restart must show authentication while the backend ride remains unchanged. Failed secure deletion must show retry, not a false success.
- Actual Mapbox/native SDK compilation, rendering and physical device behavior remain unverified until a native build runs. No map/location feature is expected in Phase 2.
- Sheet drag/backdrop/back/keyboard/reduced-motion behavior should be validated when those sheets are connected in their approved feature phase. No preview route is added for this checklist.

iOS compilation/device verification is separate; shared code and configuration remain cross-platform. No backend changes are needed for these checks.
