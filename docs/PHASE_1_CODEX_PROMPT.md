# Phase 1 Codex prompt — audit and evidence only

Copy the complete prompt below into the next Codex audit session. The companion `docs/FUNCTIONALITY_AUDIT.md` contains this review's findings and baseline command results; treat them as evidence to check, not instructions to assume runtime success.

---

You are auditing the existing RideCore final-year project in `C:/Users/m/Desktop/Ridecore`. Work as a senior full-stack reviewer. Complete **Phase 1 only: repository audit, requirements traceability and a reviewable implementation plan**. Do not redesign, implement feature phases, change authentication/booking/payment contracts, seed a configured database, deploy, commit or push. Do not generate all later implementation prompts.

## Establish scope and preserve the baseline

1. Read applicable `AGENTS.md` files and inspect `git status`, current commit, remote and relevant diff before any work. Preserve user changes. Re-read package manifests and actual files rather than assuming architecture from this prompt.
2. Read the attached full functionality brief if available, `docs/FUNCTIONALITY_AUDIT.md`, existing backend/frontend reports, API documentation and device checklist. Historical reports/test counts are not current proof.
3. Read the university proposal at `C:/Users/m/Downloads/RideCore_Project_Proposal.docx` (same-basename PDF also exists). Confirm title/version and cite section numbers. If unavailable, search the repository/known attachment locations and relevant connected source; record the missing requirement reference and request it without inventing its contents. Do not browse unrelated personal files.
4. Limit tracked edits to documentation under `docs/` and explicitly named test-evidence reports. Running existing checks may generate ignored verification/build files. Do not fix source/scripts just to improve baseline results. Document the smallest proposed repair instead.

## Inspect the real architecture and all feature paths

Inspect these paths and their imports, tests and callers. Paths are starting points, not permission to ignore other relevant modules:

- `backend/src/app.js`, `server.js`, `http-server.js`, `config/*`, `routes/*`, `controllers/*`, `middleware/*`, `models/*`, `services/*`, `realtime/*`, `scripts/create-admin.js`, `scripts/seed-dev.js`, `tests/*`.
- `frontend/App.tsx`, `src/application/*`, `navigation/*`, `features/session/*`, `features/auth/*`, `features/home/*`, `features/map/*`, `features/journey/*`, `features/driver/*`, `features/sharing/*`, `features/receipt/*`, `features/account/*`, `features/activity/*`, `services/*`, `demo/*`, `components/sheets/*`, `tests/*`, `scripts/*`, `app.config.ts`, `eas.json`.

Document actual language/framework/database, startup/index/transaction requirements, API envelopes, identifier/coordinate/unit/currency conventions, legal ride states, ownership rules, auth/session expiry, configuration boundaries and how frontend/backend realtime and REST reconcile.

Trace driver registration → licence/profile → vehicle → separate approvals → location → online → nearby projection → compatible ride request → acceptance → busy → lifecycle → offline. Distinguish mock phone verification, administrative eligibility and full document KYC. Determine from code and isolated execution whether actual eligibility checks are enforced; do not assume current seeded records are approved/nearby.

Trace rider Home and Services entries, destination/pickup text and map selection, GPS denial, address editing/result consistency, route metrics, category estimates/supply, confirmation, duplicate-request prevention, recovery, cancellation, receipt/payment and two-way ratings.

Trace sharing create/revoke, hash/expiry/ownership, public REST projection, separate public namespace, terminal-state cleanup, recipient bootstrap isolation, timestamp/stale handling, native/web copy/share, configuration/reachability and restart recovery. Reuse existing sharing infrastructure in future recommendations rather than proposing duplicate token systems.

Check saved-place persistence/CRUD/privacy, real-history recents, popular-place geocoding and demo boundaries. Inspect every visible action in relevant screens: name whether it calls a real operation, is informational, is disabled with explanation or is misleading/decorative.

Verify specifically these existing review leads, marking the evidence level honestly:

- Admin APIs exist, while frontend role guards/types/navigation do not provide an admin app.
- Backend accepts `suspended` driver/vehicle approval, but driver frontend parser/status UI omit it.
- Nearby polling conflates failed/loading queries with confirmed empty supply; backend eligibility lacks a coordinate freshness cutoff.
- Services category entry follows a different booking entry path from Where to.
- Address search results/pending requests can remain associated with old query text after edits.
- Server fare is straight-line based; visible route metrics are road based. This is disclosed; do not label it an arithmetic defect without evidence or rewrite tariffs.
- Payment preference before booking and saved Home/Work persistence are absent; simulated post-trip payment and sharing already exist.
- Admin lists are page-limited; aggregate dashboard counts cannot be taken from one page.
- Development seed uses the configured development database; an explicit isolated demonstration boundary is needed.
- `verify:rider` may fail before scenarios because its transpilation list omits `server-config`. Inspect both verification scripts and native dependencies before recommending a harness repair.

