# WEB-CONVERTER — ANTIBYPASS V2 Web Engine

Versi web dari bot **ANTIBYPASS V2** (powered by ANTILUA). Tampilan mengikuti pola
aplikasi musik modern, dan sekarang **benar-benar memproses file**: yt-dlp menarik
sumber, ffmpeg (rubberband) mengonversi, hasilnya bisa diunduh.

Ada dua mode:

| Mode | Kapan aktif | Yang terjadi |
|---|---|---|
| **Live** | Dibuka lewat `node server/server.js` | Job asli: download → convert → file nyata |
| **Demo** | File statis / GitHub Pages (tanpa backend) | Semua disimulasikan di browser |

UI otomatis mendeteksi `/api/health`. Kalau backend tidak ada, ia jatuh ke mode demo
dengan badge `DEMO ENGINE`; kalau ada, badge berubah jadi `LIVE ENGINE`.

---

## Quick start (lokal)

Butuh **Node.js 20+**, **ffmpeg** (disarankan build dengan `librubberband`), dan **yt-dlp**.

```bash
git clone https://github.com/ANTILUA-404/WEB-CONVERTER.git
cd WEB-CONVERTER
cp server/.env.example server/.env
# isi FFMPEG_PATH / YTDLP_PATH kalau binary tidak ada di PATH
node server/server.js
# http://127.0.0.1:8787
```

Windows, memakai binary dari folder bot:

```ini
# server/.env
FFMPEG_PATH=D:\BOT MUSIC CONVERTER\ANTIBYPASS_V2-main\bin\ffmpeg.exe
YTDLP_PATH=D:\BOT MUSIC CONVERTER\ANTIBYPASS_V2-main\bin\yt-dlp.exe
```

Binary juga bisa ditaruh di `server/bin/` (otomatis terdeteksi), atau dibiarkan
kosong kalau `ffmpeg`/`yt-dlp` sudah ada di `PATH`.

Cek kesiapan:

```bash
curl http://127.0.0.1:8787/api/health
# { ok: true, binaries: { ffmpeg, ytdlp, rubberband: true } }
```

---

## Docker

```bash
docker build -t antibypass-web .
docker run -p 8080:8080 -v antibypass-data:/data \
  -e OWNER_PASS=ganti-ini -e ADMIN_PASS=ganti-ini \
  antibypass-web
```

Image sudah memasang ffmpeg + yt-dlp. Data (job, kredit, kode) tersimpan di volume `/data`.

---

## Yang benar-benar jalan

| Fitur | Status | Catatan |
|---|---|---|
| **Bypass** | ✅ | yt-dlp → ffmpeg `rubberband`; 8 format, speed/pitch/gain, preset, trim, loudnorm, buang silence |
| **PlaybackSpeed** | ✅ | `1 / speed`, dipotong 4 desimal (2.3× → `0.4347`) |
| **Fresh Master** | ✅ | 1.0×, bitrate maksimum (MP3 320 / FLAC / WAV / M4A) |
| **Clean Video** | ✅ | `bv+ba` sampai 2160p, remux `-c copy` + faststart, fallback re-encode 720p |
| **Upload file** | ✅ | Multipart ke `server/data/uploads`, langsung diproses |
| **Spoof Roblox** | ✅ terbatas | Asset publik via `assetdelivery` v2; audio di-re-encode, RBXM di-scrub (`SourceAssetId = -1`) |
| **Kredit** | ✅ | 1 kredit dipotong saat job dibuat, **refund otomatis kalau gagal**; recovery +1 / 6 jam; overflow redeem |
| **Redeem** | ✅ | Validasi kode, kuota, expiry, sekali per user |
| **Admin** | ✅ | Login server-side, CRUD kode, blacklist, saldo user, setting engine, maintenance, audit |
| **History & download** | ✅ | File nyata di `GET /api/jobs/:id/file` |
| **Laporan .txt** | ✅ | Berisi format, bitrate, checksum, PlaybackSpeed |

### Batasan yang perlu diketahui

- **Spoof bukan deep-spoof penuh.** Yang dikerjakan: unduh asset asli, lalu tulis ulang
  `SourceAssetId` jadi `-1` (binary PROP `0x1b` / XML `<int64>`) dan `UniqueId` XML.
  Bot punya mutasi chunk LZ4, unwrap animasi katalog, dan auto-publish ke Roblox —
  bagian itu **belum** diporting ke web.
