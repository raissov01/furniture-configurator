# PHASE 2 — Feature Targets and Milestones

> Continuation of CLAUDE.md. M1 (pure core engine, cut list, tests) is in progress
> or complete. This document defines M2–M7 and the feature bar for each.

---

## 0. How to use the reference products

Four existing products define the bar for four different parts of this system.
For each one, the instruction is: **match the capability, learn the domain rules,
and write our own implementation.**

| Module | Reference | What we take |
|---|---|---|
| Geometry engine, cut list, DXF | **PolyBoard** | Which construction cases must be supported, and what a correct manufacturing output contains |
| Cloud SaaS, subscription, small-shop fit | **Mozaik** | Pricing model, per-shop configurability, onboarding flow |
| Browser configurator, AR, client presentation | **Roomle** | Interaction model, embeddable widget, share-link UX |
| Wardrobe/closet vertical | **autoclosets** | The narrow product we ship first and the drawings it must produce |

**Hard rule — do not copy any of the following from these products:** source code,
decompiled binaries, 3D asset libraries, texture/material catalogs, UI screenshots
or layouts traced pixel-for-pixel, marketing copy, or product databases. We
reimplement behaviour from first principles and from published manufacturing
standards. If you are ever unsure whether something crosses that line, stop and ask.

What *is* fine and expected: reading their public documentation and manuals to
learn manufacturing rules, downloading PolyBoard's free version to produce
reference cut lists we test our engine against, and matching their feature list.

---

## MODULE A — Geometry engine to PolyBoard level

M1 handles a simple rectangular carcass. PolyBoard's real value is that it stays
correct in the awkward cases. Extend the core to cover these, in this order.

### A1. Multi-section cabinets
A cabinet is divided by vertical dividers into **sections**. Each section
independently holds shelves, drawers, rails, or nothing.

```ts
type Section = {
  id: string
  widthMode: 'fixed' | 'flex'      // flex sections split the remainder equally
  width?: number                    // required when fixed
  contents: SectionContent[]
}
```
Divider panels are structural: they run the full internal height and their
thickness is subtracted from the sections either side. Section widths must sum
back to `W − 2t − (dividerCount × t)` exactly, with remainder distributed
deterministically (same rounding rule as fronts in §4.7).

### A2. Vertical and horizontal joint stacking
Cabinets taller or wider than a sheet must split into stacked carcasses with a
shared panel. Detect this automatically: if `H > material.sheetHeight − 2·trimEdge`,
propose a horizontal split and tell the user where.

### A3. Angled and non-rectangular cases
- Sloped top (mansard / under-stairs): top panel becomes a trapezoid, sides
  become right trapezoids. Cut list must carry the angle and both edge lengths.
- Corner cabinets: L-shaped and diagonal (45°) carcasses.
- Wall cut-outs: a rectangular notch in a side or back panel for a pipe or socket.

Represent these as an optional `outline: Point[]` on `Panel`. When `outline` is
absent the panel is the plain rectangle from `cutLength × cutWidth`. Everything
downstream (nesting, DXF, 3D) must handle both. Nesting uses the bounding box
for non-rectangular parts and flags them as "requires manual cut".

### A4. Materials and edge libraries
Per-account CRUD for materials and edge bands. Seed with what Kazakhstan shops
actually buy:
- ЛДСП 16 mm and 18 mm, sheet 2800×2070 and 2750×1830
- ХДФ 3 mm for backs
- МДФ 16/19 mm for milled fronts
- PVC edge 0.4 / 1 / 2 mm
Every material carries `hasGrain`, price per sheet, and default edge policy.

### A5. Manufacturing exports
This is the acceptance bar for Module A. Produce all of:

**DXF, one file per panel** (or one file with one block per panel):
- Units: millimetres. `$INSUNITS = 4`.
- Layer `OUTLINE` — closed LWPOLYLINE of the cut outline
- Layer `DRILL_5`, `DRILL_8`, `DRILL_15`, `DRILL_35` — circles at drill centres,
  one layer per diameter, since machines map layers to tools
- Layer `GROOVE` — polylines for back-panel grooves, with width and depth in
  an accompanying attribute
- Layer `TEXT` — part label, quantity, and cut size, placed inside the outline
- Origin at the panel's bottom-left corner, X along the cut length

**XLSX cut list** — the §4 columns, one sheet per material, with a totals row.

**PDF assembly drawing** — for each cabinet: front elevation, side elevation, and
plan, all dimensioned; plus an exploded isometric with part numbers keyed to the
cut list.

**CSV for optimisers** — a plain `length,width,qty,material,edgeL1,edgeL2,edgeW1,edgeW2,grain`
export so shops can feed their existing nesting software.

