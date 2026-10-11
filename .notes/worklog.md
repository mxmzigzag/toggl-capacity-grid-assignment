# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- API shape: `GET /api/capacity` returns `{ weeks:[{start,end}], people:[{id,name,weeklyHours,cells:[{allocatedHours}]}] }`, cells aligned to weeks by index. Capacity = weeklyHours (constant per row), so over-allocation is `allocatedHours > weeklyHours` and the client derives it — no need to repeat capacity per cell.

- Weeks are ISO Mon–Sun. The requested range is snapped out to whole weeks (date_trunc('week') → Monday). Partial weeks at the edges would complicate "weekly capacity"; snapping keeps capacity a clean per-week number. Assumption worth revisiting.

- Allocation query: generate_series of days in range, keep Mon–Fri, join assignments on `day BETWEEN start AND end`, sum hours_per_day grouped by person + week. Scoped to the range and index-friendly; day-granularity keeps the week-boundary and weekday logic in SQL rather than Go.

- Weekends excluded from allocation (isodow < 6). Assignment ranges include weekends, but hours land on weekdays. Not spelled out in the brief — assumption.

- DEAD END / AI got it wrong: first modelled hours_per_day as a *fraction of a workday* and multiplied by 8. Running it showed everyone 2–8× over capacity. The seed disproved it — each person's daily hours_per_day sums to at most 8.0, so it's literal booked hours (full day ≈ 8h). Dropped the ×8; allocated/week is the plain weekday sum. Over-allocation now lands on part-timers booked like full-timers.

- Edit flow: optimistic. PATCH only changes weekly_hours (capacity); allocation is independent, so the edited row recolours from cache with no refetch. On failure the cache rolls back to the pre-edit snapshot and an inline error shows on the row; on success it reconciles with the server's returned value. Chose this over refetch (snappier, no flash) and over blind patch-in-place (keeps the server authoritative).

- Verified live: query numbers spot-checked against the seed; grid renders over-allocation in red; a successful edit persists (confirmed in psql) and recomputes live; an invalid edit (>168) is rejected, rolls back, and surfaces the server message.

- Deferred for scale (seed is small, prod is thousands × 2 years): pagination/virtualisation of rows, capping/validating the requested span (a 2-year guard exists), and a materialised or pre-aggregated weekly rollup instead of per-day generate_series.
