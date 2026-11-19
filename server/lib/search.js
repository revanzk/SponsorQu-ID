'use strict'

const fs = require('fs')
const path = require('path')

const catalog = require('./catalog')
const { chat, getConfig } = require('./llm')
const { extractJson } = require('./json')

const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'search.md')
const MAX_SPONSORS = 5
const MIN_SPONSORS = 3

function scoreToLevel(score) {
  if (score >= 80) return 'Sangat Relevan'
  if (score >= 60) return 'Relevan'
  if (score >= 40) return 'Cukup Relevan'
  return 'Kurang Relevan'
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/[;\n]/).map(item => item.trim()).filter(Boolean)
  }
  return []
}

function toFrontend(row, item) {
  const raw = Math.round(Number(item?.relevance_score) || 0)
  const score = Math.min(100, Math.max(0, raw))
  return {
    sponsor_name: row.sponsor_name,
    industry: row.industry || null,
    location: row.location || null,
    relevance_score: score,
    relevance_level: scoreToLevel(score),
    reason: asList(item?.reason).slice(0, 5),
    support_type: asList(item?.support_type).slice(0, 6),
    contact_email: row.contact_email || null,
    website: row.website || null,
    source: 'ai',
  }
}

async function runSearch(input) {
  const started = Date.now()
  const cfg = getConfig()
  const mode = String(process.env.LLM_CATALOG_MODE || 'catalog').toLowerCase()

  const rows = mode === 'bm25'
    ? catalog.bm25(input, Number(process.env.LLM_BM25_TOP || 20))
    : catalog.all()

  const catalogText = catalog.renderRows(rows)
  const prompt = fs
    .readFileSync(PROMPT_PATH, 'utf8')
    .replaceAll('{{user_input}}', input)
    .replaceAll('{{catalog}}', catalogText)

  const out = await chat({
    prompt,
    temperature: cfg.temperatureSearch,
    maxTokens: 3000,
    attempts: Math.max(1, Number(process.env.LLM_SEARCH_ATTEMPTS || 2)),
  })

  const parsed = extractJson(out.text)
  const items = Array.isArray(parsed?.sponsor) ? parsed.sponsor : []

  const seen = new Set()
  const sponsors = []
  let unknownIds = 0

  for (const item of items) {
    const row = catalog.getById(item?.sponsor_id) || catalog.findByName(item?.sponsor_name)
    if (!row) {
      unknownIds += 1
      continue
    }
    if (seen.has(row.sponsor_id)) continue
    seen.add(row.sponsor_id)
    sponsors.push(toFrontend(row, item))
  }

  sponsors.sort((a, b) => b.relevance_score - a.relevance_score)
  const capped = sponsors.slice(0, MAX_SPONSORS)

  const payload = {
    summary: String(parsed?.summary || '').trim(),
    sponsor: capped,
  }

  return {
    text: JSON.stringify(payload),
    meta: {
      provider: out.provider,
      model: out.model,
      mode,
      catalogRows: rows.length,
      catalogChars: catalogText.length,
      requested: items.length,
      matched: sponsors.length,
      returned: capped.length,
      unknownIds,
      minSponsors: MIN_SPONSORS,
      attempts: out.attempts,
      ms: Date.now() - started,
      usage: out.usage,
    },
  }
}

module.exports = { runSearch }
