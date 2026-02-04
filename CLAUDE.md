# skills-to-claude

Bidirectional CLI tool to convert between `.agents/skills/` (industry standard) and `.claude/skills/` (Claude Code format).

## Project Structure

```
src/
  index.ts      - CLI entry point, argument parsing, main flow
  types.ts      - TypeScript type definitions
  detector.ts   - Skill detection, validation, frontmatter parsing
  converter.ts  - Symlink/copy/move operations, conflict handling
  prompts.ts    - User interaction via readline
```

## Key Concepts

- Industry standard: `.agents/skills/` used by Cursor, OpenCode, Copilot, Codex (40+ agents)
- Claude Code: Uses `.claude/skills/` with identical SKILL.md format
- Conversion modes: symlink (default), copy, move
- Bidirectional: Can convert in either direction or sync both

## Running Locally

```bash
# npm
npm install
npm start

# pnpm
pnpm install
pnpm start

# bun
bun install
bun start
```

## Dependencies

- Effect-TS for functional patterns
- yaml for frontmatter parsing
- tsx for TypeScript execution (npm/pnpm)

## Testing

Test with a project that has `.agents/skills/` or `.claude/skills/` directories:

```bash
cd /path/to/project-with-skills
npm start -- --to-claude
```
