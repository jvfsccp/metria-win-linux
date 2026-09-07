import test from "node:test";
import assert from "node:assert/strict";
import { chooseSource, parseCodexAuth, parseOpenCodeGoWindows } from "../main/providers";
import { parseAntigravityWindows } from "../main/antigravity";
import type { ProviderSourceInfo } from "../shared/types";

function info(host: boolean, present: string[]): Pick<ProviderSourceInfo, "host" | "wsl"> {
  return {
    host,
    wsl: ["Ubuntu", "Debian"].map((distro) => ({ distro, present: present.includes(distro) }))
  };
}

test("chooseSource defaults to host when no preference", () => {
  assert.deepEqual(chooseSource(info(true, []), null), { location: "host" });
  assert.deepEqual(chooseSource(info(true, ["Ubuntu"]), null), { location: "host" });
});

test("chooseSource falls back to WSL when only WSL has data", () => {
  assert.deepEqual(chooseSource(info(false, ["Ubuntu"]), null), { location: "wsl", distro: "Ubuntu" });
});

test("chooseSource respects the saved choice", () => {
  assert.deepEqual(chooseSource(info(true, ["Ubuntu"]), { location: "wsl", distro: "Ubuntu" }), { location: "wsl", distro: "Ubuntu" });
  assert.deepEqual(chooseSource(info(true, ["Ubuntu"]), { location: "host" }), { location: "host" });
});

test("chooseSource falls back when the saved WSL distro no longer has data", () => {
  assert.deepEqual(chooseSource(info(true, ["Ubuntu"]), { location: "wsl", distro: "Debian" }), { location: "host" });
  assert.deepEqual(chooseSource(info(false, ["Ubuntu"]), { location: "wsl", distro: "Debian" }), { location: "wsl", distro: "Ubuntu" });
  assert.deepEqual(chooseSource(info(false, ["Ubuntu"]), { location: "host" }), { location: "wsl", distro: "Ubuntu" });
});

test("chooseSource returns null when no source has data", () => {
  assert.equal(chooseSource(info(false, []), null), null);
});

test("parseCodexAuth reads the current tokens format", () => {
  assert.deepEqual(parseCodexAuth(JSON.stringify({ tokens: { access_token: "access", account_id: "account" } })), { access: "access", accountId: "account" });
});

test("parseCodexAuth keeps supporting the legacy format", () => {
  assert.deepEqual(parseCodexAuth(JSON.stringify({ openai: { access: "access", accountId: "account" } })), { access: "access", accountId: "account" });
});

test("parseOpenCodeGoWindows reads the API reset date", () => {
  assert.deepEqual(parseOpenCodeGoWindows(JSON.stringify({ usage: { rolling: { percent: 12, resetsAt: "2026-09-01T12:00:00.000Z" } } })), [
    { title: "Current session", percent: 12, resetDate: "2026-09-01T12:00:00.000Z" }
  ]);
});

test("parseAntigravityWindows inverts remaining% to used% and fixes slot order regardless of line order", () => {
  const output = [
    "others\tWeekly\t70%\t2026-09-08T00:00:00Z",
    "gemini\t5-hour\t60%\t2026-09-06T20:00:00Z",
    "gemini\tWeekly\t90%\t2026-09-08T00:00:00Z",
    "others\tFive Hour\t20%\t2026-09-06T20:00:00Z"
  ].join("\n");
  assert.deepEqual(parseAntigravityWindows(output), [
    { title: "5-hour Gemini", percent: 40, resetDate: "2026-09-06T20:00:00.000Z" },
    { title: "Weekly Gemini", percent: 10, resetDate: "2026-09-08T00:00:00.000Z" },
    { title: "5-hour other models", percent: 80, resetDate: "2026-09-06T20:00:00.000Z" },
    { title: "Weekly other models", percent: 30, resetDate: "2026-09-08T00:00:00.000Z" }
  ]);
});

test("parseAntigravityWindows omits a missing window instead of inventing it", () => {
  const output = "gemini\t5-hour\t50%\t2026-09-06T20:00:00Z";
  assert.deepEqual(parseAntigravityWindows(output), [{ title: "5-hour Gemini", percent: 50, resetDate: "2026-09-06T20:00:00.000Z" }]);
});

test("parseAntigravityWindows skips malformed lines instead of throwing", () => {
  const output = ["not enough columns", "gemini\t5-hour\tNaN%\t2026-09-06T20:00:00Z", "gemini\t5-hour\t50%\t2026-09-06T20:00:00Z"].join("\n");
  assert.deepEqual(parseAntigravityWindows(output), [{ title: "5-hour Gemini", percent: 50, resetDate: "2026-09-06T20:00:00.000Z" }]);
});

test("parseAntigravityWindows keeps the first line seen for a slot", () => {
  const output = ["gemini\t5-hour\t50%\t2026-09-06T20:00:00Z", "gemini\t5-hour\t10%\t2026-09-06T21:00:00Z"].join("\n");
  assert.deepEqual(parseAntigravityWindows(output), [{ title: "5-hour Gemini", percent: 50, resetDate: "2026-09-06T20:00:00.000Z" }]);
});
