import * as fs from "node:fs";
import * as path from "node:path";
import { Effect } from "effect";
import * as yaml from "yaml";
import type { DetectedSkill, SkillFrontmatter } from "./types.ts";

export const parseFrontmatter = (content: string): SkillFrontmatter => {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  try {
    return yaml.parse(match[1]) || {};
  } catch {
    return {};
  }
};

const getDirectorySizeKb = (dirPath: string): number => {
  let totalSize = 0;

  const walkDir = (currentPath: string) => {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    } catch {}
  };

  walkDir(dirPath);
  return Math.round(totalSize / 1024);
};

export const countReferences = (content: string): number => {
  const wikiLinks = (content.match(/\[\[[^\]]+\]\]/g) || []).length;
  const markdownLinks = (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [])
    .length;
  return wikiLinks + markdownLinks;
};

const analyzeSkill = (skillPath: string): DetectedSkill | null => {
  const name = path.basename(skillPath);
  const skillMdPath = path.join(skillPath, "SKILL.md");

  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  const stats = fs.lstatSync(skillPath);
  const isSymlink = stats.isSymbolicLink();
  let symlinkTarget: string | undefined;

  if (isSymlink) {
    try {
      symlinkTarget = fs.readlinkSync(skillPath);
    } catch {}
  }

  let skillMdContent = "";
  let frontmatter: SkillFrontmatter = {};

  try {
    skillMdContent = fs.readFileSync(skillMdPath, "utf-8");
    frontmatter = parseFrontmatter(skillMdContent);
  } catch {}

  const hasAgentsMd = fs.existsSync(path.join(skillPath, "AGENTS.md"));
  const hasRules = fs.existsSync(path.join(skillPath, "rules"));
  const hasScripts = fs.existsSync(path.join(skillPath, "scripts"));
  const hasTemplates = fs.existsSync(path.join(skillPath, "templates"));
  const referenceCount = countReferences(skillMdContent);

  return {
    name,
    path: skillPath,
    hasSkillMd: true,
    hasAgentsMd,
    hasRules,
    hasScripts,
    hasTemplates,
    hasReferences: referenceCount > 0,
    sizeKb: getDirectorySizeKb(skillPath),
    frontmatter,
    isSymlink,
    symlinkTarget,
  };
};

export const detectSkills = (
  dir: string,
): Effect.Effect<DetectedSkill[], Error> =>
  Effect.try({
    try: () => {
      if (!fs.existsSync(dir)) {
        return [];
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const skills: DetectedSkill[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (entry.name.startsWith("_")) continue;

        const skillPath = path.join(dir, entry.name);

        let actualPath = skillPath;
        if (entry.isSymbolicLink()) {
          try {
            actualPath = fs.realpathSync(skillPath);
          } catch {
            continue;
          }
        }

        const nestedSkillMd = path.join(actualPath, "SKILL.md");
        if (fs.existsSync(nestedSkillMd)) {
          const skill = analyzeSkill(skillPath);
          if (skill) skills.push(skill);
        } else {
          try {
            const nestedEntries = fs.readdirSync(actualPath, {
              withFileTypes: true,
            });
            for (const nestedEntry of nestedEntries) {
              if (!nestedEntry.isDirectory()) continue;
              const nestedPath = path.join(skillPath, nestedEntry.name);
              const skill = analyzeSkill(nestedPath);
              if (skill) {
                skill.name = `${entry.name}-${skill.name}`;
                skills.push(skill);
              }
            }
          } catch {}
        }
      }

      return skills;
    },
    catch: (error) => new Error(`Failed to detect skills: ${error}`),
  });

export const directoryExists = (dir: string): boolean => {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

export const formatSkillDisplay = (skill: DetectedSkill): string => {
  const parts: string[] = [];

  parts.push(`${skill.sizeKb}KB`);

  if (skill.hasReferences) {
    parts.push("has references");
  }

  if (skill.hasTemplates) {
    parts.push("has templates");
  }

  if (skill.hasRules) {
    parts.push("has rules/");
  }

  if (skill.hasScripts) {
    parts.push("has scripts/");
  }

  if (skill.hasAgentsMd) {
    parts.push("AGENTS.md present");
  }

  if (skill.isSymlink) {
    parts.push("symlink");
  }

  return parts.join(", ");
};
