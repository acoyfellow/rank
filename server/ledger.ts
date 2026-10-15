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
    commitDate: '2026-10-13T10:47:12Z',
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
  {
    id: '002',
    title: 'Specific titles and descriptions on hub pages',
    hypothesis:
      'Replacing the generic title and description on /, /blog and /projects with specific, keyword-bearing ones raises human page views on those pages, compared with post pages whose meta did not change.',
    metric: 'human page views per window on /, /blog, /projects',
    commit: 'f50c4ac',
    commitDate: '2026-10-15T12:45:31Z',
    windowDays: 14,
    treated: ['/', '/blog', '/projects'],
    control: [
      '/terraloop',
      '/cursing-agents',
      '/correctness',
      '/agentic-architecture',
      '/context-cues',
    ],
    baseline: { from: '2026-10-01', to: '2026-10-14' },
    after: { from: '2026-10-15', to: '2026-10-28' },
    verdict: 'open',
  },
  {
    id: '003',
    title: 'Descriptive titles on short-titled posts',
    hypothesis:
      'Replacing bare one- to four-word titles on seven posts with titles that name the topic raises human page views on those posts, compared with similar-traffic posts whose title already names the topic.',
    metric: 'human page views per window on the seven retitled posts',
    commit: '3192cb1',
    commitDate: '2026-10-15T12:50:59Z',
    windowDays: 14,
    treated: [
      '/taste',
      '/perfect-do',
      '/constraint-theory',
      '/prompts-are-wishes',
      '/built-in-reverse',
      '/worker-loaders',
      '/vm-api',
    ],
    control: [
      '/patience',
      '/deja-research',
      '/real-time-logging',
      '/gate-review',
      '/ego-less',
      '/spread',
      '/self',
      '/puzzle',
    ],
    baseline: { from: '2026-10-01', to: '2026-10-14' },
    after: { from: '2026-10-15', to: '2026-10-28' },
    verdict: 'open',
  },
]
