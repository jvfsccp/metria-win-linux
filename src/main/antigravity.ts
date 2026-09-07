import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { UsageWindow } from "../shared/types";

/**
 * Antigravity has no credential file to read: usage comes from shelling out to
 * the vendor's own `agy` CLI (already authenticated via its own keyring/OAuth)
 * and parsing its `/usage` output. Google does not publish this scripting path
 * or its output format, so this mirrors the reverse-engineered contract that
 * already ships in the macOS-native sibling app.
 */

// A signed-out CLI hangs with no output rather than erroring immediately.
const ANTIGRAVITY_HOST_TIMEOUT_MS = 30_000;

/** Documented install path first, then a PATH scan — resolved per fetch so installs/removals need no restart. */
export function resolveHostBinary(documentedPath: string, pathEnv: string | undefined, platform: NodeJS.Platform): string | undefined {
  if (existsSync(documentedPath)) return documentedPath;
  const exeName = platform === "win32" ? "agy.exe" : "agy";
  const separator = platform === "win32" ? ";" : ":";
  for (const dir of (pathEnv ?? "").split(separator).filter(Boolean)) {
    const candidate = join(dir, exeName);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function runUsage(executablePath: string, timeoutMs = ANTIGRAVITY_HOST_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, ["-p", "/usage"], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const stdout: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Antigravity CLI timed out.")); }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const output = Buffer.concat(stdout).toString("utf8");
      if (code === 0 && output.trim()) resolve(output);
      else reject(new Error(`agy exited with code ${code ?? "unknown"}.`));
    });
  });
}

/** Resolves `agy` the same way as the host (PATH, then the documented install dir) before running it inside the distro. */
export const ANTIGRAVITY_WSL_SCRIPT = [
  'agy_bin=$(command -v agy 2>/dev/null || { [ -x "$HOME/.local/bin/agy" ] && echo "$HOME/.local/bin/agy"; })',
  'if [ -z "$agy_bin" ]; then exit 1; fi',
  '"$agy_bin" -p "/usage"'
].join("\n");

type Family = "gemini" | "others";
type Horizon = "fiveHour" | "weekly";
type Slot = `${Family}:${Horizon}`;

const SLOT_TITLES: Record<Slot, string> = {
  "gemini:fiveHour": "5-hour Gemini",
  "gemini:weekly": "Weekly Gemini",
  "others:fiveHour": "5-hour other models",
  "others:weekly": "Weekly other models"
};
const SLOT_ORDER: Slot[] = ["gemini:fiveHour", "gemini:weekly", "others:fiveHour", "others:weekly"];

/**
 * Parses `<group>\t<window>\t<NN>%\t<ISO8601>` lines. Matching is by keyword,
 * so minor vendor label edits degrade to fewer windows rather than zero, and a
 * missing slot is omitted — never invented. The percent column is the CLI's
 * *remaining* capacity, inverted here to the *used* percent Metria displays
 * everywhere else. The first line seen for a slot wins; later duplicates are
 * ignored, matching the shipped macOS parser this ports.
 */
export function parseAntigravityWindows(output: string): UsageWindow[] {
  const slots = new Map<Slot, UsageWindow>();
  for (const rawLine of output.split("\n")) {
    const parts = rawLine.split("\t").map((part) => part.trim());
    if (parts.length < 4) continue;
    const family: Family = parts[0].toLowerCase().includes("gemini") ? "gemini" : "others";
    const windowText = parts[1].toLowerCase();
    const horizon: Horizon | undefined = windowText.includes("five hour") || windowText.includes("5-hour") || windowText.includes("5 hour")
      ? "fiveHour"
      : windowText.includes("week") ? "weekly" : undefined;
    if (!horizon) continue;
    const remaining = parsePercent(parts[2]);
    if (remaining === undefined) continue;
    const slot: Slot = `${family}:${horizon}`;
    if (slots.has(slot)) continue;
    const percent = Math.min(100, Math.max(0, 100 - remaining));
    slots.set(slot, { title: SLOT_TITLES[slot], percent, resetDate: parseResetDate(parts[3]) });
  }
  return SLOT_ORDER.flatMap((slot) => { const window = slots.get(slot); return window ? [window] : []; });
}

function parsePercent(raw: string): number | undefined {
  const value = Number(raw.replace("%", ""));
  return Number.isFinite(value) ? value : undefined;
}

function parseResetDate(raw: string): string | null {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
