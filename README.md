# sponsorQu

Platform pencari sponsor untuk panitia event. Deskripsikan event Anda sekali, lalu sponsorQu merangking perusahaan yang relevan, membuat draf email yang dipersonalisasi untuk tiap perusahaan, mengirimkannya lewat Gmail, dan membantu memantau balasan, semuanya dalam satu alur.

## Daftar Isi

- [Fitur](#fitur)
- [Cara Kerja](#cara-kerja)
- [Paket](#paket)
- [Tech Stack](#tech-stack)
- [Memulai](#memulai)
- [Konfigurasi](#konfigurasi)
- [Halaman Aplikasi](#halaman-aplikasi)
- [Batas Sistem](#batas-sistem)
- [Struktur Proyek](#struktur-proyek)
- [Troubleshooting](#troubleshooting)
- [Keamanan](#keamanan)

## Fitur

- **Rekomendasi sponsor berbasis AI.** Pencarian vektor atas dataset sponsor, dengan skor relevansi 0–100, alasan, dan bentuk dukungan yang mungkin diberikan.
- **Draf email terpersonalisasi.** Satu panggilan AI per kampanye, lalu digabungkan ke tiap sponsor dengan nama, tanda tangan, dan detail event Anda.
- **Pengiriman via Gmail.** Terhubung lewat OAuth, dengan pemeriksaan sebelum kirim, antrean, dan percobaan ulang per penerima.
- **Pelacakan hasil.** Pantau status tiap sponsor (Terkirim, Dibalas, Diterima, Ditolak, Diacuhkan) dan cek balasan langsung dari aplikasi.
- **Input manual.** Tambahkan sponsor yang sudah Anda kenal tanpa harus melalui pencarian AI.
- **Data tetap tersimpan.** Seluruh state disimpan di `localStorage`, sehingga refresh halaman tidak menghapus pekerjaan Anda.

## Cara Kerja

1. **Cari.** Pilih jenis event dan tulis deskripsinya (minimal 30 karakter). AI mengembalikan hingga 5 sponsor yang paling relevan.
2. **Lengkapi kampanye.** Isi detail event, kebutuhan sponsorship, nada email, dan data PIC. Konteks dari langkah 1 terbawa otomatis.
3. **Tinjau draf.** Periksa dan edit draf tiap sponsor. Placeholder yang belum terisi ditandai dan memblokir pengiriman sampai dilengkapi.
4. **Kirim dan pantau.** Kirim lewat Gmail, lalu lacak balasan dan hasilnya di dashboard dan riwayat.

## Paket

| | Starter | Elevate | Executive |
|---|---|---|---|
| Harga | Gratis | Rp49.000/bulan | Hubungi kami |
| Sponsor per pencarian | 3–5 | 10+ | 10+ |
| Pencarian per hari | 3 | 2–3x lipat Starter | Menyesuaikan |
| Email per sesi kirim | 5 | 20 | 20+ |
| Sponsor yang dipantau | 10 | 50 | Menyesuaikan |
| Tambahan | | Notifikasi langsung | SSO, dukungan prioritas, pendampingan, template khusus |

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19, React Router 7, Vite 6, CSS murni |
| Backend | Express 4, cors, dotenv |
| AI | Langflow (lokal) dengan Astra DB sebagai vector store |
| Email | Composio (`@composio/core`) + Gmail OAuth |

## Memulai

### Prasyarat

- Node.js 20 atau lebih baru dan npm
- [Langflow](https://github.com/langflow-ai/langflow) yang berjalan di `http://localhost:7860`
- Akun [Composio](https://composio.dev) (opsional, hanya untuk mengirim email asli)

Tanpa Composio, Anda tetap bisa memakai seluruh alur sampai tahap pemeriksaan sebelum kirim.

### 1. Clone dan install

```bash
git clone https://github.com/revanzk/sponsorQU.git
cd sponsorQU

npm install              # frontend
npm run server:install   # backend
```

### 2. Siapkan Langflow

Aplikasi memakai dua flow dan satu dataset yang ada di folder `langflow/`:

| File | Fungsi |
|---|---|
| `SponsorQu Flow.json` | Flow pencarian: query planner, vector search, ranker, dan parser JSON |
| `draft email.json` | Flow draf: merapikan template menjadi `Subjek:` dan `Isi:` dengan placeholder `[kurung]` |
| `sponsor_database_audited_final.txt` | Dataset sponsor (array JSON) yang dimasukkan ke Astra DB |

Langkah-langkahnya:

1. Jalankan Langflow dan buka `http://localhost:7860`.
2. Import kedua file JSON sehingga menjadi dua flow terpisah.
3. Isi vector database (wajib sebelum pencarian dapat berjalan):
   1. Di flow pencarian, temukan cabang ingest: **Read File → Split Text → Ingest Data → Astra DB**.
   2. Pada komponen **Read File**, pilih `langflow/sponsor_database_audited_final.txt`.
   3. Jalankan komponen **Ingest Data** dan tunggu hingga berstatus sukses.
   4. Pastikan collection di Astra DB sudah terisi.
4. Catat **Flow ID** masing-masing flow (tersedia di Flow Settings).

### 3. Buat file `.env`

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Isi minimal nilai berikut:

```ini
VITE_LANGFLOW_URL=http://localhost:7860
VITE_LANGFLOW_API_KEY=<api-key-langflow>
VITE_LANGFLOW_SEARCH_FLOW_ID=<flow-id-search>
VITE_LANGFLOW_DRAFT_FLOW_ID=<flow-id-draft>
```

Untuk mengirim email asli, tambahkan juga `COMPOSIO_API_KEY`. Daftar lengkap ada di bagian [Konfigurasi](#konfigurasi).

### 4. Jalankan aplikasi

Gunakan dua terminal:

```bash
# Terminal 1: backend (:5000)
npm run server

# Terminal 2: frontend (:5173)
npm run dev
```

### 5. Verifikasi

```bash
curl http://localhost:7860/health      # {"status":"ok"}
curl http://localhost:5000/api/health  # {"ok":true,"composioKey":true,...}
```

`composioKey: true` berarti `COMPOSIO_API_KEY` terdeteksi.

Buka aplikasi di **http://localhost:5173**. Gunakan `localhost`, bukan `127.0.0.1` atau IP LAN, karena backend hanya mengizinkan origin `localhost` (CORS).

## Konfigurasi

Variabel berawalan `VITE_` dibaca frontend dan tertanam saat build, jadi **restart `npm run dev`** setiap kali `.env` diubah.

| Variabel | Dibaca oleh | Wajib | Keterangan |
|---|---|---|---|
| `VITE_LANGFLOW_URL` | Frontend | Ya | URL Langflow, contoh `http://localhost:7860` |
| `VITE_LANGFLOW_API_KEY` | Frontend | Jika flow memakai `x-api-key` | Dari Settings Langflow |
| `VITE_LANGFLOW_SEARCH_FLOW_ID` | Frontend | Ya | Flow ID flow pencarian |
| `VITE_LANGFLOW_DRAFT_FLOW_ID` | Frontend | Ya | Flow ID flow draf |
| `VITE_LANGFLOW_FLOW_ID` | Frontend | Tidak | Fallback lama bila ID pencarian kosong |
| `VITE_DEBUG_LANGFLOW` | Frontend | Tidak | `true` menampilkan panel debug |
| `VITE_COMPOSIO_BACKEND_URL` | Frontend | Tidak | Default `http://localhost:5000`, tanpa slash di akhir |
| `COMPOSIO_API_KEY` | Backend | Untuk kirim email | Tanpa prefix `VITE_`; jangan diletakkan di frontend |
| `COMPOSIO_GMAIL_AUTH_CONFIG_ID` | Backend | Tidak | Dari Composio → Auth Configs → Gmail |
| `COMPOSIO_GMAIL_VERSION` | Backend | Tidak | Menetapkan versi toolkit Gmail |
| `COMPOSIO_PORT` | Backend | Tidak | Default `5000` |

### Script npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan frontend (Vite) di `:5173` |
| `npm run server` | Menjalankan backend (Express) di `:5000` |
| `npm run server:install` | Menginstal dependensi backend |
| `npm run build` | Build produksi |
| `npm run preview` | Pratinjau hasil build |

## Halaman Aplikasi

| Rute | Halaman | Fungsi |
|---|---|---|
| `/` | Landing | Pengenalan produk, cara kerja, harga, dan FAQ |
| `/app` | Dashboard | Ringkasan hasil, grafik pengiriman, corong konversi, aktivitas terbaru, dan status antrean |
| `/app/cari-sponsor` | Cari Sponsor | Pencarian AI, pemilihan sponsor, dan pengisian detail kampanye |
| `/app/cari-sponsor/draft` | Draf dan Kirim | Edit draf, hubungkan Gmail, pemeriksaan sebelum kirim, dan antrean pengiriman |
| `/app/tambah-sponsor` | Tambah Sponsor | Input sponsor manual secara massal, dengan penolakan duplikat |
| `/app/riwayat` | Riwayat | Filter status, ubah hasil per sponsor, dan cek balasan |
| `/app/setting` | Pengaturan | Status Langflow dan backend, mode debug, serta reset data |

## Batas Sistem

| Aturan | Nilai |
|---|---|
| Sponsor per pencarian AI | Maksimal 5 |
| Email per sesi kirim | Maksimal 10 (pengguna diperingatkan, tidak dipotong diam-diam) |
| Timeout request Langflow | 120 detik |
| `input_type` Langflow | Selalu `"chat"` |
| Format draf | Baris `Subjek:` dan `Isi:`, dengan placeholder `[kurung]` |

Beberapa aturan yang dijaga aplikasi:

- Email hanya dikirim jika kolom `To` terisi dan tidak ada placeholder yang tersisa.
- Status `Sent` hanya diberikan setelah Gmail mengonfirmasi pengiriman.
- Data yang tidak tersedia tidak dikarang; field kosong disembunyikan.

**Tingkat relevansi:** Sangat Relevan (80–100), Relevan (60–79), Cukup Relevan (40–59), Kurang Relevan (0–39).

**Status hubungan:** Belum Dihubungi, Terkirim, Dibalas, Diterima, Ditolak, Diacuhkan.

**Status pengiriman:** Queued, Sending, Sent, Failed.

## Struktur Proyek

```text
.
├── index.html
├── vite.config.js
├── .env.example
├── server/                 # Backend Express
│   ├── index.js            # Health check, OAuth Composio, kirim email, cek balasan
│   ├── composio.js         # Client Composio (API key tidak keluar dari server)
│   └── package.json
├── langflow/               # Flow dan dataset untuk diimport ke Langflow
│   ├── SponsorQu Flow.json
│   ├── draft email.json
│   └── sponsor_database_audited_final.txt
└── src/
    ├── main.jsx            # Entry point + ErrorBoundary
    ├── App.jsx             # Router dan guard
    ├── index.css           # Design token
    ├── landing/            # Landing page
    ├── components/         # Shell, panel debug, grafik
    ├── dashboard/          # Halaman-halaman aplikasi
    ├── lib/                # Konstanta, validator, klien Langflow, merge
    └── store/              # State global dan persistensi localStorage
```

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `Failed to fetch` atau error CORS saat menghubungkan Gmail | Backend tidak terjangkau, atau port 5000 dipakai proses lain | Pastikan `npm run server` berjalan di `:5000` dan aplikasi dibuka lewat `localhost:5173` |
| Pencarian gagal atau hasil kosong | Flow ID salah, Langflow mati, API key salah, atau vector database belum terisi | Cek status di halaman Pengaturan, lalu buka panel debug untuk melihat respons mentah |
| Output Langflow "no data" | `input_type` diubah menjadi `"text"` | Gunakan `"chat"` (lihat `src/lib/langflow.js`) |
| Placeholder tidak pernah terisi | LLM menghasilkan frasa placeholder yang berbeda di tiap run | Gunakan tombol **Merge Ulang** di halaman draf |
| Perubahan `.env` tidak berpengaruh | Variabel `VITE_*` tertanam saat start | Restart `npm run dev` |
| Layar putih setelah navigasi | Error render yang tertangkap `ErrorBoundary` | Periksa console browser |
| Status `Sent` tidak muncul | Gmail belum terhubung atau backend mati | Selesaikan koneksi Gmail di halaman draf, lalu cek log server |

## Keamanan

- Jangan commit file `.env`. Repo ini sudah mengabaikan `.env`, `node_modules/`, dan `dist/`; hanya `.env.example` yang di-commit.
- `COMPOSIO_API_KEY` hanya dibaca oleh `server/` dan tidak pernah dikirim ke browser.
- Jika sebuah API key pernah terekspos, buat ulang key tersebut di dashboard Composio atau Langflow, lalu perbarui `.env` lokal Anda.
