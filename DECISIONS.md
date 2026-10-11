# Decisions

Yours to write, not your AI's. Short is good - bullets are fine, and half a page is
plenty. We read this first.

## What did the spec not tell you?

There are things this brief doesn't specify. Which ones did you hit, what did you decide,
and why?

- **The JSON shape.** I went with `{ weeks: [{start, end}], people: [{ id, name, weeklyHours, cells: [{allocatedHours}] }] }`, where each person's `cells` line up with `weeks` by index. Capacity is just `weeklyHours` on the person, so I didn't repeat it in every cell - the grid decides "over-allocated" itself as `allocatedHours > weeklyHours`. Was thinking about the structure with keys like '{startDate-endDate}' instead of the indexes, but in our situation its controllable and empty rows are avoided and filled with zeros.
- **What a "week" is, and what to do with the date range.** The spec asks to navigate by week and pick a date range, but not how the two fit together. Since the columns are whole weeks and capacity is a per-week number, I treat weeks as Monday–Sunday and snap the picked range out to whole weeks rather than prorating a partial week. Trade-off: the view can show a slightly wider range than you literally typed. The alternative - partial weeks with prorated capacity - is closer to the input but harder to read, and I'd rather the weekly numbers stay clean and it's more like real case - better to see per week than some part of it. Also it could come in handy to also add snapping to date picker. So if user clicks on mid-week day - we show the full week automatically.
- **Capacity is per-person, not per-week.** I guess its obvious that there should not be a possibility for manager to manually change capacity for some person in particular week. Worth additional checking, to be sure.
- **Weekends - the biggest judgment call.** Assignments are continuous ranges that start on Mondays and often run across weekends, and those weekend days are booked at the same load as the weekdays - about 20% of all booked day-hours fall on Sat/Sun. I count **weekdays only**, because capacity (`weekly_hours`, e.g. 40 = 8h × 5 days) is a five-day-week figure; measuring allocation over seven days against a five-day capacity would push almost everyone on a multi-day assignment over 100% purely from calendar spillover. With weekdays only, full-timers land at a clean 100% and over-allocation falls on part-timers booked like full-timers, which is the result that makes sense. It is an assumption though - if the team actually expects weekend work, this is wrong and I'd confirm it.

## What did you notice that looked wrong?

Anything in the output that didn't match what you expected. Whether you fixed it or left
it, we want to know you saw it.

- First run, almost everyone was way over capacity - 300+ of 500 people, some at 8x. Useless as a "who's over-committed" view, so I stopped and dug into the data instead of shipping it. The hours model was wrong (below). After the fix ~39 of 500 are over in the first week, all part-timers booked like full-timers - which tells a story.
- I sanity-checked specific people against the seed (a 20h-week person showing 30h allocated) rather than trusting plausible-looking numbers, and I checked the weekday/weekend split directly before committing to excluding weekends.

## What did the AI get wrong that you caught?

One concrete example. Every real session has one.

- It modeled `hours_per_day` as a *fraction of a working day* and multiplied by 8 - that produced the everyone's-over-capacity grid. I checked the seed and saw each person's `hours_per_day` sums to at most 8.0 on any day, so it's literally booked hours (a full day ≈ 8h). Dropping the ×8 made allocation the plain weekday sum, and the numbers made sense.
- (Smaller: a refactor dropped the code that initializes each person's cells, so the first real API request panicked. Unit tests passed because they don't hit the DB - only running the stack caught it.)
- Also it avoided weekends. I left it be like it because its require some confirmation, but instincts are telling me that whole week should be trackable and ovservable.
- Avoided folder structures (small issue, but better to get it done with some rules and skills from the start). all files are just placed in the *web/src* and *api* folders, which is messy.

## What would you do differently with a week?

- **Make it work at real scale.** The frontend renders every row and the API returns every person in one payload - fine for 500, not for a few thousand × two years. I'd virtualize the rows and paginate the capacity endpoint server-side.
- **Add search and filtering** server-side alongside pagination - by name and by over-allocated / capacity range. A multi-thousand-row grid with no search isn't usable, so it pairs with the scale work.
- **Make the workday length and weekend rule configurable** instead of hardcoding 8h / Mon–Fri - especially given how much the weekend decision moves the numbers.
- **Add an integration test around the capacity query** against a real DB - the part unit tests can't cover, and where the worst bug hid.
