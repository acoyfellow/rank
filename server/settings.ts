import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Config, Effect, Layer, Option, Redacted } from 'effect'
import { rankConfig } from '../rank.config'
import { CloudflareSettings } from './cloudflare'

const WRANGLER_CONFIG_PATHS = [
  join(homedir(), '.wrangler/config/default.toml'),
  join(homedir(), 'Library/Preferences/.wrangler/config/default.toml'),
]

const wranglerLoginToken = () => {
  for (const path of WRANGLER_CONFIG_PATHS) {
    try {
      const match = readFileSync(path, 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)
      if (match?.[1]) return Option.some(match[1])
    } catch {
      continue
    }
  }
  return Option.none<string>()
}

const apiToken = Config.Redacted('CLOUDFLARE_API_TOKEN').pipe(
  Config.option,
  Config.map(fromEnv =>
    Option.isSome(fromEnv)
      ? Option.some(Redacted.value(fromEnv.value))
      : wranglerLoginToken(),
  ),
)

export const CloudflareSettingsFromEnv = Layer.effect(
  CloudflareSettings,
  Effect.gen(function* () {
    const accountId = yield* Config.withDefault(
      Config.NonEmptyString('CLOUDFLARE_ACCOUNT_ID'),
      rankConfig.accountId,
    )
    const zoneId = yield* Config.withDefault(
      Config.NonEmptyString('RANK_ZONE_ID'),
      rankConfig.zoneId,
    )
    const token = yield* apiToken
    if (Option.isNone(token)) {
      return yield* Effect.fail(
        new Error('Set CLOUDFLARE_API_TOKEN or log in with wrangler.'),
      )
    }
    return { accountId, zoneId, apiToken: token.value, host: rankConfig.host }
  }),
)
