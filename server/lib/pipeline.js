'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ytdlp = require('./ytdlp');
const ffmpeg = require('./ffmpeg');
const roblox = require('./roblox');
const converter = require('./converter');
const { FILES_DIR, TMP_DIR, UPLOADS_DIR } = require('./store');

const STAGES = {
  bypass: [
    ['queue', 'Menunggu slot antrean', 0.05],
    ['resolve', 'Membuka & memverifikasi sumber', 0.15],
    ['download', 'Mengunduh stream terbaik', 0.3],
    ['probe', 'Analisis integritas media', 0.1],
    ['convert', 'DSP conversion · rubberband', 0.3],
    ['upload', 'Menyiapkan hasil & laporan', 0.1],
  ],
  get: [
    ['queue', 'Menunggu slot antrean', 0.05],
    ['resolve', 'Membuka & memverifikasi sumber', 0.16],
    ['download', 'Mengunduh master stream', 0.32],
    ['probe', 'Membaca metadata & bitrate', 0.1],
    ['convert', 'Menulis master tanpa re-encode', 0.27],
    ['upload', 'Menyiapkan hasil & laporan', 0.1],
  ],
  video: [
    ['queue', 'Menunggu slot antrean', 0.05],
    ['resolve', 'Memilih clean stream', 0.14],
    ['download', 'Mengunduh video tanpa watermark', 0.4],
    ['probe', 'Verifikasi resolusi & fps', 0.09],
    ['convert', 'Remux lossless + faststart', 0.22],
    ['upload', 'Menyiapkan hasil', 0.1],
  ],
  spoof: [
    ['queue', 'Menunggu slot antrean', 0.05],
    ['resolve', 'Place-context discovery', 0.2],
    ['download', 'Mengunduh asset asli', 0.3],
    ['probe', 'Membaca chunk RBXM', 0.1],
    ['convert', 'Deep chunk spoof & repack', 0.25],
    ['upload', 'Menyiapkan file .rbxm', 0.1],
  ],
};

function stagesFor(type) {
  return STAGES[type] || STAGES.bypass;
}

function checksum(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex').slice(0, 32);
}

function safeRm(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    /* ignore */
  }
}

class JobRunner {
  constructor(job, { store, signal, onUpdate }) {
    this.job = job;
    this.store = store;
    this.signal = signal;
    this.onUpdate = onUpdate || (() => {});
    this.stages = stagesFor(job.type);
    this.stageIndex = 0;
  }

  patch(partial) {
    Object.assign(this.job, partial);
    this.store.updateJob(this.job.id, partial);
    this.onUpdate(this.job);
  }

  log(line) {
    this.job.log = this.job.log || [];
    this.job.log.push({ t: Date.now(), line });
    if (this.job.log.length > 40) this.job.log = this.job.log.slice(-40);
    this.store.updateJob(this.job.id, { log: this.job.log });
    this.onUpdate(this.job);
  }

  stage(key, percent = 0, labelOverride) {
    const idx = this.stages.findIndex((s) => s[0] === key);
    if (idx < 0) return;
    this.stageIndex = idx;
    let before = 0;
    for (let i = 0; i < idx; i++) before += this.stages[i][2];
    const weight = this.stages[idx][2];
    const overall = Math.round((before + weight * Math.min(100, Math.max(0, percent)) / 100) * 100);
    this.patch({
      stage: key,
      stageLabel: labelOverride || this.stages[idx][1],
      progress: Math.min(99, Math.max(this.job.progress || 0, overall)),
    });
  }

  checkAbort() {
    if (this.signal && this.signal.aborted) {
      throw Object.assign(new Error('Job dibatalkan.'), { code: 'ABORTED' });
    }
  }
}

