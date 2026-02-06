const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const semver = require('semver');

const DEFAULT_PACKAGE_NAME = 'configmesh';
const DEFAULT_UPDATE_COMMAND = 'npm install -g configmesh';

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_CHECK_TIMEOUT_MS = 1200;

const RUNNER_FILE = 'update_check_runner.js';

function isDisabled() {
  return (
    process.env.CONFIGMESH_NO_UPDATE_NOTICE === '1' ||
    process.env.CONFIGMESH_NO_UPDATE_NOTICE === 'true' ||
    process.env.NO_UPDATE_NOTIFIER === '1' ||
    process.env.NO_UPDATE_NOTIFIER === 'true' ||
    process.env.CI === '1' ||
    process.env.CI === 'true' ||
    process.env.CI === 'yes'
  );
}

function shouldPrintNotice() {
  if (isDisabled()) return false;
  if (!process.stderr.isTTY) return false;
  return true;
}

function getCacheFile() {
  const home = os.homedir();
  if (!home) return null;

  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA;
    if (!base) return path.join(home, 'AppData', 'Local', DEFAULT_PACKAGE_NAME, 'update.json');
    return path.join(base, DEFAULT_PACKAGE_NAME, 'update.json');
  }

  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', DEFAULT_PACKAGE_NAME, 'update.json');
  }

  const base = process.env.XDG_CACHE_HOME || path.join(home, '.cache');
  return path.join(base, DEFAULT_PACKAGE_NAME, 'update.json');
}

function readCache() {
  const file = getCacheFile();
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(data) {
  const file = getCacheFile();
  if (!file) return;
  const tmp = file + '.tmp.' + process.pid + '.' + Date.now();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function fetchLatestVersion(packageName, timeoutMs, signal) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': `${DEFAULT_PACKAGE_NAME}-update-check` } },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} -> ${res.statusCode}`));
          res.resume();
          return;
        }

        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(typeof json.version === 'string' ? json.version : '');
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));

    if (signal) {
      if (signal.aborted) {
        req.destroy(new Error('aborted'));
        return;
      }
      signal.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
    }
  });
}

function normalizeVersion(version) {
  if (!version) return '';
  const cleaned = semver.clean(version);
  if (cleaned) return cleaned;
  const coerced = semver.coerce(version);
  return coerced ? semver.valid(coerced) || '' : '';
}

function printNotice({ packageName, installed, latest, updateCommand }) {
  const prefix = `${packageName}:`;
  if (installed && latest) {
    console.error(
      `${prefix} an update is available (installed ${installed}, latest ${latest}). Update with: ${updateCommand}`
    );
    return;
  }
  console.error(`${prefix} an update is available. Update with: ${updateCommand}`);
}

function getCachedUpdate({ installedVersion, now = Date.now() }) {
  const installed = normalizeVersion(installedVersion);
  if (!installed) return null;

  const cache = readCache() || {};
  const cachedLatest = typeof cache.latest === 'string' ? cache.latest : '';
  const latest = normalizeVersion(cachedLatest);
  if (!latest) return null;

  if (!semver.gt(latest, installed)) return null;

  const lastNotified = Number.isFinite(cache.lastNotified) ? cache.lastNotified : 0;
  const canNotify = !lastNotified || (now - lastNotified) >= UPDATE_CHECK_INTERVAL_MS;
  return {
    latest,
    installed,
    canNotify,
    cache,
  };
}

function maybePrintCachedNotice({
  packageName = DEFAULT_PACKAGE_NAME,
  installedVersion,
  updateCommand = DEFAULT_UPDATE_COMMAND,
} = {}) {
  if (!shouldPrintNotice()) return false;

  const now = Date.now();
  const cached = getCachedUpdate({ installedVersion, now });
  if (!cached || !cached.canNotify) return false;

  printNotice({ packageName, installed: cached.installed, latest: cached.latest, updateCommand });
  writeCache({ ...cached.cache, lastNotified: now });
  return true;
}

async function refreshCache({ packageName = DEFAULT_PACKAGE_NAME, signal } = {}) {
  if (isDisabled()) return;

  const cache = readCache() || {};
  const lastChecked = Number.isFinite(cache.lastChecked) ? cache.lastChecked : 0;
  const now = Date.now();
  if (lastChecked && (now - lastChecked) < UPDATE_CHECK_INTERVAL_MS) return;

  const latestRaw = await fetchLatestVersion(packageName, UPDATE_CHECK_TIMEOUT_MS, signal);
  const latest = normalizeVersion(latestRaw);

  writeCache({
    ...cache,
    lastChecked: now,
    latest: latest || latestRaw,
  });
}

function needsCacheRefresh({ packageName = DEFAULT_PACKAGE_NAME, now = Date.now() } = {}) {
  if (isDisabled()) return false;
  // Only refresh when we're past the check interval.
  const cache = readCache() || {};
  const lastChecked = Number.isFinite(cache.lastChecked) ? cache.lastChecked : 0;
  if (!lastChecked) return true;
  return (now - lastChecked) >= UPDATE_CHECK_INTERVAL_MS;
}

function spawnUpdateCheckRunner() {
  if (isDisabled()) return;
  if (!needsCacheRefresh()) return;
  
  try {
    const runnerPath = path.join(__dirname, RUNNER_FILE);
    const child = spawn(
      process.execPath,
      [runnerPath],
      { stdio: 'ignore', detached: true, windowsHide: true }
    );
    child.unref();
  } catch (e) {
    // ignore errors starting the update check
  }
}

module.exports = {
  maybePrintCachedNotice,
  refreshCache,
  spawnUpdateCheckRunner,
};