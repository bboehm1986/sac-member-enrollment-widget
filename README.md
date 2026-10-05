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
defines the Gold-layer dataset. [`BUILD_PLAN_FOR_BLAIR.md`](../ae-member-enrollment-report/BUILD_PLAN_FOR_BLAIR.md)'s
**"SUPERSEDED — consolidated into ONE aggregate cube"** section has the
current authoritative cube SQL and architecture — **this widget binds to
a single consolidated Analytic Model (`AM_MEMBER_ENROLLMENT_SUMMARY`)
shared with `sac-member-operational-widget`**, not two separate cubes as
originally designed. That redesign happened 2026-09-30 after discovering
a SAC custom widget can only bind to one Analytic Model total, no matter
how many named `dataBindings` its `widget.json` declares.

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
  a single `aggregateData` data binding (22 measures, 8 dimensions — see
  below), one exposed scripting method (`refresh`).
- `main.js` — defines the `<com-porticobenefits-memberenrollment>` custom
  element. Renders: a Set Up/Completed-by-Wave card row (Wave 1/2a/2b/3),
  overall Enrollment Status tiles (Set Up / Completed / **Started, Not
  Completed** — a display relabel of "Abandoned", same underlying data /
  Not Started / Multiple Attempts, each with a progress bar), Defaulted
  panels broken out by Wave 1/Wave 2a (the only two waves with a PSP
  step), and a **Daily Completion Tracker comparing this cycle's daily
  completions against the prior cycle's** (added 2026-09-30) — two bar
  series (this cycle / prior cycle, completions only, aligned by day-of-
  cycle rather than literal date since the two cycles are a calendar year
  apart) plus two cumulative lines (solid this-cycle, dashed prior-cycle)
  on an independent right-axis scale. Hand-rolled inline SVG throughout —
  no external chart library, same reasoning as the Employer widget (SAC
  widget iframes are CSP-strict). Falls back to built-in mock data when no
  data binding is bound, so the whole layout is reviewable standalone.
- `icon.svg` — icon shown in the SAC widget panel.
- `preview.html` — standalone local test harness; drives the widget through
  the real `onCustomWidgetBeforeUpdate`/`onCustomWidgetAfterUpdate`
  lifecycle hooks, same pattern as the Employer widget's harness.

## Data bindings — what it expects

**One binding, `aggregateData`**, shared with `sac-member-operational-
widget` — both bind to the same `AM_MEMBER_ENROLLMENT_SUMMARY` model,
each filtering client-side by a `RowKind` discriminator dimension. This
widget only reads two row-kinds (`StatusByWave` and `DailyTrend`); the
other two (`ElectionSummary`, `WaiverTrend`) exist on the same model for
Operational's use. See `main.js`'s own header comment for the exact
dimension/measure order (SAC binds by position, not name — order matters
when binding in the SAC Builder panel: Measures before Dimensions, then
each list in the documented order).

Never Gold-layer member-level rows directly (Gold is one row per Member —
this widget only ever sees counts). See `BUILD_PLAN_FOR_BLAIR.md`'s
"SUPERSEDED — consolidated into ONE aggregate cube" section for the full
cube SQL and design.

## Status of this build

- ✅ Hosted on GitHub Pages, registered in SAC, bound and **confirmed
  working against real data** (2026-09-30).
- ✅ "Abandoned" displays as "Started, Not Completed" everywhere in this
  widget — pure display relabel, same underlying `Enrollment_Status`
  value.
- ✅ **Daily Completion Tracker redesigned 2026-09-30** into a this-cycle-
  vs-prior-cycle comparison (see Files above) — Started-Not-Completed/
  Abandoned bars were dropped from this chart entirely, completions only.
- ✅ Timeline's x-axis is fixed to the known enrollment window (Oct 19 –
  Dec 2, both cycles aligned by day-of-cycle), not auto-scaled to whatever
  dates happen to have data — otherwise sparse/unrealistic test dates make
  the chart misleading and the axis silently rescales as real data lands.
- ⏳ Open design question carried over from `GOLD_VIEW_SPEC.md` §7: what
  "Total Not Started By Day" actually means (snapshot vs. cohort trend) —
  not yet decided, not currently plotted.
- ⏳ Pacing badge (Employer-style success/warning/danger indicator against
  an expected-progress curve) was researched as a possible Snap-report
  addition but **not built** — Member Enrollment's four Waves have
  different window lengths and only two have a PSP step, so it needs its
  own expected curve design, not a straight port of the Employer widget's
  single-window curve. Not requested explicitly; revisit if wanted.

## Next steps

1. ✅ Done (2026-10-03): native SAC Input Controls for Wave (priority) and
   Enrollment_Status exist on this page, wired to the same model — not
   built into the widget, per the lesson above. They are safe here because
   the cube carries a real value for those dimensions in every row-kind
   (see `BUILD_PLAN_FOR_BLAIR.md`'s cube design rule). Never add an
   `EventDate` control — the YoY timeline/waiver panels need both cycles.
2. Once BR-29 (see `BUILD_PLAN_FOR_BLAIR.md`) is confirmed fixed and the
   `vDimMember` join is restored in Gold, `TotalEligibleLives`/
   `TotalCoveredLives` will start populating for real — no widget change
   needed, they're already wired up as placeholders.
