import { Schema } from 'effect'

const DAY_MS = 86_400_000

export const Plan = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  hypothesis: Schema.String,
  metric: Schema.String,
  target: Schema.String,
  group: Schema.String,
  treated: Schema.Array(Schema.String),
  control: Schema.Array(Schema.String),
  windowDays: Schema.Number,
  commit: Schema.String,
  commitDate: Schema.String,
})
export type Plan = typeof Plan.Type

export const Verdict = Schema.Struct({
  verdict: Schema.Literals(['proven', 'disproven', 'inconclusive']),
})

export type Overlap = Readonly<{ path: string; owners: ReadonlyArray<string> }>

const matches = (pattern: string, path: string) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern

const claims = (plan: Pick<Plan, 'id' | 'treated' | 'control'>) => [
  ...plan.treated.map(path => ({ path, owner: `${plan.id}:treated` })),
  ...plan.control.map(path => ({ path, owner: `${plan.id}:control` })),
]

const collides = (a: string, b: string) => matches(a, b) || matches(b, a)

export const findOverlaps = (
  plans: ReadonlyArray<Pick<Plan, 'id' | 'treated' | 'control'>>,
): ReadonlyArray<Overlap> => {
  const all = plans.flatMap(claims)
  const found = new Map<string, Set<string>>()
  for (const [index, left] of all.entries()) {
    for (const right of all.slice(index + 1)) {
      const sameExperiment = left.owner.split(':')[0] === right.owner.split(':')[0]
      const bothControl = left.owner.endsWith(':control') && right.owner.endsWith(':control')
      if (sameExperiment || bothControl || !collides(left.path, right.path)) continue
      const key = left.path.length <= right.path.length ? left.path : right.path
      const owners = found.get(key) ?? new Set<string>()
      owners.add(left.owner)
      owners.add(right.owner)
      found.set(key, owners)
    }
  }
  return [...found].map(([path, owners]) => ({ path, owners: [...owners].sort() }))
}

export const windowsFor = (plan: Pick<Plan, 'commitDate' | 'windowDays'>) => {
  const commitMs = Date.parse(plan.commitDate)
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  return {
    baseline: { from: day(commitMs - plan.windowDays * DAY_MS), to: day(commitMs - DAY_MS) },
    after: { from: day(commitMs), to: day(commitMs + (plan.windowDays - 1) * DAY_MS) },
  }
}

export const minimumDetectableLift = (dailyMean: number, windowDays: number) => {
  if (dailyMean <= 0) return Number.POSITIVE_INFINITY
  const total = dailyMean * windowDays
  return Math.round((2.8 * Math.sqrt(2 / total)) * 100)
}
