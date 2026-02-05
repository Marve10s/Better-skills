# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Bidirectional CLI tool to convert between `.agents/skills/` (industry standard) and `.claude/skills/` (Claude Code format).

## Project Structure

```
src/
  index.ts      - CLI entry point, argument parsing, main flow
  types.ts      - TypeScript type definitions
  detector.ts   - Skill detection, validation, frontmatter parsing
  converter.ts  - Symlink/copy/move operations, conflict handling
  prompts.ts    - Interactive prompts via @inquirer/prompts
tests/
  detector.test.ts    - Skill detection tests
  converter.test.ts   - Conversion logic tests
  integration.test.ts - End-to-end tests
  fixtures/           - Test skill directories
```

## Key Concepts

- Industry standard: `.agents/skills/` used by Cursor, OpenCode, Copilot, Codex (40+ agents)
- Claude Code: Uses `.claude/skills/` with identical SKILL.md format
- Conversion modes: symlink (default), copy, move
- Bidirectional: Can convert in either direction or sync both

## Development

Uses bun for development:

```bash
bun install          # Install dependencies
bun start            # Run locally
bun test             # Run tests
bun test --watch     # Watch mode
bun lint             # Check linting
bun lint:fix         # Fix lint issues
bun run typecheck    # Type check
```

## Dependencies

- Effect-TS for functional patterns
- @inquirer/prompts for interactive arrow-key menus
- yaml for frontmatter parsing
- tsx for Node.js TypeScript execution (for npx/pnpm users)
