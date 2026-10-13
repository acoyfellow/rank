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

export const experiments: ReadonlyArray<Experiment> = [
  {
    id: '001',
    title: 'Related prompts on every prompt page',
    hypothesis:
      'Five Clef-ranked related prompt links on each prompt page raise human page views per prompt page and verified crawler requests to /prompts/*, compared with the five prompts that no other page links to.',
    metric: 'human page views per /prompts/* page per week',
    commit: '0726bb2',
    commitDate: '2026-10-13T10:40:00Z',
    windowDays: 14,
    treated: ['/prompts/*'],
    control: [
      '/prompts/be-concise',
      '/prompts/cracked-out',
      '/prompts/inbox-dog',
      '/prompts/philosophy',
      '/prompts/write-prd-ts',
    ],
    baseline: { from: '2026-09-29', to: '2026-10-12' },
    after: { from: '2026-10-13', to: '2026-10-26' },
    verdict: 'open',
  },
]
