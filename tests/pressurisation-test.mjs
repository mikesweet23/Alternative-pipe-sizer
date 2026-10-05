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
  + 'const STD_VESSELS_L = ' + /^const STD_VESSELS_L\s*=\s*(\[[^\]]*\]);/m.exec(trace)[1] + ';\n'
  + grab(trace, /^const SYSTEM_L_PER_KW\s*=\s*\{/m) + ';\n'
  + fnText(trace, 'glycolExpansionFactor') + '\n' + fnText(trace, 'expansionCoeff') + '\n'
  + fnText(trace, 'vesselSizing')
  + '\nreturn { waterRho, coldFill, vapourGaugeBar, vesselSizing, expansionCoeff, SYSTEM_L_PER_KW, PRESS_DEFAULTS };')();
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9);

/* ---- the calculation ---- */
{
  const { waterRho, coldFill, vapourGaugeBar, vesselSizing, expansionCoeff, SYSTEM_L_PER_KW } = lib;
  const pst = waterRho(10) * 9.80665 * 11 / 1e5;
  const c = coldFill(11, 80);
  ok(near(c.pst, pst) && near(pst, 1.0784, 5e-4), 'static: 11 m of water at 10 °C is 1.078 bar');
  ok(near(c.p0, pst + 0.2) && near(c.pa, pst + 0.5), 'pre-charge = static + 0.2 bar; cold fill = pre-charge + 0.3 bar seal');
  ok(near(c.pe, 2.5) && c.ok, 'a 3 bar safety valve leaves a 2.5 bar final pressure, and 1.58 bar fill fits under it');
  ok(near(coldFill(10, 80, { svBar: 6 }).pe, 5.4), 'above 5 bar the final pressure is 0.9 × the safety valve');
  ok(!coldFill(25, 80).ok, '25 m static on a 3 bar safety valve is refused');
  ok(vapourGaugeBar(80) === 0 && near(vapourGaugeBar(120), 0.97, 0.03), 'vapour pressure only counts above 100 °C (120 °C is about 0.97 bar g)');
  ok(near(coldFill(0, 120).p0, 0.2 + vapourGaugeBar(120)), 'MTHW pre-charge carries the vapour pressure');
  ok(near(coldFill('', 80).p0, 0.5) && near(coldFill(-3, 80).pa, 0.8), 'a blank or negative static head is 0 m, and p0 never below 0.5 bar');
  ok(coldFill(1, 80).p0Floored && !c.p0Floored, 'the supplier minimum pre-charge only acts when the static is small');

  /* the vessel: 5000 L, 10 m static, 80 C, 3 bar safety valve */
  const cf = coldFill(10, 80);
  const v = vesselSizing(5000, 80, cf);
  const P0 = cf.p0 + 1, Pa = cf.pa + 1, Pe = cf.pe + 1;
  ok(near(v.e, waterRho(10) / waterRho(80) - 1) && near(v.e, 0.0284, 5e-4), 'expansion 10 to 80 C is about 2.85% on the water fit');
  ok(near(v.Ve, v.e * 5000) && near(v.reserve, 25) && near(vesselSizing(300, 80, cf).reserve, 3), 'Ve = e.Vs; water reserve 0.5%, 3 L minimum');
  ok(near(v.vnEN, (v.Ve + v.Vwr) * Pe / (Pe - P0)), 'reserve requirement Vn = (Ve + Vwr)(pe + 1)/(pe - p0), BS EN 12828 Annex D');
  ok(near(v.vnFill, v.Ve / (P0 / Pa - P0 / Pe)), 'fill requirement takes Ve between p0 + seal and pe');
  ok(near(v.req, Math.max(v.vnEN, v.vnFill)) && !near(v.req, v.vnEN + v.vnFill, 1),
    'the larger of the two governs, never their sum');
  ok(v.governs === 'fill' && v.size === 600 && Math.round(v.vnEN) === 443 && Math.round(v.vnFill) === 555,
    'worked example: reserve 443 L, fill 555 L, so a 600 L vessel (Reflex check would reject 500 L)');
  ok(near(v.paHi, Pe / (1 + v.Ve * Pe / (v.Vn * P0)) - 1) && v.paHi >= v.paSet && v.paSet >= cf.pa - 1e-9,
    'fill set point between p0 + seal and the most the vessel allows (Reflex pa formula)');
  ok(v.pFinal <= cf.pe + 1e-9 && v.ok, 'the selected vessel reaches no more than the final pressure hot');
  ok(!near(v.req, (v.Ve * 1.1 + v.Vwr) * Pe / (Pe - P0)), 'BS 7074 10% is not stacked on the reserve');
  const small = vesselSizing(40, 70, coldFill(2, 70));
  ok(small.Vn <= 15 && small.Vwr >= 0.2 * small.Vn - 1e-9, 'a vessel of 15 L or less keeps 20% of itself as reserve');
  const big = vesselSizing(400000, 82, coldFill(10, 82, { svBar: 6 }));
  ok(big.count > 1 && big.Vn >= big.req, 'beyond the largest standard vessel it goes to several');
  const chilled = vesselSizing(3000, 30, coldFill(8, 30), { minT: 6 });
  ok(chilled.Vc > 0 && near(chilled.Vwr, chilled.reserve + chilled.Vc), 'a chilled system contraction below fill is added to the reserve');
  ok(!vesselSizing(1000, 80, coldFill(25, 80)).ok, 'no vessel when the cold fill is above the final pressure');
  ok(near(expansionCoeff(10, 80, 30), (waterRho(10) / waterRho(80) - 1) * 1.3) && near(expansionCoeff(10, 80, 30, 4.1), 0.041),
    'glycol scales the expansion (assumed); a typed supplier figure replaces it');
  ok(SYSTEM_L_PER_KW.panelRad.l === 11 && SYSTEM_L_PER_KW.underfloor.l === 23, 'whole-system l/kW for an untraced estimate');
}

