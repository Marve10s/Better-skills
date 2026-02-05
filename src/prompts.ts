import { input, select } from "@inquirer/prompts";
import pc from "picocolors";
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
  console.log(
    `\n${pc.cyan("Found")} ${pc.bold(skills.length.toString())} skill(s) in ${pc.dim(sourceDir)}`,
  );

  for (const skill of skills) {
    const display = formatSkillDisplay(skill);
    const icon = skill.isSymlink ? pc.blue("→") : pc.green("●");
    console.log(`  ${icon} ${skill.name} ${pc.dim(`(${display})`)}`);
  }
};

export const promptConversionMode = async (): Promise<ConversionMode> => {
  const answer = await select({
    message: "Conversion mode",
    choices: [
      {
        name: `${pc.green("Symlink")} ${pc.dim("- Link to source, both stay in sync")}`,
        value: "symlink" as ConversionMode,
      },
      {
        name: `${pc.yellow("Copy")} ${pc.dim("- Duplicate files to target")}`,
        value: "copy" as ConversionMode,
      },
      {
        name: `${pc.red("Move")} ${pc.dim("- Move to target, remove from source")}`,
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
  console.log(
    `\n${pc.yellow("!")} Conflict: ${pc.bold(skillName)} already exists`,
  );

  const answer = await select({
    message: "How to handle conflicts?",
    choices: [
      {
        name: `${pc.cyan("Skip")} ${pc.dim("- Keep existing")}`,
        value: "skip" as ConflictResolution,
      },
      {
        name: `${pc.yellow("Overwrite")} ${pc.dim("- Replace with source")}`,
        value: "overwrite" as ConflictResolution,
      },
      {
        name: `${pc.magenta("Backup")} ${pc.dim("- Move existing to _backup/")}`,
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
  console.log(`\n${pc.cyan("Both directories found:")}`);
  console.log(
    `  ${pc.dim(".agents/skills/")} ${pc.bold(agentsCount.toString())} skills`,
  );
  console.log(
    `  ${pc.dim(".claude/skills/")} ${pc.bold(claudeCount.toString())} skills`,
  );

  const answer = await select({
    message: "Direction",
    choices: [
      {
        name: `${pc.green(".agents → .claude")} ${pc.dim("- Use in Claude Code")}`,
        value: "to-claude" as ConversionDirection,
      },
      {
        name: `${pc.blue(".claude → .agents")} ${pc.dim("- Export to other tools")}`,
        value: "to-agents" as ConversionDirection,
      },
      {
        name: `${pc.magenta("Sync both")} ${pc.dim("- Bidirectional")}`,
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
  console.log(
    `\n${pc.yellow("!")} No ${pc.bold(".agents/skills/")} directory found`,
  );

  const answer = await select({
    message: "What to do?",
    choices: [
      {
        name: `${pc.green("Create")} ${pc.dim(".agents/skills/ directory")}`,
        value: "create" as const,
      },
      {
        name: `${pc.blue("Specify")} ${pc.dim("a different source directory")}`,
        value: "specify" as const,
      },
      {
        name: `${pc.dim("Exit")}`,
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
      { name: pc.green("Yes"), value: true },
      { name: pc.red("No"), value: false },
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
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const result of results) {
    if (result.success) {
      if (result.action === "skipped") {
        console.log(
          `  ${pc.yellow("○")} ${result.skill.name} ${pc.dim(result.error || "skipped")}`,
        );
        skipCount++;
      } else {
        console.log(
          `  ${pc.green("✓")} ${result.skill.name} ${pc.dim(result.action)}`,
        );
        successCount++;
      }
    } else {
      console.log(
        `  ${pc.red("✗")} ${result.skill.name} ${pc.dim(result.error || "failed")}`,
      );
      errorCount++;
    }
  }

  console.log();

  const parts: string[] = [];
  if (successCount > 0) parts.push(pc.green(`${successCount} converted`));
  if (skipCount > 0) parts.push(pc.yellow(`${skipCount} skipped`));
  if (errorCount > 0) parts.push(pc.red(`${errorCount} failed`));

  if (parts.length > 0) {
    console.log(`${pc.bold("Done:")} ${parts.join(", ")}`);
  }
};

export const print = (message: string): void => {
  console.log(message);
};

export const printStep = (message: string): void => {
  console.log(`\n${pc.cyan("›")} ${message}`);
};

export const printSuccess = (message: string): void => {
  console.log(`${pc.green("✓")} ${message}`);
};

export const printWarning = (message: string): void => {
  console.log(`${pc.yellow("!")} ${message}`);
};

export const printError = (message: string): void => {
  console.log(`${pc.red("✗")} ${message}`);
};
