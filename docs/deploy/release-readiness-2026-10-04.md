# AisMebel release readiness — 2026-10-04

Scope: local repair and acceptance preparation for `claude/integration-0928` at
`c0b5448619f977d66e5dd2b6fa0e2c1e09a0a50d`. No deployment, remote write,
account change, payment, or live database migration was performed.

## Release decision

**Not yet approved for production or as a drop-in PRO100 replacement.** The
repair branch closes reproducible export defects and adds protections against
incomplete imported manufacturing data. Real-browser, PostgreSQL and workshop
acceptance are still required. Passing unit tests is not proof that a designer
can complete a production job comfortably or that a machine will cut it correctly.

## Repairs and evidence

| Area | Change | Automated evidence |
|---|---|---|
| B3D hardware precision | Preserve drill diameter/depth to 0.1 mm, including 2.8 and 11.5. Saved v4 boards accept that precision. Board dimensions and panel-edge offsets remain integer millimetres. | `basisManufacturingSafety`, `projectV4`, existing `basisB3d` tests |
| Incomplete B3D geometry | Persist a manufacturing block on every board of an import with loss/unsupported-operation warnings. Save/reopen and flattening retain it. CSV/XLSX/DXF/CNC/Bazis, manufacturing PDFs, labels and nesting reject those panels before producing a handoff. Preview panels remain available. Arc/circle polygonization and rounded hole coordinates warn and block; four-corner trapezoids retain their real outline. Both CLI commands preflight the entire scene before production output/files. | Real sink-cabinet fixture: 10 preview panels retained; missing groove blocks all manufacturing paths, including individual selected parts |
| Export feedback | Catch download/export rejection, clear busy state, notify the host and display an accessible alert in both inline and standalone menus. Retry clears both local and persistent host errors, including after menu close/reopen. RU/KK/EN/UZ fallback text is supplied. | `exportMenuErrors`: actual component callbacks with mocked state/transport; not a browser test |
| CI | Verification runs on pushes to all branches. Image publication and deployment remain manual; production branch restriction was not widened. | `deployWorkflow` assertions |
| CLI regression harness | Use `process.execPath --import tsx`, already used by other CLI tests, instead of the tsx executable's optional IPC listener. Assertions and expected exit codes remain unchanged. | `basisAudit`, `cliV4` |
| PostgreSQL schema drift | Add migration 005 for `shop_catalog_images`, `render_history`, and `password_resets`. Existing migration files are unchanged. | `postgresSchemaParity` compares initialized SQLite tables to migration declarations; live PostgreSQL still required |
| SQLite → PostgreSQL copy | Copy newer feature, audit, metric and job tables; reject unrecognized source tables rather than silently discarding them; advance bigserial sequences after explicit IDs are copied. | `sqliteMigrationCoverage` uses a real temporary SQLite database and a mocked PostgreSQL transport; not a PostgreSQL integration pass |
| Privacy accuracy | Describe the implemented offline queue and automatic server sync when the full online version is opened under an authenticated workshop account. | `privacySyncDisclosure`, source comparison with `native/NativeMeasurementApp.tsx` and `docs/mobile/hybrid.md` |

The B3D repair **does not implement groove decoding**, manufacture missing
geometry, or provide an “accept the warning and export anyway” override. Keep
the original source file and rebuild/verify unsupported operations before using
that model for production. B3D is currently a core import API, not a wired
Workspace import command. Warnings identify known importer losses; this is not
certification of every proprietary B3D feature or every untested source file.
The marker is forward-only: older saved v4/library imports have no loss
provenance and may already contain rounded or missing geometry. Reimport
from the original B3D with the repaired importer, or independently verify
manufacturing geometry; reopening an old project alone does not repair it.

### Verification record

Final repaired-code verification used **Node 22.23.3**, matching the CI major:

- Full suite: **3,444 passed, zero failed, six PostgreSQL-dependent checks
  skipped**; 529 files passed, four files skipped; 231.95 seconds.
- TypeScript no-emit check: passed.
- Next.js production build: passed, including its type check and prerendering.
- Native offline Vite build: passed. Existing JSX-extension/module-directive
  bundler warnings remain; this is not an Android/iOS device acceptance pass.
- Actual CLI exports for `wardrobe`, `wardrobe-3section` and `wardrobe-v1`:
  passed, generating DXF, CSV drilling/cut lists, XLSX and assembly PDFs.
- `git diff --check`: clean. Original QA checkout and its evidence are unchanged.

The tests were run without the cloud environment's `NODE_USE_ENV_PROXY=1`
auto-initialization: Node 22 otherwise emits an experimental proxy-agent
startup warning into an exact-stderr CLI assertion. No product error assertion
was removed. HTTP/HTTPS proxy configuration was retained for the build's font
fetches. An initial Turbopack attempt rejected an out-of-root dependency symlink;
dependencies were materialized inside the worktree. An overlapping build was
OS-killed; the final checks above ran serially and all completed with exit 0.

