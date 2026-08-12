# adi Pipework Toolchain — design notes

Four self-contained HTML tools served from GitHub Pages. No build step, no
dependencies to install, no server. Each file opens on its own from a hard
disk, which is deliberate: they have to work on site.

**This document is the handover.** If someone picks this up cold — another
engineer, a developer, or an AI assistant in a fresh conversation — reading
this should be enough to make a safe change. Keep it current.

---

## 1. The chain

| Step | Name in the bar | File | URL | Does |
|---|---|---|---|---|
| 1 | Pipe Trace | `trace.html` | `/trace.html` | Take-off from a scaled drawing, 3D height check |
| 2 | Pipework Sizer | `index.html` | `/` | Sizing, losses, heat loss, reheat |
| 3 | Network Simulator | `simulator.html` | `/simulator.html` | Network solve, pumps, balancing |
| — | Primary Circuit Sizer | `primary-circuit-sizer.html` | `/primary-circuit-sizer.html` | Plant-side primary loop (standalone) |

Steps 1→2→3 pass a single JSON file between them. Cross-links in the top bars
are **relative** (`./index.html` etc.) so they survive a repo rename.

The order is fixed and every page states it: all three carry the same step rail
— `1 Trace → 2 Sizer → 3 Simulator` — with the page you are on lit and the
other two live links. Use those three names everywhere. Nothing else in a top
bar should link sideways to another tool; the rail is the only route, so there
is one place to change if a step is ever added.

Repo: `github.com/mikesweet23/Alternative-pipe-sizer`

---

## 2. Non-negotiables

Break any of these and the tools stop agreeing with each other.

### Fluid properties
- Density and specific heat: polynomial fits to standard water tables, evaluated
  at **mean operating temperature** — `(supply + return) / 2`.
- **Viscosity is fixed at 0.00131 Pa·s** and is *not* temperature-corrected.
  This is the sizer's glycol-table value, water at roughly 10 °C.

> **Known inconsistency, deliberately left alone.** Correcting viscosity to the
> mean temperature is more physically right and would give slightly smaller
> pipes. Pipe Trace originally did this and produced DN50 where the sizer gave
> DN65 for the same duty. Pipe Trace was aligned *down* to the sizer rather than
> the other way round, because changing the sizer would silently re-size every
> saved project. If this is ever corrected it must be corrected in all four
> tools in the same commit, and every live project re-checked.

> **The simulator broke this rule until it was caught.** It ran
> `waterMu(FLUID.Tm)`, giving about 4.0e-4 Pa·s at a 70 °C mean — a third of
> the sizer's figure. Higher Reynolds, lower friction factor, and pipe losses
> roughly 15% under what the sizer had reported for the same pipe. It now uses
> the same fixed `SIZER_MU`. This is the first thing to check if the two tools
> ever disagree on a run's loss again.

### Hydraulics
- `Q = ṁ·cp·ΔT`
- Darcy-Weisbach, Colebrook-White via the Swamee-Jain explicit form
- Laminar `f = 64/Re` below Re 2300
- Default limit **300 Pa/m**, velocity **0.3–3.0 m/s**

### What a corner costs

Pipe Trace prices each corner on the angle it actually turns through, within
±7.5°:

| Deflection | Counted as |
|---|---|
| ≈ 90° | 1 × the configured 90° fitting (`bendType`) |
| ≈ 45° | 1 × `elbow45` |
| anything else | **2 × the 90° fitting** — a made set |

An odd angle cannot be bought as one fitting, so it is fabricated from two —
and from two **90s**, not two 45s, because a pair of 90s cut to suit will make
a set at any angle where a pair of 45s only makes the angles a 45 already
gives you. Counting every corner as a single elbow, which is what it did
before, under-counted every angled run on the drawing. `cornerAngles()` and
`cornerFitting()` are the whole of it.

### Modulating against on/off, and why it changes the duty

The terminal's control arrangement is the single biggest lever on pump head,
and the distinction that matters is not 2-port against 3-port — it is
**modulating against on/off**:

| Arrangement | Authority | Why |
|---|---|---|
| 2-port modulating | **yes** | Throttles to hold a temperature, so it must take a real share of the branch pressure or it cannot control |
| 2-port on/off | **no** | Only ever fully open or fully shut. A plate exchanger with the client modulating on the secondary is the usual case — the primary flow is on or it is not |
| 2-port + bypass, 3-port | yes | Still modulating |
| PICV | no | Sets its own differential; handled by `picvMin`/`picvMax` |

