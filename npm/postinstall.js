#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const OWNER = 'dvcrn';
const REPO = 'configmesh-cli';
const BIN = 'configmesh';
const VERSION_ENV = 'CONFIGMESH_VERSION';
const BASE_URL_ENV = 'CONFIGMESH_BASE_URL';
const ARCH_ENV = 'CONFIGMESH_ARCH';
const PLATFORM_ENV = 'CONFIGMESH_PLATFORM';

function httpGet(url, { headers } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpGet(res.headers.location, { headers }));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`GET ${url} -> ${res.statusCode}`)); return; }
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

function sha256(buf) { const h = crypto.createHash('sha256'); h.update(buf); return h.digest('hex'); }

function parseChecksums(text) {
  const map = new Map();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    let m = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    if (m) { map.set(m[2], m[1]); continue; }
    m = line.match(/^sha256:([a-f0-9]{64})\s+(.+)$/i);
    if (m) { map.set(m[2], m[1]); continue; }
    m = line.match(/^SHA256\s+\((.+)\)\s+=\s+([a-f0-9]{64})$/i);
    if (m) { map.set(m[1], m[2]); continue; }
  }
  return map;
}

(async function main() {
  try {
    const platform = process.env[PLATFORM_ENV] || process.platform;
    if (!['darwin', 'linux'].includes(platform)) {
      console.error('configmesh: npm install supports macOS (darwin) and Linux only');
      process.exit(1);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const version = process.env[VERSION_ENV] || pkg.version || '';
    if (!version) { console.error('postinstall: could not determine version'); process.exit(1); }

    const detectedArch = process.arch === 'x64'
      ? 'amd64'
      : (process.arch === 'arm64' ? 'arm64' : (process.arch === 'arm' ? 'armv7' : process.arch));
    const arch = process.env[ARCH_ENV] || detectedArch;
    if (!['amd64','arm64','armv7'].includes(arch)) {
      console.error(`Unsupported arch: ${arch}`); process.exit(1);
    }

    const assetName = `${BIN}_${version}_${platform}_${arch}.tar.gz`;
    const base = process.env[BASE_URL_ENV] || `https://github.com/${OWNER}/${REPO}/releases/download/${version}`;
    const url = `${base}/${assetName}`;
    const checksumsUrl = `${base}/checksums.txt`;
    const headers = { 'User-Agent': `${REPO}-postinstall` };
    const outDir = __dirname;
    const exe = BIN;
    const binPath = path.join(outDir, exe);

    if (fs.existsSync(binPath)) { try { fs.chmodSync(binPath, 0o755); } catch {}; return; }

    console.log(`postinstall: downloading ${assetName} from ${url}`);
    const tarGz = await httpGet(url, { headers });

    // checksum (best effort)
    try {
      const checksumsBuf = await httpGet(checksumsUrl, { headers });
      const checksums = parseChecksums(checksumsBuf.toString('utf8'));
      const sumExpected = checksums.get(assetName);
      if (!sumExpected) throw new Error('asset not in checksums.txt');
      const sumActual = sha256(tarGz);
      if (sumActual.toLowerCase() !== sumExpected.toLowerCase()) throw new Error('checksum mismatch');
      console.log('postinstall: checksum OK');
    } catch (e) { console.warn(`postinstall: checksum skipped/failed: ${e.message}`); }

    // extract only the binary into npm directory (archive contains binary at root)
    const tmpFile = path.join(os.tmpdir(), `${REPO}-${Date.now()}.tar.gz`);
    fs.writeFileSync(tmpFile, tarGz);
    const tarRes = spawnSync('tar', ['-xzf', tmpFile, '-C', outDir, exe], { stdio: 'inherit' });
    if (tarRes.status !== 0) { console.error('postinstall: failed to extract binary'); process.exit(1); }
    try { fs.chmodSync(binPath, 0o755); } catch {}
    try { fs.unlinkSync(tmpFile); } catch {}
    console.log(`postinstall: installed ${exe} to ${outDir}`);
  } catch (err) { console.error(`postinstall error: ${err.message}`); process.exit(1); }
})();
