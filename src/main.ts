import { Effect, Schema } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/http'
import { AsyncData, Command, Http, Runtime, type Update } from 'foldkit'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import { type IndexPoint, liftOf, relativeIndex } from './lift'
import { type DayRow, type Experiment, Snapshot, type Source } from './snapshot'

export const SnapshotAsyncData = AsyncData.Schema(Snapshot, Schema.String)

export const Model = Schema.Struct({ snapshot: SnapshotAsyncData.schema })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  SucceededFetchSnapshot: { snapshot: Snapshot },
  FailedFetchSnapshot: { error: Schema.String },
})
export type Message = typeof Message.Type

const DATA_URL = '/rank/data.json'
const REPO_URL = 'https://github.com/acoyfellow/rank'
const MAX_BAR_ROWS = 8

const fetchSnapshot = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.execute(HttpClientRequest.get(DATA_URL))
  const json = yield* response.json
  const snapshot = yield* Schema.decodeUnknownEffect(Snapshot)(json)
  return Message.SucceededFetchSnapshot({ snapshot })
}).pipe(
  Effect.timeout('10 seconds'),
  Effect.catch(error =>
    Effect.succeed(
      Message.FailedFetchSnapshot({
        error: `The data endpoint did not answer: ${String(error).slice(0, 200)}`,
      }),
    ),
  ),
)

export const FetchSnapshot = Command.define('FetchSnapshot', {
  messages: [Message.SucceededFetchSnapshot, Message.FailedFetchSnapshot],
  execute: Effect.provide(fetchSnapshot, Http.layer),
})

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    SucceededFetchSnapshot: ({ snapshot }) => ({
      model: modifyFields(model, {
        snapshot: () => SnapshotAsyncData.Success({ data: snapshot }),
      }),
    }),
    FailedFetchSnapshot: ({ error }) => ({
      model: modifyFields(model, {
        snapshot: () => SnapshotAsyncData.Failure({ error }),
      }),
    }),
  })

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: { snapshot: SnapshotAsyncData.Loading() },
  commands: [FetchSnapshot()],
})

const formatCount = (count: number) => count.toLocaleString('en-US')

