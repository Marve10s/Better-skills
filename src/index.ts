#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { Effect } from "effect";
import { convertSkills, validateSkill } from "./converter.ts";
import { detectSkills, directoryExists } from "./detector.ts";
import {
  closePrompts,
  displayResults,
  displaySkills,
  print,
  promptConflictResolution,
  promptConversionMode,
  promptCustomDirectory,
  promptDirection,
  promptNoSkillsFound,
} from "./prompts.ts";
import type {
  ConflictResolution,
  ConversionDirection,
  ConversionMode,
  ConversionOptions,
} from "./types.ts";

const AGENTS_SKILLS_DIR = ".agents/skills";
const CLAUDE_SKILLS_DIR = ".claude/skills";

const parseArgs = (): Partial<ConversionOptions> & { help?: boolean } => {
  const args = process.argv.slice(2);
  const options: Partial<ConversionOptions> & { help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--source":
        options.source = args[++i];
        break;
      case "--target":
        options.target = args[++i];
        break;
      case "--mode":
        options.mode = args[++i] as ConversionMode;
        break;
      case "--to-claude":
        options.direction = "to-claude";
        break;
      case "--to-agents":
        options.direction = "to-agents";
        break;
      case "--sync":
        options.direction = "sync";
        break;
      case "--non-interactive":
        options.nonInteractive = true;
        break;
      case "--conflict":
        options.conflictResolution = args[++i] as ConflictResolution;
        break;
    }
  }

  return options;
};

const showHelp = (): void => {
  console.log(`
better-skills - Bidirectional converter between .agents/skills/ and .claude/skills/

USAGE:
  deno run -A jsr:@marve10s/better-skills [options]

INSTALL GLOBALLY:
  deno install -A -g -n better-skills jsr:@marve10s/better-skills
  better-skills [options]

OPTIONS:
  --source <dir>      Source directory (default: auto-detect)
  --target <dir>      Target directory (default: auto-detect)
  --mode <mode>       Conversion mode: symlink, copy, move (default: symlink)
  --to-claude         Convert .agents/skills/ -> .claude/skills/
  --to-agents         Convert .claude/skills/ -> .agents/skills/
  --sync              Bidirectional sync
  --non-interactive   Skip prompts, use defaults
  --conflict <mode>   Conflict resolution: skip, overwrite, backup (default: skip)
  --help              Show this help message

EXAMPLES:
  # Interactive mode (auto-detects direction)
  npx better-skills

  # Convert industry skills to Claude Code format
  npx better-skills --to-claude

  # Export Claude skills to industry standard format
  npx better-skills --to-agents

  # Bidirectional sync with symlinks
  npx better-skills --sync

  # Non-interactive with specific settings
  npx better-skills --to-claude --mode copy --conflict overwrite --non-interactive
`);
};

const runConversion = async (
  sourceDir: string,
  targetDir: string,
  mode: ConversionMode,
  conflictResolution: ConflictResolution,
  nonInteractive: boolean,
): Promise<void> => {
  const skills = await Effect.runPromise(detectSkills(sourceDir));

  if (skills.length === 0) {
    print(`No skills found in ${sourceDir}`);
    return;
  }

  displaySkills(skills, sourceDir);

  for (const skill of skills) {
    const { warnings } = validateSkill(skill);
    if (warnings.length > 0) {
      print(`  [WARN] ${skill.name}: ${warnings.join(", ")}`);
    }
  }

  print(`Target: ${targetDir}`);
  print("");

  let finalMode = mode;
  if (!nonInteractive && !mode) {
    finalMode = await promptConversionMode();
  }
  finalMode = finalMode || "symlink";

  print(`\nConverting with mode: ${finalMode}...`);

  let finalConflictResolution = conflictResolution || "skip";

  if (!nonInteractive) {
    for (const skill of skills) {
      const targetPath = path.join(targetDir, skill.name);
      if (fs.existsSync(targetPath)) {
        try {
          if (fs.lstatSync(targetPath).isSymbolicLink()) {
            const linkTarget = fs.readlinkSync(targetPath);
            const resolvedTarget = path.resolve(
              path.dirname(targetPath),
              linkTarget,
            );
            const resolvedSource = path.resolve(skill.path);
            if (resolvedTarget === resolvedSource) {
              continue;
            }
          }
        } catch {}

        finalConflictResolution = await promptConflictResolution(skill.name);
        break;
      }
    }
  }

  const results = await Effect.runPromise(
    convertSkills(skills, targetDir, finalMode, finalConflictResolution),
  );

  displayResults(results);
};

