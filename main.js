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
    calendar) and ../ae-member-enrollment-report/BUILD_PLAN_FOR_AHMED.md
    for how the two data bindings below get built.

    This widget binds to two PRE-AGGREGATED cubes, never to Gold-layer
    member-level rows directly (Gold is one row per Member, individual-level
    data — this widget only ever sees counts). Data bindings (declared in
    widget.json), each following SAC's standard ResultSet row shape
    ({ data: [ { dimensions_0: {id,label}, ..., measures_0: {raw,formatted},
    ... } ] }):

      - enrollmentSummary  <- DS_MEMBER_ENROLLMENT_SUMMARY
            dimensions_0 = Wave ("Wave 1" / "Wave 2a" / "Wave 2b" / "Wave 3")
            dimensions_1 = Enrollment Status (Success / Abandoned /
                            Not Started / In Progress / Needs Follow-up)
            dimensions_2 = Defaulted ("Yes" / "No")
            dimensions_3 = Defaulted Timing ("Before PSP" / "After PSP" /
                            "N/A")
            measures_0   = Member Count
            measures_1   = Multiple-Attempts Member Count (members in this
                            combination with Total Attempts > 1)

      - dailyTrend         <- DS_MEMBER_ENROLLMENT_DAILY
            dimensions_0 = Date (YYYY-MM-DD)
            dimensions_1 = Wave
            dimensions_2 = Enrollment Status (only Success/Abandoned carry a
                            date today — see GOLD_VIEW_SPEC.md §7's open
                            question on what "Not Started by day" even means)
            measures_0   = Member Count

    No in-widget filter controls, no theme toggle, light theme only — by
    design from the start this time, not a lesson learned the hard way:
    SAC's Optimized-story View mode doesn't deliver internal click/change
    events to a custom widget's shadow DOM (confirmed on the Employer
    Selections widget). Filtering belongs in a native SAC Input Control.

    Until the two bindings above are wired to real Datasphere-backed
    models, the widget renders from the MOCK_* constants below so the
    layout can be built and reviewed standalone (see preview.html).
