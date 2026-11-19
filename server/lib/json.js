'use strict'

function stripFences(text) {
  return String(text || '')
    .replace(/```[a-zA-Z0-9_-]*\s*/g, '')
    .replace(/```/g, '')
    .trim()
}

function extractJson(text) {
  const clean = stripFences(text)
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Respons AI tidak mengandung JSON.')
  }

  const slice = clean.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    const repaired = slice
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(repaired)
  }
}

module.exports = { extractJson, stripFences }
