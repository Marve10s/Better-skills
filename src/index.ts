#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { Effect } from "effect";
import pc from "picocolors";
import { convertSkills, validateSkill } from "./converter.ts";
import { detectSkills, directoryExists } from "./detector.ts";
import {
  closePrompts,
  displayResults,
  displaySkills,
  printStep,
  printSuccess,
  printWarning,
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
${pc.bold("better-skills")} - Convert between .agents/skills/ and .claude/skills/

${pc.cyan("USAGE")}
  deno run -A jsr:@marve10s/better-skills [options]

${pc.cyan("OPTIONS")}
  --to-claude         .agents/skills/ → .claude/skills/
  --to-agents         .claude/skills/ → .agents/skills/
  --sync              Bidirectional sync
  --mode <mode>       symlink ${pc.dim("(default)")}, copy, move
  --conflict <mode>   skip ${pc.dim("(default)")}, overwrite, backup
  --non-interactive   Skip prompts, use defaults
  --source <dir>      Custom source directory
  --target <dir>      Custom target directory

${pc.cyan("EXAMPLES")}
  ${pc.dim("# Interactive mode")}
  npx better-skills

  ${pc.dim("# Convert to Claude Code format")}
  npx better-skills --to-claude

  ${pc.dim("# Non-interactive")}
  npx better-skills --to-claude --mode symlink --non-interactive
`);
};

const runConversion = async (
  sourceDir: string,
  targetDir: string,
  mode: ConversionMode,
  conflictResolution: ConflictResolution,
  nonInteractive: boolean,
  label?: string,
): Promise<void> => {
  const skills = await Effect.runPromise(detectSkills(sourceDir));

  if (skills.length === 0) {
    printWarning(`No skills found in ${sourceDir}`);
    return;
  }

  if (label) {
    printStep(label);
  }

  displaySkills(skills, sourceDir);

  for (const skill of skills) {
    const { warnings } = validateSkill(skill);
    if (warnings.length > 0) {
      console.log(
        `  ${pc.yellow("!")} ${skill.name}: ${pc.dim(warnings.join(", "))}`,
      );
    }
  }

  let finalMode = mode;
  if (!nonInteractive && !mode) {
    finalMode = await promptConversionMode();
  }
  finalMode = finalMode || "symlink";

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
        printWarning("No skills directories found.");
        process.exit(1);
      }

      const choice = await promptNoSkillsFound();

      switch (choice) {
        case "create":
          fs.mkdirSync(agentsDir, { recursive: true });
          printSuccess(`Created ${AGENTS_SKILLS_DIR}/`);
          console.log(`\n${pc.dim("Add skills with:")} npx skills add <name>`);
          console.log(`${pc.dim("Then run:")} npx better-skills`);
          closePrompts();
          process.exit(0);
          return;

        case "specify":
          sourceDir = await promptCustomDirectory("Source directory:");
          if (!directoryExists(sourceDir!)) {
            printWarning(`Directory not found: ${sourceDir}`);
            closePrompts();
            process.exit(1);
          }
          targetDir = await promptCustomDirectory(
            "Target directory (Enter for .claude/skills/):",
          );
          if (!targetDir) {
            targetDir = claudeDir;
          }
          direction = "to-claude";
          break;

        default:
          closePrompts();
          process.exit(0);
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
    await runConversion(
      agentsDir,
      claudeDir,
      args.mode || "symlink",
      args.conflictResolution || "skip",
      args.nonInteractive || false,
      ".agents → .claude",
    );

    await runConversion(
      claudeDir,
      agentsDir,
      args.mode || "symlink",
      args.conflictResolution || "skip",
      args.nonInteractive || false,
      ".claude → .agents",
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
  process.exit(0);
};

main().catch((error) => {
  console.error(`${pc.red("Error:")} ${error.message}`);
  closePrompts();
  process.exit(1);
});
