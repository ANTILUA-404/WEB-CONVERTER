'use strict';

/**
 * Format matrix, DSP presets and filter builder — ported from ANTIBYPASS V2
 * (src/core/converter.js) so the web output matches the bot exactly.
 */

const SAMPLE_RATE = 44100;

const FORMATS = {
  mp3: { ext: 'mp3', label: 'MP3', bitrate: 320, codec: 'libmp3lame', args: ['-c:a', 'libmp3lame', '-b:a', '320k'] },
  ogg: { ext: 'ogg', label: 'OGG (Vorbis)', bitrate: 256, codec: 'libvorbis', args: ['-c:a', 'libvorbis', '-b:a', '256k'] },
  wav: { ext: 'wav', label: 'WAV', bitrate: null, codec: 'pcm_s16le', args: ['-c:a', 'pcm_s16le'] },
  flac: { ext: 'flac', label: 'FLAC', bitrate: null, codec: 'flac', args: ['-c:a', 'flac'] },
  m4a: { ext: 'm4a', label: 'M4A (AAC)', bitrate: 256, codec: 'aac', args: ['-c:a', 'aac', '-b:a', '256k'] },
  aac: { ext: 'aac', label: 'AAC', bitrate: 256, codec: 'aac', args: ['-c:a', 'aac', '-b:a', '256k'] },
  opus: { ext: 'opus', label: 'Opus', bitrate: 192, codec: 'libopus', args: ['-c:a', 'libopus', '-b:a', '192k'] },
  wma: { ext: 'wma', label: 'WMA', bitrate: 192, codec: 'wmav2', args: ['-c:a', 'wmav2', '-b:a', '192k'] },
};

const FORMAT_KEYS = Object.keys(FORMATS);

const PRESETS = {
  default: {},
  crisp: { normalize: true, removeSilence: true, amplify: 0 },
  bass: { amplify: 2, normalize: false },
  loud: { amplify: 3, normalize: true },
  nightcore: { speed: 1.25, pitch: 1.25, compensate: false, amplify: 0 },
  slowed: { speed: 0.85, pitch: 0.85, compensate: false, amplify: 0 },
  fresh: { fresh: true, speed: 1, pitch: 1, amplify: 0, compensate: false },
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n)));
}

function num(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return /^(1|true|yes|y|on)$/i.test(String(value).trim());
}

function normaliseOptions(raw = {}) {
  const presetName = String(raw.preset || '').toLowerCase().trim();
  const preset = PRESETS[presetName] || {};
  const merged = Object.assign({}, preset, raw);
  const fresh = bool(merged.fresh ?? (merged.mode === 'fresh'), false);
  const requested = String(merged.format || '').toLowerCase().replace(/^\./, '');
  const format = FORMATS[requested] ? requested : fresh ? 'mp3' : 'ogg';

  return {
    fresh,
    preset: PRESETS[presetName] ? presetName : null,
    format,
    speed: clamp(num(merged.speed, fresh ? 1 : 2.3), 0.5, 3),
    pitch: clamp(num(merged.pitch, fresh ? 1 : 1), 0.5, 2),
    amplify: clamp(num(merged.amplify ?? merged.gain, fresh ? 0 : -2), -20, 10),
    compensate: fresh ? false : bool(merged.compensate ?? merged.roblox_pitch_compensation, true),
    normalize: merged.normalize === undefined ? false : bool(merged.normalize),
    removeSilence: bool(merged.removeSilence ?? merged.silence),
    trimStart: typeof merged.trimStart === 'string' ? merged.trimStart.trim() : '',
    trimEnd: typeof merged.trimEnd === 'string' ? merged.trimEnd.trim() : '',
    customName: typeof merged.customName === 'string' ? merged.customName.trim().slice(0, 120) : '',
  };
}

function exportPitch(options) {
  return options.pitch * (options.compensate ? options.speed : 1);
}

function playbackSpeed(raw = {}, options) {
  const opts = options || normaliseOptions(raw);
  if (Math.abs(opts.speed - 1) < 1e-9) return 1;
  return 1 / opts.speed;
}

function playbackSpeedLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '1';
  return String(Math.trunc(n * 10000) / 10000);
}