Sizing an on/off valve for authority invents duty the system does not need. On
the worked example it is the difference between a **66 kPa** valve and an
**8 kPa** one — 132 kPa of pump head against 74.

`valveNeedsAuthority()` in Pipe Trace and `ARRANGEMENTS[].authority` in the
simulator are the same rule and must agree.

### Which valves go with which arrangement

A **PICV holds its own flow**, so it never gets a double regulating valve or a
commissioning set behind it — that would be regulating something already
regulated. Everything else does. `setForValveType()` maps the arrangement to
its set; `termPicv` is the one with no DRV.

### The arrangement travels the whole chain

Set on the load in Pipe Trace → `controlValve` on the exported circuit →
carried untouched through the sizer (which does not use it) → read by the
simulator as the node's `arrangement`. The simulator used to hard-code
`twoPort` and default everything back to modulating, which re-invented the
pump duty at the last step. Circuit factories in `index.html` must keep
passing `controlValve` through or the chain breaks silently again.

### The standard isolating valve

adi standard: **ball valves to DN50, butterfly valves from DN65 up.**

`isoTypeForDN()` decides it. Valve sets list the pseudo-type `iso`, which
resolves against the run's size when it lands *and again on every solve*, so a
branch that grows past the break turns its own isolating valves into
butterflies without anyone remembering to. Items placed that way carry
`autoIso: true`.

Picking a specific valve from the palette, or changing one in the inspector,
is an explicit choice — it clears `autoIso` and stays put.

### Roughness (m) — identical tables in the sizer and Pipe Trace

| Condition | Carbon | Stainless / Tru-Bore | Copper |
|---|---|---|---|
| New | 0.000046 | 0.000015 | 0.0000015 |
| In service | 0.00012 | 0.00003 | 0.000003 |
| Corroded | 0.0005 | 0.00006 | 0.000005 |

### Fitting K factors

Quoted at DN15 / DN50 / DN150 / DN300, **interpolated on bore**, then scaled by
material (carbon 1.00, stainless 0.95, copper 0.92). Applied as
`Δp = K · ρv² / 2` at the circuit's own velocity, so changing pipe size updates
them automatically. Source: CIBSE Guide C / Crane TP-410 unless marked.

**`FITTING_TYPES` is one table with two copies — `trace.html` and `index.html`
— and they must stay identical.** Pipe Trace hands valve counts to the sizer
inside `fittingSchedule`, and the sizer's `fittingK()` returns **0** for a key
it does not know. A type added to one file and not the other therefore crosses
the join and silently contributes nothing. Add to both, in one commit. There
is a check for this in section 7.

| Fitting | DN15 | DN50 | DN150 | DN300 | |
|---|---|---|---|---|---|
| 90° elbow (short radius) | 1.00 | 0.75 | 0.60 | 0.52 | |
| 90° elbow (long radius) | 0.55 | 0.42 | 0.34 | 0.30 | |
| Pulled bend | 0.35 | 0.28 | 0.22 | 0.19 | |
| 45° elbow | 0.45 | 0.36 | 0.30 | 0.26 | |
| Tee through run | 0.45 | 0.35 | 0.28 | 0.24 | |
| Tee through branch | 1.60 | 1.30 | 1.05 | 0.92 | |
| Gate valve | 0.30 | 0.18 | 0.12 | 0.10 | |
| Ball valve (full bore) | 0.10 | 0.08 | 0.06 | 0.05 | |
| Butterfly valve | 0.95 | 0.60 | 0.40 | 0.32 | |
| Globe valve | 9.00 | 7.50 | 6.50 | 6.00 | |
| Check valve (swing) | 2.50 | 2.10 | 1.80 | 1.60 | |
| Check valve (wafer) | 2.00 | 1.70 | 1.45 | 1.30 | *assumed* |
| Strainer (Y-type) | 2.80 | 2.50 | 2.20 | 2.00 | |
| Strainer (basket) | 3.60 | 3.20 | 2.80 | 2.50 | *assumed* |
| Dirt separator | 2.20 | 1.90 | 1.70 | 1.50 | *assumed* |
| Double regulating valve | 3.50 | 3.00 | 2.60 | 2.40 | |
| Commissioning set | 4.00 | 3.40 | 3.00 | 2.70 | |
| Flow measuring station | 2.50 | 2.20 | 1.90 | 1.70 | *assumed* |
| Flexible connector | 0.30 | 0.25 | 0.20 | 0.18 | *assumed* |
| Reducer / enlarger | 0.35 | 0.30 | 0.25 | 0.22 | |
| Tank entry or exit | 1.00 | 1.00 | 1.00 | 1.00 | |
| Air vent, drain, relief valve, test point | 0 | 0 | 0 | 0 | on a branch |
| Flanged joint | 0.06 | 0.05 | 0.04 | 0.04 | |

