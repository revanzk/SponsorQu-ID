# sponsorQU

Aplikasi pencarian sponsor event berbasis AI: cari sponsor yang relevan, susun kampanye, buat template email, lalu kirim dan pantau balasan lewat Gmail.

Repo ini adalah versi bersih dari `revanzk/sponsorQu`: tanpa Langflow, Astra DB, atau Cohere. Pencocokan sponsor dan pembuatan draft email dilakukan langsung oleh LLM (OpenAI-compatible / Gemini / Ollama) melalui backend Express lokal. Integrasi Gmail tetap memakai Composio.

## Arsitektur

```
Browser (React + Vite)
        │
        ├── POST /api/ai/run        → LLM (search / draft)
        ├── GET  /api/ai/catalog    → daftar sponsor
        ├── GET  /api/health        → status AI + Composio
        └── /api/composio/*, /api/send-email, /api/check-replies
                                        │
                                    Composio (Gmail)
```

- `server/data/sponsors.json` — 102 sponsor hasil audit; sumber kebenaran untuk nama, industri, lokasi, kontak, dan website.
- `server/prompts/search.md` — LLM hanya memilih `sponsor_id` + skor + alasan; detail kontak diisi server dari dataset (anti-halusinasi).
- `server/prompts/draft.md` — aturan placeholder `[nama_perusahaan]` dan whitelist field.
- `src/lib/ai.js` — transport AI di frontend (signature kompatibel dengan store lama).

## Menjalankan

Prasyarat: Node.js 20+ dan npm.

```bash
npm install
npm run server:install
cp .env.example .env    # Windows: copy .env.example .env
```

Isi `.env` minimal:

```env
LLM_BASE_URL=http://localhost:20128/v1
LLM_MODEL=<model-yang-tersedia-di-9router>
LLM_API_KEY=<key-jika-diperlukan>
COMPOSIO_API_KEY=<key-composio>
```

Mode pengembangan (Vite :5173 + backend :5000):

```bash
npm run server
npm run dev
```

Mode produksi satu port (Express menyajikan `dist/`):

```bash
npm run build
npm start
# buka http://localhost:5000
```

## Variabel lingkungan

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `LLM_PROVIDER` | `openai` | `openai`, `gemini`, atau `ollama` |
| `LLM_BASE_URL` | sesuai provider | Base URL OpenAI-compatible, mis. `http://localhost:20128/v1` |
| `LLM_MODEL` | sesuai provider | Nama model di provider |
| `LLM_API_KEY` | kosong | Tidak wajib untuk `ollama` |
| `LLM_TEMPERATURE_SEARCH` | `0.2` | Temperatur pencocokan sponsor |
| `LLM_TEMPERATURE_DRAFT` | `0.1` | Temperatur pembuatan draft |
| `LLM_TIMEOUT_MS` | `60000` | Timeout per panggilan LLM |
| `LLM_SEARCH_ATTEMPTS` | `2` | Retry saat error transient |
| `LLM_CONCURRENCY` | `3` | Batas panggilan LLM bersamaan |
| `LLM_CATALOG_MODE` | `catalog` | `catalog` (semua sponsor) atau `bm25` (top-N lokal) |
| `LLM_CATALOG_MAX_CHARS` | `100000` | Batas ukuran katalog yang dikirim |
| `LLM_BM25_TOP` | `20` | Jumlah kandidat pada mode `bm25` |
| `PORT` / `COMPOSIO_PORT` | `5000` | Port backend |
| `COMPOSIO_API_KEY` | — | Key Composio |
| `COMPOSIO_GMAIL_AUTH_CONFIG_ID` | `ac_Im0mILtarfgb` | Auth config Gmail |
| `COMPOSIO_GMAIL_VERSION` | `20260915_00` | Versi tool Gmail Composio |
| `VITE_BACKEND_URL` | `http://localhost:5000` | URL backend dari browser |
| `VITE_DEBUG_AI` | `false` | Tampilkan Debug Panel secara default |

## Endpoint backend

- `GET /api/health` — status AI, ukuran katalog, dan konfigurasi Composio.
- `GET /api/ai/catalog` — daftar sponsor (tanpa kontak).
- `POST /api/ai/run` — body `{ "flow": "search" | "draft", "input": "..." }` → `{ ok, texts: [...], meta }`.
- `GET /api/composio/accounts?userId=...`
- `POST /api/composio/link`
- `GET /api/composio/accounts/:id`
- `POST /api/send-email`
- `POST /api/check-replies`

## Keamanan

- `.env` tidak pernah masuk repo; hanya `.env.example` yang di-commit.
- Jangan menaruh API key di variabel `VITE_*` — semua nilai `VITE_*` ikut ter-bundle ke browser.
- Rotasi kunci lama dari repo sebelumnya (Langflow, Composio, Cohere) karena sudah pernah terekspos di history publik.
