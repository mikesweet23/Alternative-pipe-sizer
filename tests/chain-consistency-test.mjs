#!/usr/bin/env node
/* The blocks that exist as copies in more than one tool, checked against each
   other. CLAUDE.md section 7 asks a person to do this in three browser
   consoles after every change to the fluid basis or the fittings; this does
   the same comparison from the source, so a copy that drifts fails here
   before it reaches the live site. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = {
  trace: readFileSync(join(root, 'trace.html'), 'utf8'),
  sizer: readFileSync(join(root, 'sizer.html'), 'utf8'),
  simulator: readFileSync(join(root, 'simulator.html'), 'utf8'),
};

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

/* Pull one top-level `function name(...) { ... }` out of a file by brace
   matching, so a body can be evaluated on its own. */
function extractFunction(text, name) {
  const m = new RegExp('^function\\s+' + name + '\\s*\\(', 'm').exec(text);
  if (!m) return null;
  let i = text.indexOf('{', m.index);
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(m.index, i + 1);
  }
  return null;
}
/* Pull a top-level `const NAME = { ... };` object literal. */
function extractObject(text, name) {
  const m = new RegExp('^const\\s+' + name + '\\s*=\\s*\\{', 'm').exec(text);
  if (!m) return null;
  let i = text.indexOf('{', m.index);
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(text.indexOf('{', m.index), i + 1);
  }
  return null;
}
const fn = (text, name) => {
  const body = extractFunction(text, name);
  return body ? new Function(body + '; return ' + name + ';')() : null;
};
const obj = (text, name) => {
  const body = extractObject(text, name);
  return body ? new Function('return (' + body + ');')() : null;
};

/* ---- fluid properties: one function, three copies ---- */
const MU_70 = 0.000402339802133043;   // the figure CLAUDE.md section 7 names
['trace', 'sizer', 'simulator'].forEach(k => {
  const mu = fn(src[k], 'waterMu');
  ok(mu && mu(70) === MU_70, k + ': waterMu(70) is exactly ' + MU_70);
});
const temps = [0, 5, 10, 20, 35, 50, 60, 70, 80, 95, 110, 120];
['waterMu', 'waterRho', 'waterCp'].forEach(name => {
  const f = { trace: fn(src.trace, name), sizer: fn(src.sizer, name), simulator: fn(src.simulator, name) };
  const agree = temps.every(T => f.trace(T) === f.sizer(T) && f.sizer(T) === f.simulator(T));
  ok(f.trace && f.sizer && f.simulator && agree, name + '() returns identical digits in all three tools');
});

/* ---- fittings: one table, two copies ---- */
const ftTrace = obj(src.trace, 'FITTING_TYPES');
const ftSizer = obj(src.sizer, 'FITTING_TYPES');
ok(ftTrace && ftSizer, 'FITTING_TYPES found in trace.html and sizer.html');
if (ftTrace && ftSizer) {
  const keysT = Object.keys(ftTrace).sort(), keysS = Object.keys(ftSizer).sort();
  const missingInSizer = keysT.filter(k => !ftSizer[k]);
  const missingInTrace = keysS.filter(k => !ftTrace[k]);
  ok(!missingInSizer.length, 'every fitting key Pipe Trace can count exists in the sizer'
    + (missingInSizer.length ? ' (missing: ' + missingInSizer.join(', ') + ')' : ''));
  ok(!missingInTrace.length, 'every sizer fitting key exists in Pipe Trace'
    + (missingInTrace.length ? ' (missing: ' + missingInTrace.join(', ') + ')' : ''));
  const differ = keysT.filter(k => ftSizer[k] && JSON.stringify(ftTrace[k]) !== JSON.stringify(ftSizer[k]));
  ok(!differ.length, 'every shared fitting carries the same K figures, label and assumed flag'
    + (differ.length ? ' (differ: ' + differ.join(', ') + ')' : ''));
}

