'use strict'

const fs = require('fs')
const path = require('path')

const { chat, getConfig } = require('./llm')

const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'draft.md')

async function runDraft(input) {
  const started = Date.now()
  const cfg = getConfig()

  const prompt = fs
    .readFileSync(PROMPT_PATH, 'utf8')
    .replaceAll('{{context}}', input)

  const out = await chat({
    prompt,
    temperature: cfg.temperatureDraft,
    maxTokens: 2000,
    attempts: 2,
  })

  return {
    text: out.text.trim(),
    meta: {
      provider: out.provider,
      model: out.model,
      attempts: out.attempts,
      ms: Date.now() - started,
      usage: out.usage,
    },
  }
}

module.exports = { runDraft }