const relativeTime = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`
}

const sourceCard = (source: Source, h: HtmlBuilder<Message>): Html => {
  const top = source.rows[0]?.count ?? 1
  return h.section(
    [h.Class('border border-ink/15 bg-paper p-5 flex flex-col gap-4')],
    [
      h.header(
        [h.Class('flex items-baseline justify-between gap-3')],
        [
          h.h3([h.Class('font-bold text-ink')], [source.label]),
          h.span([h.Class('font-mono text-xs text-ink/50')], [source.product]),
        ],
      ),
      h.p(
        [h.Class('font-mono text-3xl font-bold text-ink')],
        [formatCount(source.total)],
      ),
      h.ul(
        [h.Class('flex flex-col gap-1.5')],
        source.rows.slice(0, MAX_BAR_ROWS).map(row =>
          h.li(
            [h.Class('grid grid-cols-[1fr_auto] gap-3 text-sm items-center')],
            [
              h.div(
                [h.Class('relative overflow-hidden')],
                [
                  h.div(
                    [
                      h.Class('absolute inset-y-0 left-0 bg-signal/20'),
                      h.Style({ width: `${Math.max(2, (row.count / top) * 100)}%` }),
                    ],
                    [],
                  ),
                  h.span(
                    [h.Class('relative block truncate px-1.5 py-0.5 font-mono text-ink/80')],
                    [row.key],
                  ),
                ],
              ),
              h.span(
                [h.Class('font-mono text-ink/60 tabular-nums')],
                [formatCount(row.count)],
              ),
            ],
          ),
        ),
      ),
      h.footer(
        [h.Class('font-mono text-xs text-ink/40')],
        [`fetched ${relativeTime(source.fetchedAt)}`],
      ),
    ],
  )
}

const CHART_WIDTH = 300
const CHART_HEIGHT = 60

const linePoints = (rows: ReadonlyArray<DayRow>, arm: 'treated' | 'control', top: number) =>
  rows
    .map((row, index) => {
      const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * CHART_WIDTH
      const y = CHART_HEIGHT - (row[arm] / top) * CHART_HEIGHT
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

const changeX = (rows: ReadonlyArray<DayRow>, changeDay: string) => {
  const index = rows.findIndex(row => row.date >= changeDay)
  if (index < 0 || rows.length < 2) return CHART_WIDTH
  return (index / (rows.length - 1)) * CHART_WIDTH
}

const dailyChart = (experiment: Experiment, rows: ReadonlyArray<DayRow>, h: HtmlBuilder<Message>): Html => {
  const top = Math.max(1, ...rows.map(row => Math.max(row.treated, row.control)))
  const x = changeX(rows, experiment.commitDate.slice(0, 10)).toFixed(1)
  return h.svg(
    [
      h.ViewBox(`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`),
      h.PreserveAspectRatio('none'),
      h.Class('w-full h-16'),
      h.Role('img'),
      h.AriaLabel(`Daily human views, treated and control, for experiment ${experiment.id}`),
    ],
    [
      h.line([h.X1(x), h.X2(x), h.Y1('0'), h.Y2(`${CHART_HEIGHT}`), h.Stroke('currentColor'), h.StrokeWidth('1'), h.Class('text-ink/30')], []),
      h.polyline([h.Points(linePoints(rows, 'control', top)), h.Fill('none'), h.Stroke('currentColor'), h.StrokeWidth('1.5'), h.Class('text-ink/40')], []),
      h.polyline([h.Points(linePoints(rows, 'treated', top)), h.Fill('none'), h.Stroke('currentColor'), h.StrokeWidth('2'), h.Class('text-signal')], []),
    ],
  )
}

const liftLabel = (experiment: Experiment, rows: ReadonlyArray<DayRow>) => {
  const lift = liftOf(rows, experiment.commitDate)
  if (lift.liftPercent === null) return 'lift: waiting for after-days'
  const sign = lift.liftPercent > 0 ? '+' : ''
  const final = lift.afterDays >= experiment.windowDays ? 'final window' : 'not final'
  return `lift ${sign}${lift.liftPercent}% vs control · ${lift.afterDays}/${experiment.windowDays} days · ${final}`
}

const dailySection = (experiment: Experiment, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const rows = experiment.daily ?? []
  if (rows.length === 0) return []
  return [
    dailyChart(experiment, rows, h),
    h.p(
      [h.Class('font-mono text-xs text-ink/60 flex flex-wrap gap-x-4')],
      [
        h.span([h.Class('text-signal')], ['— treated']),
        h.span([h.Class('text-ink/40')], ['— control']),
        h.span([], [liftLabel(experiment, rows)]),
      ],
    ),
  ]
}

const experimentCard = (experiment: Experiment, h: HtmlBuilder<Message>): Html =>
  h.article(
    [h.Class('border-2 border-ink p-6 flex flex-col gap-3 bg-paper')],
    [
      h.div(
        [h.Class('flex items-center gap-3 font-mono text-xs uppercase tracking-widest')],
        [
          h.span([h.Class('bg-ink text-paper px-2 py-0.5')], [`#${experiment.id}`]),
          h.span([h.Class('text-signal')], [experiment.verdict]),
          h.a(
            [
              h.Href(`https://github.com/acoyfellow/coey.dev/commit/${experiment.commit}`),
              h.Class('text-ink/60 underline'),
            ],
            [experiment.commit],
          ),
        ],
      ),
      h.h3([h.Class('text-xl font-bold text-ink')], [experiment.title]),
      h.p([h.Class('text-ink/70')], [experiment.hypothesis]),
      ...dailySection(experiment, h),
      h.dl(
        [h.Class('grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-mono text-ink/70')],
        [
          h.dt([], ['metric']),
          h.dd([], [experiment.metric]),
          h.dt([], ['baseline']),
          h.dd([], [`${experiment.baseline.from} to ${experiment.baseline.to}`]),
          h.dt([], ['after']),
          h.dd([], [`${experiment.after.from} to ${experiment.after.to}`]),
          h.dt([], ['control']),
          h.dd([], [experiment.control.join(', ')]),
        ],
      ),
    ],
  )

