# AE Member Enrollment — SAC Custom Widget

A custom widget for SAP Analytics Cloud rendering the Member Enrollment
dashboard: Set Up/Completed counts by Wave, an overall Enrollment Status
breakdown, Defaulted (Before/After PSP), a multiple-attempts count, and a
daily Completed vs. Abandoned timeline. Built the same way as
[AE Snap Report](../sac-ae-snap-report-widget) — a `widget.json` manifest
plus a web-component JS file — applying everything learned building that
one, from the start rather than as later fixes.

**Design doc:** [`../ae-member-enrollment-report/GOLD_VIEW_SPEC.md`](../ae-member-enrollment-report/GOLD_VIEW_SPEC.md)
defines the Gold-layer dataset and the two aggregate cubes this widget
binds to. [`BUILD_PLAN_FOR_AHMED.md`](../ae-member-enrollment-report/BUILD_PLAN_FOR_AHMED.md)
is the build sequence. This widget's data bindings match those cubes
exactly — built against the target shape before the source data exists, so
nothing needs to change on the widget side once it does.

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
  overall Enrollment Status tiles (Set Up / Completed / Abandoned / Not
  Started / Multiple Attempts, each with a progress bar), Defaulted
  Before/After PSP tiles, and a two-series (Completed/Abandoned) daily
  timeline as hand-rolled inline SVG — no external chart library, same
  reasoning as the Employer widget (SAC widget iframes are CSP-strict).
  Falls back to built-in mock data when no data binding is bound, so the
  whole layout is reviewable standalone.
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

- ✅ Widget scaffold, layout, and rendering logic — done, verified locally
  against mock data (see `preview.html`); all tile math independently
  checked against the mock dataset, no console errors, no layout overflow.
- ⏳ Not yet hosted on GitHub Pages or registered in SAC — ask before doing
  either, same as the Employer widget's process.
- ⏳ Blocked on real data — `DS_MEMBER_ENROLLMENT_SUMMARY` and
  `DS_MEMBER_ENROLLMENT_DAILY` don't exist yet; blocked on Yong Yang's Wave
  view first, then Ahmed's build. See `BUILD_PLAN_FOR_AHMED.md`.
- ⏳ Open design question carried over from `GOLD_VIEW_SPEC.md` §7: what
  "Total Not Started By Day" actually means (snapshot vs. cohort trend) —
  not yet decided, so the timeline only plots Completed/Abandoned for now.

## Next steps (once ready)

1. Host `main.js`/`icon.svg` on GitHub Pages — same process as the
   Employer widget, new repo named to match `widget.json`'s hardcoded URLs
   (`bboehm1986.github.io/sac-member-enrollment-widget/...`).
2. Register in SAC (System → Custom Widgets → Add Custom Widget).
3. Once `DS_MEMBER_ENROLLMENT_SUMMARY`/`DS_MEMBER_ENROLLMENT_DAILY` exist,
   build a SAC model on them and bind `enrollmentSummary`/`dailyTrend`.
4. Add a native SAC Input Control for Wave/Status filtering, wired to the
   same model — not built into the widget, per the lesson above.
