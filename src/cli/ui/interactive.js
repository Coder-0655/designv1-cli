'use strict';

const readline = require('node:readline');
const { scanCodebase } = require('../scan');
const { improveCodebase } = require('../improve');
const { color } = require('../terminal');

async function runInteractiveUI({ cwd }) {
  const ui = createUI();
  try {
    ui.clear();
    ui.write(renderBanner());
    ui.write(`${color.dim('A UI polish agent for your codebase')}\n\n`);

    const started = await ui.startButton();
    if (!started) return;

    ui.write('\n');
    ui.write(color.bold('Optional custom instructions') + '\n');
    ui.write(
      color.dim(
        'Examples: "Only improve src/app/page.tsx" or "Avoid touching src/legacy/**". Leave blank to skip.'
      ) + '\n'
    );
    const instructions = (await ui.promptMultiline('Instructions (end with empty line):')).trim() || null;

    ui.write('\n');
    const include = (await ui.prompt('Include glob (optional, e.g. src/app/**): ')).trim() || null;
    const exclude = (await ui.prompt('Exclude glob (optional, e.g. src/legacy/**): ')).trim() || null;
    const maxFilesRaw = (await ui.prompt('Max files to scan (default 2000): ')).trim();
    const maxFiles = maxFilesRaw ? parseInt(maxFilesRaw, 10) : 2000;

    ui.write('\n');
    ui.write(color.bold('Choose mode') + '\n');
    ui.write(`  1) Patch (recommended)  ${color.dim('writes .designv1/patches/*.patch')}\n`);
    ui.write(`  2) Apply changes        ${color.dim('edits files directly')}\n`);
    ui.write(`  3) Dry run              ${color.dim('no patch, no writes')}\n`);
    const modeSel = (await ui.prompt('Select 1/2/3 (default 1): ')).trim() || '1';

    const flags = {
      json: false,
      apply: modeSel === '2',
      dryRun: modeSel === '3',
      maxFiles: Number.isFinite(maxFiles) ? maxFiles : 2000,
      include,
      exclude,
      instructions,
      model: null,
    };

    ui.write('\n');
    ui.write(color.cyan('Step 1/2: Scanning codebase…') + '\n');
    const report = await scanCodebase({ cwd, flags });
    ui.write(renderScan(report));

    ui.write(color.cyan('Step 2/2: Improving UI…') + '\n');
    const result = await improveCodebase({ cwd, flags });
    ui.write(renderImprove(result));
  } finally {
    ui.close();
  }
}

function renderBanner() {
  const lines = [
    '██████╗ ███████╗███████╗██╗ ██████╗ ███╗   ██╗██╗   ██╗ ██╗',
    '██╔══██╗██╔════╝██╔════╝██║██╔════╝ ████╗  ██║██║   ██║███║',
    '██║  ██║█████╗  ███████╗██║██║  ███╗██╔██╗ ██║██║   ██║╚██║',
    '██║  ██║██╔══╝  ╚════██║██║██║   ██║██║╚██╗██║╚██╗ ██╔╝ ██║',
    '██████╔╝███████╗███████║██║╚██████╔╝██║ ╚████║ ╚████╔╝  ██║',
    '╚═════╝ ╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝  ╚═══╝   ╚═╝',
    '',
  ];
  return `${color.bold(lines.join('\n'))}\n`;
}

function renderScan(report) {
  const lines = [];
  lines.push(`Root: ${report.root}`);
  lines.push(`Files scanned: ${report.files.scanned}`);
  lines.push(`UI files: ${report.files.ui}`);
  lines.push('');
  lines.push(color.bold('Detected stack'));
  for (const item of report.stack) lines.push(`- ${item}`);
  lines.push('');
  lines.push(color.bold('Findings'));
  for (const f of report.findings) lines.push(`- ${f}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderImprove(result) {
  const lines = [];
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Files changed: ${result.changedFiles.length}`);
  if (result.patchPath) lines.push(`Patch: ${result.patchPath}`);
  if (result.reportPath) lines.push(`Report: ${result.reportPath}`);
  if (result.notes.length) {
    lines.push('');
    lines.push(color.bold('Notes'));
    for (const n of result.notes) lines.push(`- ${n}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function createUI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const write = (s) => process.stdout.write(s);
  const clear = () => write('\u001b[2J\u001b[H');

  const prompt = (q) =>
    new Promise((resolve) => {
      rl.question(q, resolve);
    });

  const promptMultiline = async (label) => {
    write(`${label}\n`);
    const lines = [];
    // Use a temporary listener to collect lines until blank.
    // We can't reuse rl.question in a loop cleanly without flicker; this is fine.
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const line = await prompt('> ');
      if (!line.trim()) break;
      lines.push(line);
    }
    return lines.join('\n');
  };

  const startButton = () =>
    new Promise((resolve) => {
      write(color.bold('Press Enter to ') + color.green('[ Start ]') + color.bold(' or Ctrl+C to exit') + '\n');
      const onData = (buf) => {
        const s = buf.toString('utf8');
        if (s === '\r' || s === '\n') {
          cleanup();
          resolve(true);
        }
      };
      const cleanup = () => {
        process.stdin.off('data', onData);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
      };
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.on('data', onData);
    });

  const close = () => rl.close();

  return { write, clear, prompt, promptMultiline, startButton, close };
}

module.exports = { runInteractiveUI };
