import { Config, Effect, Layer, Redacted } from 'effect'
import { rankConfig } from '../rank.config'
import { CloudflareSettings } from './cloudflare'

export const CloudflareSettingsFromEnv = Layer.effect(
  CloudflareSettings,
  Effect.gen(function* () {
    const accountId = yield* Config.NonEmptyString('CLOUDFLARE_ACCOUNT_ID')
    const zoneId = yield* Config.NonEmptyString('RANK_ZONE_ID')
    const apiToken = yield* Config.Redacted('CLOUDFLARE_API_TOKEN')
    return {
      accountId,
      zoneId,
      apiToken: Redacted.value(apiToken),
      host: rankConfig.host,
    }
  }),
)