### A6. Validation against PolyBoard
Build `tests/reference/` containing cut lists produced by PolyBoard's free
version for at least eight cabinets: base unit, wall unit, tall unit, sloped top,
corner unit, three-section wardrobe, drawer bank, and a grooved-back cabinet.
Each becomes a test case. Our engine must match every part dimension within 0 mm.
Where we deliberately differ (different construction convention), document why in
a comment on that test.

**Acceptance for Module A:** all eight reference cabinets pass, DXF opens cleanly
in a CAM package with correct layers, and a shop can cut from our output without
re-measuring anything.

---

## MODULE B — Cloud SaaS to Mozaik level

Mozaik's insight is that small shops (1–20 people) will pay monthly for
production output if they do not have to buy a workstation licence and if the
software bends to how *they* build.

### B1. Per-shop construction profiles
Every constant from CLAUDE.md §4 lives in a named, versioned profile owned by
the account. A shop sets it up once — thicknesses, edge policy, joint method,
drill offsets, runner brand, gaps — and every project inherits it. Projects can
override individual values, and the override is visible in the UI so nobody
ships a cabinet built to the wrong standard by accident.

Ship three seeded profiles: "ЛДСП 16, конфирмат, накладной фасад" (the CIS
default), "ЛДСП 18, минификс+шкант", and "МДФ фасад, скрытые петли".

