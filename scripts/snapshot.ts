import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { CloudflareApiLive } from '../server/cloudflare'
import { CloudflareSettingsFromEnv } from '../server/settings'
import { buildSnapshot } from '../server/snapshot'

const AppLayer = CloudflareApiLive.pipe(
  Layer.provideMerge(CloudflareSettingsFromEnv),
  Layer.provideMerge(FetchHttpClient.layer),
)

const snapshot = await Effect.runPromise(buildSnapshot.pipe(Effect.provide(AppLayer)))
console.log(JSON.stringify(snapshot, null, 2))
