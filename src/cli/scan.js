'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { listFiles, readTextFile } = require('./fs');

const UI_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js', '.mdx']);

async function scanCodebase({ cwd, flags }) {
  const files = await listFiles({
    cwd,
    maxFiles: flags.maxFiles || null,
    include: flags.include || null,
    exclude: flags.exclude || null,
  });

  const packageJson = await readPackageJsonSafe(cwd);
  const stack = detectStackFromPackageJson(packageJson);
  const findings = [];

  let uiCount = 0;
  let hasTailwindClasses = false;
  let hasShadcnPatterns = false;
  let hasNextAppRouter = false;
  let hasNextPagesRouter = false;

  for (const f of files) {
    const ext = path.extname(f.rel).toLowerCase();
    if (!UI_EXTS.has(ext)) continue;
    uiCount++;
    const text = await readTextFile(f.abs);
    if (!text) continue;
    if (/\bclass(Name)?\s*=\s*["'`]/.test(text) || /\bclassName\s*:\s*["'`]/.test(text)) {
      if (/\b(p|m|px|py|pt|pb|pl|pr|gap|space-[xy])-\d/.test(text)) hasTailwindClasses = true;
    }
    if (/from\s+['"]@\/components\/ui\//.test(text) || /components\/ui\/button/.test(text)) {
      hasShadcnPatterns = true;
    }
  }

  hasNextAppRouter = await pathExists(path.join(cwd, 'app'));
  hasNextPagesRouter = await pathExists(path.join(cwd, 'pages'));

  if (hasNextAppRouter) stack.push('Next.js App Router (app/)');
  if (hasNextPagesRouter) stack.push('Next.js Pages Router (pages/)');
  if (hasTailwindClasses && !stack.some((s) => s.toLowerCase().includes('tailwind'))) stack.push('Tailwind CSS (class heuristics)');
  if (hasShadcnPatterns && !stack.some((s) => s.toLowerCase().includes('shadcn'))) stack.push('shadcn/ui (import heuristics)');

  findings.push(
    hasTailwindClasses
      ? 'Tailwind classes detected in UI files.'
      : 'No obvious Tailwind class usage detected (could still be present via helpers).'
  );
  findings.push(
    hasShadcnPatterns ? 'shadcn/ui-style imports detected.' : 'No obvious shadcn/ui imports detected.'
  );

  if (uiCount === 0) findings.push('No UI-source files found (.tsx/.jsx/.mdx).');

  return {
    root: cwd,
    stack: uniq(stack),
    files: {
      scanned: files.length,
      ui: uiCount,
    },
    findings,
  };
}

async function readPackageJsonSafe(cwd) {
  try {
    const raw = await fs.readFile(path.join(cwd, 'package.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function detectStackFromPackageJson(pkg) {
  const deps = Object.assign({}, pkg?.dependencies || {}, pkg?.devDependencies || {});
  const stack = [];
  if (deps.next) stack.push(`Next.js (${deps.next})`);
  if (deps.react) stack.push(`React (${deps.react})`);
  if (deps.tailwindcss) stack.push(`Tailwind CSS (${deps.tailwindcss})`);
  if (deps['@radix-ui/react-dialog'] || deps['@radix-ui/react-dropdown-menu']) stack.push('Radix UI (deps)');
  if (deps['class-variance-authority']) stack.push('class-variance-authority (cva)');
  if (deps['tailwind-merge'] || deps['clsx']) stack.push('Classname helpers (clsx/twMerge)');
  return stack;
}

function uniq(arr) {
  return [...new Set(arr)];
}

async function pathExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

module.exports = { scanCodebase };