## Execute and classify evidence

1. Run existing backend and frontend suites using package scripts and record exit status, counts, failures and durations. Run frontend typecheck. Use command output from this session; never repeat Claude's historical pass count as new proof.
2. Inspect integration scripts before running. Execute `npm run verify:backend-contract` and `npm run verify:rider` only against their disposable backend/database design. Never load real `.env` credentials into a new test harness or expose them in output. A harness failure is distinct from a feature failure; stop that scenario and report exact safe diagnostics.
3. Run browser interaction checks if a browser runner is already available. Prefer `backend/tests/browser-server.js` (explicit `NODE_ENV=test` and `RIDECORE_BROWSER_TEST=1`) or an equivalent isolated harness. Inspect ports/origins before starting services; do not terminate unrelated running processes or install unnecessary dependencies. Any background PowerShell helper must launch hidden. Avoid changing persisted runtime configuration just to connect the test UI.
4. Use a phone-sized viewport for actual UI interaction, with separate rider/driver/admin contexts and a public unauthenticated sharing recipient. Record console/network/API evidence without credentials. Browser emulation is not physical iOS/Android testing.
5. Exercise permission denial, manual text/pin booking, request uncertainty/duplicate taps, eligibility exclusions, role denial, ride restoration and sharing revocation/expiry/end wherever practical. Record geocoder/tile/router failures separately from backend failures.
6. If device tooling, native build, map access or a valid running harness is unavailable, classify those scenarios as **not executed** and supply precise manual steps. Passing unit tests alone never establishes the complete flow.
7. Do not mutate live users, approve real applicants, send messages, record payments in a real DB, reset data, deploy or add fake live-driver records. Use explicitly labeled disposable accounts/locations only inside the isolated scenario.

## Deliverables

Create/update `docs/FUNCTIONALITY_AUDIT.md` with:

1. Baseline commit/worktree and actual architecture inventory.
2. Feature table covering feature, existing implementation, working/broken/partial/unverified status, missing functionality, verified root cause or hypothesis, required change, priority, files and exact endpoints.
3. Evidence register linking each important conclusion to code, executed scenario or explicit limitation; separate user reports, historical reports and current results.
4. Dependency order prioritizing reproducible driver eligibility and end-to-end booking before visual polish. Admin approval must unblock human operation without requiring an analytics rebuild first.
5. Proposal traceability: Express/MongoDB/Socket.IO versus NestJS/PostgreSQL/Redis; simulated post-trip cash/wallet versus provider/webhook requirements; missing SOS and surge; basic approval versus excluded document KYC; mobile frontend expansion; Leaflet versus MapLibre; foreground tracking/manual driver acceptance limitations. Recommend documentation/scope decisions without migrating working technology.
6. An executable scenario matrix covering authentication/roles, both approvals, online/offline/location/radius/category/busy/freshness, pickup/destination/GPS/text/pin, estimates/booking/restore, driver transitions/cancellation/payment/ratings, public sharing/revoke/expiry/end and saved places/recents.
7. Actual commands/results, failed checks, unexecuted devices/services, manual testing instructions and a short delivery record listing files changed, DB/API/test changes (none if none), risks, limitations and commit reference only if one was explicitly authorized and created.

Provide only a short next-phase scope recommendation. Do not implement it or produce all later prompts. Stop at the Phase 1 review boundary because the user explicitly asked to execute, test and approve phases individually.

## Acceptance criteria

- Audit describes the actual repository and original proposal, with no invented APIs, missing-feature assumptions or unverified success claims.
- Each reported issue has an evidence label and a traceable source; nearby-driver absence is not called a backend defect merely because no eligible account was present.
- Admin access, approval relationships, suspended-state mismatch, freshness/error states, booking entry differences, payment preference, sharing and saved-place status are explicitly resolved or marked unverified.
- Existing tests are actually attempted and results reported accurately, including harness failures before scenario execution.
- At least one concrete isolated full-stack reproduction is recorded if runnable; otherwise exact blockers and manual reproduction instructions are recorded without asserting that lifecycle works.
- Requirements differences are documented without silently adding KYC, migrating stacks, claiming real payments/SOS or fabricating movement/metrics/history.
- No feature code, auth/payment/booking contracts, user data or deployment state is changed. Documentation diff is reviewable and no later phase starts before the user's review.

Return the most important findings first, link the audit, summarize current test evidence and name the proposed next phase and its review gate.