const OVERVIEW_WIDTH = 800
const OVERVIEW_HEIGHT = 240
const OVERVIEW_PAD = 28
const SERIES_COLORS = ['#f6821f', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04']
const DAY_MS = 86_400_000

type Series = Readonly<{ experiment: Experiment; points: ReadonlyArray<IndexPoint>; color: string }>

const overviewSeries = (experiments: ReadonlyArray<Experiment>): ReadonlyArray<Series> =>
  experiments
    .map((experiment, position) => ({
      experiment,
      points: relativeIndex(experiment.daily ?? [], experiment.commitDate),
      color: SERIES_COLORS[position % SERIES_COLORS.length] ?? '#000',
    }))
    .filter(series => series.points.length > 0)

const overviewScale = (series: ReadonlyArray<Series>) => {
  const dates = series.flatMap(line => line.points.map(point => Date.parse(point.date)))
  const indexes = series.flatMap(line => line.points.map(point => point.index))
  const firstMs = Math.min(...dates)
  const lastMs = Math.max(...dates, firstMs + DAY_MS)
  const spread = Math.max(25, ...indexes.map(index => Math.abs(index - 100)))
  const plotWidth = OVERVIEW_WIDTH - OVERVIEW_PAD * 2
  const plotHeight = OVERVIEW_HEIGHT - OVERVIEW_PAD * 2
  return {
    x: (date: string) => OVERVIEW_PAD + ((Date.parse(date) - firstMs) / (lastMs - firstMs)) * plotWidth,
    y: (index: number) => OVERVIEW_PAD + plotHeight / 2 - ((index - 100) / spread) * (plotHeight / 2),
    spread,
    first: new Date(firstMs).toISOString().slice(0, 10),
    last: new Date(lastMs).toISOString().slice(0, 10),
  }
}

const overviewChart = (experiments: ReadonlyArray<Experiment>, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const series = overviewSeries(experiments)
  if (series.length === 0) return []
  const scale = overviewScale(series)
  const label = (x: number, y: number, text: string, anchor: string) =>
    h.text([h.Attribute('x', x.toFixed(1)), h.Attribute('y', y.toFixed(1)), h.Attribute('text-anchor', anchor), h.Class('fill-ink/50 font-mono text-[10px]')], [text])
  const gridLine = (index: number) =>
    h.line([h.X1(`${OVERVIEW_PAD}`), h.X2(`${OVERVIEW_WIDTH - OVERVIEW_PAD}`), h.Y1(scale.y(index).toFixed(1)), h.Y2(scale.y(index).toFixed(1)), h.Stroke('currentColor'), h.StrokeWidth(index === 100 ? '1.5' : '0.5'), h.Class(index === 100 ? 'text-ink/50' : 'text-ink/15')], [])
  const top = Math.round(100 + scale.spread)
  const bottom = Math.round(100 - scale.spread)
  const line = (entry: Series) => {
    const changeDay = entry.experiment.commitDate.slice(0, 10)
    const marker = entry.points.find(point => point.date >= changeDay)
    return h.g(
      [],
      [
        h.polyline([h.Points(entry.points.map(point => `${scale.x(point.date).toFixed(1)},${scale.y(point.index).toFixed(1)}`).join(' ')), h.Fill('none'), h.Stroke(entry.color), h.StrokeWidth('2'), h.Attribute('stroke-linejoin', 'round')], []),
        ...(marker ? [h.circle([h.Attribute('cx', scale.x(marker.date).toFixed(1)), h.Attribute('cy', scale.y(marker.index).toFixed(1)), h.Attribute('r', '4'), h.Fill(entry.color)], [])] : []),
      ],
    )
  }
  const legend = series.map(entry => {
    const latest = entry.points.at(-1)?.index ?? 100
    const delta = latest - 100
    return h.span(
      [h.Class('flex items-center gap-2')],
      [
        h.span([h.Class('inline-block w-3 h-3'), h.Style({ background: entry.color })], []),
        h.span([], [`#${entry.experiment.id} ${delta > 0 ? '+' : ''}${delta}`]),
      ],
    )
  })
  return [
    h.section(
      [h.Class('flex flex-col gap-3 border-2 border-ink p-6 bg-paper')],
      [
        h.h2([h.Class('text-2xl font-black text-ink')], ['All experiments vs control']),
        h.p(
          [h.Class('text-sm text-ink/70')],
          ['Each line is treated pages divided by control pages, 7-day average, indexed so the baseline is 100. Above 100 means the change is beating its control. The dot marks the change date.'],
        ),
        h.svg(
          [h.ViewBox(`0 0 ${OVERVIEW_WIDTH} ${OVERVIEW_HEIGHT}`), h.Class('w-full h-auto'), h.Role('img'), h.AriaLabel('Relative lift of every experiment against its control over time')],
          [
            gridLine(top),
            gridLine(100),
            gridLine(bottom),
            label(OVERVIEW_PAD - 4, scale.y(top) + 3, `${top}`, 'end'),
            label(OVERVIEW_PAD - 4, scale.y(100) + 3, '100', 'end'),
            label(OVERVIEW_PAD - 4, scale.y(bottom) + 3, `${bottom}`, 'end'),
            label(OVERVIEW_PAD, OVERVIEW_HEIGHT - 6, scale.first, 'start'),
            label(OVERVIEW_WIDTH - OVERVIEW_PAD, OVERVIEW_HEIGHT - 6, scale.last, 'end'),
            ...series.map(line),
          ],
        ),
        h.div([h.Class('flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink/70')], legend),
      ],
    ),
  ]
}

const loaded = (snapshot: Snapshot, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
  h.section(
    [h.Class('flex flex-col gap-4')],
    [
      ...overviewChart(snapshot.experiments, h),
      h.h2([h.Class('text-2xl font-black text-ink')], ['Experiments']),
      ...snapshot.experiments.map(experiment => experimentCard(experiment, h)),
    ],
  ),
  h.section(
    [h.Class('flex flex-col gap-4')],
    [
      h.h2(
        [h.Class('text-2xl font-black text-ink')],
        [`Live data, ${snapshot.window.from} to ${snapshot.window.to}`],
      ),
      h.div(
        [h.Class('grid gap-4 md:grid-cols-2 xl:grid-cols-3')],
        snapshot.sources.map(source => sourceCard(source, h)),
      ),
    ],
  ),
]

const status = (text: string, h: HtmlBuilder<Message>) =>
  h.p([h.Class('font-mono text-ink/60')], [text])

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'rank: an open SEO experiment',
  body: h.main(
    [h.Class('min-h-screen bg-paper text-ink px-6 py-12 md:px-12')],
    [
      h.div(
        [h.Class('mx-auto max-w-6xl flex flex-col gap-12')],
        [
          h.header(
            [h.Class('flex flex-col gap-3 max-w-3xl')],
            [
              h.p(
                [h.Class('font-mono text-xs uppercase tracking-[0.2em] text-signal')],
                ['rank · agentic SEO on Cloudflare'],
              ),
              h.h1(
                [h.Class('text-5xl font-black tracking-tight')],
                ['This page is an experiment.'],
              ),
              h.p(
                [h.Class('text-lg text-ink/70')],
                [
                  'An agent changes this site one step at a time and measures the result with Cloudflare data only. Every change, win or loss, is recorded below. All numbers are totals. Counts under 5 are hidden.',
                ],
              ),
              h.a(
                [h.Href(REPO_URL), h.Class('font-mono text-sm underline text-ink/70')],
                ['github.com/acoyfellow/rank'],
              ),
            ],
          ),
          ...AsyncData.match(model.snapshot, {
            onIdle: () => [status('Waiting.', h)],
            onLoading: () => [status('Reading Cloudflare data.', h)],
            onRefreshing: data => loaded(data, h),
            onStale: ({ data }) => loaded(data, h),
            onSuccess: data => loaded(data, h),
            onFailure: error => [status(error, h)],
          }),
        ],
      ),
    ],
  ),
})