const main = async (): Promise<void> => {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  print("[SCAN] Scanning for skills...");

  const cwd = process.cwd();
  const agentsDir = path.join(cwd, AGENTS_SKILLS_DIR);
  const claudeDir = path.join(cwd, CLAUDE_SKILLS_DIR);

  const hasAgents = directoryExists(agentsDir);
  const hasClaude = directoryExists(claudeDir);

  let direction: ConversionDirection = args.direction || "to-claude";
  let sourceDir = args.source;
  let targetDir = args.target;

  if (!args.direction && !args.source && !args.target) {
    if (hasAgents && hasClaude && !args.nonInteractive) {
      const agentsSkills = await Effect.runPromise(detectSkills(agentsDir));
      const claudeSkills = await Effect.runPromise(detectSkills(claudeDir));
      direction = await promptDirection(
        agentsSkills.length,
        claudeSkills.length,
      );
    } else if (hasAgents) {
      direction = "to-claude";
    } else if (hasClaude) {
      direction = "to-agents";
    } else {
      if (args.nonInteractive) {
        print("[WARN] No skills directories found.");
        process.exit(1);
      }

      const choice = await promptNoSkillsFound();

      switch (choice) {
        case "create":
          fs.mkdirSync(agentsDir, { recursive: true });
          print(`\n[OK] Created ${AGENTS_SKILLS_DIR}/`);
          print("\nTo add skills, run:");
          print("  npx skills add <skill-name>");
          print("\nThen run this tool again to convert them.");
          closePrompts();
          return;

        case "specify":
          sourceDir = await promptCustomDirectory("Enter source directory: ");
          if (!directoryExists(sourceDir!)) {
            print(`[WARN] Directory not found: ${sourceDir}`);
            closePrompts();
            process.exit(1);
          }
          targetDir = await promptCustomDirectory(
            "Enter target directory (or press Enter for .claude/skills/): ",
          );
          if (!targetDir) {
            targetDir = claudeDir;
          }
          direction = "to-claude";
          break;

        default:
          closePrompts();
          return;
      }
    }
  }

  if (!sourceDir || !targetDir) {
    switch (direction) {
      case "to-claude":
        sourceDir = sourceDir || agentsDir;
        targetDir = targetDir || claudeDir;
        break;
      case "to-agents":
        sourceDir = sourceDir || claudeDir;
        targetDir = targetDir || agentsDir;
        break;
      case "sync":
        break;
    }
  }

  if (direction === "sync") {
    print("\n[SYNC] Syncing skills bidirectionally...\n");

    print(`${AGENTS_SKILLS_DIR}/ -> ${CLAUDE_SKILLS_DIR}/:`);
    await runConversion(
      agentsDir,
      claudeDir,
      args.mode || "symlink",
      args.conflictResolution || "skip",
      args.nonInteractive || false,
    );

    print(`\n${CLAUDE_SKILLS_DIR}/ -> ${AGENTS_SKILLS_DIR}/:`);
    await runConversion(
      claudeDir,
      agentsDir,
      args.mode || "symlink",
      args.conflictResolution || "skip",
      args.nonInteractive || false,
    );

    print(
      "\n[DONE] Skills synced! Changes in either location will be reflected.",
    );
  } else {
    await runConversion(
      sourceDir!,
      targetDir!,
      args.mode || "symlink",
      args.conflictResolution || "skip",
      args.nonInteractive || false,
    );
  }

  closePrompts();
};

main().catch((error) => {
  console.error("Error:", error.message);
  closePrompts();
  process.exit(1);
});
