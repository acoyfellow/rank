import { describe, expect, it } from 'vitest'
import { liftOf, relativeIndex } from './lift'

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

describe('relativeIndex', () => {
  const flat = (from: number, count: number, treated: number, control: number) =>
    Array.from({ length: count }, (_, offset) => day(`2026-10-${String(from + offset).padStart(2, '0')}`, treated, control))

  it('stays at 100 when treated and control move together', () => {
    const rows = [...flat(1, 7, 10, 20), ...flat(8, 7, 20, 40)]
    expect(relativeIndex(rows, '2026-10-08').every(point => point.index === 100)).toBe(true)
  })

  it('rises above 100 when treated outgrows control', () => {
    const rows = [...flat(1, 7, 10, 10), ...flat(8, 7, 20, 10)]
    expect(relativeIndex(rows, '2026-10-08').at(-1)?.index).toBe(200)
  })

  it('returns nothing without a baseline', () => {
    expect(relativeIndex(flat(1, 7, 10, 10), '2026-10-01')).toEqual([])
  })
})
