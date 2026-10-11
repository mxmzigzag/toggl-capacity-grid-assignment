package main

import (
	"testing"
	"time"
)

func date(s string) time.Time {
	d, err := time.Parse(dateLayout, s)
	if err != nil {
		panic(err)
	}
	return d
}

func TestMondayOf(t *testing.T) {
	cases := map[string]string{
		"2025-12-29": "2025-12-29", // Monday -> itself
		"2025-12-31": "2025-12-29", // Wednesday
		"2026-01-04": "2025-12-29", // Sunday -> previous Monday
		"2026-01-05": "2026-01-05", // next Monday
	}
	for in, want := range cases {
		if got := mondayOf(date(in)).Format(dateLayout); got != want {
			t.Errorf("mondayOf(%s) = %s, want %s", in, got, want)
		}
	}
}

func TestBuildWeeksSnapsToWholeWeeks(t *testing.T) {
	// A Wednesday through the following Monday should cover three whole weeks.
	weeks, index := buildWeeks(date("2025-12-31"), date("2026-01-12"))

	want := []weekRange{
		{Start: "2025-12-29", End: "2026-01-04"},
		{Start: "2026-01-05", End: "2026-01-11"},
		{Start: "2026-01-12", End: "2026-01-18"},
	}
	if len(weeks) != len(want) {
		t.Fatalf("got %d weeks, want %d: %+v", len(weeks), len(want), weeks)
	}
	for i := range want {
		if weeks[i] != want[i] {
			t.Errorf("week[%d] = %+v, want %+v", i, weeks[i], want[i])
		}
	}
	if index["2026-01-05"] != 1 {
		t.Errorf("index lookup wrong: %v", index)
	}
}

func TestBuildWeeksSingleDay(t *testing.T) {
	weeks, _ := buildWeeks(date("2026-01-07"), date("2026-01-07"))
	if len(weeks) != 1 || weeks[0].Start != "2026-01-05" || weeks[0].End != "2026-01-11" {
		t.Fatalf("single-day range should be one week Mon–Sun, got %+v", weeks)
	}
}
