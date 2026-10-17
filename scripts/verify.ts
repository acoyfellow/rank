import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = process.env.RANK_SITE ?? 'https://coey.dev';
const SKILL_DIR =
  process.env.RANK_SKILL_DIR ??
  join(process.env.HOME ?? '', '.pi/agent/git/github.com/acoyfellow/terraloop-mode/skills/terraloop-rank');
const MIN_SOURCES = 6;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REQUIRED_FILES = ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'status.json'];
const SKILL_FILES = ['SKILL.md', 'gate.sh', 'recipe-gate.sh'];
const PRIVATE_PATTERNS: [string, RegExp][] = [
  ['ipv4', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ['email', /[\w.+-]+@[\w-]+\.[\w.]+/],
  ['user agent', /Mozilla\/5\.0/],
];

type Check = { name: string; run: () => Promise<string | null> };

const run = async (cmd: string[]) => {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return code === 0 ? null : `${cmd.join(' ')} exited ${code}\n${(out + err).slice(-1200)}`;
};

const fetchPublicData = async () => {
  const res = await fetch(`${SITE}/rank/data.json`);
  if (!res.ok) throw new Error(`${SITE}/rank/data.json returned ${res.status}`);
  return { text: await res.text() };
};

const checks: Check[] = [
  { name: 'typecheck', run: () => run(['bun', 'run', 'typecheck']) },
  { name: 'biome', run: () => run(['bun', 'x', 'biome', 'check', '.']) },
  { name: 'anti-slop', run: () => run(['bun', 'scripts/slop.ts']) },
  { name: 'tests', run: () => run(['bun', 'run', 'test']) },
  {
    name: 'repo files',
    run: async () => {
      const missing = REQUIRED_FILES.filter((file) => !existsSync(file));
      return missing.length ? `missing: ${missing.join(', ')}` : null;
    },
  },
  {
    name: 'schedule refreshes data only, never optimizes',
    run: async () => {
      const config = ['alchemy.run.ts', 'wrangler.jsonc'].filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
      const crons = [...config.matchAll(/crons:\s*\[([^\]]*)\]/g)].map(match => match[1]?.trim())
      if (crons.some(entry => entry !== "'17 * * * *'")) return 'only the hourly data refresh cron is allowed'
      if (/alarm\(/i.test(config)) return 'an alarm exists in deploy config'
      const worker = readFileSync('worker/index.ts', 'utf8')
      return /iterate|git push|ledger\.ts.*write/i.test(worker) ? 'the scheduled handler must only refresh data' : null;
    },
  },
  {
    name: 'skill folder',
    run: async () => {
      const missing = SKILL_FILES.filter((file) => !existsSync(join(SKILL_DIR, file)));
      return missing.length ? `missing in ${SKILL_DIR}: ${missing.join(', ')}` : null;
    },
  },
  { name: 'manual iterate dry run', run: () => run(['bun', 'run', 'iterate', '--dry-run']) },
  {
    name: 'dashboard page',
    run: async () => {
      const res = await fetch(`${SITE}/rank`);
      return res.ok ? null : `${SITE}/rank returned ${res.status}`;
    },
  },
  {
    name: 'live sources',
    run: async () => {
      const data = JSON.parse((await fetchPublicData()).text) as {
        sources?: { id: string; fetchedAt: string; total: number }[];
      };
      const sources = data.sources ?? [];
      const fresh = sources.filter(
        (s) => Date.now() - Date.parse(s.fetchedAt) < MAX_AGE_MS && s.total > 0,
      );
      return fresh.length >= MIN_SOURCES
        ? null
        : `${fresh.length}/${MIN_SOURCES} fresh non-zero sources (${sources.map((s) => s.id).join(', ') || 'none'})`;
    },
  },
  {
    name: 'experiment 001',
    run: async () => {
      const data = JSON.parse((await fetchPublicData()).text) as {
        experiments?: { id: string; hypothesis?: string; commit?: string; baseline?: unknown; after?: unknown }[];
      };
      const first = data.experiments?.find((e) => e.id === '001');
      if (!first) return 'experiment 001 not in public ledger';
      const missing = (['hypothesis', 'commit', 'baseline', 'after'] as const).filter((k) => !first[k]);
      return missing.length ? `experiment 001 missing: ${missing.join(', ')}` : null;
    },
  },
  {
    name: 'public data is private-safe',
    run: async () => {
      const { text } = await fetchPublicData();
      const leaks = PRIVATE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
      const smallCounts = [...text.matchAll(/"count":\s*([1-4])\b/g)].length;
      if (smallCounts) leaks.push(`${smallCounts} unbucketed counts under 5`);
      return leaks.length ? `leaks: ${leaks.join(', ')}` : null;
    },
  },
];

let failed = 0;
for (const check of checks) {
  const error = await check.run().catch((e: unknown) => String(e));
  console.log(`${error ? 'FAIL' : 'ok  '} ${check.name}${error ? `\n     ${error.split('\n').join('\n     ')}` : ''}`);
  if (error) failed++;
}
console.log(failed ? `\n${failed}/${checks.length} checks failed` : `\nall ${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
