# better-skills

[![JSR](https://jsr.io/badges/@marve10s/better-skills)](https://jsr.io/@marve10s/better-skills)

Bidirectional converter between `.agents/skills/` (industry standard) and `.claude/skills/` (Claude Code format).

## Quick Start

**Run this command in your project directory** (where your `.agents/skills/` or `.claude/skills/` folder is):

```bash
# Using Deno (recommended)
deno run -A jsr:@marve10s/better-skills

# Using npx (Node.js)
npx better-skills

# Using pnpm
pnpm dlx better-skills

# Using bun
bunx better-skills
```

That's it. No installation, no cloning. The interactive wizard guides you through the conversion.

## The Problem

- **Industry standard**: `.agents/skills/` is used by Cursor, OpenCode, Copilot, Codex, and 40+ other AI tools
- **Claude Code**: Uses `.claude/skills/` with the same SKILL.md format
- **The gap**: Claude Code doesn't look in `.agents/skills/`

This tool bridges the gap with one command.

## Examples

```bash
# Interactive mode - auto-detects and prompts for options
deno run -A jsr:@marve10s/better-skills

# Convert .agents/skills → .claude/skills (for Claude Code)
deno run -A jsr:@marve10s/better-skills --to-claude

# Convert .claude/skills → .agents/skills (export to other tools)
deno run -A jsr:@marve10s/better-skills --to-agents

# Sync both directions
deno run -A jsr:@marve10s/better-skills --sync

# Non-interactive with all options
deno run -A jsr:@marve10s/better-skills --to-claude --mode symlink --conflict skip --non-interactive
```

## Options

| Option | Description |
|--------|-------------|
| `--to-claude` | Convert `.agents/skills/` → `.claude/skills/` |
| `--to-agents` | Convert `.claude/skills/` → `.agents/skills/` |
| `--sync` | Bidirectional sync |
| `--mode <mode>` | `symlink` (default), `copy`, or `move` |
| `--conflict <mode>` | `skip` (default), `overwrite`, or `backup` |
| `--non-interactive` | Skip prompts, use defaults |
| `--source <dir>` | Custom source directory |
| `--target <dir>` | Custom target directory |
| `--help` | Show help |

## Conversion Modes

| Mode | Description |
|------|-------------|
| **symlink** | Creates links - changes sync automatically (recommended) |
| **copy** | Duplicates files - changes must be synced manually |
| **move** | Moves files - removes from source |

## Requirements

- [Deno](https://deno.land) (recommended), Node.js 18+, or [Bun](https://bun.sh)

## License

MIT
