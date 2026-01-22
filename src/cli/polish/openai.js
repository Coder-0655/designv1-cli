'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { readTextFile } = require('../fs');

async function proposeEditsWithOpenAI({ cwd, model, scan, instructions, candidateFiles }) {
  // This is best-effort and intentionally minimal; it does not try to be a full agent.
  // It asks the model to return a JSON array of edits with `{ rel, after }`.
  // If anything looks off, we skip.

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const files = [];
  for (const f of candidateFiles) {
    const abs = path.join(cwd, f.rel);
    const text = await readTextFile(abs, 64 * 1024);
    if (!text) continue;
    files.push({ rel: f.rel, text });
  }
  if (!files.length) return [];

  const prompt = buildPrompt({ scan, files, instructions: instructions || null });
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.2,
    }),
  });

  if (!res.ok) return [];
  const json = await res.json();
  const text = extractText(json);
  if (!text) return [];

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const edits = [];
  for (const e of parsed) {
    if (!e || typeof e.rel !== 'string' || typeof e.after !== 'string') continue;
    const abs = path.join(cwd, e.rel);
    const before = await readFileSafe(abs);
    if (before == null) continue;
    if (before === e.after) continue;
    edits.push({ rel: e.rel, abs, before, after: e.after, source: 'openai' });
  }
  return edits;
}

function buildPrompt({ scan, files, instructions }) {
  return [
    {
      role: 'system',
      content:
        'You are a meticulous UI refactor assistant for Next.js + Tailwind + shadcn/ui. ' +
        'You ONLY output valid JSON (no markdown). ' +
        'Return a JSON array of edits: [{ "rel": "path/from/repo", "after": "FULL FILE CONTENT" }]. ' +
        'Do not include files you did not change. ' +
        'Keep changes focused: spacing scale consistency, typography, color tokens, layout structure, accessible components. ' +
        'Do not introduce new dependencies. Do not rename files. Preserve functionality.',
    },
    {
      role: 'user',
      content: JSON.stringify({ scan, files, instructions: instructions || null }, null, 2),
    },
  ];
}

function extractText(json) {
  // Responses API can return mixed output; we take the first text block we find.
  const output = json?.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === 'output_text' && typeof c.text === 'string') return c.text.trim();
    }
  }
  return null;
}

async function readFileSafe(abs) {
  try {
    return await fs.readFile(abs, 'utf8');
  } catch {
    return null;
  }
}

module.exports = { proposeEditsWithOpenAI };