*assumed* carries `assumed: true` in both files and is flagged in the UI
wherever the figure is shown — palette tooltip, valve inspector, both
schedules and the sizer's fittings editor. Replace with supplier data.

The four zero-K rows sit on a branch off the bore, so they add nothing to the
loss along the run. They exist so a count placed in Pipe Trace still appears
on the schedule rather than disappearing.

### Valves that hold a differential, not a velocity head

A PICV, a 2- or 3-port control valve and a DPCV are selected on the drop they
have to keep, not on their bore. Giving them a K would make the figure move
every time the pipe changed size, which is backwards. They carry a **fixed
kPa** instead (`kpa` in `VALVE_LIB` rather than `fit`), overridable per valve
once a product is selected. Placeholders, all flagged as assumptions:
PICV 25, 2-port 20, 3-port 20, DPCV 15 kPa.

### How a placed valve is costed — and why it decides what crosses

Every placed item that is *not* one of those four carries a **basis**:

- **`typ`** — a typical resistance in kPa from `VALVE_LIB[].typ`, overridable
  per valve in the inspector. **This is the default**, because it is the figure
  a supplier quotes and the one that reads right on a schedule; the K model
  gives a clean-and-new number that looks low against a real quotation.
- **`k`** — `K · ρv²/2` at the run's own size and velocity, so it moves with
  the pipe.

The project default is `S.settings.valveBasis`; an item can override it.

**The basis decides the route to the sizer, and that is the whole trade-off:**

| Basis | Where it ends up |
|---|---|
| `k` | the circuit's `fittingSchedule` — follows the size the sizer picks, reconciles exactly |
| `typ`/fixed, at a terminal | that circuit's `consumerLoad` — reconciles exactly |
| `typ`/fixed, on a distribution run | **reported only** — see below |

There is no per-circuit field on a main that can hold a fixed kPa.
`consumerLoad > 0` makes the sizer reclassify the circuit as a consumer
(`index.html`, `c.circuitType = ... consumerLoad > 0 ? 'consumer' : 'main'`)
and trips the index-run duplicate-load validation. So on the default basis a
valve on a main is in Pipe Trace's own figures and in `traceMeta`, and the
export dialog gives the number and says to add it to pump head by hand.
Switching the project to the K basis makes everything cross and the two tools
agree to the penny.

The four differential valves reach the sizer by a different route again:

- **On a run that ends at a load** they are added to that circuit's
  `consumerLoad`, which already means "the terminal's own pressure
  requirement". The split is carried alongside in `traceCoilKpa` and
  `traceValveKpa`, and the export dialog states it, so a coil drop reading
  40 kPa in the sizer is not a mystery.
- **On a distribution run** there is no sizer field that means this, and
  inventing one would change what a circuit is. The figure is reported in
  `traceMeta.valveKpaOnMains` and called out in the export dialog as something
  to add to pump head by hand. This is a known gap, deliberately visible
  rather than silently folded in somewhere wrong.

### Pipe tables
- **Tru-Bore Metric** is exact-bore: OD = DN + 2 walls. 1.5 mm wall to DN50,
  2.0 mm DN65–DN300, then DN350 355×2.5, DN400 406×3, DN500 506×3,
  DN600 606×3, DN700 708×4, DN800 808×4, DN900 908×4, DN1000 1008×4.
- **DN550 does not exist in the UK.** Steps are 50 mm from DN150 to DN500,
  then 100 mm.
- **Tru-Bore ISO stops at DN800** — the OSTP datasheet lists nothing above it.
- Carbon steel BS EN 10255 (DN8–DN500), copper EN 1057.

### Heat loss
- BS EN ISO 12241 cylindrical conduction:
  `Q/L = ΔT ÷ [ ln(Do/Di)/(2πλ) + 1/(πDo·h) ]`
  Pipe wall and internal film omitted — negligible for metal pipe with water.
- adi insulation spec: rigid PIR closed-cell 33 kg/m³, foil-faced, to
  BS 5970:2012 with thicknesses to BS 5422:2023, assigned by **nearest pipe OD**
  and overridable per line.
- Surface coefficients `h`: bright aluminium 5.0, foil 5.5, PIB 9.5,
  steel 10.0, bare 11.0 W/m²K.
