#!/usr/bin/env node
/* Opening a file that has been saved, reopened and re-saved by several people:
   the id counter, the repairs, the settings reset and the revision stamp.
   Source-level checks plus the pure functions run on their own. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const sizer = readFileSync(join(root, 'sizer.html'), 'utf8');
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');

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

/* ---- Pipe Trace ---- */
ok(/function defaultSettings\(/.test(trace) && /S\.settings = Object\.assign\(defaultSettings\(\), st\)/.test(trace),
  'Trace: loadProject starts from defaultSettings(), not the last project\u2019s settings');
ok(/S\.nextId = nextIdFrom\(data\.nextId, S\.nodes, S\.segs, S\.items, S\.measures\)/.test(trace),
  'Trace: nextId on open is never below one past the highest id in the file');
ok(/undoStack\.length = 0;/.test(trace) && /function loadProject/.test(trace),
  'Trace: the undo stack is cleared when a file is opened');
ok(/function repairProject\(/.test(trace) && /const repairs = repairProject\(\)/.test(trace)
  && /Opened, with repairs/.test(trace),
  'Trace: repairProject() runs on open and what it did is shown');
ok(/const NODE_DERIVED = \[/.test(trace) && /const SEG_DERIVED = \[/.test(trace)
  && /SEG_DERIVED = \[[^\]]*'hgroup'/.test(trace),
  'Trace: derived fields are listed by name and seg.hgroup is among them');
ok(/function clearDrawing\(/.test(trace) && /else if \(S\.img\) clearDrawing\(\)/.test(trace),
  'Trace: a take-off with no sheet does not draw over the last job\u2019s drawing');
ok(/function openProjectFile\(/.test(trace) && /openProjectFile\(f\)/.test(trace)
  && /loadProject\(before\)/.test(trace),
  'Trace: one reader for every route a file arrives by, and the job on screen is put back on failure');
ok(/rev: S\.rev \|\| 0, savedAt: S\.savedAt \|\| null, savedBy: S\.savedBy \|\| ''/.test(trace)
  && /S\.rev = \(parseInt\(S\.rev, 10\) \|\| 0\) \+ 1/.test(trace),
  'Trace: rev / savedAt / savedBy are on the file and Save steps the revision');
ok(/traceRev: S\.rev \|\| 0/.test(trace), 'Trace: the sizer export carries the trace revision it was cut from');

/* ---- the sizer ---- */
ok(/nextId = nextIdFrom\(data\.nextId, circuits\)/.test(sizer)
  && /nextId = nextIdFrom\(s\.nextId, circuits\)/.test(sizer),
  'Sizer: nextId from a file or the browser copy is never below one past the highest id');
ok(/nextPlantId = nextIdFrom\(data\.nextPlantId, plantItems\)/.test(sizer),
  'Sizer: nextPlantId is bounded the same way');
ok(/function repairCircuitList\(/.test(sizer) && /const repaired = repairCircuitList\(circuits\)/.test(sizer),
  'Sizer: duplicate ids and dangling Fed-from are repaired on open');
ok(/kids\.forEach\(k => \{ k\.parentId = up; \}\)/.test(sizer),
  'Sizer: deleting a circuit hands its children to the circuit that fed it');
ok(/rev: projectRev,/.test(sizer) && /projectRev = parseInt\(data\.rev, 10\) \|\| 0/.test(sizer),
  'Sizer: rev is written to the file and read back');

/* ---- the pure functions, run ---- */
const traceNext = new Function(extractFunction(trace, 'nextIdFrom') + '; return nextIdFrom;')();
ok(traceNext(3, [{ id: 1 }, { id: 15 }], [{ id: 9 }]) === 16, 'nextIdFrom: a stale counter is lifted past the highest id (Trace)');
ok(traceNext(40, [{ id: 1 }, { id: 15 }]) === 40, 'nextIdFrom: a counter already ahead is kept (Trace)');
ok(traceNext(undefined, []) === 1, 'nextIdFrom: an empty file starts at 1 (Trace)');
ok(traceNext('7', [{ id: 'x' }, { id: null }, { id: 2 }]) === 7, 'nextIdFrom: non-numeric ids are ignored (Trace)');

const sizerNext = new Function(extractFunction(sizer, 'nextIdFrom') + '; return nextIdFrom;')();
ok(sizerNext(2, [{ id: 1 }, { id: 2 }, { id: 3 }]) === 4, 'nextIdFrom: a stale counter is lifted past the highest id (sizer)');

const repair = new Function('let nextId = 100;' + extractFunction(sizer, 'repairCircuitList')
  + '; return function (list) { const n = repairCircuitList(list); return { n, nextId }; };')();
const list = [{ id: 1, parentId: null }, { id: 2, parentId: 1 }, { id: 2, parentId: 1 }, { id: 5, parentId: 99 }, { id: 6, parentId: 6 }];
const res = repair(list);
ok(list[2].id === 100 && res.n.dupIds === 1, 'repairCircuitList: the second of two circuits sharing an id is renumbered');
ok(list[3].parentId === null && list[4].parentId === null && res.n.dangling === 2,
  'repairCircuitList: a Fed-from naming a missing circuit, or itself, is cleared');
ok(list[1].parentId === 1 && list[1].id === 2, 'repairCircuitList: a sound row is untouched');

/* ---- the handover says so ---- */
ok(/repairProject\(\)/.test(claude) && /nextIdFrom\(\)/.test(claude) && /rev/.test(claude),
  'CLAUDE.md records the repair on open, the id rule and the revision stamp');
ok(/chain-consistency-test/.test(agents) && /persistence-repair-test/.test(agents),
  'AGENTS.md names both new checks');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall persistence / repair checks passed');
