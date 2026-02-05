import { input, select } from "@inquirer/prompts";
import { formatSkillDisplay } from "./detector.ts";
import type {
  ConflictResolution,
  ConversionDirection,
  ConversionMode,
  DetectedSkill,
} from "./types.ts";

export const closePrompts = (): void => {
  // No-op: @inquirer/prompts handles cleanup automatically
};

export const displaySkills = (
  skills: DetectedSkill[],
  sourceDir: string,
): void => {
  console.log(`\nFound ${skills.length} skill(s) in ${sourceDir}:`);

  for (const skill of skills) {
    const display = formatSkillDisplay(skill);
    const status = skill.isSymlink ? "->" : "[OK]";
    console.log(`  ${status} ${skill.name} (${display})`);
  }

  console.log();
};

export const promptConversionMode = async (): Promise<ConversionMode> => {
  const answer = await select({
    message: "Choose conversion mode:",
    choices: [
      {
        name: "Symlink (recommended) - Link to source, both stay in sync",
        value: "symlink" as ConversionMode,
      },
      {
        name: "Copy - Duplicate files to target",
        value: "copy" as ConversionMode,
      },
      {
        name: "Move - Move to target, remove from source",
        value: "move" as ConversionMode,
      },
    ],
    default: "symlink",
  });

  return answer;
};

export const promptConflictResolution = async (
  skillName: string,
): Promise<ConflictResolution> => {
  console.log(`\n[WARN] Conflict: ${skillName} already exists in target`);

  const answer = await select({
    message: "How should conflicts be handled?",
    choices: [
      {
        name: "Skip - Keep existing",
        value: "skip" as ConflictResolution,
      },
      {
        name: "Overwrite - Replace with source version",
        value: "overwrite" as ConflictResolution,
      },
      {
        name: "Backup & Replace - Move existing to _backup/",
        value: "backup" as ConflictResolution,
      },
    ],
    default: "skip",
  });

  return answer;
};

export const promptDirection = async (
  agentsCount: number,
  claudeCount: number,
): Promise<ConversionDirection> => {
  console.log("\nBoth skill directories found:");
  console.log(`  .agents/skills/ (${agentsCount} skills)`);
  console.log(`  .claude/skills/ (${claudeCount} skills)`);

  const answer = await select({
    message: "Choose direction:",
    choices: [
      {
        name: ".agents -> .claude (use industry skills in Claude Code)",
        value: "to-claude" as ConversionDirection,
      },
      {
        name: ".claude -> .agents (export Claude skills to other tools)",
        value: "to-agents" as ConversionDirection,
      },
      {
        name: "Sync both directions",
        value: "sync" as ConversionDirection,
      },
    ],
    default: "to-claude",
  });

  return answer;
};

export const promptNoSkillsFound = async (): Promise<
  "create" | "specify" | "exit"
> => {
  console.log("\n[WARN] No .agents/skills/ directory found.");

  const answer = await select({
    message: "Would you like to:",
    choices: [
      {
        name: "Create .agents/skills/ and add skills with 'npx skills add'",
        value: "create" as const,
      },
      {
        name: "Specify a different source directory",
        value: "specify" as const,
      },
      {
        name: "Exit",
        value: "exit" as const,
      },
    ],
    default: "exit",
  });

  return answer;
};

export const promptCustomDirectory = async (
  prompt: string,
): Promise<string> => {
  const answer = await input({ message: prompt });
  return answer.trim();
};

export const confirm = async (message: string): Promise<boolean> => {
  const answer = await select({
    message,
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
    default: true,
  });

  return answer;
};

export const displayResults = (
  results: Array<{
    skill: DetectedSkill;
    success: boolean;
    action: string;
    error?: string;
  }>,
): void => {
  console.log("\nConversion results:");

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const result of results) {
    if (result.success) {
      if (result.action === "skipped") {
        console.log(
          `  [WARN] ${result.skill.name} (${result.error || "skipped"})`,
        );
        skipCount++;
      } else {
        console.log(`  [OK] ${result.skill.name} -> ${result.action}`);
        successCount++;
      }
    } else {
      console.log(`  [FAIL] ${result.skill.name} (${result.error})`);
      errorCount++;
    }
  }

  console.log();

  if (successCount > 0) {
    console.log(`[DONE] ${successCount} skill(s) converted.`);
  }
  if (skipCount > 0) {
    console.log(`[WARN] ${skipCount} skill(s) skipped.`);
  }
  if (errorCount > 0) {
    console.log(`[FAIL] ${errorCount} skill(s) failed.`);
  }
};

export const print = (message: string): void => {
  console.log(message);
};