- Valve jackets, Dynoteq-derived W/K at 80 °C surface / 20 °C ambient:
  DN25 0.193 · DN32 0.224 · DN40 0.247 · DN50 0.293 · DN65 0.355 · DN80 0.417 ·
  DN100 0.540 · DN125 0.687 · DN150 0.864. Extrapolated beyond and flagged.

---

## 3. Assumptions still standing in for real data

Flagged in the tools as assumptions. Replace when the figures arrive.

| Assumption | Currently | Wanted |
|---|---|---|
| PIR conductivity | λ = 0.025 W/m·K | Declared supplier figure |
| Flange / bag loss | 0.40 × valve jacket coefficient | Measured data |
| Pump curves | Generic parabola through shut-off (125% of design head) and the duty point | **Paste the real one.** Pump → *Use a real pump curve* takes flow/head pairs in l/s or m³/h and kPa or m; everything then solves against that machine |
| Valve Kv and PICV range | Generic | Selected products |
| PICV / control valve differential | PICV 25, 2-port 20, 3-port 20, DPCV 15 kPa | Selected products, per valve |
| K for wafer check, basket strainer, dirt separator, flow station, flexible | See section 2, marked *assumed* | Supplier data |
| Typical valve resistances (`VALVE_LIB[].typ`) | Ball/gate 0.5 · butterfly 3 · globe 15 · DRV 12 · comm set 15 · flow station 8 · Y-strainer 8 · basket 10 · swing check 5 · wafer check 4 · dirt separator 12 · flexible 1 kPa | Quoted figures at design flow. These are the **default** basis, so they set the numbers on every schedule until replaced |

---

## 4. The exchange file

One format, `app: 'adi-pipework-sizer'`, `schema: 1`. Pipe Trace writes it, the
sizer reads and writes it, the simulator reads it.

Circuit fields that carry meaning across tools:

| Field | Meaning |
|---|---|
| `circuitType` | `main` / `consumer` / `future` / `plant` |
| `parentId` | The circuit feeding this one; `null` = fed from plant |
| `mode` | `fromKw` / `fromFlow` / `fromChildren` (roll up from descendants) |
| `length`, `lengthsPaired`, `lengthReturn` | Flow leg, whether the return mirrors it, explicit return |
| `consumerLoad` | Coil pressure drop in kPa — this is what marks a terminal |
| `fittingsMode`, `fittingSchedule` | `counted` plus the actual fitting counts |
| `sizeOverride` | Steps from the automatic pick |
| `isBypass` | Carries three-port / bypass arrangement to the simulator |
| `isIndex` | On the critical path. Pipe Trace works this out and ticks it |
| `traceValves` | The valves placed on this run — tag, type, leg, qty |
| `traceCoilKpa`, `traceValveKpa` | How `consumerLoad` splits between coil and control valve |

The project also carries a top-level **`valveSchedule`**: the whole take-off as
a flat list — tag, type, symbol key, run, size, DN, leg, quantity, kPa, and
whether the figure is an assumption. The sizer only needs the pressure, which
is already inside the circuits; this list exists so the valves themselves are a
read rather than a re-derivation. **It is the substrate a P&ID export is meant
to be built on**, together with `sym` in `VALVE_LIB`, which is the key a symbol
library would map against.

Pipe Trace picks the index run the same way the sizer does: the terminal with
the highest total back to plant, summing each run's pipe and fitting loss and
adding the coil at the end. Both tools therefore agree, and `traceMeta` carries
`indexTerminal`, `indexKpa` and `indexRuns` so the figure can be checked.

Pipe Trace has its own separate save format, `app: 'adi-pipe-trace'`, holding
the drawing, the scale and the traced geometry. That never goes to the sizer.

---

## 5. Conventions that are easy to break

- **A run can only be joined to a point that already exists** — a component, a
  tee, or a corner that has been traced. The cursor is pulled to the nearest
  one and the connection is ringed and named *before* the click. A corner used
  as a branch point is split exactly on the corner, never a few pixels along,
  because near-miss splits were arriving in the sizer as extra circuits
  carrying nothing. A tee takes the height of the run it lands on, not the
  default main height. Turn the rule off in Pipe & basis if a genuine mid-span
  tee is needed.
- **Run naming.** `M1, M2` mains from the plant; `SM1, SM2` sub-mains that
  branch off a main and still feed more than one load; `B1, B2` branches into a
  load; `X1` anything not connected. A main or sub-main cut by a tee is
  numbered in sections from the plant — `M1.1, M1.2`. A run in one piece keeps
  its plain number.