/* ---- modulating against on/off: the same rule in two places ---- */
const arrangements = obj(src.simulator, 'ARRANGEMENTS');
const valveTypes = obj(src.trace, 'VALVE_TYPES');
const migrate = fn(src.trace, 'migrateValveType');
const needsAuthority = fn(src.trace, 'valveNeedsAuthority');
const migrateArrangement = fn(src.simulator, 'migrateArrangement');
ok(arrangements && valveTypes && needsAuthority && migrateArrangement,
  'ARRANGEMENTS, VALVE_TYPES, valveNeedsAuthority and migrateArrangement all found');
if (arrangements && valveTypes && needsAuthority && migrateArrangement) {
  // valveNeedsAuthority calls migrateValveType, so both have to be in scope
  const authorityOf = new Function(extractFunction(src.trace, 'migrateValveType') + ';'
    + extractFunction(src.trace, 'valveNeedsAuthority') + '; return valveNeedsAuthority;')();
  const simMigrate = new Function('const ARRANGEMENTS = ' + extractObject(src.simulator, 'ARRANGEMENTS') + ';'
    + extractFunction(src.simulator, 'migrateArrangement') + '; return migrateArrangement;')();
  const disagree = Object.keys(valveTypes).filter(v => {
    const simKey = simMigrate(v);
    return !arrangements[simKey] || arrangements[simKey].authority !== authorityOf(v);
  });
  ok(!disagree.length, 'every Trace arrangement reaches a simulator arrangement with the same authority rule'
    + (disagree.length ? ' (disagree: ' + disagree.join(', ') + ')' : ''));
  ok(simMigrate('twoPort') === 'twoPortMod' && migrate('twoPort') === 'twoPortMod',
    'the old plain "twoPort" migrates to modulating in both tools');
}

/* ---- the shared brand bar and its tokens ---- */
const bar = k => {
  const a = src[k].indexOf('adi SHARED BRAND BAR'), b = src[k].indexOf('end shared brand bar');
  return a >= 0 && b > a ? src[k].slice(a, b).replace(/\s+/g, ' ') : null;
};
ok(bar('trace') && bar('trace') === bar('sizer') && bar('sizer') === bar('simulator'),
  'the shared brand bar CSS block is identical in all three tools');
['--adi-bar', '--adi-bar-ink', '--adi-bar-muted', '--adi-bar-line', '--adi-blue'].forEach(tok => {
  const val = k => { const m = new RegExp(tok + ':\\s*([^;]+);').exec(src[k]); return m && m[1].trim(); };
  ok(val('trace') && val('trace') === val('sizer') && val('sizer') === val('simulator'),
    tok + ' is the same colour in all three tools (' + val('trace') + ')');
});

/* ---- every tool links to the other two by relative path ---- */
['trace', 'sizer', 'simulator'].forEach(k => {
  const others = ['trace', 'sizer', 'simulator'].filter(o => o !== k);
  ok(others.every(o => src[k].includes('./' + o + '.html')),
    k + ' links to ' + others.join(' and ') + ' by relative path');
});

/* ---- the exchange file: one app id, one schema ---- */
ok(/app:\s*'adi-pipework-sizer',\s*schema:\s*1/.test(src.trace)
  && /app:\s*'adi-pipework-sizer',\s*\n?\s*schema:\s*1/.test(src.sizer),
  'Trace and the sizer both write app adi-pipework-sizer, schema 1');
ok(/data\.app\s*!==\s*'adi-pipework-sizer'/.test(src.simulator),
  'the simulator refuses anything that is not a sizer project');
ok(/'adi-pipework-handoff'/.test(src.trace) && /'adi-pipework-handoff'/.test(src.sizer),
  'Trace and the sizer agree on the handoff key');
ok(/'adi-sizer-handoff'/.test(src.sizer) && /'adi-sizer-handoff'/.test(src.simulator),
  'the sizer and the simulator agree on the handoff key');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall chain consistency checks passed');
