import { readFileSync } from 'node:fs';
import { Glob } from 'bun';

const ROOTS = ['src/**/*.ts', 'worker/**/*.ts', 'scripts/**/*.ts', '*.md', 'docs/**/*.md'];
const IGNORE = [/node_modules/, /FOLDKIT\.md$/, /AGENTS\.md$/, /scripts\/slop\.ts$/];

type Rule = { id: string; pattern: RegExp; code: boolean; prose: boolean };

const RULES: Rule[] = [
  { id: 'todo marker', pattern: /\b(TODO|FIXME|XXX|HACK)\b/, code: true, prose: true },
  {
    id: 'placeholder text',
    pattern: /lorem ipsum|placeholder data|coming soon/i,
    code: true,
    prose: true,
  },
  { id: 'explicit any', pattern: /:\s*any\b|as any\b|<any>/, code: true, prose: false },
  { id: 'ts-ignore', pattern: /@ts-(ignore|nocheck)/, code: true, prose: false },
  { id: 'console.log in app code', pattern: /console\.log\(/, code: true, prose: false },
  {
    id: 'hype word',
    pattern:
      /\b(revolutionary|game[- ]chang\w*|cutting[- ]edge|seamless(ly)?|supercharge\w*|unleash\w*|blazing(ly)? fast|world[- ]class|effortless(ly)?|robust|leverag(e|es|ing)|delve)\b/i,
    code: false,
    prose: true,
  },
  {
    id: 'filler phrase',
    pattern: /\b(it'?s worth noting|in today'?s (fast[- ]paced )?world|simply put|at the end of the day)\b/i,
    code: false,
    prose: true,
  },
];

const isCode = (path: string) => path.endsWith('.ts');
const allowsConsole = (path: string) => path.startsWith('scripts/');

const appliesTo = (rule: Rule, path: string) => {
  if (rule.id === 'console.log in app code' && allowsConsole(path)) return false;
  return isCode(path) ? rule.code : rule.prose;
};

const findings: string[] = [];
for (const root of ROOTS) {
  for (const path of new Glob(root).scanSync('.')) {
    if (IGNORE.some((pattern) => pattern.test(path))) continue;
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (appliesTo(rule, path) && rule.pattern.test(line)) {
          findings.push(`${path}:${index + 1} ${rule.id}: ${line.trim().slice(0, 100)}`);
        }
      }
    });
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  console.error(`\n${findings.length} slop finding(s)`);
  process.exit(1);
}
console.log('no slop found');