- **Undo is snapshots of the take-off only** — nodes, runs and placed valves.
  Not the drawing, the scale or the settings: a snapshot carrying the image
  would be megabytes, and undo is for what you drew, not the sheet behind it.
  `pushUndo(label)` goes *before* the change; `asOneUndo()` and the
  `undoSuspended` flag group several edits that are really one action, so
  tracing a run and the terminal set it fits are a single step back. The one
  thing about the sheet a snapshot does carry is the **angle it was turned
  to** — a number, not the image — because a rotation moves every traced
  point, and stepping the geometry back without putting the sheet back would
  leave the trace off the pipework. A token beside it says which sheet that
  was, so a snapshot taken before a different drawing was loaded cannot turn
  the new one.
- **Rotating the drawing turns the take-off with it.** A sheet arrives
  sideways more often than not, and a scan is rarely square, so Rotate sits
  with the zoom controls — quarter turns and a fine nudge for straightening,
  `R` for the panel, `[` and `]` for the quarter turns. The rotation is
  **baked into the image and every traced point is turned with it**, rather
  than the sheet being spun on screen: hit testing, snapping, the labels that
  have to stay square to the sheet, the 3D check and the export then carry on
  in drawing coordinates knowing nothing about it. Rotation preserves
  distance, so `pxPerM` is untouched and the calibration line is turned with
  the rest, still lying on the dimension it was taken from. Placed valves hold
  a run and a fraction along it rather than a point, so they need nothing
  doing to them.
  Every turn is re-rendered from **the image as it was loaded**, never from
  the last rotated copy — nudging a scan straight a degree at a time would
  otherwise soften it a little more each pass and grow its corners every time.
  That original is held in memory only; `imgForSave()` writes the sheet as it
  is now and nothing else, so a save is not twice the size and a rotated
  drawing opens again as a drawing in its own right. An angle off square opens
  up corners that were never on the sheet, and those are filled white.
  A sheet that was on screen whole is refitted after a turn because its shape
  has changed; one that was zoomed into is held on the same point of the
  drawing, or straightening half a degree at a time would be impossible to
  judge.
- **Alt is the override key, and it means one thing: ignore the constraint in
  the way.** Over open paper it flips the corner lock, so a square job takes
  one free angle and a free-form job one square corner without changing a
  setting — that is what makes the two mix. Over a run already traced it cuts
  a tee exactly where the cursor is rather than being pulled to the nearest
  corner. The hint bar turns amber while it is held. The Tee tool does the
  same cut without holding anything.
- **Two things become real size when you zoom in**, and both have to, or a
  valve set stays unreadable no matter how far you go in: the symbols
  (`valveDrawScale()`, true size 0.30 m) and the gap between the flow and
  return legs (`pairOffsetDraw()`, 0.35 m). Each is `max(constant-on-screen,
  real)` — so a whole-floor view keeps them visible, and past roughly 2× they
  lock to life size and spread with the drawing. Change one without the other
  and the symbols grow into each other.
- **Both legs of a set start at the same chainage and step together**, so the
  isolating valves face each other across the pair and the strainer faces the
  regulating valve. Staggering the legs put one leg's symbols in the other's
  gaps, which is exactly where they overlap when you zoom in to read them.
- **A run traced to a load fits its own terminal set**, matched to the load's
  control arrangement via `setForValveType()`, standing `setOffsetM` off the
  coil at `setSpacingM` centres — both real metres, not screen pixels, which
  is what makes zoom work. `VALVE_SETS[].items` are listed **in the order they
  are met walking down the run**, away from plant; get that order wrong and
  the automatic fit comes out back to front.
- **The control valve belongs to the terminal, not to the run.** A 2-port,
  3-port or PICV carries `atLoad: true`: it is drawn on a short stub off the
  load rather than in the line with the isolating valves, and it only appears
  once a run reaches that load. `loadStubPos()` picks the edge from the
  direction of the run's last leg, so the stub always comes out of the side
  the pipework arrives at and **the load box never has to be rotated** — its
  name and duty stay square to the sheet. Flow and return take opposite ends
  of that edge. It is still an item on the feed run internally, so the
  pressure, the schedule and the export all work unchanged, but it does not
  slide along the run the way an in-line valve does.
