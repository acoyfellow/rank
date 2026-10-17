import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { rankConfig } from '../rank.config'
import { CloudflareApiLive, CloudflareSettings } from '../server/cloudflare'
import { type DailyById, fillDaily } from '../server/daily'
import { experiments } from '../server/ledger'
import { buildSnapshotWith, seedDaily } from '../server/snapshot'

type Env = Readonly<{
  CLOUDFLARE_ACCOUNT_ID: string
  RANK_ZONE_ID: string
  CLOUDFLARE_API_TOKEN: string
  SNAPSHOTS: KVNamespace
  ASSETS: Fetcher
}>

const SNAPSHOT_KEY = 'snapshot:latest'
const DAILY_KEY = 'daily:v1'
const DAYS_PER_REFRESH = 6

const DayRows = Schema.Record(
  Schema.String,
  Schema.Array(Schema.Struct({ date: Schema.String, treated: Schema.Number, control: Schema.Number })),
)

const layerFor = (env: Env) =>
  CloudflareApiLive.pipe(
    Layer.provideMerge(
      Layer.succeed(CloudflareSettings, {
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        zoneId: env.RANK_ZONE_ID,
        apiToken: env.CLOUDFLARE_API_TOKEN,
        host: rankConfig.host,
      }),
    ),
    Layer.provideMerge(FetchHttpClient.layer),
  )

const readDaily = async (env: Env): Promise<DailyById> => {
  const stored = await env.SNAPSHOTS.get(DAILY_KEY)
  const parsed = stored ? Schema.decodeUnknownSync(DayRows)(JSON.parse(stored)) : {}
  return Object.fromEntries(
    experiments.map(experiment => {
      const kept = new Map([...(seedDaily[experiment.id] ?? []), ...(parsed[experiment.id] ?? [])].map(row => [row.date, row]))
      return [experiment.id, [...kept.values()].sort((a, b) => a.date.localeCompare(b.date))]
    }),
  )
}

export const refresh = async (env: Env) => {
  const saved = await readDaily(env)
  const program = Effect.gen(function* () {
    const daily = yield* fillDaily(experiments, saved, DAYS_PER_REFRESH, Date.now()).pipe(
      Effect.orElseSucceed(() => saved),
    )
    const snapshot = yield* buildSnapshotWith(daily)
    return { daily, snapshot }
  })
  const { daily, snapshot } = await Effect.runPromise(program.pipe(Effect.provide(layerFor(env))))
  await env.SNAPSHOTS.put(DAILY_KEY, JSON.stringify(daily))
  await env.SNAPSHOTS.put(SNAPSHOT_KEY, JSON.stringify(snapshot))
}

const json = (body: string) =>
  new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
    },
  })

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname === '/rank/data.json') {
      const cached = await env.SNAPSHOTS.get(SNAPSHOT_KEY)
      return cached ? json(cached) : new Response('snapshot not ready', { status: 503 })
    }
    return env.ASSETS.fetch(request)
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refresh(env))
  },
} satisfies ExportedHandler<Env>
