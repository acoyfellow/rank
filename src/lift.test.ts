import { describe, expect, it } from 'vitest'
import { liftOf } from './lift'

const day = (date: string, treated: number, control: number) => ({ date, treated, control })

describe('liftOf', () => {
  it('compares equal-length windows on each side of the change', () => {
    const rows = [
      day('2026-10-01', 999, 999),
      day('2026-10-02', 10, 10),
      day('2026-10-03', 10, 10),
      day('2026-10-04', 15, 10),
      day('2026-10-05', 15, 10),
    ]
    const lift = liftOf(rows, '2026-10-04T12:00:00Z')
    expect(lift.afterDays).toBe(2)
    expect(lift.treatedBefore).toBe(20)
    expect(lift.liftPercent).toBe(50)
  })

  it('reports no lift before any after-day exists', () => {
    expect(liftOf([day('2026-10-01', 5, 5)], '2026-10-04').liftPercent).toBeNull()
  })

  it('reports a decline as a negative lift', () => {
    const rows = [day('2026-10-01', 20, 10), day('2026-10-02', 10, 10)]
    expect(liftOf(rows, '2026-10-02').liftPercent).toBe(-50)
  })
})
