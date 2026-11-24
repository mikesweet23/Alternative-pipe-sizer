#!/usr/bin/env node
/* Source-level checks: run labels carry size, flow and length; every run
   label and valve tag is laid out against what is already on the plan and
   never on top of it; the writing and valve symbols have a size of their
   own; the valves can be taken off the plan without leaving the take-off;
   and a site drawing can be split into named systems, each with its own
   plate, runs and valves in the PDF. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

// ---- run labels ----
ok(/function runLabelTexts\(sg\)/.test(trace)
  && /const flow = \(sg\.lps \|\| 0\) > 0 \? fmtVol\(sg\.lps\)/.test(trace)
  && /const full = \[nom, flow, len\]/.test(trace),
  'a run label is size, flow and length, the flow in the unit chosen');
ok(/const short = \[nom, flow\]/.test(trace) && /const min = nom \|\| len;/.test(trace),
  'a label short of room falls back to size and flow, then size alone');
ok(/function runLabelCands\(sg, k, lh\)/.test(trace) && /Math\.abs\(dy\) > Math\.abs\(dx\) \* 1\.5 \? -90 : 0/.test(trace),
  'labels try the longest legs first and read along a vertical leg');
ok(!/\(sg\.pipe \? sg\.pipe\.nom \+ '  ' : ''\) \+ fmt\(sg\.lenM, 1\) \+ ' m'/.test(trace),
  'the old size-and-length label drawn in the run loop is gone');

// ---- the layout ----
ok(/function labelGrid\(cell\)/.test(trace) && /hits\(b\)/.test(trace) && /count\(b\)/.test(trace),
  'labels are placed against a spatial grid of what is already written');
ok(/function layoutPlanLabels\(g, k, tagReqs, extra\)/.test(trace)
  && /layoutPlanLabels\(g, k, tagReqs, viewTabs\.concat\(hpTags\)\);/.test(trace),
  'run labels and tags are laid out after the components, round the frames and the high-point tag');
ok(/const force = exporting \? exportKind !== 'key' : \(S\.settings\.labels === 'all'\);/.test(trace),
  'a label with no room is dropped on screen and on the key plan, kept on a system plate');
ok(/\(pickedSegs\.has\(b\.id\) - pickedSegs\.has\(a\.id\)\)/.test(trace) && /\(b\.isIndex \? 1 : 0\) - \(a\.isIndex \? 1 : 0\)/.test(trace),
  'the picked run, the index run and the mains are labelled first');
ok(/const nx = -Math\.sin\(ang\), ny = Math\.cos\(ang\);/.test(trace) && /const sign = r\.it\.leg === 'return' \? 1 : -1;/.test(trace),
  'a valve tag stands out square to its pipe, on its own leg’s side');
ok(/function drawHighPoints\(g, k\) \{\n  const out = \[\];/.test(trace) && /return out;\n\}/.test(trace),
  'the high-point tag is an obstacle the labels go round');
ok(/if \(S\.img\) \{ try \{ scheduleRender\(\); \}/.test(trace), 'a zoom redraws, so labels come back as room is made');

// ---- size of the writing, and hiding the valves ----
ok(/planText: 0\.8,/.test(trace) && /const PLAN_TEXT_STEPS = \[0\.6, 0\.8, 1, 1\.25\];/.test(trace)
  && /function planTextScale\(\)/.test(trace), 'the plan writing has its own size, smaller by default');
ok(/const onScreen = k \* VALVE_SCALE \* planTextScale\(\);/.test(trace), 'the valve symbols follow the same size');
ok(/const kt = k \* planTextScale\(\);/.test(trace) && /'font-size': 10 \* kt,/.test(trace),
  'component names are written at the plan text size');
ok(/showValves: true,/.test(trace) && /function valvesShown\(\) \{ return S\.settings\.showValves !== false \|\| tool === 'valve'; \}/.test(trace),
  'valves can be taken off the plan, and the palette shows them while placing');
ok(/function hitItem\(p, tolPx\) \{\n  if \(!valvesShown\(\)\) return null;/.test(trace), 'a hidden valve cannot be clicked');
ok(/if \(valvesShown\(\)\) S\.items\.slice\(\)/.test(trace), 'hidden valves are not drawn');
ok(/id="zTxt"/.test(trace) && /id="zVlv"/.test(trace) && /id="zSys"/.test(trace)
  && /el\('zTxt'\)\.addEventListener\('click', cyclePlanText\);/.test(trace)
  && /el\('zVlv'\)\.addEventListener\('click', cycleValveView\);/.test(trace),
  'the text size, valve and Systems buttons sit by the zoom');

// ---- systems ----
ok(/views: \[\],                 \/\/ \{ id, name, x, y, w, h \}/.test(trace), 'systems are frames held on the take-off');
ok(/views: S\.views \|\| \[\],\n    nextId: S\.nextId, settings: S\.settings,/.test(trace), 'frames are saved with the take-off');
ok(/S\.views = \(Array\.isArray\(data\.views\) \? data\.views : \[\]\)\.filter/.test(trace)
  && /nextIdFrom\(data\.nextId, S\.nodes, S\.segs, S\.items, S\.measures, S\.views\)/.test(trace)
  && /dedupe\(S\.views\);/.test(trace), 'frames are read back, checked, and their ids counted');
ok(/views: S\.views \|\| \[\], nextId: S\.nextId,/.test(trace) && /if \(Array\.isArray\(d\.views\)\) S\.views = d\.views;/.test(trace),
  'frames are in undo');
ok(/\(S\.views \|\| \[\]\)\.forEach\(v => \{\n    const c = \[T\(/.test(trace), 'frames turn and move with the take-off');
ok(/function addView\(r, name\)/.test(trace) && /function zoomToView\(v\)/.test(trace)
  && /function screenRect\(\)/.test(trace) && /function selectionRect\(\)/.test(trace)
  && /function systemsDialog\(focusId\)/.test(trace), 'frame what is on screen or the selection, and zoom to it');
ok(/id="insMultiSys"/.test(trace), 'a lasso can be made a system from the inspector');
ok(/function viewSegs\(v\)/.test(trace) && /inView\(v, polyAt\(sg\.pts, 0\.5\)\)/.test(trace),
  'a run is in a system when its middle is');

// ---- the PDF ----
ok(/function planImage\(opts\)/.test(trace) && /exportKind = kind; exportCrop = kind === 'system' \? crop : null;/.test(trace)
  && /exporting = false; exportKind = null; exportCrop = null;/.test(trace),
  'a plate is drawn as the key plan or as one system, and the export state is put back');
ok(/planImage\(\{ kind: 'system', crop: v \}\)/.test(trace) && /buildTraceReportHtml\(plan, systems\)/.test(trace),
  'every system gets its own plate in the report');
ok(/function systemSectionHtml\(sy, i\)/.test(trace) && /systems\.map\(\(sy, i\) => systemSectionHtml\(sy, i\)\)/.test(trace)
  && /\.sys\{page-break-before:always;break-before:page\}/.test(trace),
  'each system is a sheet of its own with its runs and valves');
ok(/if \(exporting && exportKind === 'system'\) return out;/.test(trace), 'a system’s own plate does not draw the frames');

// ---- the handover ----
ok(/### Labels, valve visibility and systems on the plan/.test(claude) && /layoutPlanLabels\(\)/.test(claude)
  && /`S\.views`/.test(claude), 'CLAUDE.md describes the label layout and the systems');
ok(/trace-labels-systems-test/.test(agents), 'AGENTS.md lists this check');
ok(/id: 'systems', t: 'I have several systems on one site drawing/.test(trace)
  && /id: 'hidevalves'/.test(trace), 'the help has the tips');

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nall passed');
