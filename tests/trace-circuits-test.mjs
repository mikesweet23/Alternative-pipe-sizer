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

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nall passed');
