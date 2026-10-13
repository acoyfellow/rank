import { Context, Effect, Layer, Schema } from 'effect'
import { CloudflareApi, CloudflareError, CloudflareSettings } from './cloudflare'

const PathRow = Schema.Struct({
  count: Schema.Number,
  dimensions: Schema.Struct({
    clientRequestPath: Schema.String,
    verifiedBotCategory: Schema.String,
  }),
})

const DayRow = Schema.Struct({
  dimensions: Schema.Struct({ date: Schema.String }),
  sum: Schema.Struct({
    requests: Schema.Number,
    pageViews: Schema.Number,
  }),
  uniq: Schema.Struct({ uniques: Schema.Number }),
})

const WorkerRow = Schema.Struct({
  dimensions: Schema.Struct({ scriptName: Schema.String }),
  sum: Schema.Struct({ requests: Schema.Number, errors: Schema.Number }),
})

const ZonePaths = Schema.Struct({
  viewer: Schema.Struct({
    zones: Schema.Array(
      Schema.Struct({ httpRequestsAdaptiveGroups: Schema.Array(PathRow) }),
    ),
  }),
})

const ZoneDays = Schema.Struct({
  viewer: Schema.Struct({
    zones: Schema.Array(
      Schema.Struct({ httpRequests1dGroups: Schema.Array(DayRow) }),
    ),
  }),
})

const AccountWorkers = Schema.Struct({
  viewer: Schema.Struct({
    accounts: Schema.Array(
      Schema.Struct({ workersInvocationsAdaptive: Schema.Array(WorkerRow) }),
    ),
  }),
})

export type PathCount = Readonly<{
  path: string
  botCategory: string
  count: number
}>

export type DayCount = Readonly<{
  date: string
  requests: number
  pageViews: number
  uniques: number
}>

export type WorkerCount = Readonly<{
  script: string
  requests: number
  errors: number
}>

export type Window = Readonly<{ from: string; to: string }>

type TrafficShape = Readonly<{
  pathsByBot: (
    window: Window,
  ) => Effect.Effect<ReadonlyArray<PathCount>, CloudflareError>
  days: (window: Window) => Effect.Effect<ReadonlyArray<DayCount>, CloudflareError>
  workers: (
    window: Window,
  ) => Effect.Effect<ReadonlyArray<WorkerCount>, CloudflareError>
}>

export class Traffic extends Context.Service<Traffic, TrafficShape>()(
  'rank/Traffic',
) {}

const PATH_LIMIT = 500
const WORKER_LIMIT = 20

const decode =
  <A, I>(schema: Schema.Codec<A, I>, operation: string) =>
  (data: unknown) =>
    Schema.decodeUnknownEffect(schema)(data).pipe(
      Effect.mapError(
        cause => new CloudflareError({ operation, detail: String(cause) }),
      ),
    )

export const TrafficLive = Layer.effect(
  Traffic,
  Effect.gen(function* () {
    const api = yield* CloudflareApi
    const { zoneId, accountId, host } = yield* CloudflareSettings

    const pathsByBot = (window: Window) =>
      api
        .graphql(
          'traffic.pathsByBot',
          `{viewer{zones(filter:{zoneTag:"${zoneId}"}){httpRequestsAdaptiveGroups(limit:${PATH_LIMIT},filter:{date_geq:"${window.from}",date_leq:"${window.to}",clientRequestHTTPHost:"${host}",requestSource:"eyeball"},orderBy:[count_DESC]){count dimensions{clientRequestPath verifiedBotCategory}}}}}`,
        )
        .pipe(
          Effect.flatMap(decode(ZonePaths, 'traffic.pathsByBot')),
          Effect.map(data =>
            (data.viewer.zones[0]?.httpRequestsAdaptiveGroups ?? []).map(row => ({
              path: row.dimensions.clientRequestPath,
              botCategory: row.dimensions.verifiedBotCategory,
              count: row.count,
            })),
          ),
        )

    const days = (window: Window) =>
      api
        .graphql(
          'traffic.days',
          `{viewer{zones(filter:{zoneTag:"${zoneId}"}){httpRequests1dGroups(limit:60,filter:{date_geq:"${window.from}",date_leq:"${window.to}"},orderBy:[date_ASC]){dimensions{date} sum{requests pageViews} uniq{uniques}}}}}`,
        )
        .pipe(
          Effect.flatMap(decode(ZoneDays, 'traffic.days')),
          Effect.map(data =>
            (data.viewer.zones[0]?.httpRequests1dGroups ?? []).map(row => ({
              date: row.dimensions.date,
              requests: row.sum.requests,
              pageViews: row.sum.pageViews,
              uniques: row.uniq.uniques,
            })),
          ),
        )

    const workers = (window: Window) =>
      api
        .graphql(
          'traffic.workers',
          `{viewer{accounts(filter:{accountTag:"${accountId}"}){workersInvocationsAdaptive(limit:${WORKER_LIMIT},filter:{date_geq:"${window.from}",date_leq:"${window.to}"},orderBy:[sum_requests_DESC]){dimensions{scriptName} sum{requests errors}}}}}`,
        )
        .pipe(
          Effect.flatMap(decode(AccountWorkers, 'traffic.workers')),
          Effect.map(data =>
            (data.viewer.accounts[0]?.workersInvocationsAdaptive ?? []).map(
              row => ({
                script: row.dimensions.scriptName,
                requests: row.sum.requests,
                errors: row.sum.errors,
              }),
            ),
          ),
        )

    return { pathsByBot, days, workers }
  }),
)
