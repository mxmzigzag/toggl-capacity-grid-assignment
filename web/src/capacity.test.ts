import { describe, expect, it } from 'vitest'
import { formatHours, isOverAllocated, loadLevel, utilization } from './capacity'

describe('loadLevel', () => {
  it('is none when nothing is allocated', () => {
    expect(loadLevel(0, 40)).toBe('none')
    expect(loadLevel(0, 0)).toBe('none')
  })

  it('is ok comfortably under capacity', () => {
    expect(loadLevel(20, 40)).toBe('ok')
  })

  it('is high from 85% up to and including full capacity', () => {
    expect(loadLevel(34, 40)).toBe('high') // 85%
    expect(loadLevel(40, 40)).toBe('high') // exactly full is not over
  })

  it('is over above capacity', () => {
    expect(loadLevel(50, 40)).toBe('over')
  })

  it('treats any allocation against zero capacity as over', () => {
    expect(loadLevel(5, 0)).toBe('over')
  })
})

describe('isOverAllocated', () => {
  it('is false exactly at capacity and true above it', () => {
    expect(isOverAllocated(40, 40)).toBe(false)
    expect(isOverAllocated(40.5, 40)).toBe(true)
  })
})

describe('utilization', () => {
  it('returns the ratio, or null when capacity is zero', () => {
    expect(utilization(20, 40)).toBe(0.5)
    expect(utilization(5, 0)).toBeNull()
  })
})

describe('formatHours', () => {
  it('keeps whole numbers clean and rounds fractions to one decimal', () => {
    expect(formatHours(40)).toBe('40')
    expect(formatHours(37.5)).toBe('37.5')
    expect(formatHours(2.25)).toBe('2.3')
  })
})
