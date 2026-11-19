#!/usr/bin/env node
/* Source-level checks: Change drawing keeps the trace and offers to align it
   onto the new sheet; Align moves, turns and scales the take-off and the
   scale together so no length changes; a concept moving on to a drawing gets
   a scale of its own. The transform itself is evaluated out of the file. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}
function extractFunction(text, name) {
  const m = new RegExp('^function\\s+' + name + '\\s*\\(', 'm').exec(text);
  if (!m) return null;
  let i = text.indexOf('{', m.index), depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(m.index, i + 1);
  }
  return null;
}

/* ---- wiring ---- */
ok(/id="srAlign"/.test(trace) && /startAlign\(\)/.test(trace), 'the Change drawing dialog offers Align');
ok(/id="zAlign"/.test(trace) && /el\('zAlign'\)\.addEventListener\('click', \(\) => startAlign\(\)\)/.test(trace),
  'Align is on the zoom bar at any time');
ok(/function turnTakeoff\(deg, cOld, cNew\) \{\s*mapTakeoff\(turnAbout\(deg, cOld, cNew\), 1\);/.test(trace),
  'rotation and alignment go through the one mapTakeoff()');
ok(/S\.measures \|\| \[\]\)\.forEach\(m => \{ if \(m\.pts\) m\.pts = m\.pts\.map\(T\); \}\)/.test(trace)
  && /S\.calib\.a = T\(S\.calib\.a\)/.test(trace), 'tapes and the calibration line move with the take-off');
ok(/\(t\.x - O\.x\) \/ s/.test(trace), 'a traced header line (metres) is turned, never scaled');
ok(/pushUndo\('align the trace to the drawing', true\)/.test(trace)
  && /scale: withScale \? \{ pxPerM: S\.pxPerM, calib: S\.calib \} : undefined/.test(trace)
  && /if \(d\.scale\) \{/.test(trace), 'undoing an alignment puts the scale back with the trace');
ok(/if \(tool === 'align'\) \{/.test(trace) && /if \(draft && draft\.kind === 'align'\) drawAlign\(g, k\);/.test(trace),
  'the align tool takes clicks and draws its points');
ok(/if \(tool === 'align'\) return;/.test(trace), 'a double-click in Align does not zoom or select');

/* ---- concept → drawing ---- */
ok(/const fromConcept = !!\(S\.img && S\.img\.virtual\);/.test(trace)
  && /showDrawing\(\{ replaced, fromConcept, conceptPx \}\)/.test(trace),
  'leaving the concept grid is detected');
ok(/pendingConceptPx = opts\.conceptPx > 0 \? opts\.conceptPx : 0;\s*S\.pxPerM = 0; S\.calib = null;/.test(trace),
  'the concept scale is not kept for the drawing');
ok(/if \(pendingConceptPx > 0\) layConceptOnDrawing\(\);/.test(trace)
  && /startAlign\(\{ keepScale: true \}\)/.test(trace), 'once the scale is set the concept is laid on and Align offered');

/* ---- the transform ---- */
const src = ['alignTransform', 'keepH', 'dist'].map(n => extractFunction(trace, n));
ok(src.every(Boolean), 'alignTransform, keepH and dist extract');
const S = { pxPerM: 50 };
const alignTransform = new Function('S', src.join('\n') + '\nreturn alignTransform;')(S);
const a = { x: 400, y: 400 }, b = { x: 1200, y: 700 };
const k = 1.5, off = { x: 150, y: 80 };
const map = p => ({ x: off.x + p.x * k, y: off.y + p.y * k });
let t = alignTransform([a, b, map(a), map(b)], { keepScale: false, square: false });
const c = { x: 800, y: 400, h: 3.5 }, tc = t.T(c);
ok(Math.abs(t.s - 1.5) < 1e-9 && Math.abs(t.pxPerM - 75) < 1e-9, 'scale factor and the new px/m');
ok(Math.abs(tc.x - map(c).x) < 1e-6 && Math.abs(tc.y - map(c).y) < 1e-6 && tc.h === 3.5,
  'a third point lands where it is on the new sheet, height kept');
ok(Math.abs(Math.hypot(tc.x - t.T(a).x, tc.y - t.T(a).y) / t.pxPerM - Math.hypot(c.x - a.x, c.y - a.y) / S.pxPerM) < 1e-9,
  'a traced length is the same in metres after');
ok(t.miss < 1e-9, 'an exact pair of points lands exactly');
// a sheet turned 90°
const turn = p => ({ x: 2000 - p.y, y: p.x });
t = alignTransform([a, b, turn(a), turn(b)], { keepScale: false, square: false });
ok(Math.abs(t.deg - 90) < 1e-9 && Math.abs(t.s - 1) < 1e-9, 'a quarter turn reads as 90°');
t = alignTransform([a, b, turn(a), turn(b)], { keepScale: false, square: true });
ok(t.miss > 1, 'keeping it square on a turned sheet reports the miss');
t = alignTransform([a, b, map(a), map(b)], { keepScale: true, square: false });
ok(t.s === 1 && t.pxPerM === 50, 'keep the scale: move and turn only');

/* ---- the handover ---- */
ok(/Change drawing keeps the trace, and Align lays it on the new sheet/.test(claude)
  && /layConceptOnDrawing\(\)/.test(claude) && /### If you touched Change drawing or Align/.test(claude),
  'CLAUDE.md describes it and how to check it');

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nall passed');
