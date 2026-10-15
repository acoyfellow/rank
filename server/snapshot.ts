import { Effect, Schema } from 'effect'
import { CloudflareApi, CloudflareError, CloudflareSettings } from './cloudflare'
import { experiments } from './ledger'

const DAY_MS = 86_400_000
const WINDOW_DAYS = 7
const MIN_PUBLIC_COUNT = 5
const TOP_ROWS = 15
const NOISE_PREFIXES = ['/cdn-cgi/', '/_app/', '/__vite', '/@fs/', '/wp-', '/secure', '/admin']
const NOISE_PARTS = ['/.env']
const NOISE_EXTENSION = new RegExp('[.](js|css|svg|png|ico|woff2?|map|xml|txt|php)$')

export type SourceRow = Readonly<{ key: string; count: number }>

export type Source = Readonly<{
  id: string
  label: string
  product: string
  fetchedAt: string
  total: number
  rows: ReadonlyArray<SourceRow>
}>

export const bucket = (count: number) => (count < MIN_PUBLIC_COUNT ? 0 : count)

export const isPage = (path: string) =>
  !NOISE_PREFIXES.some(prefix => path.startsWith(prefix)) &&
  !NOISE_PARTS.some(part => path.includes(part)) &&
  !NOISE_EXTENSION.test(path)

export const toSource = (
  id: string,
  label: string,
  product: string,
  entries: ReadonlyArray<readonly [string, number]>,
  fetchedAt: string,
): Source => {
  const totals = new Map<string, number>()
  for (const [key, count] of entries) totals.set(key, (totals.get(key) ?? 0) + count)
  const rows = [...totals.entries()]
    .map(([key, count]) => ({ key, count: bucket(count) }))
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count)
  return {
    id,
    label,
    product,
    fetchedAt,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    rows: rows.slice(0, TOP_ROWS),
  }
}

const isoDate = (offsetDays: number) =>
  new Date(Date.now() - offsetDays * DAY_MS).toISOString().slice(0, 10)

const Count = <F extends Schema.Struct.Fields>(fields: F) =>
  Schema.Struct({ count: Schema.Number, dimensions: Schema.Struct(fields) })

const ZoneData = Schema.Struct({
  viewer: Schema.Struct({
    zones: Schema.Array(
      Schema.Struct({
        paths: Schema.Array(
          Count({
            clientRequestPath: Schema.String,
            verifiedBotCategory: Schema.String,
          }),
        ),
        status: Schema.Array(
          Count({ edgeResponseStatus: Schema.Number, cacheStatus: Schema.String }),
        ),
        dns: Schema.Array(
          Count({ queryType: Schema.String, responseCode: Schema.String }),
        ),
        days: Schema.Array(
          Schema.Struct({
            dimensions: Schema.Struct({ date: Schema.String }),
            sum: Schema.Struct({
              pageViews: Schema.Number,
              countryMap: Schema.Array(
                Schema.Struct({
                  clientCountryName: Schema.String,
                  requests: Schema.Number,
                }),
              ),
            }),
          }),
        ),
      }),
    ),
    accounts: Schema.Array(
      Schema.Struct({
        workers: Schema.Array(
          Schema.Struct({
            dimensions: Schema.Struct({ scriptName: Schema.String }),
            sum: Schema.Struct({ requests: Schema.Number }),
          }),
        ),
      }),
    ),
  }),
})

const snapshotQuery = (zoneId: string, accountId: string, host: string) => {
  const from = isoDate(WINDOW_DAYS)
  const to = isoDate(0)
  const adaptive = `date_geq:"${from}",date_leq:"${to}",clientRequestHTTPHost:"${host}"`
  return `{viewer{
    zones(filter:{zoneTag:"${zoneId}"}){
      paths:httpRequestsAdaptiveGroups(limit:500,filter:{${adaptive},requestSource:"eyeball"},orderBy:[count_DESC]){count dimensions{clientRequestPath verifiedBotCategory}}
      status:httpRequestsAdaptiveGroups(limit:20,filter:{${adaptive},requestSource:"eyeball"},orderBy:[count_DESC]){count dimensions{edgeResponseStatus cacheStatus}}
      dns:dnsAnalyticsAdaptiveGroups(limit:20,filter:{date_geq:"${from}",date_leq:"${to}"},orderBy:[count_DESC]){count dimensions{queryType responseCode}}
      days:httpRequests1dGroups(limit:10,filter:{date_geq:"${from}",date_leq:"${to}"},orderBy:[date_ASC]){dimensions{date} sum{pageViews countryMap{clientCountryName requests}}}
    }
    accounts(filter:{accountTag:"${accountId}"}){
      workers:workersInvocationsAdaptive(limit:20,filter:{date_geq:"${from}",date_leq:"${to}"},orderBy:[sum_requests_DESC]){dimensions{scriptName} sum{requests}}
    }
  }}`
}

export const buildSnapshot = Effect.gen(function* () {
  const api = yield* CloudflareApi
  const { zoneId, accountId, host } = yield* CloudflareSettings
  const raw = yield* api.graphql(
    'snapshot',
    snapshotQuery(zoneId, accountId, host),
  )
  const data = yield* Schema.decodeUnknownEffect(ZoneData)(raw).pipe(
    Effect.mapError(
      cause => new CloudflareError({ operation: 'snapshot', detail: String(cause) }),
    ),
  )
  const zone = data.viewer.zones[0]
  const account = data.viewer.accounts[0]
  const fetchedAt = new Date().toISOString()
  const paths = zone?.paths ?? []

  const sources: ReadonlyArray<Source> = [
    toSource(
      'pages',
      'Human page requests by path',
      'GraphQL Analytics',
      paths
        .filter(r => r.dimensions.verifiedBotCategory === '' && isPage(r.dimensions.clientRequestPath))
        .map(r => [r.dimensions.clientRequestPath, r.count] as const),
      fetchedAt,
    ),
    toSource(
      'crawlers',
      'Verified crawler requests by category',
      'Bot Management fields',
      paths
        .filter(r => r.dimensions.verifiedBotCategory !== '')
        .map(r => [r.dimensions.verifiedBotCategory, r.count] as const),
      fetchedAt,
    ),
    toSource(
      'days',
      'Page views per day',
      'GraphQL Analytics',
      (zone?.days ?? []).map(d => [d.dimensions.date, d.sum.pageViews] as const),
      fetchedAt,
    ),
    toSource(
      'status',
      'Responses by status and cache result',
      'Cache and edge',
      (zone?.status ?? []).map(
        r => [`${r.dimensions.edgeResponseStatus} ${r.dimensions.cacheStatus}`, r.count] as const,
      ),
      fetchedAt,
    ),
    toSource(
      'dns',
      'DNS queries by type and result',
      'DNS Analytics',
      (zone?.dns ?? []).map(
        r => [`${r.dimensions.queryType} ${r.dimensions.responseCode}`, r.count] as const,
      ),
      fetchedAt,
    ),
    toSource(
      'countries',
      'Requests by country',
      'GraphQL Analytics',
      (zone?.days ?? []).flatMap(d =>
        d.sum.countryMap.map(c => [c.clientCountryName, c.requests] as const),
      ),
      fetchedAt,
    ),
    toSource(
      'workers',
      'Worker requests on the account',
      'Workers Analytics',
      (account?.workers ?? []).map(r => [r.dimensions.scriptName, r.sum.requests] as const),
      fetchedAt,
    ),
  ]

  return { site: host, generatedAt: fetchedAt, window: { from: isoDate(WINDOW_DAYS), to: isoDate(0) }, sources, experiments }
})