- **Satu asset per job** untuk spoof di mode live (bukan batch).
- **DRM** (Netflix/Spotify premium dsb.) tidak didukung.
- YouTube kadang minta PO token / cookies; isi `YTDLP_COOKIES` kalau kena.
- Job berat (lagu 1 jam) bisa memakan beberapa menit karena rubberband CPU-bound.

---

## Admin

Kredensial dari `server/.env` (default di bawah, **ganti untuk produksi**):

| Akun | Password | Role |
|---|---|---|
| `owner` | `antibypass` | Semua tab + setting owner-only |
| `admin` | `admin123` | Semua kecuali tab Settings |

Session disimpan di cookie `HttpOnly` dan divalidasi di server pada setiap request
`/api/admin/*`. Role admin tidak bisa membuka setting owner-only meskipun memanggil API langsung.

---

## Struktur

```
WEB-CONVERTER/
├─ index.html
├─ Dockerfile
├─ assets/
│  ├─ css/style.css
│  └─ js/
│     ├─ icons.js        # icon set
│     ├─ core.js         # state, artwork, demo engine
│     ├─ api.js          # bridge ke backend + fallback demo
│     ├─ ui.js           # toast, modal, dock, report
│     ├─ app.js          # shell, router, halaman publik
│     └─ admin.js        # gate + control center
└─ server/
   ├─ server.js          # HTTP + routing + static + SSE
   ├─ lib/
   │  ├─ env.js          # .env loader
   │  ├─ store.js        # JSON store (users, jobs, codes, audit)
   │  ├─ auth.js         # cookie user + admin session
   │  ├─ queue.js        # concurrency queue
   │  ├─ binaries.js     # deteksi ffmpeg / yt-dlp / rubberband
   │  ├─ converter.js    # format matrix, preset, filter DSP
   │  ├─ ytdlp.js        # resolve + download + progress
   │  ├─ ffmpeg.js       # probe + convert + remux
   │  ├─ roblox.js       # asset delivery + metadata scrub
   │  └─ pipeline.js     # orkestrasi job
   └─ data/              # state.json, files/, uploads/, tmp/ (gitignored)
```

---

## API

```
GET  /api/health
GET  /api/me
POST /api/jobs                 { type, source|uploadId, format, speed, pitch, gain, preset, quality, ... }
GET  /api/jobs
GET  /api/jobs/:id
GET  /api/jobs/:id/events      SSE progress
POST /api/jobs/:id/cancel
GET  /api/jobs/:id/file        download hasil
POST /api/upload               multipart field "file"
POST /api/redeem               { code }

POST /api/auth/login           { username, password }
POST /api/auth/logout
GET  /api/auth/session

GET  /api/admin/overview
GET|POST /api/admin/codes      PATCH|DELETE /api/admin/codes/:code
GET|POST /api/admin/blacklist  DELETE /api/admin/blacklist/:id
GET  /api/admin/users          POST /api/admin/users/:id/credits
GET|PUT /api/admin/settings    POST /api/admin/settings/reset
POST /api/admin/maintenance
POST /api/admin/credits/reset
GET|DELETE /api/admin/audit
POST /api/admin/cache/purge
```

Job shape yang dipakai UI sama dengan versi demo:

```js
{
  id, type: 'bypass' | 'get' | 'video' | 'spoof',
  title, source, format, speed, pitch, gain, preset, quality,
  status: 'queued' | 'running' | 'done' | 'failed',
  progress, stage, stageLabel, log: [{ t, line }],
  durationSec, outputDurationSec, sizeBytes, playbackSpeed, engine,
  fileName, downloadUrl, checksum, error
}
```

---

## Deploy

- **VPS / Railway / Render / Fly**: pakai Dockerfile di atas, mount volume ke `/data`.
- **GitHub Pages**: hanya bisa mode demo (tidak ada Node/ffmpeg). UI tetap jalan,
  tapi tombol proses hanya simulasi.

Jangan taruh `server/.env` atau `server/data/` di repo — keduanya sudah masuk `.gitignore`,
dan server memblokir `/server/*` dari static.

---

## Catatan

- Gunakan hanya untuk konten yang kamu punya haknya dan patuhi ToS platform.
- Nama, angka, dan job contoh di mode demo adalah data fiktif.