Original QA remains separate: 3,422 passing tests, five restricted tsx IPC
subprocess failures and six PostgreSQL skips. The patch uses the supported
`node --import tsx` subprocess invocation to remove those IPC-only failures.

No lint script is configured. Type checking, Next production build and native
offline build are separate checks, not substitutes for UI acceptance.

## Remaining engineering and operational gates

### 1. Authorized real-browser acceptance

The cloud browser rejected the local preview with `ERR_BLOCKED_BY_CLIENT` and
an explicit URL security-policy rejection. It was not bypassed with another
browser, proxy or socket route. Resume only in an approved available executor
or an authorized accessible staging deployment.

Run the scenarios below at desktop, narrow mobile and a representative
low-powered workshop device. Record screenshots, browser/OS, viewport,
console errors, click count, elapsed time and wrong turns. Do not report
unmeasured values as zero or claim screenshots were checked when only source
and DOM-free tests were run.

### 2. PostgreSQL before any database switch

The current compatibility adapter in `lib/server/postgres.ts` synchronously
waits on a worker with `Atomics.wait`. A 250 ms fake-worker query delayed a
10 ms main-thread timer by roughly 283 ms in the original QA probe. This is a
reproduced event-loop stall, not a production throughput measurement. Migration
005 fixes missing tables; it does not fix this architecture.

Safe path:

1. Keep the current production database choice unchanged while validating a
   separate staging PostgreSQL 16 instance. Do not point tests at production.
2. Back up SQLite and objects at one write-stopped recovery point. Restore to
   an isolated test location and verify record counts and file hashes.
3. Run migration 005 plus the full server tests under a disposable
   `DATABASE_URL`/`PG_TEST_SCHEMA_PREFIX`. Exercise password reset, render
   history, catalog image ownership, project organization, background jobs,
   permissions, multi-user isolation, and backup/restore. Compare binary data
   and foreign keys, not only row counts.
4. Test copied audit/metric/error IDs, then insert new records to prove their
   sequences no longer collide. Try a nonempty target and an unknown source
   table; both must refuse the migration without losing data.
5. Plan the asynchronous replacement as a separate reviewed change: typed
   promise-based repository/service interfaces; awaited routes and workers;
   a dedicated pooled client per transaction; equivalent SQLite test adapter;
   no transaction spread over unrelated clients. Convert a vertical slice,
   then auth/session, project, permissions, share and job paths. Do not merely
   add `async` to `PostgresCompat` while callers still expect immediate rows.
6. Verify concurrency, rollback, timeout, dropped connections and long-query
   behavior. A timer/health request must remain responsive during a delayed
   query. Choose load/latency budgets from the intended pilot workload.
7. Only switch after a tested rollback plan, restore point, migration report
   and owner approval. Never silently reattach an old SQLite file after new
   PostgreSQL writes; those writes would disappear.

The process also performs synchronous password hashing. Include login bursts
in capacity testing. No security configuration or hashing behavior was changed
in this repair.

### 3. Owner-provided release inputs

- Choose the first release surface and audience: web pilot, Android closed
  test, or full public web launch. These are different acceptance gates.
- Supply the real operator/business contact, approved retention/deletion
  policy and support process. `/privacy` still explicitly marks these as
  required. Decide how account, project, photo, log and backup deletion works.
- Confirm final public domain, staging domain and HTTPS; set the approved
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `APP_URL` and, for
  native builds, `AISMEBEL_APP_URL`. Switching native origin can strand an
  unsent IndexedDB queue; migrate/sync before changing origins.
- Select durable database/object storage, backup destination, retention,
  monitoring recipient, recovery owner and capacity target. The Swarm disk
  configuration expects a shared volume on one host; multiple hosts require
  a genuinely shared object store.
- Configure SMTP privately and test reset delivery. Without complete SMTP
  settings the current code writes reset links to the server log, so it is
  not a complete self-service recovery setup for a public launch.
- Approve real shop materials, article-specific hardware drilling, edge-band
  rules, taxes/discounts, prices and customer-facing tariffs. Seed prices are
  deliberately zero; `lib/site.ts` labels public tariff amounts as
  placeholders. Do not invent commercial prices or manufacture with sample
  hardware articles.
- For Android/iOS: decide package/bundle IDs, developer accounts, countries,
  signing custody and store disclosures. Test camera, keyboard measurement,
  offline restart, sync, downloads and permission interruption on real
  devices. A native HTML build is not a signed store package.
- Decide the protected release branch and required CI/reviewer policy. The
  current workflow's manual deployment still refers to `main`; do not widen
  it or deploy an integration branch without an explicit release decision.

## PRO100 familiarity acceptance

