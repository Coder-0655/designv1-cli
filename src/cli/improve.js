'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { listFiles, readTextFile } = require('./fs');
const { scanCodebase } = require('./scan');
const { applyHeuristicPolish } = require('./polish/heuristics');
const { proposeEditsWithOpenAI } = require('./polish/openai');

async function improveCodebase({ cwd, flags }) {
  const scan = await scanCodebase({ cwd, flags });
  const mode = flags.apply ? 'apply' : flags.dryRun ? 'dry-run' : 'patch';

  const files = await listFiles({
    cwd,
    maxFiles: flags.maxFiles || 800,
    include: flags.include || null,
    exclude: flags.exclude || null,
  });

  const uiFiles = files.filter((f) => /\.(tsx|jsx|ts|js|mdx)$/.test(f.rel));

  const notes = [];
  const edits = [];

  // 1) Fast, local heuristics (safe, deterministic).
  for (const f of uiFiles) {
    const text = await readTextFile(f.abs);
    if (!text) continue;
    const next = applyHeuristicPolish(text, { filePath: f.rel });
    if (next !== text) edits.push({ rel: f.rel, abs: f.abs, before: text, after: next, source: 'heuristics' });
  }

  // 2) Optional LLM pass (best-effort, only when configured).
  const canUseLLM = Boolean(process.env.OPENAI_API_KEY);
  if (canUseLLM) {
    const model = flags.model || process.env.DESIGNV1_MODEL || 'gpt-4.1-mini';
    notes.push(`LLM enabled via OPENAI_API_KEY (model: ${model}).`);
    const llmEdits = await proposeEditsWithOpenAI({
      cwd,
      model,
      scan,
      instructions: flags.instructions || null,
      candidateFiles: uiFiles.slice(0, 30), // keep bounded
    });
    for (const e of llmEdits) edits.push(e);
  } else {
    notes.push('LLM disabled (set OPENAI_API_KEY to enable).');
  }

  // De-dupe by rel: prefer LLM (later) or last edit.
  const byRel = new Map();
  for (const e of edits) byRel.set(e.rel, e);
  const finalEdits = [...byRel.values()];

  const changedFiles = finalEdits.map((e) => e.rel).sort();

  const outDir = path.join(cwd, '.designv1');
  const patchesDir = path.join(outDir, 'patches');
  const reportsDir = path.join(outDir, 'reports');
  await fs.mkdir(patchesDir, { recursive: true });
  await fs.mkdir(reportsDir, { recursive: true });

  const stamp = new Date().toISOString().replaceAll(':', '-');
  const reportPath = path.join(reportsDir, `improve-${stamp}.json`);
  const patchPath = path.join(patchesDir, `improve-${stamp}.patch`);

  const patch = buildUnifiedPatch(cwd, finalEdits);
  const report = {
    root: cwd,
    mode,
    scan,
    instructions: flags.instructions || null,
    changedFiles,
    edits: finalEdits.map(({ rel, source }) => ({ rel, source })),
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  if (mode === 'apply') {
    for (const e of finalEdits) await fs.writeFile(e.abs, e.after, 'utf8');
    return { root: cwd, mode, changedFiles, patchPath: null, reportPath, notes };
  }

  if (mode === 'dry-run') {
    notes.push('No files written (--dry-run).');
    return { root: cwd, mode, changedFiles, patchPath: null, reportPath, notes };
  }

  await fs.writeFile(patchPath, patch, 'utf8');
  notes.push('Patch written; review and apply with `git apply`.');
  return { root: cwd, mode, changedFiles, patchPath, reportPath, notes };
}

function buildUnifiedPatch(cwd, edits) {
  const lines = [];
  lines.push('# DesignV1 patch');
  lines.push(`# Root: ${cwd}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');
  for (const e of edits) {
    const beforeHash = shortHash(e.before);
    const afterHash = shortHash(e.after);
    lines.push(`diff --git a/${e.rel} b/${e.rel}`);
    lines.push(`index ${beforeHash}..${afterHash} 100644`);
    lines.push(`--- a/${e.rel}`);
    lines.push(`+++ b/${e.rel}`);
    // Minimal hunk: replace whole file (simple + robust without a diff lib)
    const beforeLines = e.before.split('\n');
    const afterLines = e.after.split('\n');
    lines.push(`@@ -1,${beforeLines.length} +1,${afterLines.length} @@`);
    for (const l of beforeLines) lines.push(`-${l}`);
    for (const l of afterLines) lines.push(`+${l}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function shortHash(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 7);
}

module.exports = { improveCodebase };
