# RideCore Rider — Phase 1 report

27 October 2026. Scope: Project Foundation and Design System only.

Phase 1 is implemented and its source checks pass. Native APK compilation and device validation remain limited by the local Android environment. No Phase 2 functionality has begun.

## 1. Files and folders created

The previously empty `frontend/` now contains the Expo/React Native TypeScript application, original brand assets, design tokens, shared controls, typed navigation, structural screens, tests and configuration. All changes are confined to `frontend/`.

Entry/configuration files: `App.tsx`, `index.ts`, `app.config.ts`, `eas.json`, `babel.config.js`, `metro.config.js`, `eslint.config.js`, `jest.config.js`, `tsconfig.json`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `.prettierignore` and `.prettierrc.json`.

Assets: `brand-mark.svg`, `icon.png`, `adaptive-icon.png` and `splash.png`. Documentation: `README.md`, feature/service boundary notes, this report and `DEVICE_CHECKLIST.md`.

Generated/installed directories include `android/`, `dist/`, `.expo/` and `node_modules/`. These are ignored. Android uses Expo Continuous Native Generation; maintain native configuration through `app.config.ts` and plugins. No iOS native directory was generated on Windows.

## 2. Dependencies installed and why

The lockfile records exact resolutions. Native versions were checked against Expo SDK 58's bundled manifest and package peer requirements before installation. No forced or legacy-peer installation was used.

| Dependencies                                             | Selected versions         | Purpose                                                        |
| -------------------------------------------------------- | ------------------------- | -------------------------------------------------------------- |
| Expo, React, React Native                                | 58.0.20 / 19.3.0 / 0.88.0 | Native application runtime and SDK                             |
| `expo-dev-client`                                        | ~58.0.16                  | Custom native development build for Mapbox                     |
| `expo-splash-screen`                                     | ~58.0.11                  | Branded native startup and controlled dismissal                |
| `expo-status-bar`, `expo-system-ui`                      | ~58.0.4 / ~58.0.6         | Status-bar and native light-theme configuration                |
| React Navigation native / native-stack / bottom-tabs     | 7.5.1 / 7.21.0 / 7.21.0   | Typed root/auth stacks and future Rider tabs                   |
| `react-native-screens`, `react-native-safe-area-context` | ~4.30.0 / ~5.10.1         | Native screen integration and safe-area insets                 |
| Gesture Handler / Reanimated / Worklets                  | ~3.3.0 / 4.7.1 / 0.13.0   | Native gestures, animations and UI runtime                     |
| `@gorhom/bottom-sheet`                                   | 5.2.14                    | Gesture/keyboard-aware sheet foundation                        |
| `@rnmapbox/maps`                                         | 10.3.15                   | Native mapping SDK and Expo config plugin; no map rendered yet |
| `react-native-svg`, `lucide-react-native`                | 15.16.0 / 1.62.0          | Original vector mark and consistent outline icons              |
| TypeScript / React types / Jest types                    | ~6.0.3 / ~19.3.0 / 30.0.0 | Strict source and test typing                                  |
| Jest / Jest Expo                                         | 30.5.2 / ~58.0.12         | Test runner and Expo Android environment                       |
| React Native Testing Library / Test Renderer             | 14.1.0 / 1.3.1            | Behavioral component and navigation testing                    |
| ESLint / Expo lint config                                | 9.39.5 / ~58.0.4          | Compatible React/TypeScript lint rules                         |
| Babel core / Expo Babel preset                           | ^7 / ~58.0.0              | Explicit JSX/TypeScript transformation and Expo Worklets setup |
| Prettier                                                 | 3.9.10                    | Consistent source formatting                                   |

Mapbox defaults to native SDK 11.33.0. No native SDK override or credential was added. Lucide uses per-icon exports. Jest selects its real CommonJS exports, while Metro uses native ESM exports. Tests use the documented Reanimated resolver and Worklets mock; those changes apply only to Jest.

## 3. Final project structure

