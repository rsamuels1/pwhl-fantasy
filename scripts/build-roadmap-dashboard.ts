import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Types
interface ScorecardRow {
  area: string;
  status: "pass" | "risk" | "pass-with-risks";
  blocker: string;
}

interface BuildQueueItem {
  category: "quick" | "standard" | "heavy";
  number: number;
  title: string;
  tokens: number;
  description: string;
}

interface Feature {
  number: number;
  title: string;
  status: "done" | "partial" | "todo" | "risk";
  priority?: string;
  tokens?: number;
  description: string;
}

interface Phase {
  number: number;
  name: string;
  priority: string;
  features: Feature[];
}

interface Sprint {
  number: number;
  name: string;
  status: "complete" | "current" | "planned";
  track?: string;
  tasks: string[];
  exitCriteria?: string;
}

interface Milestone {
  date: string;
  event: string;
  completed: boolean;
}

interface Stats {
  readinessPct: number;
  gatesCount: number;
  shippedCount: number;
  currentSprint: string;
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
  const lines = tableContent.split("\n").slice(1); // Skip header separator
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

function parseCurrentState(md: string): string[] {
  const items: string[] = [];
  const stateSection = md.match(
    /## Current State\n\n([\s\S]*?)(?:\n\n---|\n\n##)/
  );
  if (!stateSection) return items;

  const lines = stateSection[1].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      items.push(trimmed.slice(2));
    }
  }
  return items;
}

function parseBuildQueue(md: string): BuildQueueItem[] {
  const items: BuildQueueItem[] = [];
  const queueSection = md.match(
    /## What To Build Next([\s\S]*?)(?:\n\n---|\n\n##|## See Also)/
  );
  if (!queueSection) return items;

  let category: "quick" | "standard" | "heavy" = "quick";
  const lines = queueSection[1].split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("Quick wins")) category = "quick";
    if (line.includes("Standard sessions")) category = "standard";
    if (line.includes("Heavy lifts")) category = "heavy";

    const match = line.match(/^\d+\.\s+\*\*(.+?)\s+\(#(\d+)\)\*\*\s+·\s+~?([\d]+)K/);
    if (match) {
      const [, title, number, tokens] = match;
      const description = lines[i + 1]?.trim() || "";

      items.push({
        category,
        number: parseInt(number),
        title,
        tokens: parseInt(tokens),
        description: description.split(" ").slice(0, 15).join(" ") + "...",
      });
    }
  }

  return items;
}

