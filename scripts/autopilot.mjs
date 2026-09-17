#!/usr/bin/env node
/**
 * Instagram Factory OS — autopilot.
 *
 * Keeps one production server running on :3780 and drives it on a schedule, so
 * the factory runs without anyone watching it:
 *
 *   • publish tick      every 15 minutes  (due schedule entries → Graph API)
 *   • generation batch  daily at 07:00 local, one post per brand
 *   • learning analysis Sundays 06:30 UTC (skipped when this week already ran)
 *
 * State lives wherever the configured storage driver points: Upstash Redis when
 * `STORAGE_DRIVER=redis` (which is what makes this machine and a Vercel
 * deployment share one queue), local `data/*.json` otherwise. Nothing here is
 * specific to either.
 *
 * Logs: logs/autopilot.log (the launchd agent also captures stdout/stderr).
 * The HTTP server is `next start`, which is what `npm run build` produced;
 * the build is expected to be current (launchd runs `autopilot prestart`).
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import { ROOT, loadEnv, secretHeaders } from "./load-env.mjs";

const PORT = 3780;
const BASE = `http://127.0.0.1:${PORT}`;
const GENERATION_HOUR_LOCAL = 7; // daily batch
const LEARNING_DAY_UTC = 0; // Sunday
const LEARNING_HOUR_UTC = 6;
const TICK_INTERVAL_MS = 15 * 60 * 1000;

const log = (...parts) =>
  console.log(`[autopilot ${new Date().toISOString()}]`, ...parts);

/* -------------------------------------------------------------------------- */
/*  Server supervision                                                        */
/* -------------------------------------------------------------------------- */

let serverProcess = null;

function startServer() {
  if (serverProcess) return;
  log(`starting next start on :${PORT}`);
  serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: false,
    env: process.env,
  });
  serverProcess.on("exit", (code) => {
    log(`server exited (code ${code}) — will restart on next probe`);
    serverProcess = null;
  });
}

async function serverUp() {
  try {
    const res = await fetch(`${BASE}/api/health`, {
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverUp()) return true;
  startServer();
  // Give a cold `next start` a chance to come up before the first drive call.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(2500);
    if (await serverUp()) return true;
  }
  log("server did not become healthy in 30s — skipping this cycle");
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Drive calls (same endpoints the dashboard buttons use)                     */
/* -------------------------------------------------------------------------- */

async function callApi(pathname, init = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      // Read at call time: the .env loader runs inside main(), so a value
      // captured at module load would be empty and every tick would 401.
      ...secretHeaders(),
      ...init.headers,
    },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${pathname} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** One publish tick. Returns the summary the endpoint reports. */
async function publishTick() {
  const result = await callApi("/api/schedule/process", { method: "POST" });
  log("publish tick:", JSON.stringify(result).slice(0, 300));
}

/** Generates one post per brand. Returns created post ids. */
async function generateBatch() {
  const brands = ["midnight-ritual", "studio-noir", "daily-grind"];
  const created = [];

  for (const brandId of brands) {
    try {
      const { job } = await callApi("/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({ brandId }),
      });
      const postId = await pollJob(job.id);
      if (postId) {
        created.push(postId);
        log(`generated ${postId} for ${brandId}`);
      }
    } catch (error) {
      log(`generation failed for ${brandId}:`, error.message);
    }
  }
  return created;
}

async function pollJob(jobId, timeoutMs = 10 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(10_000);
    try {
      const { job } = await callApi(`/api/ai/generate/${jobId}`);
      if (job.status === "succeeded" && job.postId) return job.postId;
      if (job.status === "failed") {
        log(`job ${jobId} failed:`, String(job.error ?? "").slice(0, 200));
        return null;
      }
    } catch {
      // transient — keep polling until the deadline
    }
  }
  log(`job ${jobId} timed out`);
  return null;
}

/** Weekly learning analysis; runs once per ISO week, on/after Sunday 06:30 UTC. */
async function maybeRunLearning(state) {
  const now = new Date();
  if (now.getUTCDay() !== LEARNING_DAY_UTC || now.getUTCHours() < LEARNING_HOUR_UTC) {
    return;
  }
  // ISO week key so a machine asleep at the exact hour still catches up, and a
  // wake-up within the same hour does not re-run the analysis.
  const weekKey = isoWeekKey(now);
  if (state.lastLearningWeek === weekKey) return;

  const result = await callApi("/api/learning/run", { method: "POST" });
  state.lastLearningWeek = weekKey;
  await writeState(state);
  log("learning run:", JSON.stringify(result).slice(0, 300));
}

/* -------------------------------------------------------------------------- */
/*  Schedule bookkeeping                                                      */
/* -------------------------------------------------------------------------- */

const STATE_FILE = path.join(ROOT, "logs", "autopilot-state.json");

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

const todayKey = () => new Date().toISOString().slice(0, 10);

/** ISO-8601 week key (e.g. 2026-W38) — the dedupe unit for the weekly run. */
function isoWeekKey(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (process.argv[2] === "prestart") {
    // Called by launchd before the loop: fail loudly if the build is stale.
    try {
      await fs.access(path.join(ROOT, ".next", "BUILD_ID"));
      console.log("[autopilot] build present");
    } catch {
      console.error("[autopilot] no build found — run `npm run build` first");
      process.exit(1);
    }
    return;
  }

  await loadEnv();
  if (!process.env.SCHEDULER_SECRET) {
    console.error("[autopilot] SCHEDULER_SECRET missing from .env — ticks would be unauthenticated");
    process.exit(1);
  }

  log(`autopilot starting (port ${PORT}, generation ${String(GENERATION_HOUR_LOCAL).padStart(2, "0")}:00 local)`);

  let lastTick = 0;
  const state = await readState();

  for (;;) {
    const up = await ensureServer();
    if (up) {
      const now = Date.now();

      // Publish tick every 15 minutes.
      if (now - lastTick >= TICK_INTERVAL_MS) {
        lastTick = now;
        try {
          await publishTick();
        } catch (error) {
          log("publish tick error:", error.message);
        }
      }

      // Daily generation batch at GENERATION_HOUR_LOCAL local time.
      const today = todayKey();
      const hour = new Date().getHours();
      if (state.lastGenerationDay !== today && hour >= GENERATION_HOUR_LOCAL) {
        state.lastGenerationDay = today;
        await writeState(state);
        try {
          const created = await generateBatch();
          log("daily batch complete:", created.join(", ") || "(nothing generated)");
        } catch (error) {
          log("daily batch error:", error.message);
        }
      }

      // Weekly learning analysis, once per ISO week on/after Sunday 06:30 UTC.
      try {
        await maybeRunLearning(state);
      } catch (error) {
        log("learning run error:", error.message);
      }
    }

    await sleep(60_000);
  }
}

main().catch((error) => {
  console.error("[autopilot] fatal:", error);
  process.exit(1);
});
