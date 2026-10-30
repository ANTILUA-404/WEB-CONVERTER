'use strict';

/**
 * Roblox asset fetching + metadata scrub.
 *
 * - Resolves asset details through the public economy API.
 * - Downloads the source binary through assetdelivery v2 batch (same path the
 *   ISpooferMotion plugin uses).
 * - Rewrites SourceAssetId (binary PROP 0x1b / XML <int64>) to -1 and clears
 *   XML UniqueId values, so the file no longer points back at the original id.
 * - Audio assets are re-encoded to OGG with a fresh bitstream serial.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const UA = 'RobloxStudio/WinInet';
const ASSET_TYPES = {
  2: 'T-Shirt', 3: 'Audio', 4: 'Mesh', 8: 'Hat', 10: 'Model', 11: 'Shirt', 12: 'Pants',
  13: 'Decal', 17: 'Head', 18: 'Face', 19: 'Gear', 24: 'Animation', 38: 'Plugin',
  40: 'Emote', 41: 'Hair Accessory', 42: 'Face Accessory', 43: 'Neck Accessory',
  44: 'Shoulder Accessory', 45: 'Front Accessory', 46: 'Back Accessory',
  47: 'Waist Accessory', 61: 'Emote Animation',
};

function parseAssetId(raw) {
  const input = String(raw || '').trim();
  if (!input) return null;
  if (/^\d{1,20}$/.test(input)) return Number(input);
  const rbx = /rbxassetid:\/\/(\d{1,20})/i.exec(input);
  if (rbx) return Number(rbx[1]);
  const url = /(?:roblox\.com|roproxy\.com)\/(?:library|catalog|asset|game-pass|badges)\/(\d{1,20})/i.exec(input);
  if (url) return Number(url[1]);
  const q = /[?&]id=(\d{1,20})/i.exec(input);
  if (q) return Number(q[1]);
  return null;
}

async function fetchJson(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function assetDetails(assetId) {
  const data = await fetchJson(`https://economy.roblox.com/v2/assets/${assetId}/details`);
  return {
    id: Number(data.AssetId || assetId),
    name: data.Name || 'Asset ' + assetId,
    description: data.Description || '',
    assetTypeId: Number(data.AssetTypeId || 0),
    assetType: ASSET_TYPES[Number(data.AssetTypeId)] || 'Asset',
    creator: data.Creator ? { id: data.Creator.CreatorTargetId || data.Creator.Id, name: data.Creator.Name, type: data.Creator.CreatorType } : null,
    created: data.Created,
    updated: data.Updated,
  };
}

async function deliver(assetId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch('https://assetdelivery.roblox.com/v2/assets/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Roblox-Browser-Asset-Request': 'false' },
      body: JSON.stringify([{ assetId: Number(assetId), requestId: String(Date.now()) }]),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw Object.assign(new Error('Asset delivery menolak permintaan (HTTP ' + res.status + ').'), {
        code: res.status === 401 || res.status === 403 ? 'ASSET_AUTH_REQUIRED' : 'ASSET_DELIVERY_FAILED',
      });
    }
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : data;
    const location = first && first.locations && first.locations[0] && first.locations[0].location;
    if (!location) {
      throw Object.assign(new Error('Asset tidak punya lokasi unduhan (mungkin privat/dihapus).'), { code: 'ASSET_NOT_FOUND' });
    }
    const fileRes = await fetch(location, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' }, signal: controller.signal });
    if (!fileRes.ok) throw Object.assign(new Error('Gagal mengunduh file asset (HTTP ' + fileRes.status + ').'), { code: 'ASSET_DELIVERY_FAILED' });
    let buf = Buffer.from(await fileRes.arrayBuffer());
    if (fileRes.headers.get('content-encoding') === 'gzip' || (buf[0] === 0x1f && buf[1] === 0x8b)) {
      try {
        buf = zlib.gunzipSync(buf);
      } catch (err) {
        /* not gzip after all */
      }
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function detectPayload(buf) {
  if (!buf || buf.length < 16) return 'unknown';
  const head = buf.slice(0, 16).toString('latin1');
  if (head.startsWith('<roblox!')) return 'rbxm-binary';
  if (head.includes('<roblox') || head.trimStart().startsWith('<?xml')) return 'rbxm-xml';
  if (buf.slice(0, 4).toString('latin1') === 'OggS') return 'audio-ogg';
  if (buf.slice(0, 4).toString('latin1') === 'fLaC') return 'audio-flac';
  if (buf.slice(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'audio-mp3';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF') return 'audio-wav';
  if (buf.slice(4, 8).toString('latin1') === 'ftyp') return 'audio-mp4';
  return 'unknown';
}

/**
 * Binary RBXM: SourceAssetId is serialized as the ASCII property name followed
 * by type marker 0x1b and an 8-byte big-endian int64. Overwrite it with -1.
 */
function spoofBinary(buf) {
  const needle = Buffer.from('SourceAssetId', 'latin1');
  let cleared = 0;
  let cursor = buf.indexOf(needle);
  while (cursor !== -1) {
    const after = cursor + needle.length;
    if (buf[after] === 0x1b && after + 9 <= buf.length) {
      buf.fill(0xff, after + 1, after + 9);
      cleared += 1;
    }
    cursor = buf.indexOf(needle, after);
  }
  return { buffer: buf, cleared, mode: 'rbxm-binary' };
}

function spoofXml(text) {
  let cleared = 0;
  let unique = 0;
  let out = text.replace(/(<(?:int64|int)\s+name="SourceAssetId">)(-?\d+)(<\/)/g, (m, a, b, c) => {
    cleared += 1;
    return a + '-1' + c;
  });
  out = out.replace(/(<string\s+name="(?:UniqueId|HistoryId)">)([^<]*)(<\/string>)/g, (m, a, b, c) => {
    unique += 1;
    return a + crypto.randomUUID().toUpperCase() + c;
  });
  return { text: out, cleared, unique, mode: 'rbxm-xml' };
}

async function prepareAsset(assetId, { tmpDir, placeId } = {}) {
  const details = await assetDetails(assetId);
  const raw = await deliver(assetId, placeId);
  const kind = detectPayload(raw);
  return { details, raw, kind };
}

function isAudio(kind) {
  return kind.startsWith('audio-');
}

function extensionFor(kind) {
  return {
    'audio-ogg': '.ogg',
    'audio-flac': '.flac',
    'audio-mp3': '.mp3',
    'audio-wav': '.wav',
    'audio-mp4': '.m4a',
    'rbxm-binary': '.rbxm',
    'rbxm-xml': '.rbxmx',
  }[kind] || '.bin';
}

function writeTemp(dir, name, buffer) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, buffer);
  return file;
}

module.exports = {
  UA,
  ASSET_TYPES,
  parseAssetId,
  assetDetails,
  deliver,
  detectPayload,
  spoofBinary,
  spoofXml,
  prepareAsset,
  isAudio,
  extensionFor,
  writeTemp,
};
