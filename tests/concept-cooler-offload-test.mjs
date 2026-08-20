#!/usr/bin/env node
/* Source-level checks: a dry cooler on a return branch is an off-loader. */
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

ok(/function isOffloader/.test(trace) && /coolerRunCount/.test(trace),
  'a dry cooler with one run is an off-loader');
ok(/function coolerSegDuty/.test(trace) && /function coolerOwnLps/.test(trace)
  && /function coolerCircuitLps/.test(trace) && /function circuitLpsFrom/.test(trace),
  'the branch sizes from reject duty or from the circuit');
ok(/Walk toward loads/.test(trace) && /stop at/.test(trace),
  'circuit default walks toward loads and stops at the plant');
ok(/if \(isOffloader\(nodeById\(s\.down\)\)\) return;/.test(trace),
  'off-loader duty does not roll up into the plant');
ok(/const off = coolerSegDuty\(sg\)/.test(trace),
  'segDuty sizes the cooler branch on its own');
ok(/!isOffloader\(nodeById\(s\.down\)\)/.test(trace),
  'Check does not call an off-loader branch "no load"');
ok(/n\.type === 'pump'/.test(trace) && /in-line/.test(trace),
  'the in-and-out warning is for pumps, not a one-run cooler');
ok(/Off-loader/.test(trace) && /3-port on the return/.test(trace),
  'the cooler inspector states the off-loader case');
ok(/c\.offload = true/.test(trace) && /isOffloader\(down\)/.test(trace),
  'export sends the branch as fromFlow, not a second consumer');
ok(/kW off-loader/.test(trace),
  'the run inspector names it an off-loader, not "no load"');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall cooler off-loader checks passed');
