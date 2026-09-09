#!/usr/bin/env node
/* Acceptance tests for temperature-corrected viscosity, viscosityMode
   compatibility, the calculation-basis panel and the straight-pipe check.
   Reference case: 16 l/s, 100.0 mm ID, stainless new (ε = 0.015 mm). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = {
  trace: readFileSync(join(root, 'trace.html'), 'utf8'),
  sizer: readFileSync(join(root, 'sizer.html'), 'utf8'),
  simulator: readFileSync(join(root, 'simulator.html'), 'utf8'),
};
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}
function near(got, exp, tol, msg) {
  const okk = Math.abs(got - exp) <= Math.abs(exp) * tol;
  if (!okk) {
    failed++;
    console.error('FAIL  ' + msg + ' (got ' + got + ', expected ' + exp + ' ±' + (tol * 100) + '%)');
  } else console.log('ok    ' + msg + ' (' + got + ')');
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
const fn = (text, name) => {
  const body = extractFunction(text, name);
  return body ? new Function(body + '; return ' + name + ';')() : null;
};

const waterMu = {
  trace: fn(src.trace, 'waterMu'),
  sizer: fn(src.sizer, 'waterMu'),
  simulator: fn(src.simulator, 'waterMu'),
};
const darcy = fn(src.sizer, 'darcyWeisbach');
const projectViscosity = (() => {
  const a = extractFunction(src.simulator, 'waterMu');
  const b = extractFunction(src.simulator, 'projectViscosity');
  if (!a || !b) return null;
  return new Function(a + ';' + b + '; return projectViscosity;')();
})();

ok(waterMu.trace && waterMu.sizer && waterMu.simulator && darcy,
  'waterMu and darcyWeisbach extract from source');

const MU_70 = waterMu.sizer(70);
ok(waterMu.trace(70) === MU_70 && waterMu.simulator(70) === MU_70,
  'waterMu(70) is identical in all three tools');
near(MU_70, 0.000400, 0.01, 'Test 4 μ at 70 °C is ≈ 0.000400 Pa·s');
near(waterMu.sizer(5), 0.001500, 0.01, 'Test 3 μ at 5 °C is ≈ 0.001500 Pa·s');
ok(waterMu.sizer(-1) === 0.00131 && waterMu.sizer(110) === 0.00131,
  'T outside 0–100 °C falls back to the legacy 0.00131 Pa·s');

function waterRho(T) { return ((1.051865e-05*T - 5.171329e-03)*T - 6.179237e-03)*T + 1000.068; }

const LPS = 16, ID = 0.1, EPS = 0.000015;
const h = (T, mu, eps) => darcy(LPS / 1000, ID, waterRho(T), mu, eps);

const any = h(5, 0.00131, EPS);
near(any.v, 2.037, 0.01, 'Test 1 velocity is 2.037 m/s');

const fixed5 = h(5, 0.00131, EPS);
near(fixed5.Re, 155500, 0.01, 'Test 2 fixed @ 5 °C Re ≈ 155,500');
near(fixed5.f, 0.01741, 0.01, 'Test 2 fixed @ 5 °C Darcy f ≈ 0.01741');
near(fixed5.pd, 361, 0.01, 'Test 2 fixed @ 5 °C Δp/m ≈ 361 Pa/m');

const temp5 = h(5, waterMu.sizer(5), EPS);
near(temp5.Re, 135800, 0.01, 'Test 3 temperature @ 5 °C Re ≈ 135,800');
near(temp5.f, 0.01779, 0.01, 'Test 3 temperature @ 5 °C Darcy f ≈ 0.01779');
near(temp5.pd, 369, 0.01, 'Test 3 temperature @ 5 °C Δp/m ≈ 369 Pa/m');

const temp70 = h(70, waterMu.sizer(70), EPS);
const fixed70 = h(70, 0.00131, EPS);
near(temp70.pd, 305, 0.01, 'Test 4 temperature @ 70 °C Δp/m ≈ 305 Pa/m');
near(fixed70.pd, 354, 0.01, 'Test 4 fixed @ 70 °C Δp/m ≈ 354 Pa/m (the LPHW shift)');

const smooth = h(5, waterMu.sizer(5), 0);
/* Third-party smooth-pipe figure is 353 Pa/m at μ = 0.001519. Swamee–Jain
   on our water μ lands a little under that; the point of the test is that
   the remaining gap against 361 is roughness, not method. */
