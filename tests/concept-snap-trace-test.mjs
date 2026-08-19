#!/usr/bin/env node
/* Source-level checks for Trace two/single, hover-dots, edge finish, valves. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const sim = readFileSync(join(root, 'simulator.html'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

ok(/id="tpal"/.test(trace) && /data-tmode="pair"/.test(trace)
  && /data-tmode="single"/.test(trace) && /data-tleg="return"/.test(trace),
  'Trace flyout offers two pipes, single flow and single return');
ok(/function setTraceMode/.test(trace) && /function currentTraceMode/.test(trace),
  'trace mode is chosen the moment Trace is armed');
ok(/function syncTracePalette/.test(trace) && /tool === 'trace'/.test(trace),
  'the flyout appears as soon as Trace is on');

ok(!/id: 'tee'/.test(trace), 'Tee tool is gone from the rail');
ok(/function nearestPipeDot/.test(trace) && /function pipeDotsOn/.test(trace)
  && /function drawPipeDots/.test(trace),
  'hovering a run shows dots on the pipe(s)');
ok(/function hitSegLeg/.test(trace) && /pairLegPts/.test(trace),
  'a pair can be hit as flow or return, not only the centreline');

ok(/opts && opts.draw/.test(trace) && /nodeDrawHalf/.test(trace),
  'the connection ring sits on the drawn outline');
ok(/Click the ring on a load or vessel to connect and release/.test(trace),
  'hint says click the ring to connect and release');
ok(!/function continueThrough/.test(trace),
  'finishing on a vessel does not pull another pipe');

ok(/autoTermSet: false/.test(trace),
  'automatic terminal sets are off by default');
ok(/const fitted = autoFitTerminalSet/.test(trace) === false,
  'finishTrace does not drop valves on its own');

ok(/ctrl3Mix/.test(trace) && /3-port mixing valve/.test(trace)
  && /ctrl3Div/.test(trace) && /3-port diverting valve/.test(trace),
  'palette has 3-port mixing and diverting valves');
ok(/threePortMix/.test(trace) && /threePortMix/.test(sim),
  '3-port mixing is a load arrangement in Trace and the simulator');
ok(/case 'ctrl3mix'/.test(trace) && /case 'ctrl3div'/.test(trace),
  'mixing and diverting have their own symbols');

ok(/function zoomInto/.test(trace) && /zoomInto\(ev, ev.shiftKey/.test(trace),
  'double-click empty paper zooms in on that spot');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall snap / trace-mode checks passed');
