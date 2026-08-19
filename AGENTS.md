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
```

Concept is schematic: after tracing a run, type **Installed length** on that run. Check fails with "do not reach" / "no size" when a click near a load did not actually join — finish on the ringed edge of the box, not a free point beside it. Corners lock to 90°/45°; Alt frees one hop.

Several chillers or boilers on one header are one primary (duty / assist / standby on the plant). An inline **Pump** (`K`) shows indicative flow, index head and absorbed kW; an inline **Cooler** (`Y`) sits in the line and does not open a new circuit.

A two-port buffer is in the line: click through it while tracing. The load past it still sits on that pipe. A second run onto the same load (return, or flow through the buffer) is the other leg, not a loop.
