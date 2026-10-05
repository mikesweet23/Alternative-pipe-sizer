#!/usr/bin/env node
/* Static head and cold fill: the high point off the trace, the override, the
   BS EN 12828 pressures and the expansion vessel. Source-level, with the
   shared functions evaluated from the files themselves. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const sizer = readFileSync(join(root, 'sizer.html'), 'utf8');
const sim = readFileSync(join(root, 'simulator.html'), 'utf8');
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}
function grab(text, re) {
  const m = re.exec(text);
  if (!m) return null;
  let i = text.indexOf('{', m.index), depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(m.index, i + 1);
  }
  return null;
}
const fnText = (t, n) => grab(t, new RegExp('^function\\s+' + n + '\\s*\\(', 'm'));
const defaults = grab(trace, /^const PRESS_DEFAULTS\s*=\s*\{/m);
const lib = new Function(fnText(trace, 'waterRho') + '\n' + defaults + '\n'
  + fnText(trace, 'vapourGaugeBar') + '\n' + fnText(trace, 'coldFill') + '\n'
  + fnText(sizer, 'expansionVessel')
  + '\nreturn { waterRho, coldFill, vapourGaugeBar, expansionVessel, PRESS_DEFAULTS };')();
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9);

/* ---- the calculation ---- */
{
  const { waterRho, coldFill, vapourGaugeBar, expansionVessel } = lib;
  const pst = waterRho(10) * 9.80665 * 11 / 1e5;
  const c = coldFill(11, 80);
  ok(near(c.pst, pst) && near(pst, 1.0784, 5e-4), 'static: 11 m of water at 10 °C is 1.078 bar');
  ok(near(c.p0, pst + 0.2) && near(c.pa, pst + 0.5), 'pre-charge = static + 0.2 bar; cold fill = pre-charge + 0.3 bar seal');
  ok(near(c.pe, 2.5) && c.ok, 'a 3 bar safety valve leaves a 2.5 bar final pressure, and 1.58 bar fill fits under it');
  ok(near(coldFill(10, 80, { svBar: 6 }).pe, 5.4), 'above 5 bar the final pressure is 0.9 × the safety valve');
  ok(!coldFill(25, 80).ok, '25 m static on a 3 bar safety valve is refused');
  ok(vapourGaugeBar(80) === 0 && near(vapourGaugeBar(120), 0.97, 0.03), 'vapour pressure only counts above 100 °C (120 °C is about 0.97 bar g)');
  ok(near(coldFill(0, 120).p0, 0.2 + vapourGaugeBar(120)), 'MTHW pre-charge carries the vapour pressure');
  ok(near(coldFill('', 80).pa, 0.5) && near(coldFill(-3, 80).pa, 0.5), 'a blank or negative static head is 0 m');
  const ev = expansionVessel(1000, 10, 80, c.p0, c.pe);
  ok(near(ev.e, waterRho(10) / waterRho(80) - 1) && near(ev.e, 0.0287, 5e-4), 'expansion 10→80 °C is 2.87%');
  ok(near(ev.Vwr, 5) && near(expansionVessel(100, 10, 80, 0.5, 2.5).Vwr, 3), 'water reserve 0.5%, 3 L minimum');
  ok(near(ev.Vn, (ev.Ve + ev.Vwr) * (c.pe + 1) / (c.pe - c.p0)), 'Vn = (Ve + Vwr)(pe + 1)/(pe − p0)');
  ok(!expansionVessel(1000, 10, 80, 3, 2.5).ok, 'no vessel when the pre-charge is above the final pressure');
}

