import type { DayRow } from './daily'

export type Power = Readonly<{
  days: number
  treatedPerDay: number
  controlPerDay: number
  dailyNoisePercent: number
  detectableLiftPercent: number
}>

const mean = (values: ReadonlyArray<number>) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length

const standardDeviation = (values: ReadonlyArray<number>) => {
  const center = mean(values)
  return Math.sqrt(mean(values.map(value => (value - center) ** 2)))
}

export const powerOf = (baseline: ReadonlyArray<DayRow>, windowDays: number): Power => {
  const usable = baseline.filter(row => row.treated > 0 && row.control > 0)
  const logRatios = usable.map(row => Math.log(row.treated / row.control))
  const noise = standardDeviation(logRatios)
  const detectable = usable.length < 3 ? Number.POSITIVE_INFINITY : Math.exp(2.8 * noise * Math.sqrt(2 / windowDays)) - 1
  return {
    days: usable.length,
    treatedPerDay: Math.round(mean(baseline.map(row => row.treated))),
    controlPerDay: Math.round(mean(baseline.map(row => row.control))),
    dailyNoisePercent: Math.round(noise * 100),
    detectableLiftPercent: Number.isFinite(detectable) ? Math.round(detectable * 100) : Number.POSITIVE_INFINITY,
  }
}
