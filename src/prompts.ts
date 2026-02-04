import * as readline from "node:readline";
import type {
  ConversionMode,
  ConflictResolution,
  ConversionDirection,
  DetectedSkill,
} from "./types.js";
import { formatSkillDisplay } from "./detector.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question: string): Promise<string> =>
  new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });

export const closePrompts = (): void => {
  rl.close();
};

export const displaySkills = (
  skills: DetectedSkill[],
  sourceDir: string
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
  console.log("Choose conversion mode:");
  console.log("  [1] Symlink (recommended) - Link to source, both stay in sync");
  console.log("  [2] Copy - Duplicate files to target");
  console.log("  [3] Move - Move to target, remove from source");
  console.log();

  const answer = await ask("Selection [1]: ");
  const choice = parseInt(answer) || 1;

  switch (choice) {
    case 2:
      return "copy";
    case 3:
      return "move";
    default:
      return "symlink";
  }
};

export const promptConflictResolution = async (
  skillName: string
): Promise<ConflictResolution> => {
  console.log(`\n[WARN] Conflict: ${skillName} already exists in target`);
  console.log();
  console.log("Options:");
  console.log("  [1] Skip - Keep existing");
  console.log("  [2] Overwrite - Replace with source version");
  console.log("  [3] Backup & Replace - Move existing to _backup/");
  console.log();

  const answer = await ask("Selection [1]: ");
  const choice = parseInt(answer) || 1;

  switch (choice) {
    case 2:
      return "overwrite";
    case 3:
      return "backup";
    default:
      return "skip";
  }
};

export const promptDirection = async (
  agentsCount: number,
  claudeCount: number
): Promise<ConversionDirection> => {
  console.log("\nBoth skill directories found:");
  console.log(`  .agents/skills/ (${agentsCount} skills)`);
  console.log(`  .claude/skills/ (${claudeCount} skills)`);
  console.log();
  console.log("Choose direction:");
  console.log("  [1] .agents -> .claude (use industry skills in Claude Code)");
  console.log("  [2] .claude -> .agents (export Claude skills to other tools)");
  console.log("  [3] Sync both directions");
  console.log();

  const answer = await ask("Selection [1]: ");
  const choice = parseInt(answer) || 1;

  switch (choice) {
    case 2:
      return "to-agents";
    case 3:
      return "sync";
    default:
      return "to-claude";
  }
};

export const promptNoSkillsFound = async (): Promise<"create" | "specify" | "exit"> => {
  console.log("\n[WARN] No .agents/skills/ directory found.");
  console.log();
  console.log("Would you like to:");
  console.log("  [1] Create .agents/skills/ and add skills with 'npx skills add'");
  console.log("  [2] Specify a different source directory");
  console.log("  [3] Exit");
  console.log();

  const answer = await ask("Selection [3]: ");
  const choice = parseInt(answer) || 3;

  switch (choice) {
    case 1:
      return "create";
    case 2:
      return "specify";
    default:
      return "exit";
  }
};

export const promptCustomDirectory = async (
  prompt: string
): Promise<string> => {
  const answer = await ask(prompt);
  return answer;
};

export const confirm = async (message: string): Promise<boolean> => {
  const answer = await ask(`${message} [Y/n]: `);
  return answer.toLowerCase() !== "n";
};

export const displayResults = (
  results: Array<{
    skill: DetectedSkill;
    success: boolean;
    action: string;
    error?: string;
  }>
): void => {
  console.log("\nConversion results:");

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const result of results) {
    if (result.success) {
      if (result.action === "skipped") {
        console.log(`  [WARN] ${result.skill.name} (${result.error || "skipped"})`);
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
