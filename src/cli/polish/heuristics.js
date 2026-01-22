'use strict';

// Deterministic, low-risk textual improvements:
// - Prefer `cn(...)` helper when obvious long Tailwind className strings exist
// - Normalize a few common Tailwind tokens for consistency
// - Minor typography defaults (leading, tracking) when present

function applyHeuristicPolish(source, { filePath }) {
  let out = source;

  // Normalize a few common Tailwind class ordering-ish tokens (very light touch).
  out = out.replaceAll(/\btext-zinc-([0-9]{3})\b/g, 'text-neutral-$1');
  out = out.replaceAll(/\bbg-zinc-([0-9]{3})\b/g, 'bg-neutral-$1');
  out = out.replaceAll(/\bborder-zinc-([0-9]{3})\b/g, 'border-neutral-$1');

  // Prefer `text-balance` in obvious headings if Tailwind v3.4+ (best effort).
  out = out.replaceAll(/<h([1-6])([^>]*?)className=(["'`])([^"'`]*?)\3/g, (m, level, attrs, q, cls) => {
    if (cls.includes('text-balance')) return m;
    if (!/\btext-(2xl|3xl|4xl|5xl)\b/.test(cls)) return m;
    return `<h${level}${attrs}className=${q}${cls} text-balance${q}`;
  });

  // If a component uses `className="...very long..."` and already imports cn/clsx/twMerge, wrap it.
  // This is conservative: only converts when the file already has a `cn` identifier in scope.
  if (/\bcn\s*\(/.test(out)) {
    out = out.replaceAll(/\bclassName=(["'`])([^"'`]{60,})\1/g, (m, q, cls) => {
      if (cls.includes('${') || cls.includes('{') || cls.includes('}')) return m;
      if (cls.includes('\n')) return m;
      return `className={cn(${q}${cls}${q})}`;
    });
  }

  // Gentle whitespace: collapse trailing spaces.
  out = out
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n');

  // No-op placeholder for future file-specific rules.
  void filePath;

  return out;
}

module.exports = { applyHeuristicPolish };

