// Shape of GET /api/capacity. `cells` is aligned to `weeks` by index.
export type Week = { start: string; end: string }
export type Cell = { allocatedHours: number }
export type Person = {
  id: number
  name: string
  weeklyHours: number
  cells: Cell[]
}
export type CapacityResponse = { weeks: Week[]; people: Person[] }

export type Load = 'none' | 'ok' | 'high' | 'over'

// loadLevel classifies a cell by how full it is relative to capacity. It is the single
// source of truth for the grid's colour, so over-allocation is defined in exactly one
// place. A person with zero capacity but any allocation is always over-allocated.
export function loadLevel(allocatedHours: number, capacityHours: number): Load {
  if (allocatedHours <= 0) return 'none'
  if (capacityHours <= 0) return 'over'
  const utilization = allocatedHours / capacityHours
  if (utilization > 1) return 'over'
  if (utilization >= 0.85) return 'high'
  return 'ok'
}

export function isOverAllocated(allocatedHours: number, capacityHours: number): boolean {
  return loadLevel(allocatedHours, capacityHours) === 'over'
}

// utilization is allocated/capacity as a fraction, or null when capacity is zero.
export function utilization(allocatedHours: number, capacityHours: number): number | null {
  if (capacityHours <= 0) return null
  return allocatedHours / capacityHours
}

// formatHours keeps whole numbers clean and shows at most one decimal otherwise.
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}