async function finalize(runner, file, fileName, extra = {}) {
  runner.stage('upload', 10);
  const dir = path.join(FILES_DIR, runner.job.id);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, fileName);
  fs.copyFileSync(file, dest);
  const size = fs.statSync(dest).size;
  runner.stage('upload', 70);
  runner.patch({
    status: 'done',
    progress: 100,
    stage: 'done',
    stageLabel: 'Selesai',
    finishedAt: Date.now(),
    sizeBytes: size,
    fileName,
    checksum: checksum(dest),
    downloadUrl: `/api/jobs/${runner.job.id}/file`,
    ...extra,
  });
  runner.log('selesai · ' + size + ' bytes');
  return runner.job;
}

/* ------------------------------------------------------------------- audio */
async function runAudio(runner, settings) {
  const job = runner.job;
  const tmp = path.join(TMP_DIR, job.id);
  fs.mkdirSync(tmp, { recursive: true });
  const options = converter.normaliseOptions({
    format: job.format,
    speed: job.speed,
    pitch: job.pitch,
    gain: job.gain,
    preset: job.preset,
    normalize: job.normalize,
    silence: job.silence,
    trimStart: job.trimStart,
    trimEnd: job.trimEnd,
    customName: job.customName,
    fresh: job.type === 'get',
  });

  runner.stage('resolve', 5);
  let info = { title: job.title, duration: null };
  if (job.uploadPath) {
    info = { title: job.customName || job.title || path.basename(job.uploadPath), duration: null };
    runner.log('sumber: upload lokal');
  } else {
    runner.log('resolve ' + job.source);
    info = await ytdlp.resolveInfo(job.source, { signal: runner.signal });
    runner.log('metadata: ' + (info.title || 'tanpa judul'));
  }
  runner.stage('resolve', 100);
  runner.checkAbort();

  const title = info.title || job.title || 'audio';
  const duration = Number(info.duration) || null;
  runner.patch({
    title,
    artworkSeed: title + job.id,
    durationSec: duration,
    sourceTitle: info.title || null,
    uploader: info.uploader || info.channel || null,
  });

  if (settings.maxDurationSec > 0 && duration && duration > settings.maxDurationSec) {
    throw Object.assign(new Error(`Durasi ${Math.round(duration)}s melebihi batas ${settings.maxDurationSec}s.`), { code: 'TOO_LONG' });
  }

  runner.stage('download', 0);
  let sourceFile;
  if (job.uploadPath) {
    sourceFile = path.join(tmp, 'source' + (path.extname(job.uploadPath) || '.bin'));
    fs.copyFileSync(job.uploadPath, sourceFile);
    runner.stage('download', 100);
  } else {
    const dl = await ytdlp.downloadAudio(job.source, tmp, {
      signal: runner.signal,
      onProgress: (pct, line) => {
        runner.stage('download', pct);
        if (pct % 25 === 0) runner.log(line.slice(0, 90));
      },
    });
    if (!dl) throw Object.assign(new Error('File sumber tidak ditemukan setelah unduhan.'), { code: 'NO_FILE' });
    sourceFile = dl.path;
    runner.log('terunduh: ' + dl.name + ' (' + dl.size + ' bytes)');
  }
  runner.checkAbort();

  runner.stage('probe', 10);
  const meta = await ffmpeg.probe(sourceFile);
  const inputDuration = meta.durationSec || duration;
  runner.log(`probe · ${inputDuration ? inputDuration.toFixed(2) + 's' : 'durasi ?'} · ${meta.codec || 'audio'}`);
  runner.stage('probe', 100);

  runner.stage('convert', 0);
  const outName = converter.outputFileName(title, options.format, options.speed, options.customName);
  const outPath = path.join(tmp, outName);
  const engine = converter.engineFor(options);
  runner.patch({ engine });
  runner.log(`ffmpeg · ${options.format} · ${engine}`);
  await ffmpeg.convertAudio(sourceFile, outPath, options, {
    durationSec: inputDuration,
    signal: runner.signal,
    onProgress: (pct) => runner.stage('convert', pct),
  });

  const outStat = fs.statSync(outPath);
  if (outStat.size > settings.maxFileMb * 1024 * 1024) {
    throw Object.assign(new Error(`Hasil ${(outStat.size / 1048576).toFixed(1)} MB melebihi batas ${settings.maxFileMb} MB.`), { code: 'TOO_LARGE' });
  }
  const outMeta = await ffmpeg.probe(outPath);

  return finalize(runner, outPath, outName, {
    outputDurationSec: outMeta.durationSec || (inputDuration ? inputDuration / options.speed : null),
    playbackSpeed: converter.playbackSpeedLabel(converter.playbackSpeed({}, options)),
    format: options.format,
  });
}

