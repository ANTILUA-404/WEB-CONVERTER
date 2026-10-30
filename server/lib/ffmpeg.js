'use strict';

const fs = require('fs');
const { spawn } = require('child_process');
const { ffmpeg, hasRubberband } = require('./binaries');
const { FORMATS, buildFilters, resolveBitrate, targetSampleRate, parseTimecode } = require('./converter');

function run(args, { onLine, timeoutMs = 300000, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!ffmpeg.path) {
      reject(Object.assign(new Error('ffmpeg tidak ditemukan. Set FFMPEG_PATH atau taruh di server/bin.'), { code: 'FFMPEG_MISSING' }));
      return;
    }
    const child = spawn(ffmpeg.path, args, { windowsHide: true, signal });
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill('SIGKILL');
      } catch (err) {
        /* ignore */
      }
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (stderr.length > 80000) stderr = stderr.slice(-40000);
      if (onLine) {
        for (const line of text.split(/[\r\n]+/)) if (line.trim()) onLine(line);
      }
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(Object.assign(new Error('Proses ffmpeg melewati batas waktu.'), { code: 'TIMEOUT' }));
      if (code !== 0) {
        const tail = stderr.split(/\r?\n/).filter(Boolean).slice(-4).join(' ');
        return reject(Object.assign(new Error(tail || 'ffmpeg exit ' + code), { code: 'FFMPEG_FAILED' }));
      }
      resolve({ stderr });
    });
  });
}

async function probe(file) {
  if (!ffmpeg.path) return { durationSec: null };
  return new Promise((resolve) => {
    const child = spawn(ffmpeg.path, ['-hide_banner', '-i', file], { windowsHide: true });
    let text = '';
    child.stderr.on('data', (c) => {
      text += c.toString();
      if (text.length > 40000) text = text.slice(-20000);
    });
    child.on('close', () => {
      const durationMatch = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);
      const durationSec = durationMatch
        ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
        : null;
      const audioMatch = /Stream #\d+:\d+.*?Audio:\s*([^,]+),\s*(\d+)\s*Hz,\s*([^,]+)(?:,\s*[^,]+)*,\s*(\d+)\s*kb\/s/.exec(text);
      const anyAudio = /Audio:\s*([a-zA-Z0-9_]+)/.exec(text);
      resolve({
        durationSec,
        codec: audioMatch ? audioMatch[1].trim() : anyAudio ? anyAudio[1] : null,
        sampleRate: audioMatch ? Number(audioMatch[2]) : null,
        channels: audioMatch ? audioMatch[3].trim() : null,
        bitrate: audioMatch ? Number(audioMatch[4]) : null,
        hasAudio: /Audio:/.test(text),
        hasVideo: /Video:/.test(text),
      });
    });
  });
}

function timeToSeconds(text) {
  const m = /time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function convertAudio(input, output, options, { durationSec, onProgress, signal } = {}) {
  const args = ['-hide_banner', '-y', '-nostdin'];
  const start = parseTimecode(options.trimStart);
  const end = parseTimecode(options.trimEnd);
  if (start !== null) args.push('-ss', String(start));
  if (end !== null) args.push('-t', String(Math.max(0.1, end - (start || 0))));
  args.push('-i', input);

  const filters = buildFilters(options, hasRubberband());
  if (filters) args.push('-af', filters);
  args.push('-vn');

  const bitrate = resolveBitrate(options.format, options.bitrate);
  const codec = FORMATS[options.format] || FORMATS.ogg;
  if (bitrate) args.push('-c:a', codec.codec, '-b:a', `${bitrate}k`);
  else args.push(...codec.args);

  args.push('-ar', String(targetSampleRate(options.format)));
  if (options.format !== 'wav' && options.format !== 'flac') args.push('-map', '0:a:0');
  args.push('-map_metadata', '-1');
  args.push(output);

  let last = -1;
  await run(args, {
    signal,
    timeoutMs: 600000,
    onLine: (line) => {
      if (!onProgress || !durationSec) return;
      const t = timeToSeconds(line);
      if (t == null) return;
      const pct = Math.max(0, Math.min(99, Math.round((t / durationSec) * 100)));
      if (pct !== last) {
        last = pct;
        onProgress(pct);
      }
    },
  });
  return { filePath: output };
}

async function remuxFaststart(input, output, { signal } = {}) {
  await run(['-hide_banner', '-y', '-nostdin', '-i', input, '-c', 'copy', '-movflags', '+faststart', output], {
    signal,
    timeoutMs: 300000,
  });
  return { filePath: output };
}

async function transcodeAsset(input, output, { signal } = {}) {
  await run(
    [
      '-hide_banner', '-y', '-nostdin',
      '-i', input,
      '-vn',
      '-c:a', 'libvorbis', '-b:a', '192k', '-ar', '44100',
      '-map_metadata', '-1',
      '-fflags', '+bitexact',
      output,
    ],
    { signal, timeoutMs: 300000 }
  );
  return { filePath: output };
}

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch (err) {
    return 0;
  }
}

module.exports = { run, probe, convertAudio, remuxFaststart, transcodeAsset, fileSize };
