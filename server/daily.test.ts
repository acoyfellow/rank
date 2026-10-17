import { describe, expect, it } from 'vitest'
import { mergeDays, missingDays } from './daily'
import type { Experiment } from './ledger'

const experiment: Experiment = {
  id: '900',
  title: 't',
  hypothesis: 'h',
  metric: 'm',
  commit: 'c',
  commitDate: '2026-10-05T12:00:00Z',
  windowDays: 2,
  treated: ['/a*'],
  control: ['/a-control'],
  baseline: { from: '2026-10-03', to: '2026-10-04' },
  after: { from: '2026-10-05', to: '2026-10-06' },
  verdict: 'open',
}

describe('daily series', () => {
  it('asks only for days not yet saved, up to yesterday', () => {
    const saved = { '900': [{ date: '2026-10-03', treated: 1, control: 1 }] }
    expect(missingDays([experiment], saved, '2026-10-05')).toEqual(['2026-10-04', '2026-10-05'])
  })

  it('keeps saved rows and splits fetched paths into treated and control', () => {
    const saved = { '900': [{ date: '2026-10-03', treated: 9, control: 9 }] }
    const paths = [
      { date: '2026-10-04', path: '/a', count: 5 },
      { date: '2026-10-04', path: '/a-control', count: 3 },
      { date: '2026-10-04', path: '/b', count: 100 },
    ]
    const merged = mergeDays([experiment], saved, ['2026-10-04'], paths, '2026-10-04')
    expect(merged['900']).toEqual([
      { date: '2026-10-03', treated: 9, control: 9 },
      { date: '2026-10-04', treated: 5, control: 3 },
    ])
  })
})
