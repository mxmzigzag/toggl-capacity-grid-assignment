package main

import (
	"context"
	"net/http"
	"time"
)

// workdayHours is the length of one standard working day. assignments.hours_per_day
// is a fraction of such a day (1.0 = fully booked), so a person's allocated hours for
// a day is hours_per_day * workdayHours. See DECISIONS.md / .notes/worklog.md.
const workdayHours = 8.0

// maxRangeDays guards against unbounded scans. The seed spans ~2 years, so anything
// wider than that is almost certainly a mistake, not a real request.
const maxRangeDays = 731

const dateLayout = "2006-01-02"

type weekRange struct {
	Start string `json:"start"` // Monday, YYYY-MM-DD
	End   string `json:"end"`   // Sunday, YYYY-MM-DD
}

type cell struct {
	AllocatedHours float64 `json:"allocatedHours"`
}

type personCapacity struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	WeeklyHours float64 `json:"weeklyHours"`
	Cells       []cell  `json:"cells"` // aligned to weeks by index
}

type capacityResponse struct {
	Weeks  []weekRange      `json:"weeks"`
	People []personCapacity `json:"people"`
}

// mondayOf returns the Monday of the ISO week containing d.
func mondayOf(d time.Time) time.Time {
	offset := (int(d.Weekday()) + 6) % 7 // Mon->0, ..., Sun->6
	return d.AddDate(0, 0, -offset)
}

// buildWeeks snaps [from, to] out to whole ISO weeks (Mon–Sun) and returns the ordered
// list of weeks together with a lookup from a week's Monday to its index.
func buildWeeks(from, to time.Time) ([]weekRange, map[string]int) {
	start := mondayOf(from)
	lastMonday := mondayOf(to)

	weeks := make([]weekRange, 0)
	index := make(map[string]int)
	for d := start; !d.After(lastMonday); d = d.AddDate(0, 0, 7) {
		key := d.Format(dateLayout)
		index[key] = len(weeks)
		weeks = append(weeks, weekRange{
			Start: key,
			End:   d.AddDate(0, 0, 6).Format(dateLayout),
		})
	}
	return weeks, index
}

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD.
//
// For every person and every (whole) week overlapping the range it returns how many
// hours they are allocated. Capacity is the person's weekly_hours, so the consumer
// derives over-allocation as allocatedHours > weeklyHours.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	fromStr, toStr := q.Get("from"), q.Get("to")
	if fromStr == "" || toStr == "" {
		http.Error(w, "from and to are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	from, err := time.Parse(dateLayout, fromStr)
	if err != nil {
		http.Error(w, "invalid from date, expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	to, err := time.Parse(dateLayout, toStr)
	if err != nil {
		http.Error(w, "invalid to date, expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if to.Before(from) {
		http.Error(w, "to must not be before from", http.StatusBadRequest)
		return
	}

	weeks, weekIndex := buildWeeks(from, to)
	queryStart := mondayOf(from)
	queryEnd := mondayOf(to).AddDate(0, 0, 6) // Sunday of the last week

	if queryEnd.Sub(queryStart).Hours()/24 > maxRangeDays {
		http.Error(w, "range too large (max ~2 years)", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Everyone shows up, even with no assignments in range.
	people, personIndex, err := s.loadPeople(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp := capacityResponse{Weeks: weeks, People: people}

	// Allocated hours per person per week: sum of daily fractions on weekdays (Mon–Fri),
	// scaled to a standard workday. Scoped to the requested week span.
	rows, err := s.db.Query(ctx, `
		SELECT a.person_id,
		       (date_trunc('week', d.day))::date AS week_start,
		       (sum(a.hours_per_day) * $3)::float8 AS allocated_hours
		FROM generate_series($1::date, $2::date, interval '1 day') AS d(day)
		JOIN assignments a ON d.day BETWEEN a.start_date AND a.end_date
		WHERE extract(isodow FROM d.day) < 6
		GROUP BY a.person_id, week_start`,
		queryStart.Format(dateLayout), queryEnd.Format(dateLayout), workdayHours)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var personID int
		var weekStart time.Time
		var allocated float64
		if err := rows.Scan(&personID, &weekStart, &allocated); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		pi, ok := personIndex[personID]
		if !ok {
			continue
		}
		wi, ok := weekIndex[weekStart.Format(dateLayout)]
		if !ok {
			continue
		}
		resp.People[pi].Cells[wi].AllocatedHours = allocated
	}
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// loadPeople returns everyone with zero-filled cells, plus an id->slice-index lookup.
func (s *server) loadPeople(ctx context.Context) ([]personCapacity, map[int]int, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, weekly_hours::float8 FROM people ORDER BY name, id`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var people []personCapacity
	index := make(map[int]int)
	for rows.Next() {
		var p personCapacity
		if err := rows.Scan(&p.ID, &p.Name, &p.WeeklyHours); err != nil {
			return nil, nil, err
		}
		index[p.ID] = len(people)
		people = append(people, p)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	return people, index, nil
}
