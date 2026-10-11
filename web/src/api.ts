import type { CapacityResponse, Person } from './capacity'

async function parseError(res: Response): Promise<never> {
  const text = (await res.text()).trim()
  throw new Error(text || `Request failed (${res.status})`)
}

export async function fetchCapacity(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CapacityResponse> {
  const params = new URLSearchParams({ from, to })
  const res = await fetch(`/api/capacity?${params}`, { signal })
  if (!res.ok) return parseError(res)
  return res.json()
}

export async function updatePersonHours(
  id: number,
  weeklyHours: number,
): Promise<Person> {
  const res = await fetch(`/api/people/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeklyHours }),
  })
  if (!res.ok) return parseError(res)
  return res.json()
}
