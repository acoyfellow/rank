import { Effect, Schema } from 'effect'
import { CloudflareApi, CloudflareSettings } from './cloudflare'
import type { Experiment } from './ledger'

const DAY_MS = 86_400_000

export type DayRow = Readonly<{ date: string; treated: number; control: number }>
export type DailyById = Readonly<Record<string, ReadonlyArray<DayRow>>>
type PathDay = Readonly<{ date: string; path: string; count: number }>

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

export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const matches = (pattern: string, path: string) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern

const inGroup = (patterns: ReadonlyArray<string>, path: string) =>
  patterns.some(pattern => matches(pattern, path))

export const daysBetween = (from: string, to: string): ReadonlyArray<string> => {
  const days: Array<string> = []
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += DAY_MS) days.push(isoDate(ms))
  return days
}

export const experimentDays = (experiment: Experiment, yesterday: string): ReadonlyArray<string> => {
  const commitMs = Date.parse(experiment.commitDate)
  const from = isoDate(commitMs - experiment.windowDays * DAY_MS)
  const to = isoDate(commitMs + (experiment.windowDays - 1) * DAY_MS)
  return daysBetween(from, to < yesterday ? to : yesterday)
}

export const missingDays = (
  experiments: ReadonlyArray<Experiment>,
  saved: DailyById,
  yesterday: string,
): ReadonlyArray<string> => {
  const missing = experiments.flatMap(experiment => {
    const have = new Set((saved[experiment.id] ?? []).map(row => row.date))
    return experimentDays(experiment, yesterday).filter(date => !have.has(date))
  })
  return [...new Set(missing)].sort()
}

const rowFor = (experiment: Experiment, date: string, pathDays: ReadonlyArray<PathDay>): DayRow => {
  const sum = (patterns: ReadonlyArray<string>, excluded: ReadonlyArray<string>) =>
    pathDays
      .filter(row => row.date === date && inGroup(patterns, row.path) && !inGroup(excluded, row.path))
      .reduce((total, row) => total + row.count, 0)
  return { date, treated: sum(experiment.treated, experiment.control), control: sum(experiment.control, []) }
}

export const mergeDays = (
  experiments: ReadonlyArray<Experiment>,
  saved: DailyById,
  fetchedDates: ReadonlyArray<string>,
  pathDays: ReadonlyArray<PathDay>,
  yesterday: string,
): DailyById =>
  Object.fromEntries(
    experiments.map(experiment => {
      const kept = new Map((saved[experiment.id] ?? []).map(row => [row.date, row]))
      const series = experimentDays(experiment, yesterday).flatMap(date => {
        const existing = kept.get(date)
        if (existing) return [existing]
        return fetchedDates.includes(date) ? [rowFor(experiment, date, pathDays)] : []
      })
      return [experiment.id, series]
    }),
  )

export const fetchPathDay = (date: string) =>
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

export const fillDaily = (
  experiments: ReadonlyArray<Experiment>,
  saved: DailyById,
  maxDays: number,
  now: number,
) =>
  Effect.gen(function* () {
    const yesterday = isoDate(now - DAY_MS)
    const dates = missingDays(experiments, saved, yesterday).slice(0, maxDays)
    const pathDays = yield* Effect.forEach(dates, fetchPathDay, { concurrency: 1 }).pipe(
      Effect.map(days => days.flat()),
    )
    return mergeDays(experiments, saved, dates, pathDays, yesterday)
  })