/* ------------------------------------------------------------------- video */
async function runVideo(runner, settings) {
  const job = runner.job;
  const tmp = path.join(TMP_DIR, job.id);
  fs.mkdirSync(tmp, { recursive: true });

  runner.stage('resolve', 5);
  runner.log('resolve ' + job.source);
  const info = await ytdlp.resolveInfo(job.source, { signal: runner.signal });
  const title = info.title || job.title || 'video';
  const duration = Number(info.duration) || null;
  runner.patch({ title, artworkSeed: title + job.id, durationSec: duration, uploader: info.uploader || null });
  runner.stage('resolve', 100);

  if (settings.maxDurationSec > 0 && duration && duration > settings.maxDurationSec) {
    throw Object.assign(new Error(`Durasi ${Math.round(duration)}s melebihi batas ${settings.maxDurationSec}s.`), { code: 'TOO_LONG' });
  }

  runner.stage('download', 0);
  const dl = await ytdlp.downloadVideo(job.source, tmp, job.quality || settings.defaultVideoQuality || '1080p', {
    signal: runner.signal,
    onProgress: (pct, line) => {
      runner.stage('download', pct);
      if (pct % 25 === 0) runner.log(line.slice(0, 90));
    },
  });
  if (!dl) throw Object.assign(new Error('Video tidak ditemukan setelah unduhan.'), { code: 'NO_FILE' });
  runner.log('terunduh: ' + dl.name);

  runner.stage('probe', 10);
  const meta = await ffmpeg.probe(dl.path);
  runner.log(`probe · ${meta.durationSec ? meta.durationSec.toFixed(1) + 's' : '?'} · video=${meta.hasVideo}`);
  runner.stage('probe', 100);

  runner.stage('convert', 5);
  const outName = converter.safeFileName(title) + '.mp4';
  const outPath = path.join(tmp, outName);
  try {
    await ffmpeg.remuxFaststart(dl.path, outPath, { signal: runner.signal });
  } catch (err) {
    runner.log('remux copy gagal, re-encode 720p');
    await ffmpeg.run(
      ['-hide_banner', '-y', '-nostdin', '-i', dl.path, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath],
      { signal: runner.signal, timeoutMs: 600000 }
    );
  }
  runner.stage('convert', 95);
  const outMeta = await ffmpeg.probe(outPath);

  return finalize(runner, outPath, outName, {
    outputDurationSec: outMeta.durationSec || duration,
    playbackSpeed: '1',
    engine: 'remux',
    format: 'mp4',
  });
}

