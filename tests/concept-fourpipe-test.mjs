#!/usr/bin/env node
/* Checks that stay true after the valve-set, 4-pipe, landing and Concept work.
   Parses the HTML sources — there is no build step to run. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(join(root, name), 'utf8');

const trace = read('trace.html');
const index = read('index.html');
const sizer = read('sizer.html');
const sim = read('simulator.html');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

/* ---------- landing ---------- */
ok(/handoff=1/.test(index) && /\.\/trace\.html/.test(index) && /\.\/sizer\.html/.test(index),
  'index.html redirects to Trace, and ?handoff=1 to the sizer');
ok(!/function sizeFor\(/.test(index),
  'index.html is a stub, not the sizer');
ok(/function calcPD\(/.test(sizer) && /Pipework Sizer/.test(sizer),
  'sizer.html holds the Pipework Sizer');
ok(/href="\.\/sizer\.html"/.test(trace) && /href="\.\/sizer\.html"/.test(sim),
  'Trace and Simulator step rails point at sizer.html');

/* ---------- valve sets ---------- */
function extractSet(id) {
  const re = new RegExp(id + ':\\s*\\{[\\s\\S]*?items:\\s*(\\[[\\s\\S]*?\\])', 'm');
  const m = trace.match(re);
  return m ? m[1] : '';
}
const noReg = ['termPicv', 'term2p', 'term2pOnOff', 'term3p'];
noReg.forEach(id => {
  const items = extractSet(id);
  ok(items.includes('iso') && items.includes('strainer'),
    id + ' keeps isolations and a strainer');
  ok(!/dblRegVal/.test(items) && !/commSet/.test(items),
    id + ' has no DRV and no commissioning set');
});
ok(/dblRegVal/.test(extractSet('termDrv')), 'termDrv still has a DRV');
ok(/commSet/.test(extractSet('termCs')), 'termCs still has a commissioning set');
ok(/function setNeedsRegValve/.test(trace), 'setNeedsRegValve is defined');
ok(/t === 'twoPortBp' \|\| t === 'twoPortCS'/.test(trace),
  'only the bypass arrangements still need a regulating valve');

/* ---------- 4-pipe ---------- */
ok(/function isFourPipe/.test(trace) && /function ensureCool/.test(trace),
  '4-pipe helpers exist');
ok(/4-pipe/.test(trace) && /data-loadtab="heat"/.test(trace) && /data-loadtab="cool"/.test(trace),
  'load inspector has heating and cooling tabs');
ok(/function pickLoadService/.test(trace),
  'tracing onto a 4-pipe load asks which service');
ok(/Occupancy is the feeds the tree actually assigned/.test(trace),
  '4-pipe occupancy uses assigned feeds, not every touching segment');
ok(/second circuit onto a 4-pipe load/.test(trace),
  'buildTree attaches a leftover second circuit after the BFS');
ok(/snapAt\(p, draft\.startNode\)/.test(trace),
  'finishing a trace skips the node it started on');
ok(/Jump through to the far end/.test(trace),
  'a 4-pipe second run snaps through the first circuit to the plant');
ok(/\(cooling\)/.test(trace) && /fourPipeSide/.test(trace),
  'export names the two sides and tags fourPipeSide');

/* ---------- Concept ---------- */
ok(/id="bConcept"/.test(trace) && /id="bPickConcept"/.test(trace),
  'Concept toggle and Start a concept button exist');
ok(/function startConcept/.test(trace) && /lengthOverride/.test(trace),
  'Concept mode and typed installed length exist');
ok(/#sheet\.concept/.test(trace),
  'concept sheet has a grid background');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall checks passed');
