# adi Pipework Toolchain — design notes

Four self-contained HTML tools served from GitHub Pages. No build step, no
dependencies to install, no server. Each file opens on its own from a hard
disk, which is deliberate: they have to work on site.

**This document is the handover.** If someone picks this up cold — another
engineer, a developer, or an AI assistant in a fresh conversation — reading
this should be enough to make a safe change. Keep it current.

---

## 1. The chain

| Step | File | URL | Does |
|---|---|---|---|
| 1 | `trace.html` | `/trace.html` | Take-off from a scaled drawing |
| 2 | `index.html` | `/` | Sizing, losses, heat loss, reheat |
| 3 | `simulator.html` | `/simulator.html` | Network solve, pumps, balancing |
| — | `primary-circuit-sizer.html` | `/primary-circuit-sizer.html` | Plant-side primary loop (standalone) |

Steps 1→2→3 pass a single JSON file between them. Cross-links in the top bars
are **relative** (`./index.html` etc.) so they survive a repo rename.

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

### Hydraulics
- `Q = ṁ·cp·ΔT`
- Darcy-Weisbach, Colebrook-White via the Swamee-Jain explicit form
- Laminar `f = 64/Re` below Re 2300
- Default limit **300 Pa/m**, velocity **0.3–3.0 m/s**

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
them automatically. Source: CIBSE Guide C / Crane TP-410.

| Fitting | DN15 | DN50 | DN150 | DN300 |
|---|---|---|---|---|
| 90° elbow (short radius) | 1.00 | 0.75 | 0.60 | 0.52 |
| 90° elbow (long radius) | 0.55 | 0.42 | 0.34 | 0.30 |
| Pulled bend | 0.35 | 0.28 | 0.22 | 0.19 |
| Tee through branch | 1.60 | 1.30 | 1.05 | 0.92 |
| Strainer | 2.80 | 2.50 | 2.20 | 2.00 |
| Double regulating valve | 3.50 | 3.00 | 2.60 | 2.40 |
| Commissioning set | 4.00 | 3.40 | 3.00 | 2.70 |
| Flanged joint | 0.06 | 0.05 | 0.04 | 0.04 |

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
| Pump curves | Generic, shut-off at 125% of design | Real curves |
| Valve Kv and PICV range | Generic | Selected products |

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

Pipe Trace has its own separate save format, `app: 'adi-pipe-trace'`, holding
the drawing, the scale and the traced geometry. That never goes to the sizer.

---

## 5. Conventions that are easy to break

- **Number inputs must not respond to the scroll wheel.** Wheel over a focused
  number field blurs it instead. Arrow keys blocked, spinners hidden. This was a
  deliberate safety decision — scrolling a page was silently changing design
  figures.
- **"adi" is always lowercase**, never ADI.
- **British English** throughout.
- The sizer's source file uses **CRLF line endings** and contains literal JS
  escapes. Any scripted edit must match exact bytes and use `\r\n`.
- Every tool has a **deliberately different visual identity** so it is obvious
  which one you are in. Sizer: adi blue, Barlow Condensed. Simulator: IBM Plex,
  dark CAD viewport. Pipe Trace: Archivo, drawing paper, graphite rail.
  Primary: copper/amber.
- Flow is **red**, return is **blue**, per UK convention.

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
2. **Send to Sizer**, then open that file in the sizer.
3. Confirm the **size and the fitting count match** what Pipe Trace showed.
4. Save from the sizer, open it in the simulator, confirm it solves.

If sizes differ between trace and sizer, look first at roughness, then at the
viscosity note in section 2.

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
