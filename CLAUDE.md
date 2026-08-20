# Furniture 3D Configurator — Project Spec for Claude Code

> Ревизия 2 — 2026-08-20. Түзетілгені: өлшем реті H×W×D-ге бекітілді (§0.1),
> §4.4 арт қабырға шегерімі, §4.7 дөңгелектеу ережесі, §4.3 `minBandSubtract`,
> §8.7 эталон 11 деталь.

---

## 0. Conventions that override everything else

### 0.1 Dimension order — H × W × D, always

Every dimension triple in this project, in code, in JSON, in the UI, in exports,
and in conversation, is written **H × W × D** (height, width, depth) and every
number carries its letter when written in prose:

> `2000 (H) × 600 (W) × 450 (D)`

Never write a bare `2000×600×450` without letters. `W/H/D` in the old ordering
caused a real misreading during M1 design and is banned.

### 0.2 Units

- Dimensions: **millimetres, integers**, everywhere. Never floats for dimensions.
  Two documented exceptions, both physical constants, never derived dimensions:
  edge-band thickness (0.4 mm) and hinge cup drill depth (12.5 mm).
- Money: integer minor units (тиын). Never floats for money.

---

## 1. What we are building

A browser-based parametric configurator for **case furniture** (корпусная мебель):
wardrobes, kitchen cabinets, closets. The user sets dimensions and options in a
web UI; the system produces, from a single source of truth:

1. A live 3D model
2. A **cut list** (деталировка) — every panel with exact cut dimensions and edge banding
3. A **nesting layout** for sheet material, with guillotine-cut constraint
4. **Drilling coordinates** (присадка) for confirmats, minifix, shelf pins, hinges
5. **DXF / CSV / XLSX / PDF** exports for the workshop
6. A **price estimate** and a client-facing quote (КП)

The 3D view is a *consequence* of the panel model, never a separate model.
If the 3D and the cut list can ever disagree, the architecture is wrong.

**Non-goals (do not build these unless explicitly asked):**
- Free-form / organic modelling. Everything is axis-aligned rectangular panels.
- A general CAD editor. This is a configurator with constrained parameters.
- Full room / interior design in phase 1. Room context comes later.
- CNC G-code post-processors. We export DXF + drilling data; postprocessing is downstream.

---

## 2. Stack

- **Next.js (App Router) + TypeScript**, strict mode on
- **React Three Fiber + drei** for 3D (`three` latest)
- **Zustand** for configurator state
- **Tailwind + shadcn/ui** for UI
- **PostgreSQL + Prisma** for projects, materials, hardware, orders
- **Zod** for all input validation and for the project serialization schema
- **Vitest** for unit tests

Do not add a dependency without saying why in the commit message.

---

## 3. Architecture — the single most important rule

Three layers, strictly one-directional:

```
  Config (user parameters)
        │  pure functions, no React, no three.js
        ▼
  Panel[] + Hardware[] + Drilling[]   ← the ONLY source of truth
        │
        ├──► 3D renderer (R3F)      — reads panels, renders boxes
        ├──► cut list / nesting     — reads panels
        ├──► drilling export        — reads drilling
        └──► pricing                — reads panels + hardware
```

**The core (`/src/core`) must be a pure TypeScript library with zero imports
from React, three.js, or Next.js.** It takes a config object and returns panels.
It must be runnable in Node and fully unit-testable.

This is non-negotiable. If you find yourself computing a panel dimension inside
a React component or a three.js mesh, stop and move it into core.

---

## 4. Domain model — read this carefully

These are real manufacturing rules for CIS/Kazakhstan sheet-goods furniture
(ЛДСП). Encode them as **configurable constants**, not hardcoded numbers —
different shops build differently.

### 4.1 Materials

