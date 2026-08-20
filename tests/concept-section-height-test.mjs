#!/usr/bin/env node
/* Source-level checks: Pipe Trace heights per section, matching AC Trace. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

ok(/id="hgtIn"/.test(trace) && /The height the next section is traced at/.test(trace),
  'hint bar has a Height box for the next section');
ok(/\.hint\.tape \.hgt \{ display: none; \}/.test(trace),
  'tape hides the height box — it is not a pipe');
ok(/function vertexH\(/.test(trace) && /function heightsOf\(/.test(trace)
  && /function riseBreakdown\(/.test(trace) && /function inferredSegHeight\(/.test(trace),
  'vertexH / heightsOf / riseBreakdown resolve a point height');
ok(/sg\.pts\[i\]\.h/.test(trace) || /p\.h !== undefined/.test(trace),
  'each point can carry its own height');
ok(/function heightPointsBox\(/.test(trace) && /Level the whole run/.test(trace)
  && /Set all to/.test(trace) && /data-hp=/.test(trace),
  'run inspector lists every point, with Level and Set all');
ok(/function segPoly3D\(/.test(trace) && /heightsOf\(sg\)/.test(trace)
  && /hs\[i - 1\]/.test(trace),
  '3D walks the point heights — a main at 3.5 m is not drawn at the plant');
ok(/function keepH\(/.test(trace) && /reseatSeg/.test(trace)
  && /turnAbout/.test(trace),
  'reseat and rotate keep .h on a point');
ok(/function heightAtHit\(/.test(trace) && /function heightAtSnap\(/.test(trace)
  && /ptAt\(at0\.x, at0\.y, h0\)/.test(trace),
  'a new trace stamps the armed height; a branch picks up the pipe');
ok(/tool === 'trace'/.test(trace) && /Next section at/.test(trace),
  '[ and ] nudge height while Trace is armed');
ok(/@ ' \+ fmt\(traceHeight, 2\) \+ ' m'/.test(trace)
  || /@ ' \+ fmt\(traceHeight/.test(trace),
  'live preview shows plan metres and the height being drawn at');

ok(/Heights per section/.test(claude) && /vertexH\(\)/.test(claude)
  && /riseBreakdown\(\)/.test(claude),
  'CLAUDE.md records the AC Trace height model');
ok(/concept-section-height-test/.test(agents) && /Height/.test(agents),
  'AGENTS.md names the check and the Height box');

/* Runtime: the rise walk, same as riseBreakdown, on a plant → main → load. */
function heightOf(n) { return n.height; }
function riseBreakdown(sg, nodes) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const up = byId[sg.up != null ? sg.up : sg.a];
  const dn = byId[sg.down != null ? sg.down : sg.b];
  const hs = sg.pts.map(p => p.h);
  const start = up ? Math.abs(hs[0] - heightOf(up)) : 0;
  let mid = 0;
  for (let i = 1; i < hs.length; i++) mid += Math.abs(hs[i] - hs[i - 1]);
  const end = dn ? Math.abs(heightOf(dn) - hs[hs.length - 1]) : 0;
  return { start, mid, end, total: start + mid + end };
}
const plant = { id: 1, height: 1.0 };
const load = { id: 2, height: 2.5 };
const run = {
  a: 1, b: 2, up: 1, down: 2,
  pts: [{ x: 0, y: 0, h: 3.5 }, { x: 10, y: 0, h: 3.5 }, { x: 10, y: 8, h: 2.8 }],
};
const r = riseBreakdown(run, [plant, load]);
ok(Math.abs(r.start - 2.5) < 1e-9, 'rise at the plant is 2.5 m (1.0 → 3.5)');
ok(Math.abs(r.mid - 0.7) < 1e-9, 'rise along the run is 0.7 m (3.5 → 2.8)');
ok(Math.abs(r.end - 0.3) < 1e-9, 'drop at the load is 0.3 m (2.8 → 2.5)');
ok(Math.abs(r.total - 3.5) < 1e-9, 'one-way riser is the sum, not |load − plant|');

const old = {
  a: 1, b: 2, up: 1, down: 2,
  pts: [{ x: 0, y: 0, h: 1.0 }, { x: 10, y: 0, h: 1.0 }],
};
const oldR = riseBreakdown(old, [plant, load]);
ok(Math.abs(oldR.total - 1.5) < 1e-9,
  'a file with no mid-run height still counts |load − plant| as the drop');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall section-height checks passed');
