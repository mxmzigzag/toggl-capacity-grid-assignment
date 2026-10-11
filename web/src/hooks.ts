import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { fetchCapacity, updatePersonHours } from './api'
import type { CapacityResponse, Person } from './capacity'

const CAPACITY_KEY = 'capacity'

export function useCapacity(from: string, to: string) {
  return useQuery({
    queryKey: [CAPACITY_KEY, from, to],
    queryFn: ({ signal }) => fetchCapacity(from, to, signal),
    // Keep the old grid on screen while the next range loads, instead of blanking out.
    placeholderData: keepPreviousData,
  })
}

type Vars = { id: number; weeklyHours: number }

// Apply a weekly-hours change to every cached capacity range. Allocation never depends
// on capacity, so only weeklyHours changes — the grid recolours the affected row from it.
function patchCachedPerson(
  snapshots: [readonly unknown[], CapacityResponse | undefined][],
  id: number,
  update: Partial<Person>,
  set: (key: readonly unknown[], data: CapacityResponse) => void,
) {
  for (const [key, data] of snapshots) {
    if (!data) continue
    set(key, {
      ...data,
      people: data.people.map((p) => (p.id === id ? { ...p, ...update } : p)),
    })
  }
}

export function useUpdatePerson() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, weeklyHours }: Vars) => updatePersonHours(id, weeklyHours),

    // Optimistic: show the new capacity immediately, remember the old state to undo.
    onMutate: async ({ id, weeklyHours }: Vars) => {
      await qc.cancelQueries({ queryKey: [CAPACITY_KEY] })
      const snapshots = qc.getQueriesData<CapacityResponse>({ queryKey: [CAPACITY_KEY] })
      patchCachedPerson(snapshots, id, { weeklyHours }, (k, d) => qc.setQueryData(k, d))
      return { snapshots }
    },

    // Failed save: roll every cache back to the snapshot taken before the edit.
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },

    // Reconcile with the server's authoritative value.
    onSuccess: (person) => {
      const snapshots = qc.getQueriesData<CapacityResponse>({ queryKey: [CAPACITY_KEY] })
      patchCachedPerson(
        snapshots,
        person.id,
        { weeklyHours: person.weeklyHours, name: person.name },
        (k, d) => qc.setQueryData(k, d),
      )
    },
  })
}
