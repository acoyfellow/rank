import { writeFileSync } from 'node:fs'
import { windowsFor } from '../server/plan'
import { loadPlans } from './plans'

const entries = loadPlans().map(plan => ({
  id: plan.id,
  title: plan.title,
  hypothesis: plan.hypothesis,
  metric: plan.metric,
  commit: plan.commit,
  commitDate: plan.commitDate,
  windowDays: plan.windowDays,
  treated: plan.treated,
  control: plan.control,
  ...windowsFor(plan),
  verdict: plan.verdict,
}))

writeFileSync('server/ledger.generated.json', `${JSON.stringify(entries, null, 2)}\n`)
console.log(`ledger: ${entries.length} experiments`)
