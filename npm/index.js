#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const RUNNER = path.join(__dirname, "update_check_runner.js");
const {
  maybePrintCachedNotice,
  spawnUpdateCheckRunner,
} = require("./update_check");

const exe = process.platform === "win32" ? "configmesh.exe" : "configmesh";
const binPath = path.join(__dirname, exe);

const PKG = (() => {
  try {
    return require("./package.json");
  } catch {
    return null;
  }
})();

if (!fs.existsSync(binPath)) {
  console.error(`Binary not found: ${binPath}. Attempting to download...`);
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "postinstall.js")],
    { stdio: "inherit" },
  );
  if (result.status !== 0 || !fs.existsSync(binPath)) {
    console.error("Failed to download binary.");
    process.exit(1);
  }
}

if (process.platform !== "win32") {
  try {
    fs.chmodSync(binPath, 0o755);
  } catch {}
}

const child = spawn(binPath, process.argv.slice(2), {
  stdio: "inherit",
  windowsHide: true,
});

// Best-effort update notice.
try {
  maybePrintCachedNotice({ installedVersion: PKG && PKG.version });
  spawnUpdateCheckRunner();
} catch {}

child.on("exit", (code) => {
  process.exitCode = code == null ? 1 : code;
});
child.on("error", (err) => {
  console.error(err.message);
  process.exitCode = 1;
});