The user's goal is a familiar, efficient professional furniture workflow with
AisMebel's own identity. Do not replace this with an unverified percentage of
feature-name matches or copy ECRU branding/screenshots.

ECRU's official [capabilities overview](https://www.ecru.pl/en/possibilities)
centres on arranging parts, their properties, immediate updates across views,
pricing and production reports. Its [v7 overview](https://www.ecru.pl/en/pro100-v-7)
adds layers, annotations, camera/material management and keyboard/mouse
workflows. [Nowy Rozkrój](https://www.ecru.pl/en/nowy-rozkroj) is the associated
cut-optimization product. These sources guide the scenarios; they do not prove
AisMebel's UX matches them.

| Scenario | Acceptance task and evidence to collect | Current source/test coverage |
|---|---|---|
| Room creation | Enter 2700 (H) × 4200 (W) × 3000 (D), add a door/window/obstacle, switch plan/3D and revisit Properties. Values must persist exactly, selected object stays identifiable, and Cancel/Escape makes no edit. | `room`, `roomOpenings`, `f12Room*`, room store tests; interactive pass pending |
| Exact cabinet construction | Open reference 2000 (H) × 600 (W) × 450 (D) wardrobe, inspect sections/fronts/back, edit one dimension and restore it. Confirm 11 reference panels and agreement between ready dimensions, cut dimensions, edge bands and drawings. Match construction/settings before comparing with PRO100. | `generateCabinet`, `edges`, `projectProduction`, existing numeric reference tests |
| Part selection/copy/alignment | Pick a part in 3D and tree; multi-select, copy, group, align and distribute; verify exact numeric positions and one-step undo. Test nested groups, locked/hidden parts and deleting a selection. Record clicks, discovery problems and required mouse travel. | `treeEditing`, `treeArrange`, `align`, structure tests; visual hit-testing pending |
| Material editing | Change one part, then a group; set grain, rotate texture where supported, change edge band and article. Verify only intended objects change and cut dimensions/price recalculate. Test a missing or removed material. | `replaceMaterial`, `materialCloneStore`, `f14Material*`, `shopDrilling` |
| Undo/save/reopen | Perform geometry, material and price edits; undo/redo, save, reopen and compare canonical project, selections and manufacturing output. Interrupt save, exceed local quota, simulate stale tab and cloud conflict; do not lose the last valid project. | `v4RiskHistory`, `treeHistoryProperties`, `f22Undo`, `f24LocalSave`, `cloudProjectPersistence` |
| Quotation | Use approved KZT shop rates. Verify minor-unit arithmetic, totals, discount/tax assumptions, missing-price warnings, client PDF and quote scope. Do not show zero seed prices as a real offer. | `pricing`, `quoteExport`, `quotePresentation`, price override tests |
| Manufacturing handoff | Export complete CSV/XLSX/DXF/CNC and PDF for a matched shop fixture; inspect dimensions, opposite faces, edge drilling and labels. Import the missing-groove fixture and verify a visible block. Have an operator inspect the generated files and produce a measured sample. | Core exporters and new import-safety tests; actual target software/machine acceptance pending |
| Keyboard and interruption | Test Ctrl/Cmd+N/O/S/Z/Y, typing focus, Escape, reopened dialogs, Back/Forward and repeated clicks. Verify native/browser-reserved keys. Compare axis constraints with the user's PRO100 habits before remapping. | `lib/hotkeys.ts` and shortcut tests; browser interception not measured |
| Performance | Replay the same room and 100-cabinet job on the same target machine in both products. Measure selection/drag/property latency, first load, save/reopen and export; capture long tasks and rendering frame rate. | Core-only baseline: 200 varied cases and a 1,100-panel nesting batch; this says nothing about GPU/viewport smoothness |

Notable familiarity risks to validate: ECRU describes camera shortcuts and axis
movement; AisMebel currently documents numeric view presets and `X` for drill
X-ray. Different contexts may resolve the apparent collision, so test before
changing shortcuts. The committed PRO100 scenario-1 fixture also uses a
different construction from AisMebel's template: unequal part counts/areas are
not evidence of parity or automatically a defect. Rebuild an identical
construction in both tools for a meaningful comparison.

### Kazakhstan-focused strengths and checks

Code supports Russian/Kazakh UI, KZT/tiyn integer pricing, shop-specific sheet,
edge and hardware settings, Cyrillic export names, quote details, offline
measurement and seller-provided Kaspi links. These are useful potential
advantages, not a verified claim of superiority. Keep Kazakh-specific letters
through UTF-8/PDF and verify font rendering; the CP1251 Bazis export explicitly
cannot represent every Kazakh letter. Check real shop terminology with an
experienced local designer. Kaspi handoff does not itself verify payment or
issue a fiscal receipt. No financial, tax or compliance certification is
implied by these code features.
