/*
    AE Member Enrollment — SAC Custom Widget

    This is the "Snap" (executive/leadership) widget of a 3-widget suite —
    see GOLD_VIEW_SPEC.md §10l — mirroring sac-ae-snap-report-widget's role
    on the Employer side. The fuller Enrollment-Status-per-Wave breakdown,
    election-detail metrics, and waiver trend live on the sibling
    sac-member-operational-widget instead; per-member row detail lives on
    sac-member-detail-widget. This widget renders: Wave-level Set Up/
    Completed counts, a headline Enrollment Status breakdown ("Abandoned"
    displayed as "Started, Not Completed" — a pure display relabel, same
    underlying data), Defaulted broken out by Wave 1/Wave 2a (the only two
    waves with a PSP step), a multiple-attempts count, and a combined
    bar+cumulative-line daily timeline (Employer-suite style — independent
    scales for the bars vs. the cumulative line, a shared scale would
    flatten the bars). See ../ae-member-enrollment-report/GOLD_VIEW_SPEC.md
    for the full design (field definitions, business rules, reference
    calendar) and ../ae-member-enrollment-report/BUILD_PLAN_FOR_BLAIR.md
    for how the two data bindings below get built.

    ONE PRE-AGGREGATED data binding (declared in widget.json) — never
    Gold-layer member-level rows directly (Gold is one row per Member,
    individual-level data — this widget only ever sees counts).

    REDESIGNED 2026-09-30: a single SAC custom widget can only bind to one
    Analytic Model total, even if widget.json declares multiple named
    dataBindings (confirmed via the Employer Election project — a widget's
    bindings can't each point at a different model). The original 2-binding
    design (enrollmentSummary -> AM_MEMBER_ENROLLMENT_SUMMARY, dailyTrend ->
    AM_MEMBER_ENROLLMENT_DAILY, two different models) could never have
    worked — it just hadn't been caught yet since dailyTrend went untested
    for a while. Fixed the same way as the sibling sac-member-operational-
    widget: DS_MEMBER_ENROLLMENT_SUMMARY is now a UNION ALL of 4 "row-kinds"
    (mirroring the Employer suite's own multiplexed-cube pattern), each
    populating only the dimensions/measures relevant to it and leaving the
    rest NULL, plus a RowKind discriminator column. This widget reads the
    same one Analytic Model (AM_MEMBER_ENROLLMENT_SUMMARY) as Operational
    does, via a single "aggregateData" binding, filtering by RowKind — it
    just only cares about the StatusByWave and DailyTrend row-kinds.

    SAC's standard ResultSet row shape ({ data: [ { dimensions_0: {id,
    label}, ..., measures_0: {raw,formatted}, ... } ] }) — dimensions and
    measures MUST be added in the Builder panel in this exact order (SAC
    binds by position, not by name), same as sac-member-operational-widget:

      Dimensions (9): RowKind, EventDate, Wave, Enrollment_Status,
                       Defaulted, Defaulted_Timing, ActivityDate,
                       Membership_Type, Is_Portico_Employee
      Measures (22):  MemberCount, MultipleAttemptsMemberCount,
                       TotalEligibleLives, TotalCoveredLives, WaivedCount,
                       HSA_Count, HSA_Avg_Amount, FSA_Health_Count,
                       FSA_Health_Avg_Amount, FSA_Dependent_Count,
                       FSA_Dependent_Avg_Amount, SuppLife_Member_Count,
                       SuppLife_Member_Avg_Amount, SuppLife_Spouse_Count,
                       SuppLife_Spouse_Avg_Amount, SuppLife_Dependent_Count,
                       SuppLife_Dependent_Avg_Amount, Retirement_Pretax_Count,
                       Retirement_Pretax_Avg_Amount, Retirement_Roth_Count,
                       Retirement_Roth_Avg_Amount, Vision_Election_Count

    This widget only reads two row-kinds:
      - 'StatusByWave' -> Wave (dimensions_2), Enrollment_Status
                           (dimensions_3), Defaulted_Timing (dimensions_5) /
                           MemberCount (measures_0), MultipleAttemptsMember-
                           Count (measures_1)
      - 'DailyTrend'   -> EventDate (dimensions_1, identifies which cycle --
                           2027-01-01 = this cycle, 2026-01-01 = prior),
                           Wave (dimensions_2), ActivityDate (dimensions_6,
                           = Completed_Date; Abandoned is excluded from this
                           row-kind per Blair, 2026-09-30 -- Timeline shows
                           completions only) / MemberCount (measures_0)

    ADDED 2026-10-01 (per Blair): Is_Portico_Employee (dimensions_8) --
    Portico's own employees are EXCLUDED from this widget's numbers
    entirely, via a check built into _rowsOfKind() so every row-kind read
    by this widget gets it automatically. The mirror widget showing ONLY
    Portico employees is sac-member-enrollment-portico-widget -- same
    model, same code shape, opposite filter.

    REDESIGNED 2026-09-30 (per Blair): the Timeline chart now compares this
    cycle's daily completions against the prior cycle's, aligned by DAY-OF-
    CYCLE rather than literal date, since the two cycles' real activity
    windows are a full calendar year apart. See CYCLE_START/PRIOR_CYCLE_
    START and _parseDailyTrend below.

    No in-widget filter controls, no theme toggle, light theme only — by
    design from the start this time, not a lesson learned the hard way:
    SAC's Optimized-story View mode doesn't deliver internal click/change
    events to a custom widget's shadow DOM (confirmed on the Employer
    Selections widget). Filtering belongs in a native SAC Input Control.

    Until the binding above is wired to real Datasphere-backed data, the
    widget renders from the MOCK_* constants below so the layout can be
    built and reviewed standalone (see preview.html).
*/
(function () {
    "use strict";

    const WAVES = ["Wave 1", "Wave 2a", "Wave 2b", "Wave 3"];
    const STATUSES = ["Success", "Abandoned", "Not Started", "In Progress", "Needs Follow-up"];

    // Fixed Timeline window, per Blair (2026-09-30) — mirrors the Employer
    // suite's own timeline, which fixes its x-axis to the known enrollment
    // window rather than auto-scaling to whatever dates happen to have
    // data. Covers all 4 waves combined (10/19 - 12/2). Also used to align
    // the current cycle against the prior cycle (one calendar year earlier)
    // for a day-of-cycle comparison — see _parseDailyTrend. TODO: reconfirm
    // these dates each cycle — same annual-maintenance pattern as the
    // EventDate literals used elsewhere in this build.
    const CYCLE_START = new Date(2026, 9, 19);  // Oct 19, 2026 (this cycle)
    const CYCLE_END = new Date(2026, 11, 2);    // Dec 2, 2026
    const PRIOR_CYCLE_START = new Date(2025, 9, 19); // Oct 19, 2025 (prior cycle, same day-of-cycle alignment)
    const CYCLE_LENGTH_DAYS = Math.round((CYCLE_END - CYCLE_START) / 86400000) + 1;

    // Parses either an ISO "YYYY-MM-DD" string (mock data) or a locale date
    // label like "Aug 31, 2026" (real SAC dimension labels) into a Date at
    // LOCAL midnight consistently — avoids the classic bug where
    // `new Date("2026-10-19")` parses as UTC midnight while
    // `new Date("Aug 31, 2026")` parses as local midnight, which can shift
    // ISO-parsed dates back a day depending on the viewer's timezone.
    function parseDateFlexible(str) {
        const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
        if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
        return new Date(str);
    }
    function dayKey(d) {
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    // ---- Mock data (mirrors the real SAC ResultSet row shape) ----
    // Dimension order (9): RowKind, EventDate, Wave, Enrollment_Status,
    //                       Defaulted, Defaulted_Timing, ActivityDate,
    //                       Membership_Type, Is_Portico_Employee
    // Measure order (22): MemberCount, MultipleAttemptsMemberCount, ...
    // (full list in the file header) -- this widget only ever populates
    // measures_0/measures_1, the rest stay null.
    function row(dims, measures) {
        const out = {};
        dims.forEach((d, i) => { out["dimensions_" + i] = { id: d, label: d }; });
        measures.forEach((m, i) => { out["measures_" + i] = { raw: m, formatted: m == null ? "" : String(m) }; });
        return out;
    }
    const NULL_20 = new Array(20).fill(null);
    // isPortico defaults to "No" -- this widget's own mock population is
    // the general (non-Portico) member base it's meant to show.
    function rowStatusByWave(wave, status, defaulted, defaultedTiming, count, multi, isPortico) {
        return row(
            ["StatusByWave", null, wave, status, defaulted, defaultedTiming, null, null, isPortico || "No"],
            [count, multi].concat(NULL_20)
        );
    }
    // DailyTrend is Success-only now (Abandoned dropped from this row-kind,
    // see file header) and spans both cycles -- eventDate identifies which
    // cycle ("2027-01-01" = this cycle, "2026-01-01" = prior cycle).
    function rowDailyTrend(eventDate, wave, activityDate, count, isPortico) {
        return row(
            ["DailyTrend", eventDate, wave, "Success", null, null, activityDate, null, isPortico || "No"],
            [count].concat(new Array(21).fill(null))
        );
    }

    const MOCK_AGGREGATE_DATA = { data: [
        // Wave 1 (all sponsored) — PSP applies
        rowStatusByWave("Wave 1", "Success", "No", "N/A", 610, 140),
        rowStatusByWave("Wave 1", "Abandoned", "No", "N/A", 35, 28),
        rowStatusByWave("Wave 1", "In Progress", "No", "N/A", 8, 3),
        rowStatusByWave("Wave 1", "Not Started", "Yes", "Before PSP", 25, 0),
        rowStatusByWave("Wave 1", "Not Started", "Yes", "After PSP", 12, 0),
        rowStatusByWave("Wave 1", "Needs Follow-up", "No", "N/A", 15, 6),
        // Wave 2a (sponsored, excludes Medicare) — PSP applies
        rowStatusByWave("Wave 2a", "Success", "No", "N/A", 340, 55),
        rowStatusByWave("Wave 2a", "Abandoned", "No", "N/A", 18, 12),
        rowStatusByWave("Wave 2a", "In Progress", "No", "N/A", 5, 1),
        rowStatusByWave("Wave 2a", "Not Started", "Yes", "Before PSP", 14, 0),
        rowStatusByWave("Wave 2a", "Not Started", "Yes", "After PSP", 6, 0),
        rowStatusByWave("Wave 2a", "Needs Follow-up", "No", "N/A", 9, 4),
        // Wave 2b (non-sponsored) — no PSP
        rowStatusByWave("Wave 2b", "Success", "No", "N/A", 480, 60),
        rowStatusByWave("Wave 2b", "Abandoned", "No", "N/A", 22, 15),
        rowStatusByWave("Wave 2b", "In Progress", "No", "N/A", 11, 2),
        rowStatusByWave("Wave 2b", "Not Started", "Yes", "N/A", 31, 0),
        rowStatusByWave("Wave 2b", "Needs Follow-up", "No", "N/A", 13, 5),
        // Wave 3 (small population, if needed) — no PSP
        rowStatusByWave("Wave 3", "Success", "No", "N/A", 42, 6),
        rowStatusByWave("Wave 3", "Abandoned", "No", "N/A", 2, 1),
        rowStatusByWave("Wave 3", "Not Started", "Yes", "N/A", 5, 0),

        // This cycle (EventDate 2027-01-01)
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-19", 12),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-20", 25),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-21", 30),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-22", 40),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-23", 22),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-26", 55),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-27", 48),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-28", 35),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-29", 60),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-10-30", 70),
        rowDailyTrend("2027-01-01", "Wave 1", "2026-11-02", 90),
        rowDailyTrend("2027-01-01", "Wave 2a", "2026-11-09", 33),
        rowDailyTrend("2027-01-01", "Wave 2a", "2026-11-10", 45),
        rowDailyTrend("2027-01-01", "Wave 2a", "2026-11-16", 60),
        rowDailyTrend("2027-01-01", "Wave 2a", "2026-11-17", 75),
        // Prior cycle (EventDate 2026-01-01) -- same day-of-cycle offsets,
        // one calendar year earlier, illustrative mock ratios only (roughly
        // 70-85% of this cycle's pace, not derived from any real trend).
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-19", 9),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-20", 18),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-21", 22),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-22", 30),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-23", 16),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-26", 40),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-27", 35),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-28", 26),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-29", 45),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-10-30", 50),
        rowDailyTrend("2026-01-01", "Wave 1", "2025-11-02", 65),
        rowDailyTrend("2026-01-01", "Wave 2a", "2025-11-09", 24),
        rowDailyTrend("2026-01-01", "Wave 2a", "2025-11-10", 32),
        rowDailyTrend("2026-01-01", "Wave 2a", "2025-11-16", 42),
        rowDailyTrend("2026-01-01", "Wave 2a", "2025-11-17", 55),
    ] };

    // ---- Template ----
    const template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host {
                display: block;
                box-sizing: border-box;
                font-family: "72", "Segoe UI", Arial, sans-serif;

                /* Light mode only, by design — see file header.

                   Glassmorphism/depth system — matches sac-ae-snap-report-
                   widget exactly, so the two dashboards read as one family.
                   Frosted, semi-transparent surfaces over a soft
                   gradient-mesh background, layered shadows for elevation.
                   See @supports below for the non-blur fallback. */
                --mesh-1: rgba(106, 92, 240, 0.16);
                --mesh-2: rgba(47, 111, 224, 0.12);
                --mesh-3: rgba(20, 151, 111, 0.10);
                --surface: rgba(255, 255, 255, 0.58);
                --surface-2: rgba(23, 26, 35, 0.055);
                --border: rgba(255, 255, 255, 0.65);
                --text: #171a23;
                --text-soft: #5b6072;
                --accent: #6a5cf0;
                --accent-bg: rgba(106, 92, 240, 0.14);
                --success: #14976f;
                --success-bg: rgba(20, 151, 111, 0.14);
                --warning: #a5700c;
                --warning-bg: rgba(165, 112, 12, 0.14);
                --info: #2f6fe0;
                --info-bg: rgba(47, 111, 224, 0.14);
                --danger: #c94b4b;
                --danger-bg: rgba(201, 75, 75, 0.14);
                --glass-blur: blur(20px) saturate(180%);
                --shadow-card: 0 1px 1px rgba(23,26,35,0.03), 0 4px 12px -2px rgba(23,26,35,0.07), 0 14px 28px -10px rgba(23,26,35,0.10);
            }
            * { box-sizing: border-box; }

            .dashboard {
                width: 100%;
                height: 100%;
                overflow: auto;
                background:
                    radial-gradient(at 12% 8%, var(--mesh-1) 0%, transparent 45%),
                    radial-gradient(at 88% 14%, var(--mesh-2) 0%, transparent 45%),
                    radial-gradient(at 50% 100%, var(--mesh-3) 0%, transparent 50%),
                    #f4f5fa;
                color: var(--text);
                border-radius: 18px;
                padding: 18px;
            }

            .tile, .panel, .wave-card, .badge {
                backdrop-filter: var(--glass-blur);
                -webkit-backdrop-filter: var(--glass-blur);
            }
            @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
                .tile, .panel, .wave-card { background: rgba(255,255,255,0.94) !important; }
            }

            .topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
            .eyebrow { font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-soft); margin-bottom: 4px; }
            .topbar h1 { font-size: 19px; font-weight: 700; margin: 0; display: inline; }
            .titlewrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .badge { font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 100px; border: 1px solid; white-space: nowrap; }
            .badge.accent { color: var(--accent); border-color: rgba(106,92,240,0.35); background: var(--accent-bg); }
            .badge.warning { color: var(--warning); border-color: rgba(165,112,12,0.35); background: var(--warning-bg); }
            .asof { font-size: 11px; color: var(--text-soft); margin-top: 2px; }

            .section-title { font-size: 11.5px; font-weight: 700; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em; margin: 22px 0 8px; }

            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
            .tile { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--shadow-card); }
            .tile .label { font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-soft); }
            .tile .value { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text); }
            .tile .sub { font-size: 11px; color: var(--text-soft); margin-top: -4px; }
            .tile .bar-track { height: 5px; border-radius: 4px; background: var(--surface-2); box-shadow: inset 0 1px 2px rgba(23,26,35,0.10); overflow: hidden; margin-top: 2px; }
            .tile .bar-fill { height: 100%; border-radius: 4px; }
            .tile.accent .value { color: var(--accent); } .tile.accent .bar-fill { background: var(--accent); }
            .tile.success .value { color: var(--success); } .tile.success .bar-fill { background: var(--success); }
            .tile.warning .value { color: var(--warning); } .tile.warning .bar-fill { background: var(--warning); }
            .tile.info .value { color: var(--info); } .tile.info .bar-fill { background: var(--info); }
            .tile.danger .value { color: var(--danger); } .tile.danger .bar-fill { background: var(--danger); }

            .wave-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
            .wave-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow-card); }
            .wave-card .wave-name { font-size: 12.5px; font-weight: 700; color: var(--text); }
            .wave-card .wave-window { font-size: 10.5px; color: var(--text-soft); margin-bottom: 8px; }
            .wave-card .wave-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
            .wave-card .wave-row .n { font-weight: 600; font-variant-numeric: tabular-nums; }
            .wave-card .wave-pct { font-size: 11px; color: var(--text-soft); }

            .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px; box-shadow: var(--shadow-card); }
            .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
            .panel-caption { font-size: 12px; color: var(--text-soft); margin: -6px 0 8px; }

            /* Combo timeline — matches sac-ae-operational-widget's "Daily
               Completion Tracker" convention: header + stat row + legend +
               chart, bars and cumulative line on independent scales (a
               shared scale would flatten the bars). */
            .cum-tracker-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
            .cum-tracker-title { font-size: 13px; font-weight: 700; color: var(--text); }
            .cum-tracker-row { display: flex; gap: 22px; margin-bottom: 12px; flex-wrap: wrap; }
            .cum-stat-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text); }
            .cum-stat-label { font-size: 10.5px; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.04em; }
            .badge.success { color: var(--success); border-color: rgba(20,151,111,.35); background: var(--success-bg); }
            .badge.lg { font-size: 12px; font-weight: 700; padding: 5px 14px; }

            .chart-legend { display: flex; gap: 16px; margin-bottom: 10px; font-size: 11px; color: var(--text-soft); flex-wrap: wrap; }
            .chart-legend-item { display: flex; align-items: center; gap: 6px; }
            .chart-legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
            .chart-legend-swatch.line { width: 14px; height: 2px; border-radius: 1px; }
            .chart-legend-swatch.dashed-line { width: 14px; height: 2px; border-radius: 0; background: repeating-linear-gradient(to right, var(--info) 0 4px, transparent 4px 7px); }
            .chart-wrap { margin-top: 2px; }
            .chart-svg { width: 100%; height: 170px; display: block; }
            .chart-axis-label { font-size: 9px; fill: var(--text-soft); }
            .chart-grid-line { stroke: rgba(23,26,35,0.08); stroke-width: 1; }
            .chart-bar-label { font-size: 8.5px; fill: var(--text-soft); }
            .chart-bar.completed { fill: var(--success); }
            .chart-bar.abandoned { fill: var(--danger); }
            .chart-bar.prior-completed { fill: var(--info); opacity: 0.7; }

        </style>
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <div class="eyebrow">2026 Annual Enrollment</div>
                    <div class="titlewrap">
                        <h1>Member Enrollment</h1>
                        <span class="badge accent" id="dataBadge">Mock Data — Preview</span>
                    </div>
                    <div class="asof" id="asof"></div>
                </div>
            </div>

            <div class="section-title">Set Up &amp; Completed by Wave</div>
            <div class="wave-grid" id="waveGrid"></div>

            <div class="section-title">Enrollment Status (all waves)</div>
            <div class="grid" id="statusTiles"></div>

            <div class="section-title">Defaulted — by Wave</div>
            <div class="panels" id="defaultedPanels"></div>

            <div class="section-title">Timeline</div>
            <div class="panel" id="timelinePanel"></div>
        </div>
    `;

    class MemberEnrollment extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(template.content.cloneNode(true));

            this._props = { width: 900, height: 650, asOfLabel: "Live" };
            this._aggregateData = MOCK_AGGREGATE_DATA;
            this._usingMockData = true;
        }

        connectedCallback() {
            this._render();
        }

        onCustomWidgetBeforeUpdate(changedProperties) {
            this._props = Object.assign({}, this._props, changedProperties);
        }

        onCustomWidgetAfterUpdate(changedProperties) {
            if ("width" in changedProperties) this.style.width = changedProperties.width + "px";
            if ("height" in changedProperties) this.style.height = changedProperties.height + "px";
            if ("aggregateData" in changedProperties) { this._aggregateData = changedProperties.aggregateData; this._usingMockData = false; }
            this._render();
        }

        onCustomWidgetDestroy() {
            // No timers/subscriptions held; nothing to tear down.
        }

        // Exposed scripting API method (see "methods" in widget.json)
        refresh() {
            this._render();
        }

        // ---- Parsing helpers ----
        // Dimension/measure indices below match the ONE consolidated
        // model's fixed column order documented in the file header --
        // RowKind is always dimensions_0.
        _dim(r, i) {
            const d = r["dimensions_" + i];
            return d ? d.label : "";
        }
        _measure(r, i) {
            const m = r["measures_" + i];
            return m && m.raw != null ? Number(m.raw) : 0;
        }
        // Excludes Portico's own employees (Is_Portico_Employee,
        // dimensions_8) from every row-kind this widget reads -- added
        // 2026-10-01 per Blair. Centralized here so no caller can forget it.
        _rowsOfKind(kind) {
            const rows = (this._aggregateData && this._aggregateData.data) || [];
            // Also excludes FLEX members (Wave "Group A".."Group F", added
            // 2026-10-05): they share this model but belong to the FLEX
            // dashboard (sac-flex-member-widget). Blank-Wave rows are kept.
            return rows.filter((r) => this._dim(r, 0) === kind && this._dim(r, 8) !== "Yes" && !/^Group /.test(this._dim(r, 2)));
        }

        _parseSummary() {
            const rows = this._rowsOfKind("StatusByWave");
            const byWave = {};
            WAVES.forEach((w) => { byWave[w] = { setUp: 0, completed: 0 }; });
            const byStatus = {};
            STATUSES.forEach((s) => { byStatus[s] = 0; });
            // Only Wave 1 / Wave 2a ever have a PSP step (see GOLD_VIEW_SPEC.md
            // §5) — Defaulted_Timing is only ever "Before PSP"/"After PSP" for
            // these two waves, "N/A" for 2b/3.
            const defaultedByWave = { "Wave 1": { before: 0, after: 0 }, "Wave 2a": { before: 0, after: 0 } };
            let totalSetUp = 0, multipleAttempts = 0;
            let defaultedBeforePsp = 0, defaultedAfterPsp = 0;

            rows.forEach((r) => {
                const wave = this._dim(r, 2);
                const status = this._dim(r, 3);
                const timing = this._dim(r, 5);
                const count = this._measure(r, 0);
                const multi = this._measure(r, 1);

                totalSetUp += count;
                multipleAttempts += multi;
                if (byStatus[status] !== undefined) byStatus[status] += count;
                if (byWave[wave]) {
                    byWave[wave].setUp += count;
                    if (status === "Success") byWave[wave].completed += count;
                }
                if (timing === "Before PSP") defaultedBeforePsp += count;
                else if (timing === "After PSP") defaultedAfterPsp += count;
                if (defaultedByWave[wave]) {
                    if (timing === "Before PSP") defaultedByWave[wave].before += count;
                    else if (timing === "After PSP") defaultedByWave[wave].after += count;
                }
            });

            return { byWave, byStatus, totalSetUp, multipleAttempts, defaultedBeforePsp, defaultedAfterPsp, defaultedByWave };
        }

        // Compares this cycle's daily completions against the prior cycle's,
        // aligned by DAY-OF-CYCLE rather than literal calendar date — per
        // Blair (2026-09-30) — since the two cycles' real activity windows
        // are a full calendar year apart (this cycle: Oct-Dec 2026; prior
        // cycle: Oct-Dec 2025). "EventDate" (dimensions_1) identifies which
        // cycle a row belongs to (2027-01-01 = this cycle, 2026-01-01 =
        // prior); "ActivityDate" (dimensions_6, Completed_Date for this
        // row-kind — Abandoned is excluded, see file header) is the day the
        // completion actually happened. Both get converted to an offset
        // from their own cycle's start, so "day 0" always means the first
        // day of the enrollment window regardless of which cycle a bar
        // belongs to.
        _parseDailyTrend() {
            const rows = this._rowsOfKind("DailyTrend");
            const thisCycleByOffset = {};
            const priorCycleByOffset = {};
            rows.forEach((r) => {
                const eventDate = parseDateFlexible(this._dim(r, 1));
                const activityDate = parseDateFlexible(this._dim(r, 6));
                if (isNaN(eventDate.getTime()) || isNaN(activityDate.getTime())) return;
                const year = eventDate.getFullYear();
                let cycleStart, target;
                if (year === CYCLE_START.getFullYear() + 1) { cycleStart = CYCLE_START; target = thisCycleByOffset; }
                else if (year === PRIOR_CYCLE_START.getFullYear() + 1) { cycleStart = PRIOR_CYCLE_START; target = priorCycleByOffset; }
                else return; // unrecognized cycle, ignore rather than guess
                const offset = Math.round((activityDate - cycleStart) / 86400000);
                if (offset < 0 || offset >= CYCLE_LENGTH_DAYS) return; // outside the fixed window
                const count = this._measure(r, 0);
                target[offset] = (target[offset] || 0) + count;
            });

            // Always show the full fixed window (CYCLE_START - CYCLE_END),
            // not just days with data — same reasoning as before, now
            // applied to both cycles at once.
            const days = [];
            for (let i = 0; i < CYCLE_LENGTH_DAYS; i++) {
                const dateObj = new Date(CYCLE_START);
                dateObj.setDate(dateObj.getDate() + i);
                days.push({ dateObj, thisCycle: thisCycleByOffset[i] || 0, priorCycle: priorCycleByOffset[i] || 0 });
            }
            return days;
        }
        // Compact axis label ("Oct 19") from a Date object.
        _shortDateLabel(dateObj) {
            return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }

        // ---- Small render helpers ----
        _tileHtml(label, value, sub, pctOfMax, cls) {
            return `
                <div class="tile ${cls}">
                    <div class="label">${label}</div>
                    <div class="value">${value}</div>
                    <div class="sub">${sub}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, pctOfMax))}%"></div></div>
                </div>`;
        }

        // ---- Rendering ----
        _render() {
            const root = this._shadowRoot;
            const summary = this._parseSummary();
            const daily = this._parseDailyTrend();

            // Computed from the viewer's clock, not the (unreliable) bound
            // asOfLabel property — see sac-ae-operational-widget's own fix
            // for the same bug, applied here from the start.
            root.getElementById("asof").textContent = "As of: " + new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
            root.getElementById("dataBadge").textContent = this._usingMockData ? "Mock Data — Preview" : "Live";

            // Wave breakdown cards
            root.getElementById("waveGrid").innerHTML = WAVES.map((w) => {
                const d = summary.byWave[w];
                const pct = d.setUp ? Math.round((d.completed / d.setUp) * 100) : 0;
                return `
                    <div class="wave-card">
                        <div class="wave-name">${w}</div>
                        <div class="wave-window">${w === "Wave 1" ? "10/19 – 11/2" : w === "Wave 2a" ? "11/9 – 11/17" : w === "Wave 2b" ? "11/9 – 11/30" : "11/24 – 12/2"}</div>
                        <div class="wave-row"><span>Set Up</span><span class="n">${d.setUp}</span></div>
                        <div class="wave-row"><span>Completed</span><span class="n">${d.completed}</span></div>
                        <div class="wave-pct">${pct}% complete</div>
                    </div>`;
            }).join("");

            // Enrollment Status tiles. "Abandoned" displays as "Started, Not
            // Completed" — a pure display relabel, per Blair (2026-09-21):
            // same ResultCode='A' population and same underlying data key,
            // only the rendered label changes.
            const completedPct = summary.totalSetUp ? Math.round((summary.byStatus["Success"] / summary.totalSetUp) * 100) : 0;
            const startedNotCompletedPct = summary.totalSetUp ? Math.round((summary.byStatus["Abandoned"] / summary.totalSetUp) * 100) : 0;
            const notStartedPct = summary.totalSetUp ? Math.round((summary.byStatus["Not Started"] / summary.totalSetUp) * 100) : 0;
            root.getElementById("statusTiles").innerHTML = [
                this._tileHtml("Total Set Up", summary.totalSetUp, "all waves", 100, "accent"),
                this._tileHtml("Completed", summary.byStatus["Success"], completedPct + "% of total", completedPct, "success"),
                this._tileHtml("Started, Not Completed", summary.byStatus["Abandoned"], startedNotCompletedPct + "% of total", startedNotCompletedPct, "danger"),
                this._tileHtml("Not Started", summary.byStatus["Not Started"], notStartedPct + "% of total", notStartedPct, "warning"),
                this._tileHtml("Multiple Attempts", summary.multipleAttempts, "members, 2+ attempts", summary.totalSetUp ? (summary.multipleAttempts / summary.totalSetUp) * 100 : 0, "info"),
            ].join("");

            // Defaulted panels, broken out by Wave 1 / Wave 2a — the only two
            // waves with a PSP step (2b/3 have no Before/After PSP split).
            root.getElementById("defaultedPanels").innerHTML = ["Wave 1", "Wave 2a"].map((w) => {
                const d = summary.defaultedByWave[w];
                const waveTotal = summary.byWave[w].setUp;
                return `
                    <div class="panel">
                        <div class="section-title" style="margin-top:0;">${w}</div>
                        <div class="panel-caption" style="margin-top:-4px;">Defaulted members</div>
                        <div class="grid">
                            ${this._tileHtml("Before PSP", d.before, "of " + waveTotal + " set up", waveTotal ? (d.before / waveTotal) * 100 : 0, "warning")}
                            ${this._tileHtml("After PSP", d.after, "of " + waveTotal + " set up", waveTotal ? (d.after / waveTotal) * 100 : 0, "danger")}
                        </div>
                    </div>`;
            }).join("");

            // Timeline
            this._renderTimeline(root.getElementById("timelinePanel"), daily, summary);
        }

        // Daily Completion Tracker — per Blair (2026-09-30), now a this-
        // cycle-vs-prior-cycle comparison rather than a Completed/Started-
        // Not-Completed breakdown: two bar series (this cycle / prior
        // cycle, completions only) plus two cumulative lines on an
        // independent scale (a shared scale would flatten the bars).
        _renderTimeline(container, daily, summary) {
            let cum = 0;
            daily.forEach((d) => { cum += d.thisCycle; });
            const totalCompleted = cum;
            const pctOfSetUp = summary.totalSetUp ? Math.round((totalCompleted / summary.totalSetUp) * 100) : 0;

            container.innerHTML = `
                <div class="cum-tracker-header">
                    <div class="cum-tracker-title">Daily Completion Tracker — This Cycle vs. Prior Cycle</div>
                </div>
                <div class="cum-tracker-row">
                    <div><div class="cum-stat-value">${totalCompleted.toLocaleString()}</div><div class="cum-stat-label">Cumulative Completed</div></div>
                    <div><div class="cum-stat-value">${pctOfSetUp}%</div><div class="cum-stat-label">of Total Set Up</div></div>
                </div>
                <div class="chart-legend">
                    <div class="chart-legend-item"><span class="chart-legend-swatch" style="background:var(--success);"></span>This Cycle</div>
                    <div class="chart-legend-item"><span class="chart-legend-swatch" style="background:var(--info);opacity:.7;"></span>Prior Cycle</div>
                    <div class="chart-legend-item"><span class="chart-legend-swatch line" style="background:var(--accent);"></span>Cumulative — This Cycle</div>
                    <div class="chart-legend-item"><span class="chart-legend-swatch dashed-line"></span>Cumulative — Prior Cycle</div>
                </div>
                <div class="chart-wrap">${this._svgComboChart(daily)}</div>
            `;
        }

        _svgComboChart(daily) {
            const width = 700, height = 170, padL = 34, padR = 34, padT = 14, padB = 22;
            const innerW = width - padL - padR, innerH = height - padT - padB;
            const n = daily.length;
            if (!n) {
                return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg"><text x="10" y="20" class="chart-bar-label">No timeline data bound yet</text></svg>`;
            }

            const barMax = Math.max(1, ...daily.map((d) => Math.max(d.thisCycle, d.priorCycle)));
            let cumThis = 0, cumPrior = 0;
            const cumThisPoints = daily.map((d) => (cumThis += d.thisCycle));
            const cumPriorPoints = daily.map((d) => (cumPrior += d.priorCycle));
            const cumMax = Math.max(1, ...cumThisPoints, ...cumPriorPoints);

            const groupW = innerW / n;
            const barW = groupW * 0.32;
            const gap = groupW * 0.12;
            // Fixed calendar range means ~45 days on screen -- only label
            // every Nth day (targeting ~9 labels) so they don't overlap.
            const labelStride = Math.max(1, Math.ceil(n / 9));

            let grid = "";
            [0.25, 0.5, 0.75].forEach((f) => {
                const y = padT + innerH * (1 - f);
                grid += `<line class="chart-grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}"></line>`;
            });

            let bars = "", dayLabels = "";
            daily.forEach((d, i) => {
                const groupX = padL + i * groupW;
                const tH = (innerH * d.thisCycle) / barMax;
                const pH = (innerH * d.priorCycle) / barMax;
                const tX = groupX + gap;
                const pX = tX + barW + 2;
                const fullLabel = d.dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" });
                bars += `<rect class="chart-bar completed" x="${tX.toFixed(1)}" y="${(padT + innerH - tH).toFixed(1)}" width="${barW.toFixed(1)}" height="${tH.toFixed(1)}" rx="1"><title>${fullLabel} (day ${i + 1} of cycle): ${d.thisCycle} completed, this cycle</title></rect>`;
                bars += `<rect class="chart-bar prior-completed" x="${pX.toFixed(1)}" y="${(padT + innerH - pH).toFixed(1)}" width="${barW.toFixed(1)}" height="${pH.toFixed(1)}" rx="1"><title>Day ${i + 1} of cycle: ${d.priorCycle} completed, prior cycle</title></rect>`;
                if (i % labelStride === 0 || i === n - 1) {
                    dayLabels += `<text class="chart-bar-label" x="${(groupX + groupW / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${this._shortDateLabel(d.dateObj)}</text>`;
                }
            });

            const stepX = n > 1 ? innerW / (n - 1) : 0;
            const thisCoords = cumThisPoints.map((v, i) => [padL + i * stepX, padT + innerH - (v / cumMax) * innerH]);
            const priorCoords = cumPriorPoints.map((v, i) => [padL + i * stepX, padT + innerH - (v / cumMax) * innerH]);
            const thisLinePath = thisCoords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
            const priorLinePath = priorCoords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
            const thisDots = thisCoords.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--accent)"><title>Day ${i + 1} of cycle: ${cumThisPoints[i]} cumulative completed, this cycle</title></circle>`).join("");

            const axisLabels = `
                <text class="chart-axis-label" x="${(padL - 6).toFixed(1)}" y="${(padT + 4).toFixed(1)}" text-anchor="end">${barMax}</text>
                <text class="chart-axis-label" x="${(padL - 6).toFixed(1)}" y="${(padT + innerH).toFixed(1)}" text-anchor="end">0</text>
                <text class="chart-axis-label" x="${(width - padR + 6).toFixed(1)}" y="${(padT + 4).toFixed(1)}" text-anchor="start">${cumMax}</text>
                <text class="chart-axis-label" x="${(width - padR + 6).toFixed(1)}" y="${(padT + innerH).toFixed(1)}" text-anchor="start">0</text>`;

            return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Daily completions, this cycle vs. prior cycle">
                ${grid}${bars}
                <path d="${priorLinePath}" fill="none" stroke="var(--info)" stroke-width="2" stroke-dasharray="4,3"></path>
                <path d="${thisLinePath}" fill="none" stroke="var(--accent)" stroke-width="2"></path>
                ${thisDots}${dayLabels}${axisLabels}
            </svg>`;
        }
    }

    customElements.define("com-porticobenefits-memberenrollment", MemberEnrollment);
})();
