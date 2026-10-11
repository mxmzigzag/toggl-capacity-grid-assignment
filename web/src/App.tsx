import { useState } from 'react'
import { CapacityGrid } from './CapacityGrid'

const DEFAULT_FROM = '2025-12-29'
const DEFAULT_TO = '2026-01-25'

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function App() {
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(DEFAULT_TO)

  const stepWeeks = (weeks: number) => {
    setFrom((f) => shiftDays(f, weeks * 7))
    setTo((t) => shiftDays(t, weeks * 7))
  }

  const invalidRange = to < from

  return (
    <main>
      <h1>Team capacity</h1>

      <div className="controls">
        <div className="nav">
          <button type="button" onClick={() => stepWeeks(-1)} aria-label="Previous week">
            ← Previous
          </button>
          <button type="button" onClick={() => stepWeeks(1)} aria-label="Next week">
            Next →
          </button>
        </div>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {invalidRange ? (
        <p className="message error">“To” is before “From” — pick a later end date.</p>
      ) : (
        <CapacityGrid from={from} to={to} />
      )}
    </main>
  )
}
