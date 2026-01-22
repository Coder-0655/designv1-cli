# DesignV1

`DesignV1` is a CLI that scans the codebase in your current directory and proposes (or applies) UI polish refactors:
- Reads your codebase (Next.js, Tailwind, shadcn/ui, etc.)
- Analyzes UI structure (lightweight heuristics)
- Refactors components (safe heuristics + optional LLM)
- Improves spacing, colors, typography, layout

## Install (local dev)

From this repo:
- `npm i`
- `npm link` (optional, to expose `designv1` on your PATH)

## Install & run anywhere (after publishing to npm)

Once this package is published to npm as `designv1`, users can run it on any machine without cloning:
- Run once (no install): `npx designv1 --help`
- Scan a project: `cd your-project && npx designv1 scan`
- Interactive UI: `cd your-project && npx designv1`

With Bun:
- `cd your-project && bunx designv1 scan`

Or install globally:
- `npm i -g designv1` then run `designv1`

## Usage

Dev (starts the CLI):
- `npm run dev`

Interactive UI (same as `npm run dev`):
- `designv1`

Scan:
- `designv1 scan`
- `designv1 scan --json`

Improve (writes a patch by default):
- `designv1 improve`
- Apply directly: `designv1 improve --apply`
- Dry run: `designv1 improve --dry-run`
- Optional instructions: `designv1 improve --instructions "Only touch src/app/page.tsx"`

### Optional LLM mode

If you set `OPENAI_API_KEY`, `designv1 improve` will also run a best-effort LLM pass over a small, bounded set of candidate UI files.

Environment variables:
- `OPENAI_API_KEY` (required for LLM mode)
- `DESIGNV1_MODEL` (optional, defaults to `gpt-4.1-mini`)

## Output

- Patches: `.designv1/patches/*.patch`
- Reports: `.designv1/reports/*.json`
