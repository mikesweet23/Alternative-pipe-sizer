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
node tests/concept-pdf-report-test.mjs
node tests/chain-consistency-test.mjs
node tests/persistence-repair-test.mjs
node tests/trace-multiselect-truesize-help-test.mjs
node tests/viscosity-basis-test.mjs
```

`chain-consistency-test` evaluates the blocks that exist as copies in more than one file — `waterMu` / `waterRho` / `waterCp`, `FITTING_TYPES`, the authority rule, the brand bar, the handoff keys — and fails if any copy has drifted. Run it after touching any of them. `viscosity-basis-test` is the acceptance set for `viscosityMode`, the Al-Shemmeri `waterMu`, the calculation-basis panel and the straight-pipe check. `persistence-repair-test` covers what happens when a file that has been through several hands is opened: the id counter, the repairs, the settings reset, the revision stamp. `trace-multiselect-truesize-help-test` covers the lasso and group editing, true size on the plan / 3D / PDF, the help pane and the long-session guards (`scheduleRender`, `dropPointerState`, the autosave image cache, `asOneUndo`).

A headless browser can drive the real pages: Google Chrome is on the VM at `/usr/local/bin/google-chrome`, and `playwright-core` installed outside the repo (for example under `/tmp`) can `page.evaluate()` the tools' own functions — `loadProject`, `projectBundle`, `solve`, `buildSizerProject` in Trace; `applyProjectData`, `buildProjectSnapshot`, `calculateCircuit` in the sizer; `loadProject`, `solve` in the simulator. Nothing browser-based lives in the repo: the tools have no dependencies and that is deliberate.

Concept is schematic: after tracing a run, type **Installed length** on that run. Check fails with "do not reach" / "no size" when a click near a load did not actually join — finish on the ringed edge of the box, not a free point beside it. Corners lock to 90°/45°; Alt frees one hop.

With **Select** (`V`), drag on open paper to lasso several units, runs and valves; Shift-click adds or removes one; Ctrl+A takes all. Drag any picked thing to move the group; Ctrl+D duplicates beside it, Ctrl+C / Ctrl+V copy and paste (the clipboard is in `localStorage`, so it survives Change drawing and a reload); arrow keys nudge 50 mm; Delete removes the lot. A branch into a lassoed unit comes with it even when its tee is outside the box, and a copy gets one new tee per shared end. Components and pipes are drawn at **true size** by default (`1:1` button; `Aa` cycles labels); the same footprints go to 3D and the PDF plan plate. `? Help` (or `?` / F1) opens the searchable "I want to…" pane.

Trace opens **Two pipes / Single pipe** as soon as the tool is armed. Hover a run for branch dots (a pair shows flow and return). Click the edge ring on a load or vessel to connect and drop the pencil. Double-click empty paper to zoom in on that spot. There is no Tee tool and no automatic terminal set. Set **Height** in the hint bar before a click to start a riser — each point on the run has its own, the same as AC Trace, and 3D check draws them. Click a run to edit the list, or Level / Set all.

Several chillers or boilers on one header are one primary (duty / assist / standby on the plant). An inline **Pump** (`K`) shows indicative flow, index head and absorbed kW; an inline **Cooler** (`Y`) sits in the line and does not open a new circuit.

A two-port buffer is in the line: click the edge ring to finish, then start again from the far side. The load past it still sits on that pipe. A second run onto the same load (return, or flow through the buffer) is the other leg, not a loop.

A dry cooler with one run is an off-loader (3-port on the return). The branch sizes from reject kW, or from the circuit if that box is empty. It is not another plant load and Check must not say "no load".

**PDF** on the Trace bar (Concept too) opens a printable report: 3D isometric, pipework schedule, metres by material and size, counted fittings, placed valves, index run. Same print-window pattern as the sizer.
