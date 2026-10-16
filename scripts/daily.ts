import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { CloudflareApi, CloudflareApiLive, CloudflareSettings } from '../server/cloudflare'
import { CloudflareSettingsFromEnv } from '../server/settings'

const DAY_MS = 86_400_000
const EXPERIMENTS_DIR = 'experiments'
const GENERATED_FILE = 'server/daily.generated.json'

const Plan = Schema.Struct({
  id: Schema.String,
  windowDays: Schema.Number,
  commitDate: Schema.String,
  treated: Schema.Array(Schema.String),
  control: Schema.Array(Schema.String),
})
type Plan = typeof Plan.Type

const DayRow = Schema.Struct({ date: Schema.String, treated: Schema.Number, control: Schema.Number })
type DayRow = typeof DayRow.Type

const Rows = Schema.Struct({
  viewer: Schema.Struct({
    zones: Schema.Array(
      Schema.Struct({
        g: Schema.Array(
          Schema.Struct({
            count: Schema.Number,
            dimensions: Schema.Struct({ date: Schema.String, clientRequestPath: Schema.String }),
          }),
        ),
      }),
    ),
  }),
})
type PathDay = Readonly<{ date: string; path: string; count: number }>

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const matches = (pattern: string, path: string) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern

const inGroup = (patterns: ReadonlyArray<string>, path: string) =>
  patterns.some(pattern => matches(pattern, path))

const readPlans = (): ReadonlyArray<Plan> =>
  readdirSync(EXPERIMENTS_DIR)
    .map(id => join(EXPERIMENTS_DIR, id, 'experiment.json'))
    .filter(existsSync)
    .map(file => Schema.decodeUnknownSync(Plan)(JSON.parse(readFileSync(file, 'utf8'))))

const readSaved = (id: string): ReadonlyArray<DayRow> => {
  const file = join(EXPERIMENTS_DIR, id, 'daily.json')
  return existsSync(file) ? Schema.decodeUnknownSync(Schema.Array(DayRow))(JSON.parse(readFileSync(file, 'utf8'))) : []
}

const planRange = (plan: Plan) => {
  const commitMs = Date.parse(plan.commitDate)
  return {
    from: isoDate(commitMs - plan.windowDays * DAY_MS),
    to: isoDate(commitMs + (plan.windowDays - 1) * DAY_MS),
  }
}

const daysBetween = (from: string, to: string): ReadonlyArray<string> => {
  const days: Array<string> = []
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += DAY_MS) days.push(isoDate(ms))
  return days
}

const fetchPathDay = (date: string) =>
  Effect.gen(function* () {
    const api = yield* CloudflareApi
    const { zoneId, host } = yield* CloudflareSettings
    const raw = yield* api.graphql(
      `daily.${date}`,
      `{viewer{zones(filter:{zoneTag:"${zoneId}"}){g:httpRequestsAdaptiveGroups(limit:10000,filter:{date:"${date}",clientRequestHTTPHost:"${host}",requestSource:"eyeball",verifiedBotCategory:""},orderBy:[date_ASC]){count dimensions{date clientRequestPath}}}}}`,
    )
    return (Schema.decodeUnknownSync(Rows)(raw).viewer.zones[0]?.g ?? []).map(
      (row): PathDay => ({ date: row.dimensions.date, path: row.dimensions.clientRequestPath, count: row.count }),
    )
  })

const fetchPathDays = (from: string, to: string) =>
  Effect.forEach(daysBetween(from, to), fetchPathDay, { concurrency: 1 }).pipe(Effect.map(days => days.flat()))

const seriesFor = (plan: Plan, pathDays: ReadonlyArray<PathDay>, today: string): ReadonlyArray<DayRow> => {
  const saved = new Map(readSaved(plan.id).map(row => [row.date, row]))
  const range = planRange(plan)
  const lastDay = range.to < today ? range.to : today
  const fetchedDates = new Set(pathDays.map(row => row.date))
  const sumFor = (date: string, patterns: ReadonlyArray<string>, excluded: ReadonlyArray<string>) =>
    pathDays
      .filter(row => row.date === date && inGroup(patterns, row.path) && !inGroup(excluded, row.path))
      .reduce((sum, row) => sum + row.count, 0)
  return daysBetween(range.from, lastDay).flatMap(date => {
    if (date === today) return []
    if (!fetchedDates.has(date) || saved.has(date)) {
      const kept = saved.get(date)
      return kept ? [kept] : []
    }
    return [{ date, treated: sumFor(date, plan.treated, plan.control), control: sumFor(date, plan.control, []) }]
  })
}

const program = Effect.gen(function* () {
  const plans = readPlans()
  const today = isoDate(Date.now())
  const earliest = plans.map(plan => planRange(plan).from).sort()[0] ?? today
  const yesterday = isoDate(Date.parse(today) - DAY_MS)
  const missing = (plan: Plan) => {
    const saved = new Set(readSaved(plan.id).map(row => row.date))
    const range = planRange(plan)
    const last = range.to < yesterday ? range.to : yesterday
    return daysBetween(range.from, last).filter(date => !saved.has(date))
  }
  const needed = [...new Set(plans.flatMap(missing))].sort()
  const pathDays = yield* Effect.forEach(needed, fetchPathDay, { concurrency: 1 }).pipe(
    Effect.map(days => days.flat()),
  )
  console.log(`fetched ${needed.length} missing day(s) from ${earliest}`)
  const generated: Record<string, ReadonlyArray<DayRow>> = {}
  for (const plan of plans) {
    const series = seriesFor(plan, pathDays, today)
    writeFileSync(join(EXPERIMENTS_DIR, plan.id, 'daily.json'), `${JSON.stringify(series, null, 2)}\n`)
    generated[plan.id] = series
    console.log(`${plan.id}: ${series.length} days, ${series[0]?.date ?? '-'} to ${series.at(-1)?.date ?? '-'}`)
  }
  writeFileSync(GENERATED_FILE, `${JSON.stringify(generated)}\n`)
})

const AppLayer = CloudflareApiLive.pipe(
  Layer.provideMerge(CloudflareSettingsFromEnv),
  Layer.provideMerge(FetchHttpClient.layer),
)

await Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
