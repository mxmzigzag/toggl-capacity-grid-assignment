import { useRef, useState } from 'react'
import { useCapacity, useUpdatePerson } from './hooks'
import { formatHours, loadLevel, utilization, type Person, type Week } from './capacity'

type Props = {
  from: string
  to: string
}

function weekLabel(start: string): string {
  return new Date(`${start}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function CapacityGrid({ from, to }: Props) {
  const query = useCapacity(from, to)

  if (query.isPending) {
    return <p className="message">Loading capacity…</p>
  }

  if (query.isError) {
    return (
      <div className="message error" role="alert">
        <p>Couldn’t load capacity: {query.error.message}</p>
        <button type="button" onClick={() => query.refetch()}>
          Retry
        </button>
      </div>
    )
  }

  const { weeks, people } = query.data

  return (
    <div
      className="grid-wrap"
      aria-busy={query.isFetching || undefined}
      data-stale={query.isPlaceholderData || undefined}
    >
      <table className="grid">
        <thead>
          <tr>
            <th scope="col" className="col-person">Person</th>
            <th scope="col" className="col-capacity">Weekly capacity</th>
            {weeks.map((w) => (
              <th scope="col" key={w.start} title={`${w.start} – ${w.end}`}>
                {weekLabel(w.start)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <PersonRow key={person.id} person={person} weeks={weeks} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PersonRow({ person, weeks }: { person: Person; weeks: Week[] }) {
  const update = useUpdatePerson()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  // Guards against committing twice (e.g. Enter then blur) or committing after Escape.
  const editingRef = useRef(false)

  const saving = update.isPending && update.variables?.id === person.id

  const startEdit = () => {
    setDraft(String(person.weeklyHours))
    setSaveError(null)
    editingRef.current = true
    setEditing(true)
  }

  const cancel = () => {
    editingRef.current = false
    setEditing(false)
  }

  const commit = () => {
    if (!editingRef.current) return
    editingRef.current = false
    setEditing(false)
    const next = Number(draft)
    if (!Number.isFinite(next) || next < 0 || next === person.weeklyHours) return
    update.mutate(
      { id: person.id, weeklyHours: next },
      {
        onError: (err) => setSaveError(err.message),
        onSuccess: () => setSaveError(null),
      },
    )
  }

  return (
    <tr>
      <th scope="row" className="col-person">{person.name}</th>
      <td className="col-capacity">
        {editing ? (
          <input
            type="number"
            min={0}
            step={1}
            autoFocus
            value={draft}
            aria-label={`Weekly hours for ${person.name}`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
            }}
          />
        ) : (
          <button
            type="button"
            className="capacity-edit"
            aria-label={`Edit weekly hours for ${person.name}`}
            onClick={startEdit}
          >
            {formatHours(person.weeklyHours)}h{saving ? ' …' : ''}
          </button>
        )}
        {saveError && (
          <span className="cell-error" role="alert">
            Couldn’t save — {saveError}
          </span>
        )}
      </td>
      {weeks.map((week, i) => {
        const allocated = person.cells[i]?.allocatedHours ?? 0
        const level = loadLevel(allocated, person.weeklyHours)
        const util = utilization(allocated, person.weeklyHours)
        const pct = util === null ? 'no capacity' : `${Math.round(util * 100)}%`
        return (
          <td
            key={week.start}
            className={`cell load-${level}`}
            title={`${person.name}, week of ${week.start}: ${formatHours(allocated)}h of ${formatHours(person.weeklyHours)}h (${pct})`}
          >
            <span className="alloc">{formatHours(allocated)}</span>
            <span className="cap">/{formatHours(person.weeklyHours)}</span>
          </td>
        )
      })}
    </tr>
  )
}
