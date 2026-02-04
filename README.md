# skills-to-claude

Bidirectional converter between `.agents/skills/` (industry standard) and `.claude/skills/` (Claude Code format).

## The Problem

- **Industry standard**: `.agents/skills/` is used by Cursor, OpenCode, Copilot, Codex, and 40+ other agents
- **Claude Code**: Uses `.claude/skills/` with the same SKILL.md format
- **The irony**: The skill format is identical - Claude just does not look in `.agents/skills/`

This tool bridges the gap, letting you use your existing skills in Claude Code or export Claude skills to other tools.

## Quick Start

```bash
git clone https://github.com/Marve10s/skills-to-claude.git
cd skills-to-claude

# Using npm
npm install
npm start

# Using pnpm
pnpm install
pnpm start

# Using bun
bun install
bun start
```

## Usage

### Interactive Mode

```bash
$ npm start

[SCAN] Scanning for skills...

Found 4 skills in .agents/skills/:
  [OK] effect-best-practices (14KB, has references)
  [OK] turborepo (6KB)
  [OK] agent-browser (12KB, has templates)
  [OK] vercel-composition-patterns (8KB, AGENTS.md present)

Target: .claude/skills/

Choose conversion mode:
  [1] Symlink (recommended) - Link to source, both stay in sync
  [2] Copy - Duplicate files to target
  [3] Move - Move to target, remove from source

Selected: Symlink

Converting with mode: symlink...
  [OK] effect-best-practices -> symlinked
  [OK] turborepo -> symlinked
  [OK] agent-browser -> symlinked
  [OK] vercel-composition-patterns -> symlinked

[DONE] 4 skills converted.
```

### Command Line Options

```bash
# Convert .agents -> .claude (default)
npm start -- --to-claude

# Export .claude -> .agents
npm start -- --to-agents

# Bidirectional sync
npm start -- --sync

# Non-interactive with specific settings
npm start -- --to-claude --mode copy --conflict overwrite --non-interactive
```

With pnpm or bun, use the same flags:
```bash
pnpm start --to-claude
bun start --to-claude
```

### All Options

| Option | Description |
|--------|-------------|
| `--source <dir>` | Source directory (default: auto-detect) |
| `--target <dir>` | Target directory (default: auto-detect) |
| `--mode <mode>` | `symlink` (default), `copy`, or `move` |
| `--to-claude` | Convert `.agents/skills/` -> `.claude/skills/` |
| `--to-agents` | Convert `.claude/skills/` -> `.agents/skills/` |
| `--sync` | Bidirectional sync |
| `--conflict <mode>` | `skip` (default), `overwrite`, or `backup` |
| `--non-interactive` | Skip prompts, use defaults |
| `--help` | Show help message |

## Conversion Modes

### Symlink (Recommended)

Creates symbolic links from target to source. Changes in either location are reflected in both.

```
.claude/skills/my-skill -> ../../.agents/skills/my-skill
```

### Copy

Duplicates files to target. Changes must be synced manually.

### Move

Moves files to target, removing from source. Use with caution.

## Conflict Handling

When a skill already exists in the target:

- **Skip**: Keep existing skill (default)
- **Overwrite**: Replace with source version
- **Backup**: Move existing to `_backup/` then replace

## Skill Structure Support

The converter handles various skill structures:

```
skill/
  SKILL.md          - Required - skill definition
  AGENTS.md         - Optional - compiled output
  rules/            - Optional - individual rule files
  scripts/          - Optional - executable scripts (permissions preserved)
  templates/        - Optional - template files
```

## Compatibility

Skills work across tools because the SKILL.md format is standardized:

```yaml
---
name: my-skill
description: What this skill does
allowed-tools: Read, Glob, Grep
---

# My Skill

Instructions for the AI...
```

## Requirements

- Node.js 18+ (with npm or pnpm)
- Or [Bun](https://bun.sh) runtime

## License

MIT