- **Valves go on a run, never near one.** A placed item stores the run it sits
  on and a **fraction of that run's length**, not a point, so it stays put when
  a node is dragged or a corner is added. Splitting, promoting a corner and
  merging all re-cut the polylines that fraction is measured against, so those
  three go through `keepingItemsInPlace()`: remember every valve's plan
  position, do the surgery, put each one back on whichever run now passes
  closest. Working out the new fraction by hand for each case is where an
  off-by-one leaves a valve on the wrong side of a tee.
- **The assumed terminal set switches itself off.** `segFittings()` only adds
  the assumed two isolating valves, strainer and regulating valve at a load
  when that run has **no** placed valves. Otherwise the drawing and the
  assumption would both be counted. Said in the run inspector, not left to be
  found in the numbers.
- **Quantity and pressure agree on a paired run.** Flow and return are in
  series round the circuit, so an item set to `both` legs is two valves *and*
  two drops. Placed items are added to the fitting list **after** the ×2 that
  doubles the geometry-counted fittings, carrying their own quantity, so a
  valve on one leg stays one valve.
- **Valve tags are handed out once**, next free number per prefix (`IV-`,
  `ST-`, `NRV-`, `DRV-`, `CS-`, `PICV-`, `2PV-`, `3PV-`, `DPCV-`, `FM-`,
  `AAV-`, `DR-`, `SV-`, `TP-`, `FC-`, `DS-`, `GV-`). They are not renumbered on
  every placement, because a tag written on a drawing should not move under it.
  *Rename runs* renumbers them down the drawing, and Tidy does it only if two
  are the same.
- **Deleting a tee heals the pipework.** A tee joining two runs in line merges
  them back into one and keeps every metre; it used to delete every run
  touching the tee, which threw away the trace either side of a tee that was
  only in the wrong place. Three or more runs cannot be healed, so it says so
  and offers the explicit destructive option rather than doing it quietly.
- **Check and Tidy.** Check lists what would break downstream; Tidy repairs
  only what is unambiguous — welds a tee sitting on a component, merges two
  tees in the same place, joins runs split by accident, removes tees left
  hanging and runs of no length. It never moves a component or changes a duty.
  Send to Sizer runs the check first.
- **Two files come out of Pipe Trace and they must not be confusable.**
  `Trace — <ref> — <date>.json` is the take-off (`app: 'adi-pipe-trace'`) and
  is the one Open reads. `Sizer — <ref> — <date>.json` is the sizer project
  (`app: 'adi-pipework-sizer'`) written by Send to Sizer. They used to be
  `Trace_x.json` and `x_from_trace.json`, which is how the wrong one gets
  opened. Opening a sizer file in Trace now explains what it is and where it
  goes, in a modal — the old two-second toast was gone before it was read.
- **The trace is also kept in the browser.** `autosave()` runs off the back of
  `render()`, so every change is written a moment later, and the take-off is
  offered back on the next visit rather than restored silently — opening the
  tool to find someone else's job already in it is worse than one extra click.
  The drawing is stored under its own key because it is by far the biggest
  part; if it will not fit, the take-off is still kept and the drawing is asked
  for again. The file Save is what you send to someone else or archive with
  the job, and it writes the same bundle so the two cannot drift.
- **Send to Sizer hands over directly.** The project goes into
  `localStorage['adi-pipework-handoff']` and the sizer picks it up on load,
  clearing the key so a refresh cannot re-import it. A copy of the file is
  still downloaded, and if the store is unavailable the file is the fallback.
  The sizer's side of this is `takeTraceHandoff()` calling `applyProjectData()`.
- **Pipe Trace will not let anything be placed before the scale is set.** A
  drawing that arrives without one opens a modal that cannot be dismissed, and
  the plant, load and trace tools stay disabled. Swapping the sheet behind an
  existing trace asks whether the scale still holds rather than gating, so a
  revision at the same scale does not throw the take-off away.
- **Pipe Trace lengths, in the schedule and the exchange file.** Route is one
  way on the plan, riser is one way vertical (the height difference plus any
  extra rise), and pipe metres is every leg as installed. Route + riser, times
  the number of pipes, is the pipe figure. `length` in the exchange file is the
  one-way installed length, with `lengthsPaired` saying whether it is doubled.
- **Number inputs must not respond to the scroll wheel.** Wheel over a focused
  number field blurs it instead. Arrow keys blocked, spinners hidden. This was a
  deliberate safety decision — scrolling a page was silently changing design
  figures.
- **"adi" is always lowercase**, never ADI. That includes anything a
  `text-transform: uppercase` would catch — the brand strapline in the top bar
  is deliberately *not* uppercased for exactly this reason.
