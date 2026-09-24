# Roles and Client Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Give owner, designer, shop and client explicit server-enforced access, keep internal prices out of client shares, and let clients comment on shared projects.

**Architecture:** A pure permission matrix decides capabilities. SQLite stores member roles and comments. Authenticated routes check roles before data access; anonymous share routes expose a stripped public project and bounded comment operations. A small viewer comment panel and designer inbox consume those APIs.

**Tech Stack:** Next.js route handlers, node:sqlite, Zod, React, Vitest.

**Spec:** `PHASE-2.md` B3/C3 and `docs/pro100/parity.md` §2.9. Billing/provider expansion of B3 is outside this requested role/comment slice.

## Global Constraints

- Client sees 3D, materials, manually quoted sale price and comments, but never dimensions/cut list, costs, purchase rates, coefficient or markup.
- Project schema remains a core concern; v4 migration agent changes parser call sites independently.
- Error responses for malformed requests are bounded 4xx and disclose no trace or internal path.
- No dependency additions, no build/dev/e2e in this worktree; root runs integration.

## Review Focus

- Anonymous share data leaks through encoded hash or JSON API.
- Shop role mutates project/profile or accesses internal pricing.
- Cross-shop access through member/project ids.
- Expired or malformed share code permits comments or throws 500.
- HTML/script text in comments is rendered as text, and oversized input is refused.

### Task 1: Role matrix and member persistence

**Files:** `lib/permissions.ts`, `lib/server/db.ts`, `lib/server/auth.ts`, `lib/server/team.ts`, `app/api/team/*`, `tests/roles.test.ts`.

**Interfaces:** `Role`, `can(role, action)`, `Account.role`, `setMemberRole(shopId, actor, target, role)`.

- [x] Add table-driven RED tests for all four roles and migration of existing founders/members.
- [x] Add pure matrix, role column migration, account role loading, owner-only role assignment and invite role.
- [x] Add server checks in team routes and role API, then GREEN tests.
- [x] Mutate one matrix permission and confirm a regression test fails; restore with `cp`.

### Task 2: Route enforcement and public payload

**Files:** `app/api/projects/*`, `app/api/shop/route.ts`, `app/api/share/*`, `src/core/share.ts`, `src/core/publicProject.ts`, `tests/rolesRoutes.test.ts`, `tests/publicProject.test.ts`.

**Interfaces:** `toPublicProject(project)` retains only appearance fields and `priceOverrides.salePrice`; all client entry points call it.

- [x] RED tests for forbidden actions, cross-shop access, bad JSON and secret fields in both share formats.
- [x] Guard routes with `can`, validate request shapes and strip client payloads.
- [x] GREEN tests and mutation restore check.

### Task 3: Comments and viewer/designer UI

**Files:** `lib/server/comments.ts`, `app/api/share/[code]/comments/route.ts`, `app/api/comments/route.ts`, `components/ViewerPage.tsx`, `components/AccountPanel.tsx` or focused child panel, `tests/comments.test.ts`, `scripts/e2e-roles-comments.mjs`.

**Interfaces:** code-bound comment `{id, code, panelId|null, body, author, replyTo|null, createdAt}`; client POST; designer GET/reply via authenticated endpoint.

- [x] RED tests for creation, listing, reply, invalid inputs, expiry, isolation and escaping.
- [x] Implement SQLite comments and bounded routes; GREEN tests.
- [x] Add client comment form plus object selector and designer inbox; prepare standalone e2e scenario for root.
- [x] Mutate comment validation, observe RED, restore with `cp`.

### Task 4: Verify and report

- [x] Run full `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=2` and `npm run typecheck` after checking memory.
- [x] Review diff and record remaining gaps, test counts, mutations and e2e instruction in `.codex-runs/0924-roles-comments-report.md`.
- [x] Conventional Kazakh commit(s); leave merge/build/e2e to root.
