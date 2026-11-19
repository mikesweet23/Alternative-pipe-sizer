#!/usr/bin/env node
/* Source-level checks: each main off the plant (or a header or exchanger) is
   a circuit with its own name, index run, losses, pump duty and water, shown
   in the run inspector, the Schedule's Circuits tab, the status strip, the
   PDF and the export — and nothing about it changes a size or a loss. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
const sizer = readFileSync(join(root, 'sizer.html'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

ok(/S\.circuits = buildCircuits\(\);/.test(trace), 'the circuits are worked out on every solve');
ok(/'mergeInto', 'mergeFrom', 'circuit'\];/.test(trace), '`circuit` on a run is derived and never saved');
ok(!/'circuitName'/.test(trace.slice(trace.indexOf('const SEG_DERIVED'), trace.indexOf('const SEG_DERIVED') + 600)),
  'the circuit name is saved');
ok(/if \(par && par\.hgroup === sg\.hgroup\) return false;/.test(trace) && /return !isEchoReturn\(sg, outs\);/.test(trace),
  'a head is a run whose parent is in another group or none, and not a single return beside its flow');
ok(/while \(x && ids\.has\(x\.id\) && guard\+\+ < 1000\)/.test(trace), 'a circuit index walks only its own runs');
ok(/pipeKpa: c\.pipe, fitKpa: c\.fit, valveKpa: c\.valve/.test(trace), 'the index is split into pipe, fittings and valves');
ok(/headM: kpa \* 1000 \/ \(fluid\(\)\.rho \* 9\.80665\)/.test(trace), 'pump head in metres on the fluid density');
ok(/volL: pipeL \+ termL \+ vesselL/.test(trace), 'water per circuit: pipe, terminals and vessels');
ok(/data-f="circuitName"/.test(trace) && /function circuitBox\(sg\)/.test(trace) && /\+ circuitBox\(sg\)/.test(trace),
  'the run inspector names the circuit on its main and shows its figures on every run');
ok(/<button data-tab="circ">Circuits<\/button>/.test(trace) && /function renderCircuitSchedule\(\)/.test(trace),
  'Schedule has a Circuits tab');
ok(/id="stCirc"/.test(trace) && /ev\.target\.closest\('#stCirc'\)\) openCircuits\(\)/.test(trace),
  'the status strip opens it');
ok(/function selectCircuit\(headId\)/.test(trace) && /selectCircuit\(parseInt\(tr\.dataset\.circ, 10\)\)/.test(trace),
  'a row picks the whole circuit');
ok(/If one pump at /.test(trace), 'the shared-pump duty is given beside the circuits');
ok(/<h2>8\. Circuits and index runs<\/h2>/.test(trace), 'the PDF has the circuits');
ok(/traceCircuit: \(c0 =>/.test(trace) && /circuits: \(S\.circuits \|\| \[\]\)\.map\(c => \(\{/.test(trace),
  'the export carries the circuit on each run and in traceMeta.circuits');
ok(/id: 'circuits', t: 'I have several circuits off one plant/.test(trace), 'there is a help tip');
ok(/Several mains off one plant are several circuits/.test(claude) && /tests\/trace-circuits-test\.mjs/.test(claude),
  'CLAUDE.md describes it');

/* ---- the schedule grouped by circuit, and names that stick ---- */
ok(/function scheduleByCircuit\(rows\)/.test(trace) && /const groups = scheduleByCircuit\(rows\);/.test(trace)
  && /const pipeBody = scheduleByCircuit\(pipeRows\)/.test(trace), 'the Pipework schedule, screen and PDF, is grouped by circuit');
ok(/function circuitHeadLine\(c\)/.test(trace) && /tr\.circhead\[data-circ\]/.test(trace), 'each circuit has a heading that picks it');
ok(/\.sort\(\(a, b\) => \(order\.get\(a\.headId\) \|\| 0\) - \(order\.get\(b\.headId\) \|\| 0\)\);/.test(trace),
  'circuits in the order the pipework is met, secondaries after their feeder');
ok(/if \(feeder\) c\.fedBy = circuitLabel\(feeder\);/.test(trace) && /function circuitLoadsText\(c\)/.test(trace),
  'a secondary says what feeds it, a main to a header says what it feeds');
ok(/obj\[inp\.getAttribute\('data-f'\)\] = inp\.value;\s*scheduleRender\(\);/.test(trace),
  'a name is written as it is typed, so clicking away cannot lose it');
ok(/The Pipework schedule is grouped by circuit/.test(claude), 'CLAUDE.md describes the grouping');

/* ---- the sizer's view ---- */
ok(/traceCircuitName: \(c0 => c0 && c0\.headId === sg\.id \? c0\.name : ''\)/.test(trace)
  && /traceCircuitUnitsL:/.test(trace), 'Trace sends the name and the units litres on the main');
ok(/id="circuitsView"/.test(sizer) && /renderCircuitsView\(\);\s*renderPumpPanel\(\);/.test(sizer),
  'the sizer has a Circuits card, drawn on every render');
ok(/return !p \|\| isSeparatorCircuit\(p\) \|\| circuitGroup\(p\) !== circuitGroup\(c\);/.test(sizer),
  'the sizer finds the circuits from its own tree');
ok(/straight \+= r\.straightLoss_kPa \|\| 0; fit \+= r\.fittingsLoss_kPa \|\| 0; load \+= r\.consumerLoad \|\| 0;/.test(sizer),
  'on its own figures');
ok(/return t\(head\.circuitName\) \|\| t\(head\.traceCircuitName\);/.test(sizer), 'a name typed in the sizer wins');
ok(/function goToCircuit\(id\)/.test(sizer) && /class="circ-pill"/.test(sizer), 'the name shows on the main, and the card jumps to it');
ok(/\+ circuitsReportHtml\(\)/.test(sizer) && /<h2>6a\. Circuits<\/h2>/.test(sizer), 'the sizer report has the circuits');
ok(/The sizer has the same view/.test(claude), 'CLAUDE.md describes the sizer side');
ok(/const schedRow = \(\{c,r\}\) =>/.test(sizer) && /<tr class="circ"><td colspan="13">' \+ circuitHeadText\(cc\)/.test(sizer),
  'the sizer report schedule is grouped by circuit');
ok(/function treeOrder\(\)/.test(sizer) && /if \(feeder\) c\.fedBy = circuitLabelOf\(feeder\);/.test(sizer)
  && /function circuitLoadsText\(c\)/.test(sizer), 'the sizer links a header main to its secondaries, in tree order');
ok(/<th class="n">Units L<\/th><\/tr><\/thead>/.test(sizer) && /circuitChainText\(c\) \+ '<\/p>'/.test(sizer),
  'section 6a carries units water and each index hop by hop');
ok(/const keepNames = \/Pipe Trace\/\.test\(source\)/.test(sizer), 'names typed in the sizer survive a re-send from Trace');
ok(/Section 3 of the sizer report is grouped by/.test(claude), 'CLAUDE.md describes the sizer report');

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nall passed');
