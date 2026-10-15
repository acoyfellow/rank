import { Schema } from 'effect'

export const SourceRow = Schema.Struct({ key: Schema.String, count: Schema.Number })

export const Source = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  product: Schema.String,
  fetchedAt: Schema.String,
  total: Schema.Number,
  rows: Schema.Array(SourceRow),
})
export type Source = typeof Source.Type

export const DayRow = Schema.Struct({
  date: Schema.String,
  treated: Schema.Number,
  control: Schema.Number,
})
export type DayRow = typeof DayRow.Type

export const Experiment = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  hypothesis: Schema.String,
  metric: Schema.String,
  commit: Schema.String,
  commitDate: Schema.String,
  windowDays: Schema.Number,
  treated: Schema.Array(Schema.String),
  control: Schema.Array(Schema.String),
  baseline: Schema.Struct({ from: Schema.String, to: Schema.String }),
  after: Schema.Struct({ from: Schema.String, to: Schema.String }),
  verdict: Schema.Literals(['open', 'proven', 'disproven', 'inconclusive']),
  daily: Schema.optional(Schema.Array(DayRow)),
})
export type Experiment = typeof Experiment.Type

export const Snapshot = Schema.Struct({
  site: Schema.String,
  generatedAt: Schema.String,
  window: Schema.Struct({ from: Schema.String, to: Schema.String }),
  sources: Schema.Array(Source),
  experiments: Schema.Array(Experiment),
})
export type Snapshot = typeof Snapshot.Type
