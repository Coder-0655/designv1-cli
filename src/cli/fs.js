'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_IGNORES = [
  '**/.git/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/.designv1/**',
];

function normalizeSlash(p) {
  return p.replaceAll(path.sep, '/');
}

function globToRegExp(glob) {
  // Very small glob subset: **, *, ?, and path separators.
  // Good enough for our include/exclude flags and ignore list.
  const esc = (s) => s.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  let re = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // ** -> any path segments. Special-case "**/" to also match root-level paths.
        const next = glob[i + 2];
        if (next === '/') {
          re += '(?:.*/)?';
          i += 3;
        } else {
          re += '.*';
          i += 2;
        }
      } else {
        // * -> any segment chars except '/'
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else {
      re += esc(c);
      i += 1;
    }
  }
  re += '$';
  return new RegExp(re);
}

function compileMatchers(globs) {
  const list = (globs || []).filter(Boolean).map(globToRegExp);
  return (p) => list.some((r) => r.test(p));
}

async function* walkFiles(rootDir) {
  const queue = [rootDir];
  while (queue.length) {
    const dir = queue.pop();
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) queue.push(abs);
      else if (ent.isFile()) yield abs;
    }
  }
}

async function listFiles({ cwd, maxFiles, include, exclude }) {
  const isIgnored = compileMatchers(DEFAULT_IGNORES.concat(exclude ? [exclude] : []));
  const isIncluded = include ? compileMatchers([include]) : null;

  const out = [];
  for await (const abs of walkFiles(cwd)) {
    const rel = normalizeSlash(path.relative(cwd, abs));
    if (!rel || rel.startsWith('..')) continue;
    if (isIgnored(rel)) continue;
    if (isIncluded && !isIncluded(rel)) continue;
    out.push({ abs, rel });
    if (maxFiles && out.length >= maxFiles) break;
  }
  return out;
}

async function readTextFile(absPath, maxBytes = 1024 * 256) {
  const buf = await fs.readFile(absPath);
  if (buf.length > maxBytes) return null;
  // naive binary detection
  for (let i = 0; i < Math.min(buf.length, 1000); i++) {
    if (buf[i] === 0) return null;
  }
  return buf.toString('utf8');
}

module.exports = {
  DEFAULT_IGNORES,
  listFiles,
  readTextFile,
  normalizeSlash,
};