- **British English** throughout.
- The sizer's source file contains **literal `\uXXXX` escapes** in its JS
  strings. Any scripted edit has to match those bytes rather than the character
  they stand for. (It is plain LF now, whatever it once was.)
- **The top bar is shared; everything below it is not.** `trace.html`,
  `index.html` and `simulator.html` each hold a copy of the same block, marked
  `adi SHARED BRAND BAR ... end shared brand bar`. Same adi logo at 30 px, same
  `#10151a` bar, same 3 px adi-blue rule under it, same title and strapline
  scale, same step rail (`.adi-bar`, `.adi-chain`, both namespaced because
  `.steps` and `.chain` were already taken inside the tools). **Change one copy
  and change all three in the same commit**, and keep the shared brand tokens
  (`--adi-bar`, `--adi-bar-ink`, `--adi-bar-muted`, `--adi-bar-line`,
  `--adi-blue`) identical too. Trace carries ten more buttons in the same bar,
  so it alone adds two breakpoints below the block that drop the strapline and
  then the step labels — that keeps it one row down to a 1366-wide laptop, and
  is the only sanctioned local deviation.
- Below the bar every tool keeps its **deliberately different visual identity**
  so it is obvious which one you are in. Sizer: adi blue, Barlow Condensed.
  Simulator: IBM Plex, dark CAD viewport. Pipe Trace: Archivo, drawing paper,
  graphite rail. Primary: copper/amber. Pipe Trace's 3D check deliberately
  keeps the paper background rather than borrowing the simulator's dark
  viewport.
- Each tool sets one `--tool-accent`, and its only job in the shared bar is to
  light that tool's own step: Trace `#e0a422`, Sizer `#7ad1e4`, Simulator
  `#2fb8a6`. Each is the colour that tool already uses inside itself, so the
  lit step matches the page under it.
- Flow is **red** `#c0392b`, return is **blue** `#2471a3`, per UK convention —
  the same two values in Pipe Trace and the simulator.
- **Everything on the simulator is full width except the pair under the
  diagram.** Consumers and Bypasses sit side by side directly beneath it
  because they are what you touch while watching it; every other panel runs
  the full width. A 340px side column made every table and chart read in a
  third of the screen while the page grew twice as long as it needed to be.
- **The sizer hands over to the simulator the same way Pipe Trace hands over
  to the sizer** — `adi-sizer-handoff` in the shared store, cleared on read,
  with the file still downloaded as the fallback. One key per join, one step
  each.
- **The simulator's diagram is drawn tight on purpose.** `GEO` is sized so a
  whole network fits at 100% rather than any one branch being large — the
  point of that view is watching everything react at once, and zoom is there
  for detail. **Fit never scales above 100%** and takes height into account as
  well as width, or making the geometry denser just gets undone by the fit and
  half the branches sit below the fold.
- **Consumers and Bypasses sit directly under the diagram**, not in the side
  column, because they are the two things you touch while watching it. Toggling
  a load and having to scroll to see what it did is the thing that made the
  page tiring to use.
- **A pump setpoint of 100% of design head is wrong as a default.** It leaves
  the machine flat out at design flow with nothing in hand, so constant-pressure
  control cannot hold a setpoint when a branch opens. The default is 85%, and
  the selection advice asks for a pump whose duty lands near `DUTY_AT_RUNOUT`
  (75%) of its run-out flow.
- **`speedRatio()` has two branches.** The parabola has a closed form; a pasted
  curve does not, so it bisects on the affinity laws — at ratio *s* the curve
  passes through `(s·q, s²·h)`, so the head at Q is `s²·h(Q/s)`. Change one and
  check the other.
- **The simulator opens on the sizer's basis, and everything it adds is a
  choice.** A project imported from the sizer must show the same head the sizer
  reported, or the chain looks broken — that happened three times before it was
  fixed. Three things used to be added silently:
    - a **control valve** on every consumer, sized for authority. Now
      `cvMode`, defaulting to `none`. `authority` and `fixed` are there to be
      switched on deliberately.
    - a **strainer** on every node (`strainer: true`). Now off. A circuit's
      pipe drop already carries the sizer's fittings figure, so anything on the
      drawing was counted twice.
    - **two isolating valves** per node (`isolation: 'butterfly'`), which had
      no UI at all. Now off, for the same reason.
  `renderHeadOrigin()` itemises the index path — pipe, coil, control valve —
  and states which rows the sizer's figure covers. **A real two-port system
  does need the control valve**, and the panel says so and says to take that
  figure to a pump selection; the default is about the two tools agreeing, not
  about the valve being unnecessary.
