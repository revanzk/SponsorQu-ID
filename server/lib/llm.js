'use strict'

const DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.1' },
}

class LLMError extends Error {
  constructor(message, { status = 0, retryable = false } = {}) {
    super(message)
    this.name = 'LLMError'
    this.status = status
    this.retryable = retryable
  }
}

function getConfig() {
  const provider = String(process.env.LLM_PROVIDER || 'openai').toLowerCase()
  const defaults = DEFAULTS[provider] || DEFAULTS.openai
  return {
    provider,
    baseUrl: String(process.env.LLM_BASE_URL || defaults.baseUrl).replace(/\/+$/, ''),
    model: String(process.env.LLM_MODEL || defaults.model),
    apiKey: String(process.env.LLM_API_KEY || ''),
    timeoutMs: Math.max(1000, Number(process.env.LLM_TIMEOUT_MS || 60000)),
    temperatureSearch: Number(process.env.LLM_TEMPERATURE_SEARCH || 0.2),
    temperatureDraft: Number(process.env.LLM_TEMPERATURE_DRAFT || 0.1),
    concurrency: Math.max(1, Number(process.env.LLM_CONCURRENCY || 3)),
  }
}

function isConfigured() {
  const cfg = getConfig()
  if (cfg.provider === 'ollama') return true
  return Boolean(cfg.apiKey)
}

let active = 0
const waiting = []

async function withSlot(task, limit) {
  if (active >= limit) {
    await new Promise(resolve => waiting.push(resolve))
  }
  active += 1
  try {
    return await task()
  } finally {
    active -= 1
    const next = waiting.shift()
    if (next) next()
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toMessages(system, prompt) {
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })
  return messages
}

async function readJson(res) {
  const raw = await res.text()
  if (!res.ok) {
    throw new LLMError(`LLM HTTP ${res.status}: ${raw.slice(0, 300)}`, {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new LLMError('Respons LLM bukan JSON yang valid.', { status: res.status })
  }
}

async function requestOpenAI(cfg, messages, temperature, maxTokens, signal) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  })
  const data = await readJson(res)
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new LLMError('LLM tidak mengembalikan konten.')
  return { text, usage: data.usage || null }
}

async function requestGemini(cfg, messages, temperature, maxTokens, signal) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
  const user = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n\n')
  const url = `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { 'x-goog-api-key': cfg.apiKey } : {}),
    },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  })
  const data = await readJson(res)
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts.map(p => p?.text || '').join('').trim()
  if (!text) throw new LLMError('LLM tidak mengembalikan konten.')
  return { text, usage: data.usageMetadata || null }
}

async function requestOllama(cfg, messages, temperature, maxTokens, signal) {
  const res = await fetch(`${cfg.baseUrl}/api/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: false,
      options: { temperature, num_predict: maxTokens },
    }),
  })
  const data = await readJson(res)
  const text = data?.message?.content
  if (!text) throw new LLMError('LLM tidak mengembalikan konten.')
  return {
    text,
    usage: {
      prompt_tokens: data?.prompt_eval_count,
      completion_tokens: data?.eval_count,
    },
  }
}

async function callProvider(cfg, messages, temperature, maxTokens) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    if (cfg.provider === 'gemini') {
      return await requestGemini(cfg, messages, temperature, maxTokens, controller.signal)
    }
    if (cfg.provider === 'ollama') {
      return await requestOllama(cfg, messages, temperature, maxTokens, controller.signal)
    }
    return await requestOpenAI(cfg, messages, temperature, maxTokens, controller.signal)
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new LLMError(`LLM timeout setelah ${cfg.timeoutMs} ms.`, { retryable: true })
    }
    if (err instanceof LLMError) throw err
    throw new LLMError(err?.message || String(err), { retryable: true })
  } finally {
    clearTimeout(timer)
  }
}

async function chat({ system = '', prompt, temperature = 0.2, maxTokens = 3000, attempts = 1 }) {
  const cfg = getConfig()
  if (!isConfigured()) {
    throw new LLMError('LLM_API_KEY belum diisi di .env (atau gunakan LLM_PROVIDER=ollama).')
  }

  const messages = toMessages(system, prompt)
  const total = Math.max(1, Number(attempts) || 1)
  let lastError = null

  for (let attempt = 1; attempt <= total; attempt++) {
    try {
      const out = await withSlot(
        () => callProvider(cfg, messages, temperature, maxTokens),
        cfg.concurrency,
      )
      return { ...out, provider: cfg.provider, model: cfg.model, attempts: attempt }
    } catch (err) {
      lastError = err
      const retryable = err instanceof LLMError && err.retryable
      if (attempt >= total || !retryable) break
      await sleep(500 * attempt)
    }
  }

  throw lastError
}

module.exports = { chat, getConfig, isConfigured, LLMError }