```text
Ridecore/
  backend/                         existing; untouched
  frontend/
    assets/                        original mark, icon, adaptive icon, splash
    docs/
      DEVICE_CHECKLIST.md
      PHASE_1_REPORT.md
    src/
      application/
        AppProviders.tsx
        AppErrorBoundary.tsx
      components/
        brand/BrandMark.tsx
        feedback/ConfirmationDialog.tsx
        layout/Screen.tsx
        sheets/AppSheet.tsx
        ui/
          Button.tsx
          Icon.tsx
          IconButton.tsx
          Input.tsx
          ListRow.tsx
          Loading.tsx
          StateMessage.tsx
          Text.tsx
      features/
        auth/screens/
          WelcomeScreen.tsx
          AuthPlaceholderScreen.tsx
        home/screens/HomeScreen.tsx
        activity/screens/ActivityScreen.tsx
        account/screens/AccountScreen.tsx
        README.md
      navigation/
        AuthNavigator.tsx
        RiderNavigator.tsx
        RootNavigator.tsx
        theme.ts
        types.ts
      services/README.md
      theme/tokens.ts
    tests/
      confirmation.test.tsx
      controls.test.tsx
      navigation.test.tsx
      resolver.cjs
      setup.ts
    App.tsx / index.ts
    app.config.ts / eas.json
    babel.config.js / metro.config.js
    eslint.config.js / jest.config.js / tsconfig.json
    package.json / package-lock.json
    README.md / .env.example / ignore and formatting files
    android/                       generated; ignored
    dist/                          verified Android export; ignored
    node_modules/ / .expo/         installed/generated; ignored
```

## 4. Design-system decisions

- Original evergreen `#125C46`, pressed `#0B4433`, soft accent `#E7F1EB`.
- Off-white canvas `#FAFBF8`, white surfaces, neutral fill `#F0F2EF`.
- Near-black text `#18201C`, secondary text `#59645D`, border `#D5DDD7`.
- Red `#B42332` is reserved for destructive actions and errors.
- Native system sans-serif; shared 36/28/22/16/14 type scale with explicit line heights and weights. Font scaling remains enabled; text heights are not fixed.
- Spacing: 4/8/12/16/24/32/48/64 dp. Radii: 8/12/16/28 dp and pill.
- Minimum touch target: 48 dp. Inputs: minimum 56 dp. Icons: 20/24/32 dp.
- Restrained floating/sheet elevation. System reduced motion is preserved by the sheet library. No artificial loading timer was introduced.

Reusable foundations include buttons, labelled inputs, icon buttons, text, loading indicators, list rows, empty/error presentation, confirmation dialogs, safe-area/keyboard-aware screens and a bottom-sheet wrapper. Controls expose disabled/busy states and accessible labels. Confirmation guards duplicate submission and prevents dismissal while pending.

The sheet wrapper supports dynamic sizing, safe-area spacing, close/backdrop dismissal, Android back handling, gestures and keyboard resize/restore. Future input fields within sheets should use Gorhom's `BottomSheetTextInput`. No completed booking or cancellation screen was introduced.

Brand assets are original. No competitor branding, artwork, exact green or screen was copied.

## 5. Navigation and application shell

Launch: native branded splash → first application layout → Welcome → structural Sign In or Create Account route. Back returns to Welcome. Account routes honestly state that access is not available yet; no credentials are collected.

The separate typed `RiderNavigator` connects Home, Activity and Account. It is not mounted in the real launch flow until Phase 2 provides a real session gate. Tests mount it directly; no user-facing bypass exists.

Providers include Gesture Handler, safe areas, a root error boundary, themed React Navigation, the bottom-sheet provider and status-bar control. `src/application` deliberately avoids Expo Router's `src/app` convention. This application uses explicit React Navigation.

There is no gallery, showcase, fake phone frame, developer landing page, screen selector, mocked login, fake user or ride progression. Application source contains no API/provider requests or simulated ride timers. No location prompt occurs. Authentication, maps, booking, payments, active rides, sharing and ratings remain later-phase work.

## 6. Testing and check results

| Check                     | Final result                                                            |
| ------------------------- | ----------------------------------------------------------------------- |
| TypeScript                | PASS; strict checks, no errors                                          |
| ESLint                    | PASS; no errors or warnings                                             |
| Automated tests           | PASS; **3 files, 15 passed, 0 failed**, Expo Android preset             |
| Formatting                | PASS; source and documentation formatted                                |
| Expo config loading       | PASS; correct identity and native plugins                               |
| `expo install --check`    | Dependencies up to date; offline mode limits this validation            |
| Expo Doctor               | 19/20 checks passed; online schema check blocked by TLS/network failure |
| Android prebuild          | PASS; final run has no missing-system-theme warning                     |
| Android production export | PASS; 1,616 modules, approximately 3.7 MB Hermes bytecode               |
| Development server        | PASS; status endpoint returned `packager-status:running` on 8081        |
| Backend fingerprints      | PASS; 70 files before/after, zero differences                           |

