import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { CloudflareApi, CloudflareApiLive, CloudflareSettings } from '../server/cloudflare'
import { CloudflareSettingsFromEnv } from '../server/settings'
import { bucket } from '../server/snapshot'

const DAY_MS = 86_400_000

const Plan = Schema.Struct({
  id: Schema.String,
  metric: Schema.String,
  windowDays: Schema.Number,
  commitDate: Schema.String,
  treated: Schema.Array(Schema.String),
  control: Schema.Array(Schema.String),
  status: Schema.optional(Schema.Number),
})

const Rows = Schema.Struct({
  viewer: Schema.Struct({
    zones: Schema.Array(
      Schema.Struct({
        g: Schema.Array(
          Schema.Struct({
            count: Schema.Number,
            dimensions: Schema.Struct({ clientRequestPath: Schema.String }),
          }),
        ),
      }),
    ),
  }),
})

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const matches = (pattern: string, path: string) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern

const phase = process.argv.includes('--after') ? 'after' : 'baseline'
const id = process.argv.slice(2).find(arg => !arg.startsWith('--'))
if (!id) throw new Error('usage: bun scripts/baseline.ts <experiment-id> [--after]')

const dir = join('experiments', id)
const plan = Schema.decodeUnknownSync(Plan)(
  JSON.parse(readFileSync(join(dir, 'experiment.json'), 'utf8')),
)

const commitMs = Date.parse(plan.commitDate)
const windowMs = plan.windowDays * DAY_MS
const from = phase === 'baseline' ? commitMs - windowMs : commitMs
const to = phase === 'baseline' ? commitMs - DAY_MS : commitMs + windowMs - DAY_MS

const program = Effect.gen(function* () {
  const api = yield* CloudflareApi
  const { zoneId, host } = yield* CloudflareSettings
  const statusFilter = plan.status === undefined ? 'requestSource:"eyeball",verifiedBotCategory:""' : `edgeResponseStatus:${plan.status}`
  const raw = yield* api.graphql(
    `baseline.${id}`,
    `{viewer{zones(filter:{zoneTag:"${zoneId}"}){g:httpRequestsAdaptiveGroups(limit:1000,filter:{date_geq:"${isoDate(from)}",date_leq:"${isoDate(to)}",clientRequestHTTPHost:"${host}",${statusFilter}},orderBy:[count_DESC]){count dimensions{clientRequestPath}}}}}`,
  )
  const rows = Schema.decodeUnknownSync(Rows)(raw).viewer.zones[0]?.g ?? []
  const inGroup = (patterns: ReadonlyArray<string>, path: string) =>
    patterns.some(pattern => matches(pattern, path))
  const group = (patterns: ReadonlyArray<string>, excluded: ReadonlyArray<string>) =>
    rows
      .filter(row => inGroup(patterns, row.dimensions.clientRequestPath))
      .filter(row => !inGroup(excluded, row.dimensions.clientRequestPath))
      .map(row => ({ path: row.dimensions.clientRequestPath, count: bucket(row.count) }))
      .filter(row => row.count > 0)
  return {
    experiment: plan.id,
    phase,
    metric: plan.metric,
    windowStart: isoDate(from),
    windowEnd: isoDate(to),
    windowDays: plan.windowDays,
    frozenAt: new Date().toISOString(),
    rows: [
      ...group(plan.treated, plan.control).map(row => ({ ...row, arm: 'treated' })),
      ...group(plan.control, []).map(row => ({ ...row, arm: 'control' })),
    ],
  }
})

const AppLayer = CloudflareApiLive.pipe(
  Layer.provideMerge(CloudflareSettingsFromEnv),
  Layer.provideMerge(FetchHttpClient.layer),
)

const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
const file = join(dir, phase === 'baseline' ? 'baseline.json' : 'after.json')
writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
const total = (arm: string) =>
  result.rows.filter(row => row.arm === arm).reduce((sum, row) => sum + row.count, 0)
console.log(`${file}: treated=${total('treated')} control=${total('control')} rows=${result.rows.length}`)
