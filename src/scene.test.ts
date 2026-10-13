import { expect, given, role, scene } from 'foldkit/scene'
import { test } from 'vitest'

import { SnapshotAsyncData, update, view } from './main'
import type { Snapshot } from './snapshot'

const snapshot: Snapshot = {
  site: 'coey.dev',
  generatedAt: '2026-10-13T12:00:00Z',
  window: { from: '2026-10-06', to: '2026-10-13' },
  sources: [
    {
      id: 'pages',
      label: 'Human page requests by path',
      product: 'GraphQL Analytics',
      fetchedAt: '2026-10-13T12:00:00Z',
      total: 120,
      rows: [{ key: '/prompts/grill-me', count: 120 }],
    },
  ],
  experiments: [
    {
      id: '001',
      title: 'Related prompts on every prompt page',
      hypothesis: 'Links raise page views.',
      metric: 'human page views per prompt page per week',
      commit: '0726bb2',
      commitDate: '2026-10-13T10:40:00Z',
      windowDays: 14,
      treated: ['/prompts/*'],
      control: ['/prompts/philosophy'],
      baseline: { from: '2026-09-29', to: '2026-10-12' },
      after: { from: '2026-10-13', to: '2026-10-26' },
      verdict: 'open',
    },
  ],
}

test('a loaded snapshot shows the experiment and each source', () => {
  scene(
    { update, view },
    given({ snapshot: SnapshotAsyncData.Success({ data: snapshot }) }),
    expect(role('heading', { name: 'Related prompts on every prompt page' })).toExist(),
    expect(role('heading', { name: 'Human page requests by path' })).toExist(),
  )
})
