# AE Member Enrollment — SAC Custom Widget ("Snap" report)

A custom widget for SAP Analytics Cloud rendering the Member Enrollment
**executive/leadership "Snap" dashboard**: Set Up/Completed counts by
Wave, a headline Enrollment Status breakdown, Defaulted broken out by
Wave 1/Wave 2a, a multiple-attempts count, and a combined bar+cumulative-
line daily timeline. This is one of a **3-widget suite** (see
`GOLD_VIEW_SPEC.md` §10l) mirroring the Employer Election suite's
structure — this widget plays the same role as
[AE Snap Report](../sac-ae-snap-report-widget) does there. The fuller
Enrollment-Status-per-Wave breakdown, election-detail metrics (HSA/FSA/
Supp Life/Retirement/Vision), and the waiver-trend-by-membership-type
metric live on the sibling `sac-member-operational-widget` instead;
per-member row detail lives on `sac-member-detail-widget`.

**Design doc:** [`../ae-member-enrollment-report/GOLD_VIEW_SPEC.md`](../ae-member-enrollment-report/GOLD_VIEW_SPEC.md)
defines the Gold-layer dataset and the aggregate cubes this suite binds
to. [`BUILD_PLAN_FOR_AHMED.md`](../ae-member-enrollment-report/BUILD_PLAN_FOR_AHMED.md)
is the build sequence, including the drafted Gold SQL (the `AE_EventRqsts`
Wave/Defaulted join, the `vDimMember` Membership_Type join, all three new
cubes). This widget's data bindings match `DS_MEMBER_ENROLLMENT_SUMMARY`/
`DS_MEMBER_ENROLLMENT_DAILY`'s shape exactly — built against the target
shape before the source data reliably flows, so nothing needs to change on
the widget side once it does.

## Two lessons carried over from the start, not discovered the hard way again

The Employer Selections widget went through a real debugging cycle to learn
that SAC's Optimized-story **View mode doesn't deliver internal click/change
events** to a custom widget's shadow DOM. This widget applies that lesson
from day one:
- **No in-widget filter controls.** Filtering belongs in a native SAC Input
  Control, wired to the underlying data source — see the Employer widget's
  README for the full reasoning.
- **No theme toggle, light theme only.** Same reason — a manual toggle
  can't work in View mode, so it was never added rather than added and
  removed.

## Files

- `widget.json` — manifest: properties (`width`, `height`, `asOfLabel`),
  two data bindings (`enrollmentSummary`, `dailyTrend`), one exposed
  scripting method (`refresh`).
- `main.js` — defines the `<com-porticobenefits-memberenrollment>` custom
  element. Renders: a Set Up/Completed-by-Wave card row (Wave 1/2a/2b/3),
  overall Enrollment Status tiles (Set Up / Completed / **Started, Not
  Completed** — a display relabel of "Abandoned", same underlying data /
  Not Started / Multiple Attempts, each with a progress bar), Defaulted
  panels broken out by Wave 1/Wave 2a (the only two waves with a PSP
  step), and a combined bar+cumulative-line daily timeline — two bar
  series (Completed/Started-Not-Completed) plus a cumulative-Completed
  line on an independent right-axis scale, matching the Employer suite's
  combo-chart convention (`sac-ae-operational-widget`'s "Daily Completion
  Tracker"). Hand-rolled inline SVG throughout — no external chart
  library, same reasoning as the Employer widget (SAC widget iframes are
  CSP-strict). Falls back to built-in mock data when no data binding is
  bound, so the whole layout is reviewable standalone.
- `icon.svg` — icon shown in the SAC widget panel.
- `preview.html` — standalone local test harness; drives the widget through
  the real `onCustomWidgetBeforeUpdate`/`onCustomWidgetAfterUpdate`
  lifecycle hooks, same pattern as the Employer widget's harness.

## Data bindings — what they expect

Both are pre-aggregated cubes, never Gold-layer member-level rows (Gold is
one row per Member, individual-level data — this widget only ever sees
counts). See `GOLD_VIEW_SPEC.md` §7 for the full cube design.

- **`enrollmentSummary`** ← `DS_MEMBER_ENROLLMENT_SUMMARY` — one row per
  (Wave, Enrollment Status, Defaulted, Defaulted Timing); measures Member
  Count and Multiple-Attempts Member Count.
- **`dailyTrend`** ← `DS_MEMBER_ENROLLMENT_DAILY` — one row per (Date,
  Wave, Enrollment Status); measure Member Count.

## Status of this build

- ✅ Hosted on GitHub Pages and registered in SAC (shows a "Live" badge).
  Tiles currently read against whatever `DS_MEMBER_ENROLLMENT_SUMMARY`/
  `DAILY` return today — the drafted Gold rebuild in
  `BUILD_PLAN_FOR_AHMED.md` (the `AE_EventRqsts` Wave/Defaulted join, the
  `vDimMember` Membership_Type join, current-cycle `EventDate` scoping)
  has **not been deployed yet**, so real Wave/Defaulted values won't show
  until that happens.
- ✅ **2026-09-22 widget refresh, verified in `preview.html` (no console
  errors, correct chart/tile math against mock data):** the "As of"
  timestamp now computes from the viewer's clock instead of trusting the
  (unreliable) bound `asOfLabel` property; "Abandoned" displays as
  "Started, Not Completed"; Defaulted is broken out into Wave 1/Wave 2a
  panels instead of one combined Before/After PSP pair; the timeline is
  now the Employer-style combined bar+cumulative-line chart with
  independent scales, replacing the old plain two-series bar chart.
- ⏳ Scope expanded 2026-09-21/22 into a 3-widget suite (see the top of
  this doc and `GOLD_VIEW_SPEC.md` §10l) — the election-detail metrics,
  waiver trend, and full per-wave status breakdown that were originally
  going to live here instead belong on the sibling
  `sac-member-operational-widget`. Nothing more to add to *this* widget
  from that requirements list.
- ⏳ Open design question carried over from `GOLD_VIEW_SPEC.md` §7: what
  "Total Not Started By Day" actually means (snapshot vs. cohort trend) —
  not yet decided, so the timeline only plots Completed/Started-Not-
  Completed for now (inferring Not Started separately, per §7).
- ⏳ Pacing badge (Employer-style success/warning/danger indicator against
  an expected-progress curve) was researched as a possible Snap-report
  addition but **not built** — Member Enrollment's four Waves have
  different window lengths and only two have a PSP step, so it needs its
  own expected curve design, not a straight port of the Employer widget's
  single-window curve. Not requested explicitly; revisit if wanted.

## Next steps

1. Deploy the drafted Gold SQL (`BUILD_PLAN_FOR_AHMED.md`) so
   `DS_MEMBER_ENROLLMENT_SUMMARY`/`DAILY` actually carry real Wave/
   Defaulted/Defaulted_Timing values.
2. Confirm the widget's tile math against real (not mock) data once that
   lands.
3. Add a native SAC Input Control for Wave/Status filtering, wired to the
   same model — not built into the widget, per the lesson above.
