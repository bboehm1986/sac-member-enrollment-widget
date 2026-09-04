/*
    AE Member Enrollment — SAC Custom Widget

    Renders the Member Enrollment dashboard: Wave-level Set Up/Completed
    counts, overall Enrollment Status breakdown, Defaulted (Before/After
    PSP), a multiple-attempts count, and a daily Completed/Abandoned
    timeline. See ../ae-member-enrollment-report/GOLD_VIEW_SPEC.md for the
    full design (field definitions, business rules, reference calendar) and
    ../ae-member-enrollment-report/BUILD_PLAN_FOR_AHMED.md for how the two
    data bindings below get built.

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

            .chart-legend { display: flex; gap: 16px; margin-bottom: 8px; font-size: 11.5px; color: var(--text-soft); }
            .chart-legend .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
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

            <div class="section-title">Defaulted</div>
            <div class="grid" id="defaultedTiles"></div>

            <div class="section-title">Timeline — Completed vs. Abandoned</div>
            <div class="panel">
                <div class="chart-legend">
                    <span><span class="dot" style="background:var(--success);"></span>Completed</span>
                    <span><span class="dot" style="background:var(--danger);"></span>Abandoned</span>
                </div>
                <svg id="timelineChart" width="100%" height="140" viewBox="0 0 700 140" preserveAspectRatio="none"></svg>
            </div>

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
            });

            return { byWave, byStatus, totalSetUp, multipleAttempts, defaultedBeforePsp, defaultedAfterPsp };
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

            root.getElementById("asof").textContent = "As of: " + (this._props.asOfLabel || "Live");
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

            // Enrollment Status tiles
            const completedPct = summary.totalSetUp ? Math.round((summary.byStatus["Success"] / summary.totalSetUp) * 100) : 0;
            const abandonedPct = summary.totalSetUp ? Math.round((summary.byStatus["Abandoned"] / summary.totalSetUp) * 100) : 0;
            const notStartedPct = summary.totalSetUp ? Math.round((summary.byStatus["Not Started"] / summary.totalSetUp) * 100) : 0;
            root.getElementById("statusTiles").innerHTML = [
                this._tileHtml("Total Set Up", summary.totalSetUp, "all waves", 100, "accent"),
                this._tileHtml("Completed", summary.byStatus["Success"], completedPct + "% of total", completedPct, "success"),
                this._tileHtml("Abandoned", summary.byStatus["Abandoned"], abandonedPct + "% of total", abandonedPct, "danger"),
                this._tileHtml("Not Started", summary.byStatus["Not Started"], notStartedPct + "% of total", notStartedPct, "warning"),
                this._tileHtml("Multiple Attempts", summary.multipleAttempts, "members, 2+ attempts", summary.totalSetUp ? (summary.multipleAttempts / summary.totalSetUp) * 100 : 0, "info"),
            ].join("");

            // Defaulted tiles
            root.getElementById("defaultedTiles").innerHTML = [
                this._tileHtml("Defaulted — Before PSP", summary.defaultedBeforePsp, "Wave 1 / 2a only", summary.totalSetUp ? (summary.defaultedBeforePsp / summary.totalSetUp) * 100 : 0, "warning"),
                this._tileHtml("Defaulted — After PSP", summary.defaultedAfterPsp, "Wave 1 / 2a only", summary.totalSetUp ? (summary.defaultedAfterPsp / summary.totalSetUp) * 100 : 0, "danger"),
            ].join("");

            // Timeline
            this._renderTimeline(root.getElementById("timelineChart"), daily);

            root.getElementById("notice").textContent =
                "⚠ Open items: Wave assignment is still Yong Yang's view (not yet built), and " +
                "\"Total Not Started By Day\" isn't yet defined (snapshot vs. cohort trend) — " +
                "see GOLD_VIEW_SPEC.md §7 in ae-member-enrollment-report/.";
        }

        _renderTimeline(svg, daily) {
            const W = 700, H = 140, padBottom = 20, padTop = 8;
            const max = Math.max(1, ...daily.map((d) => Math.max(d.completed, d.abandoned)));
            const groupW = daily.length ? W / daily.length : 0;
            const barW = groupW * 0.32;
            const gap = groupW * 0.12;

            let grid = "";
            [0.25, 0.5, 0.75].forEach((f) => {
                const y = padTop + (H - padTop - padBottom) * (1 - f);
                grid += `<line class="chart-grid-line" x1="0" y1="${y}" x2="${W}" y2="${y}"></line>`;
            });

            let bars = "";
            daily.forEach((d, i) => {
                const groupX = i * groupW;
                const cH = ((H - padTop - padBottom) * d.completed) / max;
                const aH = ((H - padTop - padBottom) * d.abandoned) / max;
                const cX = groupX + gap;
                const aX = cX + barW + 2;
                bars += `<rect class="chart-bar completed" x="${cX}" y="${H - padBottom - cH}" width="${barW}" height="${cH}" rx="1"></rect>`;
                bars += `<rect class="chart-bar abandoned" x="${aX}" y="${H - padBottom - aH}" width="${barW}" height="${aH}" rx="1"></rect>`;
                const dayLabel = d.date.slice(5);
                bars += `<text class="chart-bar-label" x="${groupX + groupW / 2}" y="${H - 6}" text-anchor="middle">${dayLabel}</text>`;
            });

            svg.innerHTML = daily.length
                ? (grid + bars)
                : `<text x="10" y="20" class="chart-bar-label">No timeline data bound yet</text>`;
        }
    }

    customElements.define("com-porticobenefits-memberenrollment", MemberEnrollment);
})();
