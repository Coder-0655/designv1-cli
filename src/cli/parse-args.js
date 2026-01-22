'use strict';

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : null;
  const rest = command ? args.slice(1) : args;

  const flags = {
    help: false,
    version: false,
    json: false,
    apply: false,
    dryRun: false,
    maxFiles: null,
    include: null,
    exclude: null,
    model: null,
    instructions: null,
  };

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '-h' || a === '--help') flags.help = true;
    else if (a === '-v' || a === '--version') flags.version = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--apply') flags.apply = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--max-files') flags.maxFiles = parseInt(rest[++i] || '', 10);
    else if (a === '--include') flags.include = rest[++i] || null;
    else if (a === '--exclude') flags.exclude = rest[++i] || null;
    else if (a === '--model') flags.model = rest[++i] || null;
    else if (a === '--instructions' || a === '--instruction') flags.instructions = rest[++i] || null;
  }

  return { command, flags };
}

function formatHelp() {
  return (
    [
      'DesignV1 — UI polish agent for codebases',
      '',
      'Usage:',
      '  designv1                 # interactive UI',
      '  designv1 scan [--json] [--max-files N] [--include glob] [--exclude glob]',
      '  designv1 improve [--apply|--dry-run] [--max-files N] [--include glob] [--exclude glob] [--model name] [--instructions text]',
      '',
      'Notes:',
      '  - Without --apply, improve writes a patch to .designv1/patches.',
      '  - If OPENAI_API_KEY is set, improve can use an LLM to propose edits.',
      '',
    ].join('\n') + '\n'
  );
}

module.exports = { parseArgs, formatHelp };