function parsePhases(md: string): Phase[] {
  const phases: Phase[] = [];
  const phaseBlocks = md.split(/^# Phase /m).slice(1);

  for (const block of phaseBlocks) {
    const lines = block.split("\n");
    const headerLine = lines[0];
    const match = headerLine.match(/(\d+):\s+(.+?)(?:\n|$)/);
    if (!match) continue;

    const [, numStr, name] = match;
    const phaseNum = parseInt(numStr);
    const priorityMatch = block.match(/Priority:\s*(.+?)(?:\n|$)/);
    const priority = priorityMatch ? priorityMatch[1].trim() : "MEDIUM";

    const features: Feature[] = [];
    const featureMatches = block.matchAll(/^## (\d+)\.?\s+(.+?)(?:\n|$)/gm);

    for (const fm of featureMatches) {
      const [fullMatch, numStr, titleWithStatus] = fm;
      const featureNum = parseInt(numStr);
      const titleMatch = titleWithStatus.match(/^([^·]+?)(?:\s*·)?\s*(.*)$/);
      if (!titleMatch) continue;

      const [, title, rest] = titleMatch;
      const featureStartIdx = block.indexOf(fullMatch);
      const nextFeatureIdx = block.indexOf("\n## ", featureStartIdx + 1);
      const featureBlock = block.slice(
        featureStartIdx,
        nextFeatureIdx > 0 ? nextFeatureIdx : undefined
      );

      // Parse status
      let status: "done" | "partial" | "todo" | "risk" = "todo";
      if (/✅\s*(DONE|COMPLETE|Implemented|PASS)/.test(featureBlock))
        status = "done";
      else if (/Partially|Largely|Partial/.test(featureBlock))
        status = "partial";
      else if (/Not Implemented|Needed|Desired/.test(featureBlock))
        status = "todo";

      // Parse tokens
      const tokensMatch = featureBlock.match(/Estimated tokens:\s*~?([\d]+)K/);
      const tokens = tokensMatch ? parseInt(tokensMatch[1]) : undefined;

      // Get description (first paragraph)
      const descMatch = featureBlock.match(
        /Status:[\s\S]*?\n\n([\s\S]*?)(?:\n\n|Acceptance Criteria|$)/
      );
      const description = descMatch
        ? descMatch[1]
            .trim()
            .split("\n")[0]
            .slice(0, 150)
            .replace(/\[.+?\]\(.+?\)/g, "")
            .trim()
        : "";

      features.push({
        number: featureNum,
        title: title.trim(),
        status,
        tokens,
        description,
      });
    }

    phases.push({
      number: phaseNum,
      name: name.trim(),
      priority,
      features,
    });
  }

  return phases;
}

function parseSprints(md: string): Sprint[] {
  const sprints: Sprint[] = [];
  const sprintMatches = md.matchAll(
    /^## Sprint (\d+)\s*—\s*"([^"]+)"\s*·\s*(✅\s*COMPLETE|←\s*CURRENT|⏳\s*PLANNED)(?:\s*·\s*(.+?))?$/gm
  );

  for (const match of sprintMatches) {
    const [fullMatch, numStr, name, statusText, track] = match;
    const number = parseInt(numStr);

    let status: "complete" | "current" | "planned" = "planned";
    if (statusText.includes("✅")) status = "complete";
    if (statusText.includes("←")) status = "current";

    const sprintStartIdx = md.indexOf(fullMatch);
    const nextSprintIdx = md.indexOf("\n## Sprint", sprintStartIdx + 1);
    const sprintBlock = md.slice(
      sprintStartIdx,
      nextSprintIdx > 0 ? nextSprintIdx : undefined
    );

    const tasks: string[] = [];
    const taskLines = sprintBlock
      .split("\n")
      .filter((l) => l.match(/^-\s+\*\*?[A-Z]/));
    for (const line of taskLines) {
      const cleaned = line
        .replace(/^-\s+/, "")
        .replace(/\*\*([^*]+)\*\*:?/g, "$1")
        .trim();
      if (cleaned) tasks.push(cleaned);
    }

    sprints.push({
      number,
      name: name.trim(),
      status,
      track: track?.trim(),
      tasks: tasks.slice(0, 3), // Limit to 3 tasks for display
    });
  }

  return sprints;
}

function parseTimeline(md: string): Milestone[] {
  const milestones: Milestone[] = [];
  const timelineSection = md.match(
    /## MVP Launch Timeline & Beyond[\s\S]*?\| Window \| Milestone \|([\s\S]*?)(?:\n\n|##)/
  );
  if (!timelineSection) return milestones;

  const lines = timelineSection[1].split("\n");
  for (const line of lines) {
    const match = line.match(
      /\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/
    );
    if (!match) continue;

    const [, dateStr, event] = match;
    const completed = /✅|COMPLETE|LIVE|SHIPPED/.test(event);

    milestones.push({
      date: dateStr.trim(),
      event: event.trim(),
      completed,
    });
  }

  return milestones;
}

function computeStats(phases: Phase[], scorecard: ScorecardRow[]): Stats {
  const passCount = scorecard.filter((s) => s.status.includes("pass")).length;
  const readinessPct = Math.round((passCount / scorecard.length) * 100);

  const gatesCount = scorecard.filter((s) =>
    s.area.includes("Launch gates")
  ).length;
  const shippedCount = phases.reduce(
    (sum, p) => sum + p.features.filter((f) => f.status === "done").length,
    0
  );

  return {
    readinessPct,
    gatesCount: scorecard.length,
    shippedCount,
    currentSprint: "Sprint 4",
  };
}

// HTML Rendering
function renderHTML(
  scorecard: ScorecardRow[],
  currentState: string[],
  buildQueue: BuildQueueItem[],
  phases: Phase[],
  sprints: Sprint[],
  timeline: Milestone[],
  stats: Stats
): string {
  const now = new Date().toLocaleDateString();

  return `<!DOCTYPE html>
<html lang="en" class="bg-slate-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PWHL Fantasy Roadmap</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            pwhl: {
              purple: '#4c1d95',
              accent: '#2dd4bf',
              dark: '#020617',
            }
          }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lucide@latest"></script>
  <style>
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #0f172a;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 3px;
    }
    .status-done { @apply bg-emerald-500/10 text-emerald-400 border-emerald-500/20; }
    .status-partial { @apply bg-amber-500/10 text-amber-400 border-amber-500/20; }
    .status-todo { @apply bg-slate-500/10 text-slate-400 border-slate-500/20; }
    .status-risk { @apply bg-rose-500/10 text-rose-400 border-rose-500/20; }
    .gradient-text {
      background: linear-gradient(135deg, #2dd4bf 0%, #4c1d95 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ping-circle {
      animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    @keyframes ping {
      75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }
  </style>
</head>
<body class="text-slate-100 bg-slate-950 custom-scrollbar">
  <!-- Header -->
  <header class="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-slate-800 p-6">
    <div class="max-w-7xl mx-auto flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-black gradient-text">PWHL Fantasy</h1>
        <p class="text-sm text-slate-400">Product Roadmap</p>
      </div>
      <div class="text-right">
        <div class="text-2xl font-mono font-bold text-pwhl-accent" id="countdown">
          Loading...
        </div>
        <p class="text-xs text-slate-500">until public launch</p>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto p-6 space-y-8">
    <!-- KPI Row -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-mono text-slate-400">Launch Confidence</h3>
          <div class="w-12 h-12 relative">
            <canvas id="readinessChart" width="48" height="48"></canvas>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="font-mono text-xs font-bold text-pwhl-accent">${stats.readinessPct}%</span>
            </div>
          </div>
        </div>
        <p class="text-xs text-slate-500">areas PASS</p>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p class="text-4xl font-mono font-bold text-pwhl-accent">${stats.gatesCount}</p>
        <p class="text-xs text-slate-500 mt-2">launch gates</p>
        <div class="w-full bg-slate-800 h-1.5 rounded-full mt-3"></div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p class="text-4xl font-mono font-bold text-emerald-400">${stats.shippedCount}</p>
        <p class="text-xs text-slate-500 mt-2">features shipped</p>
        <div class="w-full bg-slate-800 h-1.5 rounded-full mt-3"></div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p class="text-sm font-mono text-pwhl-accent font-bold">${stats.currentSprint}</p>
        <p class="text-xs text-slate-500 mt-2">IN FLIGHT</p>
        <div class="flex gap-1 mt-3">
          <div class="w-2 h-2 bg-pwhl-accent rounded-full ping-circle"></div>
          <div class="w-2 h-2 bg-slate-700 rounded-full"></div>
        </div>
      </div>
    </div>

    <!-- MVP Readiness Scorecard -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 class="text-lg font-mono font-bold mb-4">MVP Readiness Scorecard</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-800">
              <th class="text-left py-2 px-2 text-slate-400 font-mono">Area</th>
              <th class="text-left py-2 px-2 text-slate-400 font-mono">Status</th>
              <th class="text-left py-2 px-2 text-slate-400 font-mono">Blocker</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            ${scorecard
              .map(
                (row) => `
              <tr class="hover:bg-slate-800/50">
                <td class="py-3 px-2">${row.area}</td>
                <td class="py-3 px-2">
                  <span class="px-2 py-1 rounded-full text-xs font-mono border status-${row.status.split("-")[0]}">
                    ${row.status === "pass" ? "✅ PASS" : row.status === "pass-with-risks" ? "⚠️ PASS WITH RISKS" : "FAIL"}
                  </span>
                </td>
                <td class="py-3 px-2 text-slate-400">${row.blocker}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Current State (Shipped) -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 class="text-lg font-mono font-bold mb-4">✅ Shipped Platform Capabilities</h2>
      <div class="flex flex-wrap gap-2">
        ${currentState
          .map(
            (item) =>
              `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1 text-xs font-mono">${item.split(" ·")[0]}</span>`
          )
          .join("")}
      </div>
    </div>

    <!-- What To Build Next (Token Planner) -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 class="text-lg font-mono font-bold mb-4">⚡ Session Planner (Tokens)</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-3">
          ${buildQueue
            .map(
              (item) => `
            <label class="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 cursor-pointer group">
              <input type="checkbox" class="token-item mt-1" data-tokens="${item.tokens}" value="${item.number}" />
              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm font-bold">#${item.number} ${item.title}</div>
                <div class="text-xs text-slate-400">~${item.tokens}K tokens</div>
              </div>
            </label>
          `
            )
            .join("")}
        </div>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-slate-400 font-mono">Total Session Cost</label>
            <div class="text-4xl font-mono font-bold text-pwhl-accent" id="tokenSum">15K</div>
            <div class="text-xs text-slate-500">base (CLAUDE.md + overhead)</div>
          </div>
          <div>
            <label class="text-xs text-slate-400 font-mono">Status</label>
            <div class="flex gap-2 mt-2">
              <div class="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div id="tokenBar" class="h-full bg-indigo-500 transition-all duration-300" style="width: 0%"></div>
              </div>
            </div>
            <div id="tokenBadge" class="mt-2 inline-block px-2 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Optimal</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Phases -->
    ${phases
      .map(
        (phase) => `
      <div id="phase-${phase.number}">
        <div class="flex items-center gap-3 mb-4">
          <h2 class="text-xl font-mono font-bold">Phase ${phase.number}: ${phase.name}</h2>
          <span class="px-2 py-1 rounded text-xs font-mono font-bold ${phase.priority === "CRITICAL" ? "bg-rose-500/10 text-rose-400" : phase.priority === "HIGH" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"}">${phase.priority}</span>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          ${phase.features
            .map(
              (feat) => `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div class="flex items-start justify-between mb-3">
                <h3 class="font-mono font-bold text-sm">#${feat.number} ${feat.title}</h3>
                <span class="px-2 py-1 rounded text-xs font-mono border status-${feat.status}">
                  ${feat.status === "done" ? "✅ DONE" : feat.status === "partial" ? "⚠️ PARTIAL" : feat.status === "todo" ? "TODO" : "RISK"}
                </span>
              </div>
              ${feat.tokens ? `<div class="text-xs text-slate-400 mb-2">~${feat.tokens}K tokens</div>` : ""}
              <p class="text-sm text-slate-300">${feat.description}</p>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("")}

    <!-- Sprint Timeline -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 class="text-lg font-mono font-bold mb-6">Sprint Timeline</h2>
      <div class="space-y-4">
        ${sprints
          .map(
            (sprint, idx) => `
          <div class="flex gap-4">
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 rounded-full flex items-center justify-center border-2 ${sprint.status === "complete" ? "border-pwhl-accent bg-pwhl-accent/10" : sprint.status === "current" ? "border-pwhl-accent bg-pwhl-accent/20 ping-circle" : "border-slate-700 bg-slate-800"} relative">
                ${sprint.status === "complete" ? '✓' : sprint.status === "current" ? "●" : "○"}
              </div>
              ${idx < sprints.length - 1 ? '<div class="w-0.5 h-12 bg-slate-800"></div>' : ""}
            </div>
            <div class="flex-1 py-1">
              <div class="font-mono font-bold">Sprint ${sprint.number} — ${sprint.name}</div>
              <div class="text-xs text-slate-400 mt-1">
                ${sprint.status === "complete" ? "✅ COMPLETE" : sprint.status === "current" ? "← CURRENT" : "⏳ PLANNED"}
              </div>
              ${sprint.tasks.length > 0 ? `<div class="text-xs text-slate-400 mt-2">Tasks: ${sprint.tasks.slice(0, 2).join(", ")}</div>` : ""}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>

    <!-- Timeline -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 class="text-lg font-mono font-bold mb-4">MVP Launch Timeline</h2>
      <div class="space-y-2">
        ${timeline
          .map(
            (m) => `
          <div class="flex items-center gap-3 py-2 px-3 rounded-lg ${m.completed ? "bg-emerald-500/10" : ""}">
            <div class="w-6 text-center">
              ${m.completed ? '<span class="text-pwhl-accent">✓</span>' : '<span class="text-slate-500">→</span>'}
            </div>
            <div class="flex-1">
              <span class="font-mono text-sm font-bold">${m.date}</span>
              <span class="text-xs text-slate-400 ml-3">${m.event}</span>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800 mt-12 py-6 text-center text-xs text-slate-500">
    <p>Generated: ${now} · Run <code class="bg-slate-800 px-2 py-1 rounded">npm run build-roadmap</code> to regenerate</p>
  </footer>

  <script>
    // Countdown timer
    function updateCountdown() {
      const target = new Date('2026-10-24').getTime();
      const now = new Date().getTime();
      const diff = target - now;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      document.getElementById('countdown').textContent = \`\${days}D : \${hours}H : \${mins}M\`;
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);

    // Readiness chart
    const ctx = document.getElementById('readinessChart')?.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [${stats.readinessPct}, 100 - ${stats.readinessPct}],
            backgroundColor: ['#2dd4bf', '#0f172a'],
            borderColor: ['#2dd4bf', '#0f172a'],
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '80%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });
    }

    // Token planner
    const items = document.querySelectorAll('.token-item');
    items.forEach(item => {
      item.addEventListener('change', updateTokens);
    });

    function updateTokens() {
      let total = 15000; // base
      items.forEach(item => {
        if (item.checked) total += parseInt(item.dataset.tokens) * 1000;
      });

      const display = total >= 1000000 ? (total / 1000000).toFixed(1) + 'M' : (total / 1000).toFixed(0) + 'K';
      document.getElementById('tokenSum').textContent = display;

      const pct = Math.min(100, (total / 200000) * 100);
      document.getElementById('tokenBar').style.width = pct + '%';

      let badge, badgeClass;
      if (total <= 120000) {
        badge = '✓ Optimal';
        badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      } else if (total <= 180000) {
        badge = '⚠ Caution';
        badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      } else {
        badge = '✗ Exceeds window';
        badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      }

      const badgeEl = document.getElementById('tokenBadge');
      badgeEl.textContent = badge;
      badgeEl.className = \`mt-2 inline-block px-2 py-1 rounded-full text-xs font-mono border \${badgeClass}\`;
    }

    // Lucide icons
    lucide.createIcons();
  </script>
</body>
</html>`;
}

// Main execution
const scorecard = parseScorecard(indexMd);
const currentState = parseCurrentState(indexMd);
const buildQueue = parseBuildQueue(indexMd);
const phases = parsePhases(featuresMd);
const sprints = parseSprints(sprintsMd);
const timeline = parseTimeline(sprintsMd);
const stats = computeStats(phases, scorecard);

const html = renderHTML(
  scorecard,
  currentState,
  buildQueue,
  phases,
  sprints,
  timeline,
  stats
);

const outputPath = resolve("docs/01-roadmap/roadmap-dashboard.html");
writeFileSync(outputPath, html);

console.log("✓ roadmap-dashboard.html generated");