- **`seedPumpDuty()` has to re-run when the resistance changes.** The pump is
  seeded so its curve passes through the design point at import. Turning the
  control valve allowance on raises the system resistance, so without
  re-seeding the model showed the pump falling short instead of the duty now
  being asked for. `cvMode`, `cvFixed` and `aTarget` all re-seed.
- **The sizer's Additional System Resistances all default to zero** — plant,
  control valve, strainer, misc. The pump figure is then the index run and
  nothing else, which is what makes it comparable with the simulator. The
  safety factor stays at 10%.
- **Bypass advice names the branches and the flow.** `bypassAdvice()` gives the
  shortfall in l/s, an end-of-main figure with 15% on top, and the smallest
  branches that would cover it if converted — smallest first, because a bypass
  only carries its own branch flow and the least is then short-circuited at
  full load. Telling someone in red that it will not work leaves them to do
  the arithmetic that the tool already has.

---

## 6. Deploying

1. Tag the current state: **Releases → Draft a new release** → new tag → publish.
2. Open the file → pencil → select all → paste the new version.
3. Commit with a message that says what changed, directly to `main`.
4. Wait for the green tick on **github-pages** in Deployments.
5. Hard-refresh the live URL (`Ctrl+Shift+R`). On iPhone, force-close the
   home-screen app and reopen — iOS caches hard.
6. Tag again once you have confirmed it works.

To revert: open the last good release → **Browse files** → the file → **Raw** →
copy → paste back → commit.

---

## 7. Checking a change did not break the chain

Two minutes, and it exercises every join:

1. Open `trace.html`, load any drawing, set a scale, place a plant and a load,
   trace one run.
2. Open **3D check**, confirm the plant, the main and the load sit at the
   heights they were given, then come back to the plan.
3. **Check** — it should come back clean.
4. **Send to Sizer**. The sizer should open with the project already in it and
   say so in the toast.
5. Confirm the **size and the fitting count match** what Pipe Trace showed, and
   that the **index run is ticked on the same path** the trace schedule named.
6. Save from the sizer, open it in the simulator, confirm it solves.

If sizes differ between trace and sizer, look first at roughness, then at the
viscosity note in section 2.

### If you touched valves or fittings

7. Drop a terminal set on a branch and an isolating pair on a main, then open
   **Schedule → Valves & fittings**. Every item should have a tag, a size
   inherited from its run and a kPa.
8. **Confirm no fitting key falls through the join.** In the browser console on
   the sizer, after importing:
   `proj.circuits.flatMap(c=>Object.keys(c.fittingSchedule||{})).filter(k=>!FITTING_TYPES[k])`
   must be empty. A key listed there is counted in Pipe Trace and worth zero in
   the sizer.
9. **Reconcile one circuit by hand.** A terminal circuit must agree exactly on
   both bases: Pipe Trace's `dropKpa + coilKpa` for the run equals the sizer's
   `pipeLoss_kPa + consumerLoad`. On the worked example, default basis:
   trace 46.76 + 15 = sizer 5.76 + 56 = **61.76 kPa**.
10. **Check the gap on a main is only what it should be.** With any valve on a
    main on the default basis, Pipe Trace's `dropKpa` is ahead of the sizer's
    `pipeLoss_kPa` by exactly `traceMeta.valveKpaOnMains`, and the export
    dialog quotes that figure. Set `valveBasis` to `k`, re-export, and the two
    should then match to the penny with nothing stranded.
11. **Trace a run with an odd-angle corner** and confirm the run inspector
    says "counted as a set of two elbows" and the fitting list shows 2 ×
    45° elbow for it.

### If you touched the sheet rotation

12. Trace something, then **rotate the drawing** a quarter turn: the trace has
    to still sit on the pipework it was traced from, and Route on plan, Pipe
    installed and Scale in the status strip must not move by a millimetre —
    rotation cannot change a distance. `Ctrl`+`Z` puts both the sheet and the
    trace back together.

---

## 8. History worth keeping

- The topology roll-up check found a **real 3.3 kW data error** in the Fabergé
  schedule (Main 4) that no amount of calculation improvement would have caught.
  Tolerance is 0.25%, not the 1% originally specified — 1% would have missed it.
- Index run validation exists because a duplicated consumer load on the ticked
  path inflated pump head by **200 kPa** on a real build.
- The dwell decay in the report once started from supply temperature instead of
  the mixed shutdown temperature, overstating time-to-target by **1.8×**. Screen
  and report now share one function so they cannot drift again.