/* ---- Pipe Trace: the high point and the override ---- */
ok(/function pressureWaters\(/.test(trace) && /S\.waters = pressureWaters\(\)/.test(trace),
  'solve() works out the static head per water');
ok(/sep && sep\.type === 'hx'/.test(trace) && /waterOf\[g\.primaryOf\]/.test(trace),
  'a heat exchanger opens a new water; a header stays on the water that feeds it');
ok(/segPoly3D\(sg, W\)/.test(trace) && /if \(!p\.hp\) return;/.test(trace),
  'the high point is the top of the 3D walk, or a labelled point');
ok(/if \(old && old\.hp\) neu\.hp = true;/.test(trace) && /else if \(p\.hp\) last\.hp = true;/.test(trace),
  'a high-point label survives keepH and the de-duplication of a finished trace');
ok(/id="hintHP"/.test(trace) && /data-hpmark=/.test(trace) && /function setHighPoint\(/.test(trace),
  'the high point can be labelled from the hint bar while tracing and from the run inspector');
ok(/data-press="staticOverrideM"/.test(trace) && /data-press="pressRefM"/.test(trace)
  && /function pressureFields\(/.test(trace), 'the plant and the HX take a static head override and the unit height');
ok(/w\.nodes\.forEach\(x => \{/.test(trace), 'an override is written on every plant in the cluster');
ok(/pressMarginBar: 0\.2/.test(trace) && /pressSealBar: 0\.3/.test(trace) && /svBar: 3\.0/.test(trace),
  'Pipe & basis carries the margin, the seal and the safety valve');
ok(/function drawHighPoints\(/.test(trace) && /cold fill/.test(trace) && /'coldfill', 'bad'/.test(trace)
  && /'highpoint', 'warn'/.test(trace), 'marked on the plan, in the status strip and in Check');
ok(/pressStaticM: pw \?/.test(trace) && /pressurisation: pressurisationMeta\(\)/.test(trace),
  'Send to Sizer carries the primary static head and every water in traceMeta');
ok(/9\. Static head and cold fill/.test(trace) && /function pressureReportHtml\(/.test(trace), 'on the Trace PDF');
ok(/id: 'highpoint'/.test(trace), 'there is a help tip for it');

/* ---- sizer ---- */
ok(/"pressStaticM", "pressMarginBar", "pressSealBar", "pressSvBar", "pressFillT", "pressMaxT"/.test(sizer),
  'the sizer saves the pressurisation fields with the project');
ok(/PRESS_FIELD_DEFAULTS/.test(sizer) && /data\.settings\[id\] === undefined\) el\.value = PRESS_FIELD_DEFAULTS\[id\]/.test(sizer),
  'a file without them gets the defaults, not the last job’s');
ok(/id="pressCard"/.test(sizer) && /function renderPressurisation\(/.test(sizer) && /renderPressurisation\(\);/.test(sizer),
  'the sizer has a Static Head, Cold Fill & Expansion card');
ok(/function pressurisationWaters\(/.test(sizer) && /volByGroup\[g\]/.test(sizer),
  'each water is sized on the volume of its own circuits');
ok(/7a\. Static Head, Cold Fill/.test(sizer) && /'Static Head \(m\)'/.test(sizer), 'on the sizer PDF and the CSV');
ok(!/pressStaticM[^\n]*staticHead\b/.test(sizer) && /id="staticHead"/.test(sizer),
  'the sealed static head does not feed the open-system pump head box');

/* ---- simulator ---- */
ok(/id="pressPanel"/.test(sim) && /function renderPressures\(/.test(sim) && /renderPressures\(\);/.test(sim),
  'the simulator shows the pressures the pump sits in');
ok(/Math\.max\(cf\.pe, cf\.pa\) \+ pump\.H0 \/ 100/.test(sim) && /NPSH available/.test(sim),
  'shut-off against the safety valve, and NPSH available');

/* ---- documented ---- */
ok(/Static head and cold fill/.test(claude) && /pressureWaters\(\)/.test(claude) && /coldFill\(\)/.test(claude),
  'CLAUDE.md describes it');
ok(/pressurisation-test/.test(agents), 'AGENTS.md names this check');

if (failed) { console.error('\n' + failed + ' check(s) failed'); process.exit(1); }
console.log('\nall pressurisation checks passed');
