import type { DayRow } from './snapshot'

export type Lift = Readonly<{
  treatedBefore: number
  treatedAfter: number
  controlBefore: number
  controlAfter: number
  afterDays: number
  liftPercent: number | null
}>

const sum = (rows: ReadonlyArray<DayRow>, arm: 'treated' | 'control') =>
  rows.reduce((total, row) => total + row[arm], 0)

const growth = (before: number, after: number) => (before === 0 ? null : after / before)

export const liftOf = (rows: ReadonlyArray<DayRow>, changeDate: string): Lift => {
  const changeDay = changeDate.slice(0, 10)
  const after = rows.filter(row => row.date >= changeDay)
  const before = rows.filter(row => row.date < changeDay).slice(-after.length || undefined)
  const treatedGrowth = growth(sum(before, 'treated'), sum(after, 'treated'))
  const controlGrowth = growth(sum(before, 'control'), sum(after, 'control'))
  const liftPercent =
    after.length === 0 || treatedGrowth === null || controlGrowth === null || controlGrowth === 0
      ? null
      : Math.round((treatedGrowth / controlGrowth - 1) * 100)
  return {
    treatedBefore: sum(before, 'treated'),
    treatedAfter: sum(after, 'treated'),
    controlBefore: sum(before, 'control'),
    controlAfter: sum(after, 'control'),
    afterDays: after.length,
    liftPercent,
  }
}

export type IndexPoint = Readonly<{ date: string; index: number }>

const ROLLING_DAYS = 7

const mean = (values: ReadonlyArray<number>) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length

export const relativeIndex = (rows: ReadonlyArray<DayRow>, changeDate: string): ReadonlyArray<IndexPoint> => {
  const changeDay = changeDate.slice(0, 10)
  const before = rows.filter(row => row.date < changeDay)
  const treatedBase = mean(before.map(row => row.treated))
  const controlBase = mean(before.map(row => row.control))
  if (treatedBase === 0 || controlBase === 0) return []
  return rows.flatMap((row, position) => {
    if (position + 1 < ROLLING_DAYS) return []
    const window = rows.slice(position + 1 - ROLLING_DAYS, position + 1)
    const control = mean(window.map(day => day.control)) / controlBase
    if (control === 0) return []
    const treated = mean(window.map(day => day.treated)) / treatedBase
    return [{ date: row.date, index: Math.round((treated / control) * 100) }]
  })
}
