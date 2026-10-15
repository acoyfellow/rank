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
