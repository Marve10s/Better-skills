# better-skills

Bidirectional CLI tool to convert between `.agents/skills/` (industry standard) and `.claude/skills/` (Claude Code format).

## Project Structure

```
src/
  index.ts      - CLI entry point, argument parsing, main flow
  types.ts      - TypeScript type definitions
  detector.ts   - Skill detection, validation, frontmatter parsing
  converter.ts  - Symlink/copy/move operations, conflict handling
  prompts.ts    - User interaction via readline
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

## User Usage (no clone required)

```bash
# Run directly with npx, pnpm dlx, or bunx
npx better-skills
pnpm dlx better-skills
bunx better-skills

# With options
npx better-skills --to-claude
npx better-skills --sync --mode copy
```

## Development

Uses bun for development:

```bash
# Install
bun install

# Run locally
bun start

# Run tests
bun test
bun test --watch

# Lint
bun lint
bun lint:fix

# Type check
bun run typecheck
```

## Dependencies

- Effect-TS for functional patterns
- yaml for frontmatter parsing
- tsx for Node.js TypeScript execution (for npx/pnpm users)
