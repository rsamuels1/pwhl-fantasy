import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Types
interface ScorecardRow {
  area: string;
  status: "pass" | "risk" | "pass-with-risks";
  blocker: string;
}

interface SprintTask {
  text: string;
  done: boolean;
}

interface Sprint {
  number: number;
  name: string;
  status: "complete" | "current" | "planned";
  track?: string;
  tasks: SprintTask[];
  exitCriteria?: string;
}

interface Feature {
  number: number;
  title: string;
  status: "done" | "partial" | "todo";
  priority: string;
  tokens?: number;
  phase: number;
}

interface Stats {
  currentSprint: string;
  sprintsComplete: number;
  sprintsTotal: number;
  gatesPassing: number;
  gatesTotal: number;
}

// Read markdown files
const indexPath = resolve("docs/01-roadmap/roadmap-index.md");
const featuresPath = resolve("docs/01-roadmap/roadmap-features.md");
const sprintsPath = resolve("docs/01-roadmap/roadmap-sprints.md");

const indexMd = readFileSync(indexPath, "utf-8");
const featuresMd = readFileSync(featuresPath, "utf-8");
const sprintsMd = readFileSync(sprintsPath, "utf-8");

// Parsing functions
function parseScorecard(md: string): ScorecardRow[] {
  const rows: ScorecardRow[] = [];
  const scorecard = md.match(
    /## MVP Readiness Scorecard[\s\S]*?\| Area \| Status([\s\S]*?)\n\n/
  );
  if (!scorecard) return rows;

  const tableContent = scorecard[1];
  const lines = tableContent.split("\n").slice(1);
  for (const line of lines) {
    const match = line.match(/\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (!match) continue;

    const [, area, statusText, blocker] = match;
    let status: "pass" | "risk" | "pass-with-risks" = "pass";
    if (statusText.includes("⚠️")) status = "pass-with-risks";
    else if (statusText.includes("FAIL")) status = "risk";

    rows.push({
      area: area.trim(),
      status,
      blocker: blocker.trim() || "—",
    });
  }
  return rows;
}

function parseSprints(md: string): Sprint[] {
  const sprints: Sprint[] = [];
  // Match sprints: handles both "5" and "6+" formats; name can be quoted or unquoted
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sprintMatch = line.match(/^## Sprint (\d+\+?)\s*—\s*"?([^"·]+)"?/);
    if (!sprintMatch) continue;

    const [, numStr, name] = sprintMatch;
    const number = numStr === "6+" ? 6 : parseInt(numStr);

    let status: "complete" | "current" | "planned" = "planned";
    if (line.includes("✅ COMPLETE")) status = "complete";
    if (line.includes("← CURRENT")) status = "current";

    // Extract track from the line
    const trackMatch = line.match(/Track\s+(\w+)/);
    const track = trackMatch ? trackMatch[1] : undefined;

    // Find sprint block (from this line until next ## Sprint)
    const sprintStartIdx = md.indexOf(line, i > 0 ? md.indexOf(lines[i - 1]) : 0);
    const nextSprintIdx = md.indexOf("\n## Sprint", sprintStartIdx + 1);
    const sprintBlock = md.slice(
      sprintStartIdx,
      nextSprintIdx > 0 ? nextSprintIdx : undefined
    );

    // Parse tasks with done status (only for non-planned sprints, or for planned with listed tasks)
    const tasks: SprintTask[] = [];
    const taskLines = sprintBlock.split("\n").filter((l) => l.match(/^-\s+\*?\*?[A-Z#]/));
    for (const line of taskLines) {
      const done = line.includes("✅");
      const text = line
        .replace(/^-\s+/, "")
        .replace(/✅\s*/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .trim();
      if (text && text.length > 5) tasks.push({ text, done }); // Filter out cruft
    }

    // Parse exit criteria (only for completed/current sprints)
    const exitMatch = sprintBlock.match(/\*\*Exit:\*\*\s*([\s\S]*?)(?:\n## Sprint|\n\n##|$)/);
    const exitCriteria = exitMatch
      ? exitMatch[1]
          .split("\n")[0]
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .trim()
      : undefined;

    sprints.push({
      number,
      name: name.trim(),
      status,
      track,
      tasks,
      exitCriteria,
    });
  }

  return sprints;
}

function parseFeatures(md: string): Feature[] {
  const features: Feature[] = [];
  const phaseBlocks = md.split(/^# Phase /m).slice(1);

  for (const block of phaseBlocks) {
    const headerLine = block.split("\n")[0];
    const phaseMatch = headerLine.match(/(\d+):/);
    if (!phaseMatch) continue;
    const phaseNum = parseInt(phaseMatch[1]);

    const featureMatches = block.matchAll(/^## (\d+)\.?\s+(.+?)(?:\n|$)/gm);

    for (const fm of featureMatches) {
      const [fullMatch, numStr, titleText] = fm;
      const featureNum = parseInt(numStr);

      const featureStartIdx = block.indexOf(fullMatch);
      const nextFeatureIdx = block.indexOf("\n## ", featureStartIdx + 1);
      const featureBlock = block.slice(
        featureStartIdx,
        nextFeatureIdx > 0 ? nextFeatureIdx : undefined
      );

      // Parse title (before any · or other delimiter)
      const title = titleText.split(/\s*·|\s*\(/).shift()?.trim() || titleText;

      // Parse status
      let status: "done" | "partial" | "todo" = "todo";
      if (/✅\s*(DONE|COMPLETE|Implemented|PASS)/.test(featureBlock))
        status = "done";
      else if (/Partially|Largely|Partial/.test(featureBlock))
        status = "partial";

      // Parse priority
      const priorityMatch = featureBlock.match(/Priority:\s*(.+?)(?:\n|$)/);
      const priority = priorityMatch ? priorityMatch[1].trim() : "MEDIUM";

      // Parse tokens
      const tokensMatch = featureBlock.match(/Estimated tokens:\s*~?([\d]+)K/);
      const tokens = tokensMatch ? parseInt(tokensMatch[1]) : undefined;

      features.push({
        number: featureNum,
        title,
        status,
        priority,
        tokens,
        phase: phaseNum,
      });
    }
  }

  return features;
}

function computeStats(sprints: Sprint[], scorecard: ScorecardRow[]): Stats {
  const completeSprints = sprints.filter((s) => s.status === "complete").length;
  const gatesPassing = scorecard.filter((s) => s.status.includes("pass")).length;
  const currentSprintObj = sprints.find((s) => s.status === "current");

  return {
    currentSprint: currentSprintObj ? `Sprint ${currentSprintObj.number}` : "No active sprint",
    sprintsComplete: completeSprints,
    sprintsTotal: sprints.length,
    gatesPassing,
    gatesTotal: scorecard.length,
  };
}

function criticalityLevel(
  feature: Feature,
  allFeatures: Feature[]
): "blocker" | "high" | "medium" | "low" {
  if (feature.status === "done") return "low"; // Don't show completed items

  if (feature.phase === 0) return "blocker"; // All Phase 0 items
  if (feature.priority === "CRITICAL") return "blocker";
  if (feature.priority === "HIGH") return "high";
  if (feature.priority === "MEDIUM") return "medium";
  if (feature.phase >= 4) return "low"; // Phases 4+ are post-launch
  return "medium";
}

function renderHTML(
  scorecard: ScorecardRow[],
  sprints: Sprint[],
  features: Feature[],
  stats: Stats
): string {
  const now = new Date();
  const betaCodeComplete = new Date("2026-09-01");
  const daysRemaining = Math.ceil((betaCodeComplete.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Build backlog grouped by criticality
  const backlog = features.filter((f) => f.status !== "done");
  const bycriticality = {
    blocker: backlog.filter((f) => criticalityLevel(f, features) === "blocker"),
    high: backlog.filter((f) => criticalityLevel(f, features) === "high"),
    medium: backlog.filter((f) => criticalityLevel(f, features) === "medium"),
    low: backlog.filter((f) => criticalityLevel(f, features) === "low"),
  };

  // Build sprint overview
  const sprintOverview = sprints.map((s) => {
    const tasksDone = s.tasks.filter((t) => t.done).length;
    return { ...s, tasksDone, tasksTotal: s.tasks.length };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PWHL Fantasy · Project Tracker</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'JetBrains Mono', monospace;
      background-color: #0a0a0a;
      color: #e0e0e0;
      line-height: 1.5;
    }
    a { color: #64b5f6; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Header */
    header {
      background: #111;
      border-bottom: 1px solid #222;
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h1 { font-size: 1.2rem; font-weight: 700; letter-spacing: 0.05em; }
    .header-right { text-align: right; font-size: 0.85rem; }
    .header-right .stat { display: inline-block; margin-left: 2rem; }
    .header-right .label { color: #888; }
    .header-right .value { font-weight: 700; color: #64b5f6; }

    /* Tab bar */
    .tab-bar {
      background: #111;
      border-bottom: 1px solid #222;
      display: flex;
      padding: 0 1.5rem;
      gap: 2rem;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .tab-button {
      flex: 0 0 auto;
      padding: 0.75rem 0;
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab-button:hover { color: #ccc; }
    .tab-button.active {
      color: #22c55e;
      border-bottom-color: #22c55e;
    }

    /* Tab content */
    .tab-content {
      display: none;
      padding: 1.5rem;
    }
    .tab-content.active { display: block; }

    /* Cards & panels */
    .card {
      background: #111;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .card.complete { border-left: 4px solid #22c55e; background: #0f1a0f; }
    .card.current { border-left: 4px solid #f59e0b; }
    .card.planned { border: 1px dashed #444; }

    /* Status chips */
    .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 700; }
    .status.done { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
    .status.partial { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    .status.todo { background: rgba(107, 114, 128, 0.1); color: #9ca3af; }
    .status.complete { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
    .status.planned { background: rgba(107, 114, 128, 0.1); color: #6b7280; }
    .status.risk { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

    /* Gates & tasks */
    .gate-row {
      display: grid;
      grid-template-columns: 2rem 1fr 6rem 1fr;
      gap: 1rem;
      padding: 0.75rem;
      border-bottom: 1px solid #1a1a1a;
      align-items: center;
      font-size: 0.9rem;
    }
    .gate-row:last-child { border-bottom: none; }
    .gate-icon { font-size: 1rem; }
    .task-row {
      padding: 0.5rem 0;
      font-size: 0.9rem;
      border-bottom: 1px solid #1a1a1a;
    }
    .task-row:last-child { border-bottom: none; }
    .task-check { display: inline-block; width: 1.5rem; }

    /* Sprint grid */
    .sprint-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
    .sprint-card {
      background: #111;
      border: 1px solid #222;
      border-radius: 6px;
      padding: 0.75rem;
      text-align: center;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }
    .sprint-card:hover { border-color: #444; }
    .sprint-card.complete { border-color: #22c55e; }
    .sprint-card.current { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
    .sprint-card .name { font-weight: 700; margin-bottom: 0.25rem; }
    .sprint-card .progress { font-size: 0.75rem; color: #888; margin-top: 0.25rem; }

    /* Backlog table */
    .backlog-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .backlog-table th {
      background: #0a0a0a;
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #222;
      font-weight: 700;
      color: #888;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .backlog-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #1a1a1a;
    }
    .backlog-table tr:hover { background: #0f0f0f; }

    /* Section header */
    .section-header {
      font-size: 1rem;
      font-weight: 700;
      margin: 1.5rem 0 1rem 0;
      color: #ccc;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .section-count { font-size: 0.85rem; color: #666; font-weight: 400; }

    /* Filter pills */
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #222;
    }
    .filter-group { display: flex; gap: 0.5rem; align-items: center; }
    .filter-group label { font-size: 0.8rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .filter-btn {
      padding: 0.4rem 0.8rem;
      background: #111;
      border: 1px solid #222;
      border-radius: 4px;
      color: #888;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      transition: all 0.2s;
    }
    .filter-btn:hover { border-color: #444; }
    .filter-btn.active {
      background: #22c55e;
      border-color: #22c55e;
      color: #000;
    }

    /* Criticality dots */
    .crit-dot { display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 50%; margin-right: 0.5rem; }
    .crit-blocker { background: #ef4444; }
    .crit-high { background: #f59e0b; }
    .crit-medium { background: #eab308; }
    .crit-low { background: #6b7280; }

    /* Blocker callout */
    .blocker-callout {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid #ef4444;
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
      font-size: 0.9rem;
    }
    .blocker-callout strong { color: #ef4444; }

    /* Exit criteria */
    .exit-criteria {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid #222;
      font-size: 0.85rem;
      color: #888;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <h1>PWHL Fantasy · Project Tracker</h1>
    <div class="header-right">
      <div class="stat">
        <span class="label">Current:</span>
        <span class="value">${stats.currentSprint}</span>
      </div>
      <div class="stat">
        <span class="label">To Beta:</span>
        <span class="value">${daysRemaining} days</span>
      </div>
      <div class="stat">
        <span class="label">Sprints:</span>
        <span class="value">${stats.sprintsComplete}/${stats.sprintsTotal}</span>
      </div>
      <div class="stat">
        <span class="label">Gates:</span>
        <span class="value">${stats.gatesPassing}/${stats.gatesTotal}</span>
      </div>
    </div>
  </header>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button class="tab-button active" onclick="switchTab('overview')">Overview</button>
    <button class="tab-button" onclick="switchTab('sprints')">Sprints</button>
    <button class="tab-button" onclick="switchTab('backlog')">Backlog</button>
  </div>

  <!-- Tab 1: Overview -->
  <div id="overview" class="tab-content active">
    <div class="section-header">Launch Gates <span class="section-count">${stats.gatesPassing}/${stats.gatesTotal}</span></div>
    <div class="card">
      ${scorecard
        .map(
          (row) => `
        <div class="gate-row">
          <div class="gate-icon">${row.status === "pass" ? "✅" : row.status === "pass-with-risks" ? "⚠️" : "❌"}</div>
          <div>${row.area}</div>
          <div><span class="status ${row.status === "pass" ? "done" : row.status === "pass-with-risks" ? "partial" : "risk"}">${row.status === "pass" ? "PASS" : row.status === "pass-with-risks" ? "RISK" : "FAIL"}</span></div>
          <div style="font-size: 0.85rem; color: #888;">${row.blocker}</div>
        </div>
      `
        )
        .join("")}
    </div>

    ${
      scorecard.some((r) => r.status !== "pass")
        ? `
      <div class="blocker-callout">
        <strong>What's blocking beta:</strong><br/>
        ${scorecard
          .filter((r) => r.status !== "pass")
          .map((r) => `• ${r.area} — ${r.blocker}`)
          .join("<br/>")}
      </div>
    `
        : ""
    }

    <div class="section-header" style="margin-top: 2rem;">Sprint Overview</div>
    <div class="sprint-grid">
      ${sprintOverview
        .map(
          (s) => `
        <div class="sprint-card ${s.status}" onclick="switchTab('sprints'); setTimeout(() => document.getElementById('sprint-${s.number}').scrollIntoView({behavior: 'smooth'}), 100)">
          <div class="name">Sprint ${s.number}</div>
          <div class="progress">${s.tasksDone}/${s.tasksTotal}</div>
          <span class="status ${s.status}">${s.status === "complete" ? "✅ DONE" : s.status === "current" ? "● LIVE" : "○ PLAN"}</span>
        </div>
      `
        )
        .join("")}
    </div>
  </div>

  <!-- Tab 2: Sprints -->
  <div id="sprints" class="tab-content">
    ${sprints
      .map(
        (s) => `
      <div id="sprint-${s.number}" class="card ${s.status}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div>
            <div style="font-weight: 700; font-size: 1rem;">Sprint ${s.number} · "${s.name}"</div>
            ${s.track ? `<div style="font-size: 0.8rem; color: #888;">Track: ${s.track}</div>` : ""}
          </div>
          <span class="status ${s.status}">${s.status === "complete" ? "✅ COMPLETE" : s.status === "current" ? "● IN FLIGHT" : "○ PLANNED"}</span>
        </div>
        <div>
          ${s.tasks
            .map(
              (t) => `
            <div class="task-row">
              <span class="task-check">${t.done ? "✅" : "○"}</span>
              <span style="color: ${t.done ? "#666" : "#ccc"}">${t.text}</span>
            </div>
          `
            )
            .join("")}
        </div>
        ${s.exitCriteria ? `<div class="exit-criteria"><strong>Exit:</strong> ${s.exitCriteria}</div>` : ""}
      </div>
    `
      )
      .join("")}
  </div>

  <!-- Tab 3: Backlog -->
  <div id="backlog" class="tab-content">
    <div class="filters">
      <div class="filter-group">
        <label>Status:</label>
        <button class="filter-btn active" onclick="filterBacklog('status', 'all')">All</button>
        <button class="filter-btn" onclick="filterBacklog('status', 'todo')">Todo</button>
        <button class="filter-btn" onclick="filterBacklog('status', 'partial')">Partial</button>
      </div>
      <div class="filter-group">
        <label>Criticality:</label>
        <button class="filter-btn active" onclick="filterBacklog('crit', 'all')">All</button>
        <button class="filter-btn" onclick="filterBacklog('crit', 'blocker')">Blocker</button>
        <button class="filter-btn" onclick="filterBacklog('crit', 'high')">High</button>
        <button class="filter-btn" onclick="filterBacklog('crit', 'medium')">Medium</button>
      </div>
    </div>

    ${Object.entries(
      {
        blocker: "🔴 Beta Blocker",
        high: "🟠 High Priority",
        medium: "🟡 Medium Priority",
        low: "⚪ Low / Post-launch",
      }
    )
      .map(
        ([key, label]) => `
        <div class="crit-section-${key}">
          ${bycriticality[key as keyof typeof bycriticality].length > 0 ? `
            <div class="section-header">${label} <span class="section-count">${bycriticality[key as keyof typeof bycriticality].length}</span></div>
            <table class="backlog-table">
              <thead>
                <tr>
                  <th style="width: 2rem;"></th>
                  <th style="width: 4rem;">#</th>
                  <th>Title</th>
                  <th style="width: 6rem;">Status</th>
                  <th style="width: 5rem;">Tokens</th>
                  <th style="width: 5rem;">Phase</th>
                </tr>
              </thead>
              <tbody>
                ${bycriticality[key as keyof typeof bycriticality]
                  .map(
                    (f) => `
                  <tr class="backlog-row" data-status="${f.status}" data-crit="${key}">
                    <td><span class="crit-dot crit-${key}"></span></td>
                    <td>#${f.number}</td>
                    <td>${f.title}</td>
                    <td><span class="status ${f.status}">${f.status.toUpperCase()}</span></td>
                    <td>${f.tokens ? "~" + f.tokens + "K" : "—"}</td>
                    <td>${f.phase}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          ` : ""}
        </div>
      `
      )
      .join("")}
  </div>

  <script>
    function switchTab(tabName) {
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));

      // Show selected tab
      document.getElementById(tabName).classList.add('active');
      event.target.classList.add('active');
    }

    function filterBacklog(filterType, value) {
      // Update button state
      event.target.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      // Filter rows
      const rows = document.querySelectorAll('.backlog-row');
      rows.forEach(row => {
        let show = true;

        if (filterType === 'status' && value !== 'all') {
          show = row.dataset.status === value;
        } else if (filterType === 'crit' && value !== 'all') {
          show = row.dataset.crit === value;
        }

        row.style.display = show ? 'table-row' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

// Main execution
const scorecard = parseScorecard(indexMd);
const sprints = parseSprints(sprintsMd);
const features = parseFeatures(featuresMd);
const stats = computeStats(sprints, scorecard);

const html = renderHTML(scorecard, sprints, features, stats);

const outputPath = resolve("docs/01-roadmap/roadmap-dashboard.html");
writeFileSync(outputPath, html);

console.log("✓ roadmap-dashboard.html generated");
