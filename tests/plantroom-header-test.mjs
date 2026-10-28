#!/usr/bin/env node
/* Source-level checks: a plant room with no plant drawn (an HX as the
   source), a primary loop through pumps, buffer and header in pairs or single
   pipes, several sources into one buffer, and a header traced to its shape
   with secondary taps. The pure geometry is evaluated out of the file. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
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

/* ---- where the water starts ---- */
ok(/function isRoot\(n\)/.test(trace) && /function rootNodes\(\)/.test(trace),
  'a root is a plant or an HX acting as the source');
ok(/function markHxSources\(\)/.test(trace) && /n\.priOff === true \? true/.test(trace)
  && /!componentHasPlant\(n\)/.test(trace),
  'priOff decides, and auto makes an HX the source when nothing on its pipework is a plant');
ok(/const roots = rootNodes\(\);/.test(trace), 'buildTree starts from every root, not only plant');
ok(/rootNodes\(\)\.forEach\(r => walk\(r\.id, null, false\)\)/.test(trace), 'runs off a source HX are named');
ok(/data-f="priOff"/.test(trace) && /Not on this drawing &mdash; acts as the source/.test(trace),
  'the HX inspector offers the primary side');
ok(/SOURCE \\u2014 primary not drawn/.test(trace), 'the plan says an HX is the source');
ok(/if \(rootNodes\(\)\.length === 0\)/.test(trace), 'Send to Sizer accepts an HX as the root');

/* ---- rings ---- */
ok(/function leadsToRoot\(vessel, sg\)/.test(trace) && /function leadsToFeeder\(vessel, sg, feederId\)/.test(trace),
  'a vessel knows which of its runs lead back where its water came from');
ok(/isVessel\(curNode\) && !isRoot\(curNode\) && isRootward\(curNode, seg\)/.test(trace),
  'a vessel does not walk a primary return out as a secondary');
ok(/feeder\.set\(other, cur\.id\)/.test(trace), 'the node each vessel was first reached from is kept');
ok(/function isEchoReturn\(s, outs\)/.test(trace) && (trace.match(/isEchoReturn\(s, outs\)\) return;/g) || []).length >= 2,
  'a single-pipe return is not counted as a second circuit');

/* ---- merges ---- */
ok(/function markMerges\(\)/.test(trace) && /s\.mergeInto = m\.id; s\.mergeFrom/.test(trace),
  'inlets from different roots are marked as a merge');
ok(/function mergeShare\(sg\)/.test(trace) && /function rootRatedLps\(r\)/.test(trace),
  'each inlet carries its own source’s rated flow');
ok(/\(s\.mergeInto != null && mergeShare\(s\)\) \|\| nodeDemand\(s\.down, seen, s\.service\)/.test(trace),
  'the roll-up uses the share, not the outlet');
ok(/add\('mergeshort'/.test(trace), 'Check warns when the sources cannot make the outlet flow');
ok(/id="bvMulti"/.test(trace) && /<option value="m"/.test(trace) && /obj\.multiIn = inp\.value === 'm'/.test(trace),
  'a buffer can be several in, one out');
ok(/const walked = new Set\(\);/.test(trace) && /function feedsMerge\(sg\)/.test(trace),
  'the sizer export walks each node once and gives runs above a merge their own flow');

/* ---- the traced header ---- */
ok(/function setHeaderShape\(n, ptsPx\)/.test(trace) && /function fitHeaderToPath\(n\)/.test(trace),
  'a header can be traced to its shape');
ok(/draft = \{ kind: 'tape', pts: \[\], shapeFor \}/.test(trace) && /const hdr = draft\.shapeFor != null/.test(trace),
  'the shape is traced with the tape tool');
ok(/port\.s != null && llhPath\(n\)/.test(trace) && /if \(llhPath\(n\) && S\.pxPerM > 0\) return headerPort/.test(trace),
  'a run joins a traced header on its line');
ok(/return area \* llhShellLengthM\(n\) \* 1000;/.test(trace), 'the volume uses the traced length');
ok(/A traced header's line is in its own frame/.test(trace), 'rotating the sheet turns the line');
ok(/if \(llhPath\(n\) && S\.pxPerM > 0\) \{\s*const odM = llhShellOdM\(n\);/.test(trace), '3D draws the shell along the line');

/* ---- taps ---- */
ok(/function llhTapDemand\(n\)/.test(trace) && (trace.match(/llhTapDemand\(n\)/g) || []).length >= 3,
  'taps count toward the header’s secondary');
ok(/data-hdr="tapclick"/.test(trace) && /addTap\(hn, tapSOf\(hn, p\)\)/.test(trace),
  'taps can be placed by clicking the header');
ok(/taps: llhTaps\(n\)\.map/.test(trace), 'taps cross in traceMeta.separators');
ok(/'asSource', 'mergeRoots'/.test(trace) && /'mergeInto', 'mergeFrom'/.test(trace),
  'derived keys are not saved');

/* ---- the geometry ---- */
const fns = ['clamp', 'polyLenM', 'pathPointAt', 'pathNearestS'].map(n => extractFunction(trace, n));
ok(fns.every(Boolean), 'path helpers are present');
if (fns.every(Boolean)) {
  const lib = new Function(fns.join('\n') + '; return { polyLenM, pathPointAt, pathNearestS };')();
  const L = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }];
  ok(lib.polyLenM(L) === 7, 'an L of 4 m and 3 m is 7 m of shell');
  const mid = lib.pathPointAt(L, 5 / 7);
  ok(Math.abs(mid.x - 4) < 1e-9 && Math.abs(mid.y - 1) < 1e-9, 'a point 5 m along is 1 m down the second leg');
  ok(Math.abs(lib.pathNearestS(L, { x: 4.3, y: 2 }) - 6 / 7) < 1e-3, 'the nearest point on the line is found');
}

/* ---- the handover ---- */
ok(/### A header traced to its shape, and secondaries shown as taps/.test(claude)
  && /### Where the water starts, rings and merges/.test(claude), 'CLAUDE.md records the design');
ok(/plantroom-header-test/.test(agents), 'AGENTS.md names this check');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nall plant-room / header checks passed');
