import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { rankConfig } from '../rank.config'
import { CloudflareApiLive, CloudflareSettings } from '../server/cloudflare'
import { buildSnapshot } from '../server/snapshot'

type Env = Readonly<{
  CLOUDFLARE_ACCOUNT_ID: string
  RANK_ZONE_ID: string
  CLOUDFLARE_API_TOKEN: string
  SNAPSHOTS: KVNamespace
  ASSETS: Fetcher
}>

const SNAPSHOT_KEY = 'snapshot:latest'
const SNAPSHOT_MAX_AGE_SECONDS = 3600

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

const isStale = (fetchedAt: string) =>
  Date.now() - Date.parse(fetchedAt) > SNAPSHOT_MAX_AGE_SECONDS * 1000

const readSnapshot = async (env: Env, ctx: ExecutionContext) => {
  const cached = await env.SNAPSHOTS.get(SNAPSHOT_KEY)
  if (cached && !isStale(JSON.parse(cached).generatedAt)) return cached
  const refresh = Effect.runPromise(
    buildSnapshot.pipe(Effect.provide(layerFor(env))),
  ).then(async snapshot => {
    const body = JSON.stringify(snapshot)
    await env.SNAPSHOTS.put(SNAPSHOT_KEY, body)
    return body
  })
  if (cached) {
    ctx.waitUntil(refresh)
    return cached
  }
  return refresh
}

const json = (body: string) =>
  new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=300`,
      'access-control-allow-origin': '*',
    },
  })

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)
    if (url.pathname === '/seo/data.json') return json(await readSnapshot(env, ctx))
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