```ts
type Material = {
  id: string
  name: string            // "ЛДСП Egger H1145 Дуб Бардолино"
  thickness: number       // 16 | 18 | 10 | 3 (ХДФ)
  sheetWidth: number      // 2800
  sheetHeight: number     // 2070
  hasGrain: boolean       // true → panels may NOT be rotated 90° in nesting
  pricePerSheet: number   // minor units
  trimEdge: number        // 10 — unusable strip on each side of the sheet
}

type EdgeBand = {
  id: string
  name: string            // shown in the cut list
  thickness: number       // 0.4 | 1 | 2
  pricePerMeter: number
}
```

### 4.2 Panel

See `src/core/types.ts` for the authoritative type. Key points:

- `finishedLength / finishedWidth` — what the assembled part measures, edge included
- `cutLength / cutWidth` — what the saw actually cuts (derived, §4.3)
- `edges` — `L1/L2` are the two long sides, `W1/W2` the two short sides
- `position / rotation / orientation` — placement in cabinet space, mm
- Cabinet axes: **X** left→right, **Y** bottom→up, **Z** front→back. Origin at the
  carcass front-bottom-left. An overlay front sits *in front of* the carcass and
  therefore has negative `z`.

### 4.3 The edge-banding subtraction rule (critical, always missed)

Edge banding adds thickness. The saw must cut the panel **smaller** by the
banding thickness so the finished part hits the target dimension.

```
cutLength = finishedLength − thickness(W1) − thickness(W2)
cutWidth  = finishedWidth  − thickness(L1) − thickness(L2)
```

Example: finished 600 mm, 2 mm PVC on both ends → cut at 596 mm.

**Exception — `minBandSubtract` (default 1 mm).** Bands thinner than this are
**not** subtracted. In a real shop 0.4 mm banding never comes off the cut size:
the panel saw does not hold that tolerance (±0.5 mm) and the glue line absorbs
the difference. Only 1 mm and thicker banding is subtracted. This also keeps
every cut dimension an integer.

**The cut list must show cut dimensions. The 3D view must show finished
dimensions.** Getting it backwards produces furniture that does not fit, and
this is the single most expensive bug in this domain.

### 4.4 Carcass construction

Support two construction methods, selectable per project. `W/H/D` are the outer
cabinet dimensions, `t` is the carcass material thickness (read from the
material, never hardcoded to 16), and `backAllowance` is defined in §4.5.

**A. Sides overlay top/bottom (`sidesOverlay`, most common in CIS)**
Sides run full height; top and bottom sit between them.
```
side.finishedLength = H
side.finishedWidth  = D − backAllowance
top.finishedLength    = W − 2·t
bottom.finishedLength = W − 2·t
top.finishedWidth = bottom.finishedWidth = D − backAllowance
```

**B. Top/bottom overlay sides (`topBottomOverlay`)**
```
top.finishedLength = bottom.finishedLength = W
side.finishedLength = H − 2·t
(all carcass panels keep finishedWidth = D − backAllowance)
```

Every carcass panel is `D − backAllowance` deep. The old text said
`side.finishedWidth = D`, which double-counted the back panel.

### 4.5 Back panel (задняя стенка, ХДФ 3 mm)

`backAllowance` = `backThickness` in overlay mode, `grooveInset` in groove mode.

- **`overlay` (внакладку):** `W × H`, stapled to the back. **`D` includes the
  3 mm**: the carcass is `D − 3` deep and the ХДФ makes up the rest, so the
  assembled cabinet measures exactly `D`. Cheapest, standard for wardrobes.
- **`groove` (в паз):** routed 4 mm deep, 10 mm from the rear edge. Back size:
  `H − 2·t + 2·grooveDepth` by `W − 2·t + 2·grooveDepth`. Stronger, no edge banding.
  Carcass depth of sides/shelves shortens by `grooveInset` in this mode.

Constants: `grooveDepth = 4`, `grooveInset = 10`, `backThickness = 3`.

