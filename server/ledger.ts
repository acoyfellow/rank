import generated from './ledger.generated.json'

export type Experiment = Readonly<{
  id: string
  title: string
  hypothesis: string
  metric: string
  commit: string
  commitDate: string
  windowDays: number
  treated: ReadonlyArray<string>
  control: ReadonlyArray<string>
  baseline: Readonly<{ from: string; to: string }>
  after: Readonly<{ from: string; to: string }>
  verdict: 'open' | 'proven' | 'disproven' | 'inconclusive'
}>

export const experiments = generated as ReadonlyArray<Experiment>
