import { Console, Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { rankConfig } from '../rank.config'
import { CloudflareApiLive } from '../server/cloudflare'
import { CloudflareSettingsFromEnv } from '../server/settings'
import { Traffic, TrafficLive, type PathCount } from '../server/traffic'

const DAY_MS = 86_400_000
const RESEARCH_DAYS = 7
const TOP_PATHS = 10

const isoDate = (offsetDays: number) =>
  new Date(Date.now() - offsetDays * DAY_MS).toISOString().slice(0, 10)

const groupOf = (path: string) =>
  Object.entries(rankConfig.pageGroups).find(([, prefix]) =>
    path.startsWith(prefix),
  )?.[0] ?? 'other'

const summarizeByGroup = (rows: ReadonlyArray<PathCount>) => {
  const totals = new Map<string, { humans: number; crawlers: number }>()
  for (const row of rows) {
    const group = groupOf(row.path)
    const current = totals.get(group) ?? { humans: 0, crawlers: 0 }
    if (row.botCategory === '') current.humans += row.count
    else current.crawlers += row.count
    totals.set(group, current)
  }
  return [...totals.entries()].sort((a, b) => b[1].humans - a[1].humans)
}

const research = Effect.gen(function* () {
  const traffic = yield* Traffic
  const window = { from: isoDate(RESEARCH_DAYS), to: isoDate(0) }
  const [paths, days] = yield* Effect.all([
    traffic.pathsByBot(window),
    traffic.days(window),
  ])

  yield* Console.log(`# Research for ${rankConfig.site}, ${window.from} to ${window.to}`)
  yield* Console.log('\n## Source: GraphQL zone analytics')
  yield* Console.log(
    `days=${days.length} pageViews=${days.reduce((sum, d) => sum + d.pageViews, 0)}`,
  )
  yield* Console.log('\n## Page groups (humans / verified crawlers)')
  for (const [group, totals] of summarizeByGroup(paths)) {
    yield* Console.log(`${group}: ${totals.humans} / ${totals.crawlers}`)
  }
  yield* Console.log('\n## Top paths')
  for (const row of paths.filter(r => r.botCategory === '').slice(0, TOP_PATHS)) {
    yield* Console.log(`${row.count}\t${row.path}`)
  }
  return { paths: paths.length, days: days.length }
})

const AppLayer = TrafficLive.pipe(
  Layer.provideMerge(CloudflareApiLive),
  Layer.provideMerge(CloudflareSettingsFromEnv),
  Layer.provideMerge(FetchHttpClient.layer),
)

const [command = 'research'] = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const dryRun = process.argv.includes('--dry-run')

const program = Effect.gen(function* () {
  if (command !== 'research') {
    return yield* Effect.fail(new Error(`unknown command: ${command}`))
  }
  const result = yield* research
  if (result.days === 0) {
    return yield* Effect.fail(new Error('research returned no traffic days'))
  }
  yield* Console.log(dryRun ? '\ndry run: nothing written' : '')
})

Effect.runPromise(program.pipe(Effect.provide(AppLayer))).catch(error => {
  console.error(error instanceof Error ? `${error.name}: ${error.message} ${JSON.stringify(error)}` : String(error))
  process.exit(1)
})