> OPEN QUESTION (M2): in groove mode the assembled depth comes out at
> `D − grooveInset` rather than `D`, because nothing sits behind the carcass.
> Confirm whether `D` should stay the outer dimension there too.

### 4.6 Shelves

```
shelf.finishedLength = W − 2·t − shelfGap        // shelfGap = 2 (1 mm each side)
shelf.finishedWidth  = D − backAllowance − shelfSetback
```
- `shelfGap = 2` — total clearance, 1 mm per side. Without it the shelf does not
  go in: ЛДСП cutting tolerance is ±0.5 mm.
- `shelfSetback` default **0**. Wardrobes and closets with hinged doors often use
  **10–20 mm** so hangers and clothing clear the shelf when the door shuts.
  Keep it configurable; the reference test uses 0.

Front edge (`L1`) always gets 2 mm banding — it is the edge people touch, and
0.4 mm peels off it. Other three edges: 0.4 mm or none, per project settings.

Distinguish **fixed shelves** (полка фиксированная — joined with confirmats,
counts as structural) from **adjustable shelves** (полкодержатели — needs the
shelf-pin hole column, see 4.9).

### 4.7 Fronts (фасады)

```
gap = 3                                  // зазор between fronts and around them
frontHeight = H − 2·gap                  // full-height overlay front
frontWidth  = floor((W − (n+1)·gap) / n) // n fronts side by side
```

**Rounding rule.** `frontWidth` rounds **down** to whole mm. The leftover
millimetres are distributed **one at a time into the gaps, outer gaps first
(left, then right), then the inner gaps left to right.** Fronts are therefore
**always identical** — this matters in the shop, because identical parts are cut
in one operation.

Worked example, `W = 600 (W)`, `n = 2`: `floor((600 − 9) / 2) = 295`;
leftover `600 − 590 = 10` mm of gap → left 4, right 3, middle 3.

All four edges get 2 mm banding. Support `overlay` (накладной, sits in front of
the carcass, `z < 0`) and `inset` (вкладной, sits inside the opening, computed
against `W − 2·t` and `H − 2·t`).

### 4.8 Drawers (ящики)

Model runner systems as data, not code:

```ts
type RunnerSystem = {
  id: string                 // 'ballBearing' | 'tandembox' | 'metabox'
  sideClearance: number      // per side: ball-bearing = 13, so total 26
  bottomClearance: number
  topClearance: number
  lengths: number[]          // available runner lengths: 250,300,350,400,450,500
}

drawerBoxWidth = innerWidth − 2·sideClearance
drawerBoxDepth = chosen runner length      // NOT cabinet depth
drawerBottomFit: 'groove' | 'nailed'
```
Runner length must be validated against cabinet depth:
`runnerLength ≤ D − backAllowance − frontThickness`.
If no runner fits, surface a validation error — do not silently pick a wrong one.

### 4.9 Drilling (присадка) — the 32 mm system

```ts
type Drill = {
  face: 'inner' | 'outer' | 'edgeL1' | 'edgeL2' | 'edgeW1' | 'edgeW2'
  x: number; y: number      // mm from panel's bottom-left on that face
  diameter: number
  depth: number
  purpose: 'confirmat' | 'dowel' | 'minifix' | 'shelfPin' | 'hinge' | 'runner'
}
```

Rules:
- **Confirmat (евровинт):** Ø5 through the face panel, Ø7×50 into the panel edge.
  Two per joint minimum, three if the joint is longer than 400 mm.
  First hole 50 mm from the edge; the rest distributed evenly.
- **Shelf pin column:** Ø5, depth 8 mm, **32 mm pitch**, front row 37 mm from
  the front edge, back row 37 mm from the back edge.
- **Hinge cup:** Ø35, depth 12.5 mm, centre 22 mm from the front edge (Blum
  standard), 100 mm from the top and bottom of the front.
- **Runner screws:** per `RunnerSystem`, first hole 37 mm from the front.

Every one of these is a named constant in `src/core/constants.ts` with a comment
explaining what it physically is. A shop owner must be able to change them in
one place.

