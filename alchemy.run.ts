import alchemy from 'alchemy'
import { Assets, KVNamespace, Worker } from 'alchemy/cloudflare'
import { rankConfig } from './rank.config'

const app = await alchemy('rank')

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const snapshots = await KVNamespace('rank-snapshots', { title: 'rank-snapshots' })

const assets = await Assets({ path: './dist' })

export const worker = await Worker('rank', {
  name: 'rank',
  entrypoint: './worker/index.ts',
  compatibilityDate: '2026-10-13',
  url: false,
  routes: [{ pattern: `${rankConfig.host}/rank*`, zoneId: required('RANK_ZONE_ID') }],
  bindings: {
    ASSETS: assets,
    SNAPSHOTS: snapshots,
    CLOUDFLARE_ACCOUNT_ID: required('CLOUDFLARE_ACCOUNT_ID'),
    RANK_ZONE_ID: required('RANK_ZONE_ID'),
    CLOUDFLARE_API_TOKEN: alchemy.secret(required('RANK_ANALYTICS_TOKEN')),
  },
})

console.log(`rank worker deployed for ${rankConfig.site}/rank`)

await app.finalize()
