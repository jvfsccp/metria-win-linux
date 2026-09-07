import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { providerPaths } from "../main/provider-paths";

test("provider credential roots honor Windows, Linux XDG, and explicit Codex home", () => {
  const win = { platform: "win32", home: "C:\\Users\\Ada", env: { APPDATA: "C:\\Users\\Ada\\AppData\\Roaming" } } as const;
  const linux = { platform: "linux", home: "/home/ada", env: {} } as const;
  assert.equal(providerPaths(win).openCodeAuth, join("C:\\Users\\Ada\\AppData\\Roaming", "opencode", "auth.json"));
  assert.equal(providerPaths(linux).openCodeAuth, join("/home/ada", ".local", "share", "opencode", "auth.json"));
  assert.equal(providerPaths({ ...linux, env: { XDG_DATA_HOME: "/data" } }).openCodeAuth, join("/data", "opencode", "auth.json"));
  assert.equal(providerPaths({ ...linux, env: { CODEX_HOME: "/portable/codex" } }).codexSessions, join("/portable/codex", "sessions"));
  assert.equal(providerPaths(win).claudeCredentials, join("C:\\Users\\Ada", ".claude", ".credentials.json"));
  assert.equal(providerPaths(linux).claudeCredentials, join("/home/ada", ".claude", ".credentials.json"));
});

test("antigravity binary path uses LOCALAPPDATA on Windows and ~/.local/bin elsewhere", () => {
  const win = { platform: "win32", home: "C:\\Users\\Ada", env: { LOCALAPPDATA: "C:\\Users\\Ada\\AppData\\Local" } } as const;
  const winNoEnv = { platform: "win32", home: "C:\\Users\\Ada", env: {} } as const;
  const linux = { platform: "linux", home: "/home/ada", env: {} } as const;
  assert.equal(providerPaths(win).antigravityBinary, join("C:\\Users\\Ada\\AppData\\Local", "agy", "bin", "agy.exe"));
  assert.equal(providerPaths(winNoEnv).antigravityBinary, join("C:\\Users\\Ada", "AppData", "Local", "agy", "bin", "agy.exe"));
  assert.equal(providerPaths(linux).antigravityBinary, join("/home/ada", ".local", "bin", "agy"));
});
