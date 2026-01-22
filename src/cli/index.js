'use strict';

const path = require('node:path');
const { scanCodebase } = require('./scan');
const { improveCodebase } = require('./improve');
const { formatHelp, parseArgs } = require('./parse-args');
const { color } = require('./terminal');
const { runInteractiveUI } = require('./ui/interactive');

async function main(argv) {
  const { command, flags } = parseArgs(argv);

  if (!command && !flags.help && !flags.version) {
    await runInteractiveUI({ cwd: process.cwd() });
    return;
  }

  if (flags.help || command === 'help' || !command) {
    process.stdout.write(formatHelp());
    return;
  }

  if (flags.version || command === 'version') {
    const pkg = require(path.join(process.cwd(), 'package.json'));
    process.stdout.write(`${pkg.name}@${pkg.version}\n`);
    return;
  }

  const cwd = process.cwd();

  if (command === 'scan') {
    const report = await scanCodebase({ cwd, flags });
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    process.stdout.write(renderScanReport(report));
    return;
  }

  if (command === 'improve') {
    const result = await improveCodebase({ cwd, flags });
    process.stdout.write(renderImproveResult(result));
    return;
  }

  process.stderr.write(color.red(`Unknown command: ${command}\n`));
  process.stderr.write(formatHelp());
  process.exitCode = 2;
}

function renderScanReport(report) {
  const lines = [];
  lines.push(color.bold('DesignV1 scan'));
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

function renderImproveResult(result) {
  const lines = [];
  lines.push(color.bold('DesignV1 improve'));
  lines.push(`Root: ${result.root}`);
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

module.exports = { main };
