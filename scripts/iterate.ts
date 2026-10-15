import { Console, Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { rankConfig } from '../rank.config'
import { CloudflareApiLive } from '../server/cloudflare'
import { CloudflareSettingsFromEnv } from '../server/settings'
import { buildSnapshot, type Source } from '../server/snapshot'

const TOP_ROWS = 10

const groupOf = (path: string) =>
  Object.entries(rankConfig.pageGroups).find(([, prefix]) => path.startsWith(prefix))?.[0] ??
  'other'

const pageGroupTotals = (pages: Source | undefined) => {
  const totals = new Map<string, number>()
  for (const row of pages?.rows ?? []) {
    totals.set(groupOf(row.key), (totals.get(groupOf(row.key)) ?? 0) + row.count)
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

const research = Effect.gen(function* () {
  const snapshot = yield* buildSnapshot
  yield* Console.log(
    `# Research for ${rankConfig.site}, ${snapshot.window.from} to ${snapshot.window.to}`,
  )
  for (const source of snapshot.sources) {
    yield* Console.log(`\n## Source: ${source.product}, ${source.label} (total ${source.total})`)
    for (const row of source.rows.slice(0, TOP_ROWS)) {
      yield* Console.log(`${row.count}\t${row.key}`)
    }
  }
  yield* Console.log('\n## Page groups (human requests, top paths only)')
  for (const [group, total] of pageGroupTotals(
    snapshot.sources.find(source => source.id === 'pages'),
  )) {
    yield* Console.log(`${group}: ${total}`)
  }
  return snapshot
})

const AppLayer = CloudflareApiLive.pipe(
  Layer.provideMerge(CloudflareSettingsFromEnv),
  Layer.provideMerge(FetchHttpClient.layer),
)

const [command = 'research'] = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const dryRun = process.argv.includes('--dry-run')

const program = Effect.gen(function* () {
  if (command !== 'research') {
    return yield* Effect.fail(new Error(`unknown command: ${command}`))
  }
  const snapshot = yield* research
  if (snapshot.sources.every(source => source.total === 0)) {
    return yield* Effect.fail(new Error('research returned no traffic'))
  }
  yield* Console.log(dryRun ? '\ndry run: nothing written' : '')
})

Effect.runPromise(program.pipe(Effect.provide(AppLayer))).catch(error => {
  console.error(
    error instanceof Error
      ? `${error.name}: ${error.message} ${JSON.stringify(error)}`
      : String(error),
  )
  process.exit(1)
})