*/
(function () {
    "use strict";

    const WAVES = ["Wave 1", "Wave 2a", "Wave 2b", "Wave 3"];
    const STATUSES = ["Success", "Abandoned", "Not Started", "In Progress", "Needs Follow-up"];

    // ---- Mock data (mirrors the real SAC ResultSet row shape) ----
    function row(dims, measures) {
        const out = {};
        dims.forEach((d, i) => { out["dimensions_" + i] = { id: d, label: d }; });
        measures.forEach((m, i) => { out["measures_" + i] = { raw: m, formatted: String(m) }; });
        return out;
    }

    const MOCK_ENROLLMENT_SUMMARY = { data: [
        // Wave 1 (all sponsored) — PSP applies
        row(["Wave 1", "Success", "No", "N/A"], [610, 140]),
        row(["Wave 1", "Abandoned", "No", "N/A"], [35, 28]),
        row(["Wave 1", "In Progress", "No", "N/A"], [8, 3]),
        row(["Wave 1", "Not Started", "Yes", "Before PSP"], [25, 0]),
        row(["Wave 1", "Not Started", "Yes", "After PSP"], [12, 0]),
        row(["Wave 1", "Needs Follow-up", "No", "N/A"], [15, 6]),
        // Wave 2a (sponsored, excludes Medicare) — PSP applies
        row(["Wave 2a", "Success", "No", "N/A"], [340, 55]),
        row(["Wave 2a", "Abandoned", "No", "N/A"], [18, 12]),
        row(["Wave 2a", "In Progress", "No", "N/A"], [5, 1]),
        row(["Wave 2a", "Not Started", "Yes", "Before PSP"], [14, 0]),
        row(["Wave 2a", "Not Started", "Yes", "After PSP"], [6, 0]),
        row(["Wave 2a", "Needs Follow-up", "No", "N/A"], [9, 4]),
        // Wave 2b (non-sponsored) — no PSP
        row(["Wave 2b", "Success", "No", "N/A"], [480, 60]),
        row(["Wave 2b", "Abandoned", "No", "N/A"], [22, 15]),
        row(["Wave 2b", "In Progress", "No", "N/A"], [11, 2]),
        row(["Wave 2b", "Not Started", "Yes", "N/A"], [31, 0]),
        row(["Wave 2b", "Needs Follow-up", "No", "N/A"], [13, 5]),
        // Wave 3 (small population, if needed) — no PSP
        row(["Wave 3", "Success", "No", "N/A"], [42, 6]),
        row(["Wave 3", "Abandoned", "No", "N/A"], [2, 1]),
        row(["Wave 3", "Not Started", "Yes", "N/A"], [5, 0]),
    ] };

    const MOCK_DAILY_TREND = { data: [
        row(["2026-10-19", "Wave 1", "Success"], [12]), row(["2026-10-19", "Wave 1", "Abandoned"], [1]),
        row(["2026-10-20", "Wave 1", "Success"], [25]), row(["2026-10-20", "Wave 1", "Abandoned"], [2]),
        row(["2026-10-21", "Wave 1", "Success"], [30]), row(["2026-10-21", "Wave 1", "Abandoned"], [3]),
        row(["2026-10-22", "Wave 1", "Success"], [40]), row(["2026-10-22", "Wave 1", "Abandoned"], [2]),
        row(["2026-10-23", "Wave 1", "Success"], [22]), row(["2026-10-23", "Wave 1", "Abandoned"], [4]),
        row(["2026-10-26", "Wave 1", "Success"], [55]), row(["2026-10-26", "Wave 1", "Abandoned"], [5]),
        row(["2026-10-27", "Wave 1", "Success"], [48]), row(["2026-10-27", "Wave 1", "Abandoned"], [3]),
        row(["2026-10-28", "Wave 1", "Success"], [35]), row(["2026-10-28", "Wave 1", "Abandoned"], [6]),
        row(["2026-10-29", "Wave 1", "Success"], [60]), row(["2026-10-29", "Wave 1", "Abandoned"], [4]),
        row(["2026-10-30", "Wave 1", "Success"], [70]), row(["2026-10-30", "Wave 1", "Abandoned"], [5]),
        row(["2026-11-02", "Wave 1", "Success"], [90]), row(["2026-11-02", "Wave 1", "Abandoned"], [8]),
        row(["2026-11-09", "Wave 2a", "Success"], [33]), row(["2026-11-09", "Wave 2a", "Abandoned"], [2]),
        row(["2026-11-10", "Wave 2a", "Success"], [45]), row(["2026-11-10", "Wave 2a", "Abandoned"], [3]),
        row(["2026-11-16", "Wave 2a", "Success"], [60]), row(["2026-11-16", "Wave 2a", "Abandoned"], [5]),
        row(["2026-11-17", "Wave 2a", "Success"], [75]), row(["2026-11-17", "Wave 2a", "Abandoned"], [7]),
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

            .tile, .panel, .wave-card, .notice, .badge {
                backdrop-filter: var(--glass-blur);
                -webkit-backdrop-filter: var(--glass-blur);
            }
            @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
                .tile, .panel, .wave-card, .notice { background: rgba(255,255,255,0.94) !important; }
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
            .chart-wrap { margin-top: 2px; }
            .chart-svg { width: 100%; height: 170px; display: block; }
            .chart-axis-label { font-size: 9px; fill: var(--text-soft); }
            .chart-grid-line { stroke: rgba(23,26,35,0.08); stroke-width: 1; }
            .chart-bar-label { font-size: 8.5px; fill: var(--text-soft); }
            .chart-bar.completed { fill: var(--success); }
            .chart-bar.abandoned { fill: var(--danger); }

            .notice { margin-top: 18px; background: var(--warning-bg); border: 1px solid rgba(165,112,12,0.3); border-radius: 14px; padding: 10px 14px; font-size: 11.5px; color: var(--text); box-shadow: var(--shadow-card); }
        </style>
        <div class="dashboard">
            <div class="topbar">
                <div>
                    <div class="eyebrow">2026 Annual Enrollment</div>
                    <div class="titlewrap">
                        <h1>Member Enrollment</h1>
                        <span class="badge accent" id="dataBadge">Mock Data — Preview</span>
                        <span class="badge warning">2 Open Items</span>
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

            <div class="notice" id="notice"></div>
        </div>
    `;

    class MemberEnrollment extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(template.content.cloneNode(true));

            this._props = { width: 900, height: 650, asOfLabel: "Live" };
            this._enrollmentSummary = MOCK_ENROLLMENT_SUMMARY;
            this._dailyTrend = MOCK_DAILY_TREND;
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
            if ("enrollmentSummary" in changedProperties) { this._enrollmentSummary = changedProperties.enrollmentSummary; this._usingMockData = false; }
            if ("dailyTrend" in changedProperties) { this._dailyTrend = changedProperties.dailyTrend; this._usingMockData = false; }
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
        _dim(r, i) {
            const d = r["dimensions_" + i];
            return d ? d.label : "";
        }
        _measure(r, i) {
            const m = r["measures_" + i];
            return m ? Number(m.raw) : 0;
        }

        _parseSummary() {
            const rows = (this._enrollmentSummary && this._enrollmentSummary.data) || [];
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
                const wave = this._dim(r, 0);
                const status = this._dim(r, 1);
                const timing = this._dim(r, 3);
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

        _parseDailyTrend() {
            const rows = (this._dailyTrend && this._dailyTrend.data) || [];
            const byDate = {};
            rows.forEach((r) => {
                const date = this._dim(r, 0);
                const status = this._dim(r, 2);
                const count = this._measure(r, 0);
                if (!byDate[date]) byDate[date] = { completed: 0, abandoned: 0 };
                if (status === "Success") byDate[date].completed += count;
                else if (status === "Abandoned") byDate[date].abandoned += count;
            });
            return Object.keys(byDate).sort().map((date) => ({ date, ...byDate[date] }));
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

            root.getElementById("notice").textContent =
                "⚠ Open items: \"Total Not Started By Day\" isn't a tracked field — it's " +
                "inferred as Total Set Up minus cumulative Completed, and the Wave/Defaulted " +
                "join against AE_EventRqsts/vDimMember hasn't been deployed to this cube yet — " +
                "see GOLD_VIEW_SPEC.md §7/§8/§10k in ae-member-enrollment-report/.";
        }

        // Daily Completion Tracker — header/stat-row/legend/chart, matching
        // sac-ae-operational-widget's convention. Keeps both bar series
        // (Completed / Started-Not-Completed) since that per-day contrast is
        // meaningful for Member Enrollment, unlike the Employer widget's
        // single-series original — but adds the same cumulative-line overlay
        // on an independent scale (a shared scale would flatten the bars).
        _renderTimeline(container, daily, summary) {
            let cum = 0;
            daily.forEach((d) => { cum += d.completed; });
            const totalCompleted = cum;
            const pctOfSetUp = summary.totalSetUp ? Math.round((totalCompleted / summary.totalSetUp) * 100) : 0;

            container.innerHTML = `
                <div class="cum-tracker-header">
                    <div class="cum-tracker-title">Daily Completion Tracker</div>
                </div>
                <div class="cum-tracker-row">
                    <div><div class="cum-stat-value">${totalCompleted.toLocaleString()}</div><div class="cum-stat-label">Cumulative Completed</div></div>
                    <div><div class="cum-stat-value">${pctOfSetUp}%</div><div class="cum-stat-label">of Total Set Up</div></div>
                </div>
                <div class="chart-legend">
                    <div class="chart-legend-item"><span class="chart-legend-swatch" style="background:var(--success);"></span>Completed</div>
                    <div class="chart-legend-item"><span class="chart-legend-swatch" style="background:var(--danger);"></span>Started, Not Completed</div>
                    <div class="chart-legend-item"><span class="chart-legend-swatch line" style="background:var(--accent);"></span>Cumulative Completed</div>
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

            const barMax = Math.max(1, ...daily.map((d) => Math.max(d.completed, d.abandoned)));
            let cum = 0;
            const cumPoints = daily.map((d) => (cum += d.completed));
            const cumMax = Math.max(1, ...cumPoints);

            const groupW = innerW / n;
            const barW = groupW * 0.32;
            const gap = groupW * 0.12;

            let grid = "";
            [0.25, 0.5, 0.75].forEach((f) => {
                const y = padT + innerH * (1 - f);
                grid += `<line class="chart-grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}"></line>`;
            });

            let bars = "", dayLabels = "";
            daily.forEach((d, i) => {
                const groupX = padL + i * groupW;
                const cH = (innerH * d.completed) / barMax;
                const aH = (innerH * d.abandoned) / barMax;
                const cX = groupX + gap;
                const aX = cX + barW + 2;
                bars += `<rect class="chart-bar completed" x="${cX.toFixed(1)}" y="${(padT + innerH - cH).toFixed(1)}" width="${barW.toFixed(1)}" height="${cH.toFixed(1)}" rx="1"><title>${d.date}: ${d.completed} completed</title></rect>`;
                bars += `<rect class="chart-bar abandoned" x="${aX.toFixed(1)}" y="${(padT + innerH - aH).toFixed(1)}" width="${barW.toFixed(1)}" height="${aH.toFixed(1)}" rx="1"><title>${d.date}: ${d.abandoned} started, not completed</title></rect>`;
                dayLabels += `<text class="chart-bar-label" x="${(groupX + groupW / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${d.date.slice(5)}</text>`;
            });

            const stepX = n > 1 ? innerW / (n - 1) : 0;
            const coords = cumPoints.map((v, i) => [padL + i * stepX, padT + innerH - (v / cumMax) * innerH]);
            const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
            const dots = coords.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--accent)"><title>${daily[i].date}: ${cumPoints[i]} cumulative completed</title></circle>`).join("");

            const axisLabels = `
                <text class="chart-axis-label" x="${(padL - 6).toFixed(1)}" y="${(padT + 4).toFixed(1)}" text-anchor="end">${barMax}</text>
                <text class="chart-axis-label" x="${(padL - 6).toFixed(1)}" y="${(padT + innerH).toFixed(1)}" text-anchor="end">0</text>
                <text class="chart-axis-label" x="${(width - padR + 6).toFixed(1)}" y="${(padT + 4).toFixed(1)}" text-anchor="start">${cumMax}</text>
                <text class="chart-axis-label" x="${(width - padR + 6).toFixed(1)}" y="${(padT + innerH).toFixed(1)}" text-anchor="start">0</text>`;

            return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Daily and cumulative completions">
                ${grid}${bars}
                <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2"></path>
                ${dots}${dayLabels}${axisLabels}
            </svg>`;
        }
    }

    customElements.define("com-porticobenefits-memberenrollment", MemberEnrollment);
})();
