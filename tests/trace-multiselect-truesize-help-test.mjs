#!/usr/bin/env node
/* Source-level checks for Pipe Trace's lasso / group editing, true size on
   the plan, in 3D and on the PDF, the help pane, and the long-session
   stability work that went in with them. */
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
const has = re => re.test(trace);

/* ---- several things at once ---- */
ok(has(/let marquee = null/) && has(/function selectInBox/),
  'a lasso dragged on open paper with Select builds a selection');
ok(has(/kind: 'multi', nodes: \[\], segs: \[\], items: \[\], measures: \[\]/),
  'the multi selection holds nodes, runs, valves and tapes');
ok(has(/function isSel\(kind, id\)/) && !has(/sel && sel\.kind === 'node' && sel\.id === n\.id/),
  'everything that draws a picked state asks isSel(), not sel.kind/sel.id by hand');
ok(has(/function toggleInSelection/) && has(/ev\.shiftKey/),
  'Shift-click adds to or takes from the selection');
ok(has(/function selectAll/) && has(/k === 'a'[^\n]*selectAll|selectAll\(\)[^\n]*k === 'a'|\(k === 'a'\)/),
  'Ctrl+A selects everything on the sheet');
ok(has(/function settleMulti/) && has(/if \(c === 1\)/),
  'a multi of one thing settles to that thing; of nothing, to null');
ok(has(/function moveSelection\(dx, dy\)/) && has(/drag\.group/),
  'dragging any picked component moves the whole group');
ok(has(/const butLast = pts\.slice\(0, -1\), butFirst = pts\.slice\(1\)/),
  'the branch into a lassoed unit comes with it even when its tee is outside the box');
ok(has(/function packSelection/) && has(/kind: 'pack'/) && has(/\(p\.x - cx\) \/ s/)
  && has(/strip\(JSON\.parse\(JSON\.stringify\(n\)\), NODE_DERIVED\)/) && has(/SEG_DERIVED\)/),
  'a pack is in metres about its own centre, with derived figures stripped');
ok(has(/function placePack\(pack, cx, cy\)/) && has(/idMap\[endId\] = j\.id/),
  'a run whose far end was not packed gets a tee, and two such runs share one');
ok(has(/const nthName = /) && has(/nextValveTag\(d\.tag\)/) && has(/autoNameRuns\(true\)/),
  'copies are named the next of their kind, valves get fresh tags, runs are renumbered');
ok(has(/function duplicateSelection/) && has(/asOneUndo\('duplicate '/),
  'Ctrl+D / Duplicate sets a copy beside the original as one undo step');
ok(has(/const CLIP_KEY = 'adi-pipe-trace-clipboard'/) && has(/localStorage\.setItem\(CLIP_KEY/),
  'Ctrl+C keeps the pack in the browser so it survives Change drawing and a reload');
ok(has(/function pasteClipboard/) && has(/function pasteAt/) && has(/lastPointer/),
  'Ctrl+V lands the pack under the cursor, or mid-view');
ok(has(/function nudgeSelection/) && has(/lastNudgeAt/),
  'arrow keys nudge the selection; a run of presses is one undo step');
ok(has(/function deleteMulti/) && has(/neighbours\(x\.id\)\.length > 0/),
  'Delete on a group removes it and any tee left joining nothing');
ok(has(/function multiForm/) && has(/function wireMultiForm/) && has(/sel\.kind === 'multi'/),
  'the inspector has a form for a group');
ok(has(/function hitAny/) && has(/function nodeUnder/),
  'Select resolves item / port / node / tape / run in one place; a click inside a small unit is for the unit');

/* ---- true size ---- */
ok(has(/trueSize: true/) && has(/function trueSizeOn\(\)/) && has(/const TRUE_SIZE_MIN_PX = 7/),
  'true size is the default; the only floor is a 7 px dot');
ok(has(/if \(real && trueSizeOn\(\)\)/), 'nodeDrawHalf() returns the real footprint at true size');
ok(has(/id="zTrue"/) && has(/function toggleTrueSize/) && has(/name="trueSize"|data-s="trueSize"|trueSize/),
  'a 1:1 button by the zoom and a switch in Pipe & basis turn it off');
ok(has(/function labelLevel/) && has(/id="zLbl"/) && has(/const LABEL_MODES/) && has(/labels: 'auto'/),
  'labels drop to names only when zoomed out; Aa cycles auto / all / none');
ok(has(/if \(exporting\) return 2/), 'exports always carry every label');
ok(has(/function nodeLabelPlan/), 'writing goes inside the box only when it fits');
ok(has(/function node3DFoot/) && has(/function node3DHeight/) && has(/trueSizeOn\(\)/),
  '3D boxes are the real footprint, turned as on the plan');
ok(has(/function planCrop/) && has(/function planImage/) && has(/<h2>2\. Plan<\/h2>/),
  'the PDF report carries a plan plate drawn at a fixed scale');
ok(has(/async function exportTracePDFReport/), 'the report window is opened before the plates are drawn');

/* ---- help ---- */
ok(has(/const HELP = \[/) && has(/const HELP_KEYS = \[/), 'help is a list of "I want to…" tips plus the keys');
ok(has(/id="helpPane"/) && has(/id="helpQ"/) && has(/id="helpBody"/) && has(/id="bHelp"/),
  'a searchable help pane with a button on the bar');
ok(has(/function renderHelp/) && has(/function toggleHelp/) && has(/function helpMatches/),
  'the pane filters on the search box and lights the tips for the armed tool');
ok(has(/function buildBoardHelp/) && has(/id="boardHelp"/), 'the start page shows the same tips');
ok(has(/k === '\?'|key === '\?'/) && has(/F1/), '? and F1 open the help');

/* ---- long-session stability ---- */
ok(has(/function scheduleRender/) && has(/requestAnimationFrame/),
  'pointer moves coalesce to one redraw a frame');
ok(has(/function renderInner/) && has(/renderFailedMsg/),
  'render() catches a broken solve, says so once, and drops the pointer state');
ok(has(/function dropPointerState/) && has(/window\.addEventListener\('blur'/),
  'losing the window drops a drag, a pan and a lasso');
ok(has(/let autosavedImg = null/) && has(/if \(autosavedImg === key\) return/),
  'autosave writes the drawing once per sheet, not every 900 ms');
ok(has(/const was = undoSuspended;/) && has(/finally \{ undoSuspended = was;/),
  'asOneUndo restores the suspension it found, so grouped actions nest');
ok(!has(/undoSuspended = true;\s*\n\s*const ok = mergeAtJunction/),
  'deleting a tee goes through asOneUndo rather than toggling the flag by hand');
ok(has(/if \(!sel\) return;/), 'the inspector change handler survives the inspector having closed');

/* ---- the handover ---- */
ok(/lasso/i.test(claude) && /packSelection/.test(claude) && /placePack/.test(claude),
  'CLAUDE.md explains the lasso and the pack');
ok(/true size/i.test(claude) && /trueSizeOn/.test(claude) && /TRUE_SIZE_MIN_PX/.test(claude),
  'CLAUDE.md explains true size');
ok(/helpPane|HELP\b/.test(claude) && /renderHelp/.test(claude), 'CLAUDE.md explains the help pane');
ok(/scheduleRender/.test(claude) && /dropPointerState/.test(claude) && /autosavedImg/.test(claude),
  'CLAUDE.md records the stability work');
ok(/trace-multiselect-truesize-help-test/.test(agents), 'AGENTS.md names this check');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall multi-select / true-size / help checks passed');