near(smooth.pd, 353, 0.02, 'Test 6 ε = 0 Δp/m ≈ 353 Pa/m (smooth-pipe reference)');
ok(smooth.pd < fixed5.pd - 5, 'Test 6 smooth pipe is materially below ε = 0.015 mm');

ok(projectViscosity && projectViscosity({}, 70) === 0.00131,
  'Test 5 simulator: missing viscosityMode is the legacy fixed value');
ok(projectViscosity({ viscosityMode: 'fixed', mu: 0.0004 }, 70) === 0.0004,
  'simulator prefers settings.mu when viscosityMode is present');
ok(projectViscosity({ viscosityMode: 'temperature' }, 70) === MU_70,
  'simulator temperature mode without settings.mu uses waterMu(Tm)');
ok(projectViscosity({ mu: MU_70 }, 70) === 0.00131,
  'Test 5 a later-era settings.mu is ignored when viscosityMode is missing');

const hyd = (() => {
  const a = extractFunction(src.trace, 'frictionFactor');
  const b = extractFunction(src.trace, 'hyd');
  if (!a || !b) return null;
  return new Function(a + ';' + b + '; return hyd;')();
})();
ok(hyd, 'Trace hyd() extracts with frictionFactor');
if (hyd) {
  const fluid5 = { rho: waterRho(5), mu: 0.00131, Tm: 5 };
  const th = hyd(16, 100, EPS, fluid5);
  near(th.paPerM, fixed5.pd, 0.0001, 'Test 7 Trace hyd() matches the sizer at the same inputs');
}

ok(/viscosityMode/.test(src.sizer) && /viscosityMode/.test(src.trace)
  && /projectViscosity/.test(src.simulator),
  'viscosityMode is in the sizer, Trace export and the simulator');
ok(/id="viscosityMode"/.test(src.sizer) && /value="temperature" selected/.test(src.sizer),
  'new sizer projects default to temperature-corrected viscosity');
ok(/pendingViscosityOffer = true/.test(src.sizer)
  && /Use temperature-corrected viscosity/.test(src.sizer)
  && /Keep legacy figures/.test(src.sizer),
  'a legacy file offers an explicit switch and never applies it automatically');
ok(/schema:\s*1/.test(src.sizer) && /schema:\s*1/.test(src.trace),
  'schema stays at 1 — the field is additive');
ok(/id="straightPipeCard"/.test(src.sizer) && /does not write to the project/.test(src.sizer),
  'the sizer has a standalone straight-pipe check that does not write to the project');
ok(/function calcBasisHtml/.test(src.sizer)
  && /Assumptions register/.test(src.sizer)
  && /Friction factor \(Darcy\)/.test(src.sizer)
  && /Straight-pipe/.test(src.sizer),
  'each circuit has a calculation-basis panel and the PDF has an assumptions register');
ok(/function sizeLabel/.test(src.sizer) && /function formatEpsMm/.test(src.sizer)
  && /id="roughnessHint"/.test(src.sizer),
  'DN labels show bore and material/condition selections show ε in mm');
ok(/const MAT_LABEL = \{/.test(src.sizer) && /carbon: 'Carbon Steel'/.test(src.sizer),
  'MAT_LABEL is defined so the circuit table and straight-pipe check can render');
ok(/derived value is for <strong>water<\/strong>/.test(src.sizer)
  || /The derived value is for <strong>water<\/strong>/.test(src.sizer),
  'the sizer says the derived viscosity is for water only');

ok(/Al-Shemmeri/.test(claude) && /viscosityMode/.test(claude)
  && /0\.00040042907094183465/.test(claude),
  'CLAUDE.md records the correlation, the compatibility flag and waterMu(70)');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall viscosity / calculation-basis checks passed');
