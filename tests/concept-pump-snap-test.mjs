#!/usr/bin/env node
/* Source-level checks for Concept pumps, edge snap, multi-plant and dry cooler.
   Parses the HTML — there is no build step to run. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

ok(/id: 'pump'/.test(trace) && /id: 'drycooler'/.test(trace),
  'rail has Pump and Cooler tools');
ok(/function addPump/.test(trace) && /function addDryCooler/.test(trace),
  'addPump and addDryCooler exist');
ok(/function pumpForm/.test(trace) && /function drycoolerForm/.test(trace),
  'pump and dry-cooler inspectors exist');
ok(/function pumpThrough/.test(trace) && /function fitPumpSet/.test(trace),
  'indicative pump duty and Fit pump set exist');
ok(/P = Q/.test(trace) && /index head/.test(trace),
  'pump form states P = Q × Δp / η from the index head');

ok(/SOURCE_ROLES/.test(trace) && /dutyRole/.test(trace) && /Standby/.test(trace),
  'plants carry a duty / assist / standby role');
ok(/function plantFeedShare/.test(trace) && /function plantFeedsInto/.test(trace),
  'parallel plant feeds share the header primary');
ok(/function connectedSourceClusters/.test(trace),
  'plants on one network stay one primary group');
ok(/A second chiller onto the same header/.test(trace),
  'buildTree treats a second plant as duty/assist, not a loop');
ok(/sizeLps/.test(trace) && /standby/.test(trace),
  'standby is sized to take over and carries nothing at design');
ok(/!plantOnSeg\(s\)/.test(trace),
  'Check does not call a plant feed "no load"');

ok(/function portFacing/.test(trace) && /function squareIntoUnit/.test(trace),
  'last hop onto a casing is faced and squared');
ok(/function unitLanding/.test(trace),
  'preview and finish share one landing onto a unit');
ok(/opts\.edge !== false/.test(trace) && /magnet: false/.test(trace),
  'new connections land on the outline, not the centre magnet');
ok(/function endClearPx/.test(trace) && /nodeDrawHalf/.test(trace),
  'terminal valves stand outside the drawn box');
ok(/unitTol = 56/.test(trace),
  'casings get a wider snap so a click on the edge joins');

ok(/data-f="lengthOverride"/.test(trace) && /there is no drawing to measure/.test(trace),
  'Concept run inspector asks for installed length');
ok(/lengthOverride/.test(trace) && /lenEl\.focus/.test(trace),
  'Concept focuses the typed length when a run is selected');

ok(/LOAD_KINDS/.test(trace) && /What it is/.test(trace) && /function nextKindName/.test(trace),
  'a load can be called AHU, FCU, dry cooler, and so on');
ok(/function drawInline/.test(trace),
  'pump and dry cooler have their own symbols');
ok(/type !== 'drycooler'/.test(trace) && /dryCoolerKpaOn/.test(trace),
  'in-line dry cooler drop is split across the runs that meet it');

ok(/function isInLineVessel/.test(trace) && !/function continueThrough/.test(trace),
  'an in-line vessel finishes and drops the pencil — no extra hop');
ok(/second run onto a load is the other leg/.test(trace),
  'a second run onto a load (flow through a buffer) is not a loop');
ok(/if \(n\.feedSeg == null\) n\.feedSeg = seg\.id/.test(trace),
  'the first feed onto a 2-pipe load is kept when the other leg arrives');
ok(/isPrimaryFeed/.test(trace) && /Other leg of the same load/.test(trace),
  'export does not invent a second consumer for the other leg');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall concept pump / snap checks passed');
