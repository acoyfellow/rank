import { describe, expect, it } from 'vitest'
import { findOverlaps, minimumDetectableLift, windowsFor } from './plan'

describe('findOverlaps', () => {
  it('flags a page that is treated in one experiment and control in another', () => {
    const overlaps = findOverlaps([
      { id: '1', treated: ['/a'], control: ['/c'] },
      { id: '2', treated: ['/b'], control: ['/a'] },
    ])
    expect(overlaps).toEqual([{ path: '/a', owners: ['1:treated', '2:control'] }])
  })

  it('flags a wildcard that covers another treated page', () => {
    const overlaps = findOverlaps([
      { id: '1', treated: ['/prompts/*'], control: [] },
      { id: '2', treated: ['/prompts/grill-me'], control: [] },
    ])
    expect(overlaps).toHaveLength(1)
  })

  it('allows the same unchanged control page in two experiments', () => {
    expect(
      findOverlaps([
        { id: '1', treated: ['/a'], control: ['/c'] },
        { id: '2', treated: ['/b'], control: ['/c'] },
      ]),
    ).toEqual([])
  })
})

describe('windowsFor', () => {
  it('puts the change day first in the after window', () => {
    expect(windowsFor({ commitDate: '2026-10-15T12:45:31Z', windowDays: 14 })).toEqual({
      baseline: { from: '2026-10-01', to: '2026-10-14' },
      after: { from: '2026-10-15', to: '2026-10-28' },
    })
  })
})

describe('minimumDetectableLift', () => {
  it('needs a larger lift on quieter pages', () => {
    expect(minimumDetectableLift(5, 14)).toBeGreaterThan(minimumDetectableLift(50, 14))
  })
})