/* ------------------------------------------------------------------- spoof */
async function runSpoof(runner, settings) {
  const job = runner.job;
  const tmp = path.join(TMP_DIR, job.id);
  fs.mkdirSync(tmp, { recursive: true });

  runner.stage('resolve', 5);
  const assetId = roblox.parseAssetId(job.source) || roblox.parseAssetId(job.assetId);
  if (!assetId) throw Object.assign(new Error('Asset ID tidak valid.'), { code: 'INVALID_ASSET_ID' });
  runner.log('asset ' + assetId);
  const details = await roblox.assetDetails(assetId);
  runner.patch({
    title: details.name,
    artworkSeed: details.name + assetId,
    assetId,
    assetType: details.assetType,
    assetTypeId: details.assetTypeId,
    creator: details.creator ? details.creator.name : null,
  });
  runner.log(`tipe: ${details.assetType} · creator ${details.creator ? details.creator.name : '?'}`);
  runner.stage('resolve', 100);

  runner.stage('download', 10);
  const raw = await roblox.deliver(assetId);
  runner.log('binary ' + raw.length + ' bytes');
  runner.stage('download', 100);

  runner.stage('probe', 10);
  const kind = roblox.detectPayload(raw);
  runner.patch({ payloadKind: kind });
  runner.log('payload: ' + kind);
  runner.stage('probe', 100);

  runner.stage('convert', 10);
  let outPath;
  let outName;
  let extra = {};

  if (roblox.isAudio(kind)) {
    const src = roblox.writeTemp(tmp, 'source' + roblox.extensionFor(kind), raw);
    outName = converter.safeFileName(details.name) + '_spoofed.ogg';
    outPath = path.join(tmp, outName);
    await ffmpeg.transcodeAsset(src, outPath, { signal: runner.signal });
    extra = { spoofMode: 'audio', engine: 'vorbis-reencode' };
    runner.log('audio re-encode · serial baru');
  } else if (kind === 'rbxm-xml') {
    const result = roblox.spoofXml(raw.toString('utf8'));
    outName = converter.safeFileName(details.name) + '_spoofed.rbxmx';
    outPath = path.join(tmp, outName);
    fs.writeFileSync(outPath, result.text, 'utf8');
    extra = { spoofMode: 'rbxm-xml', clearedIds: result.cleared, clearedUnique: result.unique, engine: 'xml-scrub' };
    runner.log(`xml scrub · ${result.cleared} SourceAssetId · ${result.unique} UniqueId`);
  } else if (kind === 'rbxm-binary') {
    const result = roblox.spoofBinary(Buffer.from(raw));
    outName = converter.safeFileName(details.name) + '_spoofed.rbxm';
    outPath = path.join(tmp, outName);
    fs.writeFileSync(outPath, result.buffer);
    extra = { spoofMode: 'rbxm-binary', clearedIds: result.cleared, engine: 'binary-prop-scrub' };
    runner.log(`binary scrub · ${result.cleared} SourceAssetId`);
  } else {
    throw Object.assign(new Error('Format asset tidak dikenali (' + kind + ').'), { code: 'UNSUPPORTED' });
  }

  runner.stage('convert', 95);
  return finalize(runner, outPath, outName, {
    playbackSpeed: '1',
    format: extra.spoofMode === 'audio' ? 'ogg' : outName.endsWith('.rbxmx') ? 'rbxmx' : 'rbxm',
    ...extra,
  });
}

/* --------------------------------------------------------------------- main */
async function processJob(job, { store, signal, onUpdate }) {
  const runner = new JobRunner(job, { store, signal, onUpdate });
  const settings = store.settings();
  runner.patch({ status: 'running', startedAt: Date.now(), progress: 1 });
  runner.stage('queue', 100);

  try {
    let result;
    if (job.type === 'spoof') result = await runSpoof(runner, settings);
    else if (job.type === 'video') result = await runVideo(runner, settings);
    else result = await runAudio(runner, settings);
    return result;
  } catch (err) {
    const aborted = err.code === 'ABORTED' || err.name === 'AbortError' || (runner.signal && runner.signal.aborted);
    const code = aborted ? 'ABORTED' : err.code || 'FAILED';
    runner.patch({
      status: 'failed',
      stage: 'failed',
      stageLabel: aborted ? 'Dibatalkan' : 'Gagal',
      finishedAt: Date.now(),
      error: aborted ? 'Job dibatalkan.' : err.message || 'Job gagal.',
      errorCode: code,
    });
    runner.log('✖ ' + (err.message || code));
    throw err;
  } finally {
    safeRm(path.join(TMP_DIR, job.id));
    if (job.uploadPath) {
      try {
        fs.unlinkSync(job.uploadPath);
      } catch (err) {
        /* ignore */
      }
    }
  }
}

module.exports = { processJob, STAGES, stagesFor, UPLOADS_DIR };
