# Agent notes

Three self-contained HTML tools. No build step, no package manager. The handover is `CLAUDE.md`.

## Cursor Cloud specific instructions

Serve the repo root and open the HTML files. Do not look for `npm run dev`.

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then `http://127.0.0.1:8765/trace.html` (Pipe Trace / Concept), `sizer.html`, `simulator.html`. `/` redirects to Trace.

Source-level checks (no browser):

```bash
node tests/concept-fourpipe-test.mjs
node tests/concept-pump-snap-test.mjs
node tests/concept-snap-trace-test.mjs
node tests/concept-cooler-offload-test.mjs
node tests/concept-section-height-test.mjs
```

Concept is schematic: after tracing a run, type **Installed length** on that run. Check fails with "do not reach" / "no size" when a click near a load did not actually join — finish on the ringed edge of the box, not a free point beside it. Corners lock to 90°/45°; Alt frees one hop.

Trace opens **Two pipes / Single pipe** as soon as the tool is armed. Hover a run for branch dots (a pair shows flow and return). Click the edge ring on a load or vessel to connect and drop the pencil. Double-click empty paper to zoom in on that spot. There is no Tee tool and no automatic terminal set. Set **Height** in the hint bar before a click to start a riser — each point on the run has its own, the same as AC Trace, and 3D check draws them. Click a run to edit the list, or Level / Set all.

Several chillers or boilers on one header are one primary (duty / assist / standby on the plant). An inline **Pump** (`K`) shows indicative flow, index head and absorbed kW; an inline **Cooler** (`Y`) sits in the line and does not open a new circuit.

A two-port buffer is in the line: click the edge ring to finish, then start again from the far side. The load past it still sits on that pipe. A second run onto the same load (return, or flow through the buffer) is the other leg, not a loop.

A dry cooler with one run is an off-loader (3-port on the return). The branch sizes from reject kW, or from the circuit if that box is empty. It is not another plant load and Check must not say "no load".