---

## 5. Nesting (раскрой) — do not use a generic bin-packer

**Requirement: guillotine cuts only.** Panel saws (форматно-раскроечный станок)
cut edge-to-edge in a straight line. A free rectangle-packing algorithm produces
layouts no shop can actually cut. Implement guillotine nesting with
recursive horizontal/vertical splits.

Constraints:
- `kerf = 4` mm (пропил) between every part
- `trimEdge = 10` mm removed from each side of the sheet
- If `material.hasGrain`, a panel may **not** be rotated 90°
- Group by material and thickness — never mix on one sheet
- Report: sheets used, waste %, offcuts larger than 100×100 mm

Output an SVG per sheet with part labels and dimensions. Also export DXF.

Write property-based tests: no two parts overlap, every part is inside the
usable area, every cut line is a full guillotine cut.

---

## 6. Pricing

```
materialCost  = Σ(sheets used per material × pricePerSheet)
edgeCost      = Σ(banded edge length per band × pricePerMeter)
hardwareCost  = Σ(qty × unit price)   // confirmats, hinges, runners, pins, handles
labourCost    = configurable: per m² of panel + per drilled hole + per m of edge
markup        = configurable %
```
Every line item traceable back to the panels that produced it. Show the client a
summary; show the shop the breakdown.

---

## 7. Project persistence

Store the **config**, not the panels. Panels are always regenerated. Version the
schema (`schemaVersion: 1`) and write a migration path from day one — you will
change the config shape and you must not break saved projects.

---

## 8. Testing rules

Unit tests are mandatory for `src/core/`. Specifically:

1. Edge subtraction — a 600 mm finished panel with 2 mm bands cuts at 596,
   and a 0.4 mm band does **not** change the cut size
2. Both carcass construction methods produce panels that sum back to `H`, `W`, `D`
3. Groove-back mode shortens shelves and sides correctly
4. Front widths sum to `W` exactly, including gaps, with no rounding drift, and
   all fronts in a cabinet are identical
5. Shelf-pin holes land on the 32 mm grid with the 37 mm offset
6. Nesting: no overlaps, all inside bounds, grain respected
7. **Snapshot test:** the reference wardrobe — `2000 (H) × 600 (W) × 450 (D)`,
   4 adjustable shelves, 2 overlay fronts, 16 mm ЛДСП, overlay back,
   `sidesOverlay` — produces **11 physical panels in 6 cut-list positions**:

   | Наименование | Кол-во | Готовый | Рез |
   |---|---|---|---|
   | Боковина | 2 | 2000 × 447 | 2000 × 445 |
   | Дно | 1 | 568 × 447 | 568 × 445 |
   | Крышка | 1 | 568 × 447 | 568 × 445 |
   | Полка | 4 | 566 × 447 | 566 × 445 |
   | Задняя стенка | 1 | 2000 × 600 | 2000 × 600 |
   | Фасад | 2 | 1994 × 295 | 1990 × 291 |

   Any change to that snapshot must be deliberate.

Run `npm test` before every commit. Do not commit failing tests.

---

## 9. Milestones

M1–M2 as delivered here; M2 onward is specified in **PHASE-2.md**, which
supersedes the milestone list that used to live in this section.

- **M1 — Core panel engine (no UI).** ✅ done.
  CLI: config JSON in → cut list table out. Full test suite.

Everything after M1 follows the build order in PHASE-2.md.

---

## 10. Working style

- Small commits, one concern each, conventional commit messages
- When a manufacturing rule is ambiguous, **ask me** — do not guess and do not
  invent a constant. A wrong constant silently produces unbuildable furniture.
- Prefer explicit over clever. A shop owner may need to read this code someday.
- No `any`. No silent `catch`. Validation errors surface to the UI with the
  parameter name and the allowed range.
- Comment every manufacturing constant with what it physically is.
