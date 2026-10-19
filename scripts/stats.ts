import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DayRow } from '../server/daily'
import { powerOf } from '../server/power'
import { EXPERIMENTS_DIR, loadPlans } from './plans'

const targetPercent = (target: string) => Number(target.match(/(\d+)%/)?.[1] ?? Number.NaN)

const rows = loadPlans().map(plan => {
  const daily: ReadonlyArray<DayRow> = JSON.parse(readFileSync(join(EXPERIMENTS_DIR, plan.id, 'daily.json'), 'utf8'))
  const changeDay = plan.commitDate.slice(0, 10)
  const power = powerOf(daily.filter(row => row.date < changeDay), plan.windowDays)
  const target = targetPercent(plan.target)
  const powered = power.detectableLiftPercent <= target
  return { plan, power, target, powered }
})

console.log('id   treated/d control/d noise  detectable target  status')
for (const { plan, power, target, powered } of rows) {
  console.log(
    `${plan.id}  ${String(power.treatedPerDay).padStart(9)} ${String(power.controlPerDay).padStart(9)} ${`${power.dailyNoisePercent}%`.padStart(6)} ${`${power.detectableLiftPercent}%`.padStart(10)} ${`${target}%`.padStart(6)}  ${powered ? 'powered' : 'UNDERPOWERED'}`,
  )
}
