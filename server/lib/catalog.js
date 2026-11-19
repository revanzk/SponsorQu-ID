'use strict'

const fs = require('fs')
const path = require('path')

const DATA_PATH = path.join(__dirname, '..', 'data', 'sponsors.json')
let cache = null

const STOPWORDS = new Set([
  'dan', 'atau', 'yang', 'untuk', 'dengan', 'di', 'ke', 'dari', 'pada', 'dalam',
  'acara', 'event', 'sponsor', 'sponsorship', 'kami', 'kita', 'akan', 'ini', 'itu',
  'adalah', 'para', 'sebuah', 'the', 'and', 'for', 'with', 'of', 'in', 'on', 'a',
])

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

function load() {
  if (cache) return cache
  const rows = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
  if (!Array.isArray(rows)) throw new Error('sponsors.json harus berupa array.')
  cache = rows.map((row, index) => ({
    ...row,
    sponsor_id: clean(row.sponsor_id) || `S${String(index + 1).padStart(3, '0')}`,
    sponsor_name: clean(row.sponsor_name),
    industry: clean(row.industry),
    location: clean(row.location),
    audience: clean(row.audience),
    sponsorship_types: clean(row.sponsorship_types),
    preferred_event_types: clean(row.preferred_event_types),
    partnership_signal: clean(row.partnership_signal),
    contact_email: clean(row.contact_email),
    website: clean(row.website),
    text: clean(row.text),
  }))
  return cache
}

function all() {
  return load()
}

function getById(id) {
  const key = clean(id).toLowerCase()
  if (!key) return null
  return load().find(row => row.sponsor_id.toLowerCase() === key) || null
}

function normalizeName(value) {
  return clean(value)
    .toLowerCase()
    .replace(/^pt\.?\s+|^cv\.?\s+|^tbk\.?\s+/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function findByName(name) {
  const key = normalizeName(name)
  if (!key) return null
  const rows = load()
  return rows.find(row => normalizeName(row.sponsor_name) === key)
    || rows.find(row => normalizeName(row.sponsor_name).includes(key))
    || null
}

function formatLine(row) {
  const parts = [
    `[${row.sponsor_id}] ${row.sponsor_name}`,
    `industri: ${row.industry || '-'}`,
    `lokasi: ${row.location || '-'}`,
    `audiens: ${row.audience ? row.audience.slice(0, 140) : '-'}`,
    `dukungan: ${row.sponsorship_types ? row.sponsorship_types.slice(0, 160) : '-'}`,
    `event: ${row.preferred_event_types ? row.preferred_event_types.slice(0, 120) : '-'}`,
    `sinyal: ${row.partnership_signal ? row.partnership_signal.slice(0, 160) : '-'}`,
    `profil: ${row.text ? row.text.slice(0, 200) : '-'}`,
  ]
  return parts.join(' | ')
}

function renderRows(rows) {
  return rows.map(formatLine).join('\n')
}

function renderCatalog(maxChars) {
  const limit = Math.max(1000, Number(maxChars || process.env.LLM_CATALOG_MAX_CHARS || 100000))
  const lines = []
  let used = 0
  for (const row of load()) {
    const line = formatLine(row)
    if (used + line.length + 1 > limit) break
    lines.push(line)
    used += line.length + 1
  }
  return lines.join('\n')
}

function tokenize(value) {
  return clean(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 1 && !STOPWORDS.has(token))
}

function bm25(query, limit = 20) {
  const rows = load()
  const docs = rows.map(row => tokenize([
    row.sponsor_name,
    row.industry,
    row.audience,
    row.sponsorship_types,
    row.preferred_event_types,
    row.text,
  ].join(' ')))

  const totalDocs = docs.length
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, totalDocs)
  const docFreq = new Map()
  for (const doc of docs) {
    for (const term of new Set(doc)) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1)
    }
  }

  const queryTerms = tokenize(query)
  const scored = docs.map((doc, index) => {
    const freq = new Map()
    for (const term of doc) freq.set(term, (freq.get(term) || 0) + 1)

    let score = 0
    for (const term of queryTerms) {
      const f = freq.get(term) || 0
      if (!f) continue
      const df = docFreq.get(term) || 0
      const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5))
      score += idf * (f * 2.5) / (f + 1.5 * (0.25 + 0.75 * doc.length / Math.max(1, avgLength)))
    }
    return { row: rows[index], score }
  })

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map(item => item.row)
}

function summary() {
  const rows = load()
  const industries = new Set(rows.map(row => row.industry).filter(Boolean))
  return { count: rows.length, industries: industries.size }
}

module.exports = { all, getById, findByName, renderCatalog, renderRows, bm25, summary }
