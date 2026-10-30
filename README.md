# ANTIBYPASS V2 — Web Interface

Versi web dari bot Discord **ANTIBYPASS V2** (powered by ANTILUA).
Tampilan mengikuti pola aplikasi musik modern (sidebar, search, shelf, player dock),
dengan identitas sendiri: gelap, crimson → ember → gold, dan tipografi teknis.

> **Status:** ini adalah *front-end design + demo engine*. Semua proses (download,
> konversi, spoof) disimulasikan di browser supaya alur UI bisa dicoba tanpa server.
> Bagian "Menghubungkan engine asli" di bawah menjelaskan titik sambungnya.

---

## Menjalankan

Buka `index.html` langsung di browser, atau jalankan static server:

```bash
git clone https://github.com/ANTILUA-404/WEB-CONVERTER.git
cd WEB-CONVERTER
python -m http.server 8777
# http://127.0.0.1:8777
```

Tidak ada build step, tidak ada dependency. Font diambil dari Google Fonts
(ada fallback system font kalau offline).

---

## Halaman

| Route | Isi |
|---|---|
| `#/home` | Hero, statistik, toolkit, shelf job terakhir, preset suara, akses |
| `#/bypass` | Studio Bypass — link/upload, 8 format, speed/pitch/gain, preset, trim, preview `PlaybackSpeed` live |
| `#/spoof` | Asset Spoofer — batch asset ID, output auto/audio/rbxm, place context, pipeline |
| `#/get` | Fresh Master — matriks format (MP3 320 / FLAC / WAV / M4A), 1.0× original |
| `#/video` | Clean Video — ladder 2160p → 360p, trim, platform support |
| `#/credits` | Ring kuota, recovery countdown, bonus overflow, redeem, tier, ledger |
| `#/history` | Filter + search + tabel job, copy PlaybackSpeed, re-run |
| `#/admin` | Control Center — terkunci, butuh login owner/admin |

Shortcut: `/` fokus ke search, `Ctrl/Cmd + K` command palette.

---

## Admin / Owner

Gate `#/admin` hanya render panel kalau ada session valid (2 jam, disimpan di
`localStorage`). Role menentukan akses:

| Akun | Password | Role | Akses |
|---|---|---|---|
| `owner` | `antibypass` | Owner | Semua tab, Roblox cookie/API key, reset setting, reset semua kredit |
| `admin` | `admin123` | Admin | Overview, queue, redeem, blacklist, credit users, audit. Tab **Settings** terkunci |

Tab yang butuh owner ditandai ikon kunci dan tidak bisa dibuka oleh role admin.
Aksi penting masuk ke audit log.

**Penting:** autentikasi ini berjalan di sisi klien dan hanya untuk demo UI.
Untuk produksi, pindahkan verifikasi ke server (session cookie/JWT), dan jangan
kirim kredensial role ke bundle publik seperti ini.

---

## Struktur

```
WEB-CONVERTER/
├─ index.html
├─ README.md
├─ LICENSE
└─ assets/
   ├─ css/style.css        # design system + seluruh layout
   └─ js/
      ├─ icons.js          # inline SVG icon set
      ├─ core.js           # util, state, artwork generator, demo engine, auth
      ├─ ui.js             # toast, modal, dock, report overlay, command palette
      ├─ app.js            # shell, router, halaman publik
      └─ admin.js          # gate + control center
```

Live (kalau GitHub Pages diaktifkan): `https://antilua-404.github.io/WEB-CONVERTER/`

State disimpan di `localStorage` key `antibypass.v2.state`. Reset lewat menu
profil → **Reset data demo**.

---

## Yang sudah berfungsi di demo

- Job simulation dengan 6 stage, progress, log terminal, cancel, re-run
- PlaybackSpeed dihitung `1 / speed` dan dipotong 4 desimal (0.4347 untuk 2.3×)
- Kredit: konsumsi per job, recovery +1 / 6 jam, bonus overflow dari redeem
- Redeem: validasi kode, kuota klaim, expiry, nonaktif
- Admin: CRUD kode redeem, blacklist, saldo user, setting engine, maintenance
- Maintenance mode memblokir job publik dan menampilkan banner
- Report `.txt` benar-benar diunduh; file audio/video hanya disimulasikan
- Responsive sampai 414px (bottom nav + dock ringkas)

---

## Menghubungkan engine asli

Ganti `ABP.engine.run()` di `assets/js/core.js` dengan panggilan API. Bentuk job
yang dipakai UI:

```js
{
  id, type: 'bypass' | 'get' | 'video' | 'spoof',
  title, source, format, speed, pitch, gain, preset,
  status: 'running' | 'done' | 'failed',
  progress: 0..100,
  stage: 'queue' | 'resolve' | 'download' | 'probe' | 'convert' | 'upload' | 'done',
  stageLabel, durationSec, outputDurationSec, sizeBytes, playbackSpeed, engine, log: []
}
```

Endpoint yang disarankan:

```
POST /api/jobs              -> { id }
GET  /api/jobs/:id          -> job (poll 500–1000ms, atau SSE)
POST /api/jobs/:id/cancel
GET  /api/jobs/:id/file     -> file hasil
GET  /api/me                -> { credits, max, bonus, nextRefillMs, tier }
POST /api/redeem            -> { ok, reward }
GET  /api/admin/...         -> semua aksi panel (wajib dicek role di server)
```

Pipeline asli dari bot bisa dipakai apa adanya: `yt-dlp` → `ffmpeg` (rubberband)
→ output, lalu simpan metadata laporan yang sama (`playbackSpeed`, bitrate,
sample rate, checksum) supaya UI tidak perlu berubah.

---

## Catatan

- Nama, angka, dan konten job di demo adalah data contoh.
- Desain ini tidak menampilkan atau membungkam merek pihak ketiga; branding
  ANTIBYPASS dipakai eksplisit sesuai permintaan.
- Gunakan tool ini hanya untuk konten yang kamu punya haknya dan patuhi ToS
  platform masing-masing.