Tests cover entry/session gating boundaries, splash dismissal on layout, honest auth placeholders and back navigation, future Rider tabs, labelled controls, disabled/loading behavior, input feedback/editing, retry presentation, icon accessibility, informational rows and explicit/pending/duplicate confirmation behavior. They assert behavior rather than snapshots.

Native components are appropriately mocked in Jest. These tests do not validate actual GPU rendering, native Mapbox compilation or physical gestures. Existing backend tests were not rerun; no backend source, tests or configuration changed.

## 7. Build/run result

Native Android configuration generation and production Hermes JavaScript export succeeded. Expo's development server started normally, its HTTP status endpoint was verified, and the verification server was stopped. Per-icon imports reduced the initial 3,517-module/5.8 MB bundle to 1,616 modules/3.7 MB.

An Android development APK was **not compiled or installed**. The unrestricted run command found no connected device or launchable emulator. The configured Android tools location lacks SDK `platforms` and `build-tools`; it is not a complete SDK. Java 23 is installed; React Native recommends JDK 17. No SDK, JDK, emulator or cloud infrastructure was installed by this phase.

Mapbox is prepared for an Expo development build. It cannot run in Expo Go. No map, GPS, geocoding or routing feature was built. Shared code and iOS configuration remain cross-platform; iOS compilation/device verification was not performed on Windows.

## 8. Warnings and limitations

- **npm audit: 3 high-severity advisory entries remain unresolved**, in the Expo → Expo CLI → Zod chain. CLI 58.1.16 requires Zod `^3.25.76`; the reported advisory is [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). This must not be described as a clean security audit. No forced SDK downgrade or incompatible Zod major override was applied. Recheck upstream fixes before release.
- ESLint 9 is deprecated upstream, but Expo's installed React lint plugin declares compatibility through v9. It was retained for compatibility. npm also emitted transitive `inflight`, `glob` and `whatwg-encoding` deprecation warnings. Peer checks were not bypassed.
- Expo Doctor's online schema check could not complete because its Expo API TLS connection failed. Local config loading, native generation and bundling passed; rerun Doctor when connectivity is available.
- Native compilation, actual cold-start appearance, TalkBack, large fonts, Android keyboard behavior and physical sheet gestures remain unverified on a device. See `DEVICE_CHECKLIST.md`.
- Authentication and later-phase functionality are intentionally absent. No API contract changed. No driver ETA or fake lifecycle data is displayed.
- Package/bundle identifiers are provisional. EAS account/project, signing and cloud builds are not configured.

## 9. Local configuration needed

1. Install Android Studio and a full Android SDK with platforms, build-tools and emulator. Configure `ANDROID_HOME` to the actual SDK root, platform-tools on PATH and a compatible `JAVA_HOME` (React Native recommends JDK 17).
2. Start an emulator or connect a USB-debuggable Android device. From `frontend`, run `npm run android`, then `npm start` as needed. Backend port remains **5050**; Metro uses **8081**.
3. Alternatively, configure your own Expo/EAS account/project and use the development profile in `eas.json`. Choose a unique package/bundle identifier before distribution. No account connection or EAS project was created here.
4. Phase 1 needs no token or API URL. When mapping is approved, configure the public token locally as `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`; Expo does not read `VITE_MAPBOX_ACCESS_TOKEN`. Configure a device-reachable `EXPO_PUBLIC_API_URL` ending in `/api` on port 5050 when authentication integration begins.
5. `EXPO_PUBLIC_` values are embedded in the app. Private SDK-download credentials, if needed, belong only in build secrets such as `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`, never public variables or app config values. `.env.example` contains names and empty values only. No token was read, printed, hardcoded, recovered or copied. No `.env` was created.
6. Rerun Expo Doctor after resolving connectivity and review upstream dependency advisories before release.

## 10. Backend preservation

SHA-256 fingerprints of 70 existing backend files match the original baseline exactly, including configuration files without printing their contents. No routes, controllers, services, schemas, models, tests, business rules or backend environment files changed. Dependency installation occurred only in the frontend. No backend or driver lifecycle calls were added.

## 11. Phase 2 next — requires approval

Implement real password authentication, typed API errors, secure session storage, rider-role checks and startup/session restoration. Mount authenticated navigation only from server-backed session state. Reflect mocked OTP delivery honestly and preserve server authority for eventual active-ride recovery.

**Work stops after Phase 1. No Phase 2 implementation has begun. Awaiting approval.**