function parseTimecode(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  return nums.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2];
}

function atempoChain(factor) {
  const chain = [];
  let f = factor;
  while (f > 2) {
    chain.push('atempo=2');
    f /= 2;
  }
  while (f < 0.5) {
    chain.push('atempo=0.5');
    f /= 0.5;
  }
  chain.push(`atempo=${f.toFixed(6)}`);
  return chain;
}

function buildFilters(options, hasRubberband = true) {
  const filters = [];
  if (options.removeSilence) {
    filters.push('silenceremove=start_periods=1:start_duration=0.15:start_threshold=-50dB:detection=peak');
  }
  const speed = options.speed;
  const pitchOut = exportPitch(options);
  const speedChanged = Math.abs(speed - 1) > 1e-6;
  const pitchChanged = Math.abs(pitchOut - 1) > 1e-6;
  if (speedChanged || pitchChanged) {
    if (hasRubberband) {
      filters.push(`rubberband=pitch=${pitchOut.toFixed(6)}:tempo=${speed.toFixed(6)}`);
    } else {
      const tempoCorrection = speed / pitchOut;
      if (pitchChanged) {
        const sr = targetSampleRate(options.format);
        filters.push(`asetrate=${Math.round(sr * pitchOut)}`);
        filters.push(`aresample=${sr}`);
      }
      if (Math.abs(tempoCorrection - 1) > 1e-6) filters.push(...atempoChain(tempoCorrection));
    }
  }
  if (Math.abs(options.amplify) > 0.01) filters.push(`volume=${options.amplify}dB`);
  if (options.normalize) filters.push('loudnorm=I=-14:TP=-1:LRA=11');
  return filters.join(',');
}

function engineFor(options) {
  const speedChanged = Math.abs(options.speed - 1) > 1e-6;
  const pitchChanged = Math.abs(exportPitch(options) - 1) > 1e-6;
  if (!speedChanged && !pitchChanged) return 'none';
  return 'rubberband';
}

function targetSampleRate(format) {
  return format === 'opus' ? 48000 : SAMPLE_RATE;
}

function resolveBitrate(format, requested) {
  const codec = FORMATS[format] || FORMATS.ogg;
  return Number(requested) > 0 ? Number(requested) : codec.bitrate;
}

function safeFileName(value) {
  const cleaned = String(value || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  const truncated = Buffer.byteLength(cleaned, 'utf8') > 170
    ? Buffer.from(cleaned, 'utf8').slice(0, 170).toString('utf8').replace(/\uFFFD$/, '')
    : cleaned;
  return truncated || 'audio';
}

function outputFileName(title, format, speed, customName = '') {
  const ext = (FORMATS[format] || FORMATS.ogg).ext;
  const base = safeFileName(customName || title);
  const suffix = Math.abs(speed - 1) < 1e-9 ? '' : `_${Number(Number(speed).toFixed(4))}x`;
  return `${base}${suffix}.${ext}`;
}

function describeFormat(options) {
  const info = FORMATS[options.format] || FORMATS.ogg;
  const bitrate = resolveBitrate(options.format, options.bitrate);
  return {
    label: info.label,
    ext: info.ext,
    bitrate,
    sampleRate: targetSampleRate(options.format),
    summary: bitrate ? `${info.label} · ${bitrate} kbps · 44.1 kHz` : `${info.label} · lossless · 44.1 kHz`,
  };
}

const VIDEO_QUALITIES = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];

function videoFormatSelector(quality) {
  const map = { '2160p': 2160, '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 };
  const h = map[quality] || 1080;
  return `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/bv*[height<=${h}]+ba/b[height<=${h}]/b`;
}

module.exports = {
  FORMATS,
  FORMAT_KEYS,
  PRESETS,
  VIDEO_QUALITIES,
  normaliseOptions,
  exportPitch,
  playbackSpeed,
  playbackSpeedLabel,
  parseTimecode,
  buildFilters,
  atempoChain,
  engineFor,
  targetSampleRate,
  resolveBitrate,
  safeFileName,
  outputFileName,
  describeFormat,
  videoFormatSelector,
};
