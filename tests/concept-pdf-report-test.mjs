#!/usr/bin/env node
/* Source-level checks: Pipe Trace / Concept PDF report. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trace = readFileSync(join(root, 'trace.html'), 'utf8');
const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
  else console.log('ok    ' + msg);
}

ok(/id="bPdf"/.test(trace) && /exportTracePDFReport/.test(trace),
  'Trace bar has a PDF button wired to the report');
ok(/bPdf/.test(trace) && /bSched/.test(trace)
  && /disabled = false/.test(trace) && /disabled = true/.test(trace),
  'PDF enables and disables with Schedule');
ok(/function capture3DPng\(/.test(trace) && /function draw3DOnto\(/.test(trace)
  && /toDataURL\('image\/png'\)/.test(trace),
  '3D snapshot is drawn off-screen as a PNG');
ok(/V3\.az = 0\.62/.test(trace) && /V3\.ex = 1/.test(trace)
  && /live 3D camera/.test(trace),
  'snapshot is isometric at true height and restores the live camera');
ok(/function pipeScheduleRows\(/.test(trace)
  && /function pipeMaterialTakeoff\(/.test(trace)
  && /function fittingsTakeoff\(/.test(trace)
  && /function valveSchedule\(/.test(trace),
  'report schedules come from the same take-off functions as the drawer');
ok(/Material take-off/.test(trace) && /Pipework schedule/.test(trace)
  && /Valves &amp; fittings placed/.test(trace)
  && /Index run/.test(trace) && /3D view/.test(trace),
  'report has 3D, pipe, material, valve and index sections');
ok(/Concept take-off report/.test(trace) && /Pipe Trace take-off report/.test(trace)
  && /Installed length is typed/.test(trace)
  && /Pipe metres is every leg as installed/.test(trace),
  'Concept and a scaled drawing get their own wording');
ok(/Save as PDF \/ Print/.test(trace) && /allow pop-ups/.test(trace),
  'print window matches the sizer route');
ok(/#c0392b/.test(trace) && /#2471a3/.test(trace) && /#f6f4ef/.test(trace),
  '3D keeps flow red, return blue and the paper background');

ok(/exportTracePDFReport\(\)/.test(claude) && /capture3DPng\(\)/.test(claude)
  && /PDF report from Trace and Concept/.test(claude),
  'CLAUDE.md records the Trace / Concept PDF');
ok(/concept-pdf-report-test/.test(agents) && /\*\*PDF\*\*/.test(agents),
  'AGENTS.md names the check and the PDF button');

process.exit(failed ? 1 : 0);
