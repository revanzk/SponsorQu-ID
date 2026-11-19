const BACKEND = () =>
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_COMPOSIO_BACKEND_URL ||
  'http://localhost:5000'

function wrapTexts(texts, meta) {
  return {
    outputs: [{
      outputs: texts.map(text => ({ results: { message: { text } } })),
    }],
    meta,
  }
}

/**
 * Kirim satu permintaan ke backend AI lokal.
 * Signature dipertahankan sama seperti transport Langflow lama agar
 * store.jsx tidak perlu diubah selain import.
 *
 * @param {'search'|'draft'} flowId
 * @param {string} inputValue
 * @returns {Promise<{ok:boolean,data?:object,error?:string,httpStatus?:number,ms:number,raw?:any}>}
 */
export async function runFlow(flowId, inputValue) {
  const flow = flowId === 'draft' ? 'draft' : 'search'
  const url = `${BACKEND()}/api/ai/run`
  const started = Date.now()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow, input: inputValue }),
    })
    const ms = Date.now() - started

    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}`, httpStatus: res.status, ms, raw: data }
    }
    if (!data?.ok) {
      return { ok: false, error: data?.error || 'AI gagal memproses permintaan.', httpStatus: res.status, ms, raw: data }
    }

    const texts = Array.isArray(data.texts) ? data.texts : []
    return { ok: true, data: wrapTexts(texts, data.meta), httpStatus: res.status, ms }
  } catch (err) {
    return {
      ok: false,
      error: `Tidak dapat menghubungi backend AI (${url}): ${err.message}`,
      ms: Date.now() - started,
    }
  }
}

/** Ambil teks kandidat dari respons backend (bentuk menyerupai Langflow). */
export function extractCandidates(data) {
  try {
    const outs = data?.outputs?.[0]?.outputs || []
    return outs
      .map(o => o?.results?.message?.text)
      .filter(t => typeof t === 'string' && t.trim())
  } catch {
    return []
  }
}