### B2. Projects, versions, and history
- A project holds many cabinets plus room context
- Every save creates a version; the user can diff two versions ("what changed
  since I sent the quote?") and roll back
- Once a project is marked `sent_to_production`, it locks. Further edits fork a
  new revision with a visible revision number, because the shop floor is holding
  a printed cut list with that number on it

### B3. Accounts and billing
- Roles: `owner`, `designer`, `shop` (read-only access to production output),
  `client` (read-only 3D and quote, no dimensions or cut list)
- Subscription tiers with hard feature gates, not honour-system:
  free trial → single-shop monthly → multi-seat annual
- Currency ₸, integer тиын, VAT-aware invoices
- Payment: build a `PaymentProvider` interface first, then implement Kaspi and
  a card provider behind it. Never call a payment SDK from a React component.

### B4. Libraries
- Cabinet templates: a shop saves a configured cabinet as a reusable template
  with its parameters exposed. This is the single highest-leverage retention
  feature — a shop with 40 of its own templates does not churn.
- Hardware catalog: hinges, runners, handles, rails, sliding-door systems, each
  with dimensions, drill patterns, and price
- Global vs per-account scope, with per-account entries shadowing global ones

**Acceptance for Module B:** two shops with different construction profiles can
build the same cabinet dimensions and each gets a cut list matching their own
standard, with no shared state leaking between accounts.

---

## MODULE C — Web configurator and client presentation to Roomle level

### C1. Configurator UX
- Dimension inputs with live validation: min/max, and an explanation when a value
  is rejected ("depth 300 mm — no runner shorter than 350 mm fits; minimum 400 mm")
- Every parameter change re-renders 3D in under 100 ms for a cabinet up to 40
  panels. Regenerate panels in a worker if the main thread stalls.
- Undo/redo on every parameter
- Dimension annotations toggled on/off in 3D; exploded-view slider
- Camera presets: front, 3/4, inside, plan

### C2. Embeddable widget
A furniture shop drops one `<script>` tag on their own site and gets the
configurator with their catalog and their branding. Isolate it: separate bundle,
shadow DOM or iframe, its own auth token, configurable locked parameters (a
retailer may want depth fixed). This is a distribution channel, not a feature.

### C3. Share links and client mode
A read-only URL showing the 3D model, chosen materials, and price — no cut list,
no dimensions the client could take to another shop. Client can leave comments
pinned to a point on the model. Designer sees comments in the project.

### C4. AR
- Android and desktop Chrome: WebXR immersive-ar, hit-test to place on the floor
- iOS: export the scene to USDZ and hand off to Quick Look — Safari does not do
  WebXR. Build GLB→USDZ conversion server-side; do not try to do it in the browser.
- Anchor to the floor plane, allow rotation, snap the cabinet's back to a
  detected wall plane when one is available
- Cap the AR model at ~50k triangles; panels are boxes so this is easy, but
  hardware and handle meshes will blow the budget if you are careless

### C5. Quote and presentation output
A PDF the designer sends the client: 3–4 rendered views, material swatches,
dimensions, itemised price, shop branding, validity date. Generated server-side
so it looks identical everywhere.

**Acceptance for Module C:** a designer configures a wardrobe on a phone, shows
it to a client in AR in the client's room, and sends a quote — all in under five
minutes, without a laptop.

---

## MODULE D — Wardrobe vertical, the autoclosets play

**Ship this first.** A narrow product that is completely correct beats a broad
one that is 80% correct in every direction. Wardrobes and walk-in closets are
the highest-volume custom furniture category in Kazakhstan.

### D1. Wardrobe-specific parts
- **Hanging rail (штанга):** round or oval, with end supports. Height rules:
  shirts/jackets ≥ 1000 mm of clear space, coats/dresses ≥ 1500 mm. Minimum
  internal depth for a hanger is 550 mm — validate and warn below that.
- **Pull-down rail (пантограф)** for high sections
- **Trouser rack, tie rack, basket drawers** as catalog hardware with their own
  clearances
- **Mezzanine / antresol:** a separate stacked carcass above the main one
- **Shoe shelves** at an angle

### D2. Sliding door systems (шкаф-купе) — the core of this module
Model the system as data, exactly like runners:

```ts
type SlidingSystem = {
  id: string                 // 'aristo-eco' | 'versal' | 'senator'
  doorOverlap: number        // how much adjacent doors overlap, e.g. 25–50
  topTrackHeight: number
  bottomTrackHeight: number
  frameSideWidth: number     // vertical profile width, subtracted from the filling
  frameTopBottom: number
  fillingClearance: number   // gap between filling panel and profile groove bottom
  maxDoorWidth: number
  maxDoorHeight: number
  maxDoorWeight: number
}
```

Door sizing:
```
doorHeight = H − topTrackHeight − bottomTrackHeight + trackInsertion
doorWidth  = (W + (n − 1) · doorOverlap) / n        // n doors
fillingWidth  = doorWidth  − 2·frameSideWidth  + 2·fillingClearance
fillingHeight = doorHeight − 2·frameTopBottom + 2·fillingClearance
```
Validate against `maxDoorWidth/Height/Weight` — a 1200 mm wide mirrored door
will exceed the weight limit on a cheap system and the customer will find out
six months later. Estimate filling weight from material density and surface area.

Doors can be split horizontally into multiple fillings with a divider profile —
support 1–4 fillings per door with independent materials (ЛДСП / mirror / glass /
lacobel).

### D3. Wardrobe elevation drawings
autoclosets' actual selling point: a dimensioned front elevation and plan the
installer can work from. Produce, per wardrobe:
- Front elevation with every section width, shelf height, and rail height marked
- Plan view with depths
- Door layout with the open/closed positions of sliding doors
- Internal filling elevation with doors removed

These go in the quote PDF *and* the production PDF. They are what stops the
"but I thought the shelf was higher" argument on installation day.

### D4. Wardrobe templates
Ten seeded, ready-to-configure wardrobes: 2-door and 3-door sliding, hinged
2/3/4-door, walk-in corner, walk-in U-shape, mezzanine variants, narrow hallway
unit. Each fully parametric on width/height/depth.

**Acceptance for Module D:** a designer picks a template, sets three dimensions
and a door system, and gets a correct cut list, a correct sliding-door spec with
weight validation, and installer-ready elevation drawings — in under two minutes.

---

## Cross-cutting requirements

**Localisation.** kk, ru, en, uz from the start. No hardcoded strings, ever.
The cut list column headers and part names must be translatable — a shop in
Uzbekistan needs "Ён девор", not "Боковина". Number formatting per locale, but
dimensions always in mm with no thousands separator.

**Performance budgets.** First paint under 2 s on a mid-range Android over 4G.
Configurator bundle under 500 kB gzipped excluding three.js. 3D scene at 30 fps
on a 2021 mid-range phone. Measure these in CI; do not assume.

**Offline tolerance.** Shop floors have bad Wi-Fi. The configurator keeps working
on a loaded project without network and syncs when it returns.

**Data export.** A user can export their entire account — projects, templates,
libraries — as JSON at any time. Say so on the pricing page. Shops are burned by
lock-in and this removes an objection.

---

## Build order

```
M2  Geometry: A1 multi-section, A4 libraries          → 8 reference cabinets passing
M3  3D + configurator UI: C1                          → live 3D from panel data
M4  Exports: A5 all four formats                      → shop cuts from our output
M5  Wardrobe vertical: D1, D2, D3, D4                 → FIRST SHIPPABLE PRODUCT
M6  SaaS: B1–B4                                       → first paying account
M7  Presentation: C2, C3, C4, C5                      → AR and share links
M8  Geometry hard cases: A2, A3                       → sloped, corner, split
M9  Nesting + pricing (CLAUDE.md §5, §6)
M10 AI render pipeline
```

M5 is the launch. Everything before it exists to make M5 correct; everything
after it exists to make M5 sellable. Do not start M9 or M10 until a real shop
has cut real panels from our output.