/* ---- the volume: counted once, untraced added, or a total typed ---- */
ok(/function waterVolume\(/.test(trace) && /v\.override !== null \? v\.override : v\.counted/.test(trace),
  'Trace counts pipe, vessels, plant, exchangers and terminals per water; a typed total replaces them');
ok(/addL !== null && addL > 0\) \{ v\.notTraced = addL/.test(trace) && /addKw \* t\.l/.test(trace),
  'not on this trace: typed litres, or kW at a whole-system l/kW');
ok(/data-press="volAddL"/.test(trace) && /data-press="volOverrideL"/.test(trace) && /data-f="waterL"/.test(trace)
  && /data-f="priWaterL"/.test(trace), 'volume inputs on the plant, the HX and each load');
ok(/function exportPlantItems\(/.test(trace) && /group: group == null \? 0 : group/.test(trace) && /pressWaters: \(S\.waters/.test(trace),
  'plant, exchanger and terminal content cross to the sizer tagged by group, with the per-water volume inputs');
ok(/const step = \(s, gid\) =>/.test(trace), 'a separator leaving a separator opens its own group');
ok(/let pressWaters = \[\]/.test(sizer) && /settings\.pressWaters = pressWaters/.test(sizer) && /function plantItemWaterSelect\(/.test(sizer),
  'the sizer keeps the per-water volume inputs and tags each plant item with its water');

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
ok(/"pressStaticM", "pressMarginBar", "pressSealBar", "pressSvBar", "pressFillT", "pressMaxT", "pressMinT", "pressMinP0Bar", "pressExpPct"/.test(sizer),
  'the sizer saves the pressurisation fields with the project');
ok(/PRESS_FIELD_DEFAULTS/.test(sizer) && /data\.settings\[id\] === undefined\) el\.value = PRESS_FIELD_DEFAULTS\[id\]/.test(sizer),
  'a file without them gets the defaults, not the last job’s');
ok(/id="pressCard"/.test(sizer) && /function renderPressurisation\(/.test(sizer) && /renderPressurisation\(\);/.test(sizer),
  'the sizer has a Static Head, Cold Fill & Expansion card');
ok(/function pressurisationWaters\(/.test(sizer) && /volByGroup\[g\]/.test(sizer) && /vesselSizing\(total/.test(sizer),
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
