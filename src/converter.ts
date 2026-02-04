import * as fs from "node:fs";
import * as path from "node:path";
import { Effect } from "effect";
import type {
  ConflictResolution,
  ConversionMode,
  ConversionResult,
  DetectedSkill,
} from "./types.ts";

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const copyDir = (src: string, dest: string): void => {
  ensureDir(dest);

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(srcPath);
      fs.symlinkSync(linkTarget, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      const stats = fs.statSync(srcPath);
      if (stats.mode & 0o111) {
        fs.chmodSync(destPath, stats.mode);
      }
    }
  }
};

const removeDir = (dir: string): void => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const isSymlinkTo = (linkPath: string, targetPath: string): boolean => {
  try {
    if (!fs.lstatSync(linkPath).isSymbolicLink()) {
      return false;
    }
    const linkTarget = fs.readlinkSync(linkPath);
    const resolvedLinkTarget = path.resolve(path.dirname(linkPath), linkTarget);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedLinkTarget === resolvedTarget;
  } catch {
    return false;
  }
};

const createRelativeSymlink = (source: string, target: string): void => {
  const targetDir = path.dirname(target);
  const relativePath = path.relative(targetDir, source);
  fs.symlinkSync(relativePath, target);
};

export const convertSkill = (
  skill: DetectedSkill,
  targetDir: string,
  mode: ConversionMode,
  conflictResolution: ConflictResolution = "skip",
): Effect.Effect<ConversionResult, Error> =>
  Effect.try({
    try: () => {
      const targetPath = path.join(targetDir, skill.name);
      const sourcePath = skill.path;

      // Use lstatSync to check if the symlink itself exists (without following it)
      const targetExists = (() => {
        try {
          fs.lstatSync(targetPath);
          return true;
        } catch {
          return false;
        }
      })();

      if (targetExists) {
        if (mode === "symlink" && isSymlinkTo(targetPath, sourcePath)) {
          return {
            skill,
            success: true,
            action: "skipped" as const,
            targetPath,
            error: "Already linked",
          };
        }

        switch (conflictResolution) {
          case "skip":
            return {
              skill,
              success: true,
              action: "skipped" as const,
              targetPath,
              error: "Already exists",
            };

          case "backup": {
            const backupDir = path.join(targetDir, "_backup");
            ensureDir(backupDir);
            const backupPath = path.join(
              backupDir,
              `${skill.name}-${Date.now()}`,
            );
            fs.renameSync(targetPath, backupPath);
            break;
          }

          case "overwrite":
            if (fs.lstatSync(targetPath).isSymbolicLink()) {
              fs.unlinkSync(targetPath);
            } else {
              removeDir(targetPath);
            }
            break;
        }
      }

      ensureDir(targetDir);

      switch (mode) {
        case "symlink": {
          let actualSource = sourcePath;
          if (fs.lstatSync(sourcePath).isSymbolicLink()) {
            actualSource = fs.realpathSync(sourcePath);
          }
          createRelativeSymlink(actualSource, targetPath);
          return {
            skill,
            success: true,
            action: "symlinked" as const,
            targetPath,
          };
        }

        case "copy": {
          let actualSource = sourcePath;
          if (fs.lstatSync(sourcePath).isSymbolicLink()) {
            actualSource = fs.realpathSync(sourcePath);
          }
          copyDir(actualSource, targetPath);
          return {
            skill,
            success: true,
            action: "copied" as const,
            targetPath,
          };
        }

        case "move": {
          let actualSource = sourcePath;
          if (fs.lstatSync(sourcePath).isSymbolicLink()) {
            actualSource = fs.realpathSync(sourcePath);
            copyDir(actualSource, targetPath);
            fs.unlinkSync(sourcePath);
          } else {
            fs.renameSync(sourcePath, targetPath);
          }
          return {
            skill,
            success: true,
            action: "moved" as const,
            targetPath,
          };
        }
      }
    },
    catch: (error) =>
      new Error(`Failed to convert skill ${skill.name}: ${error}`),
  });

export const convertSkills = (
  skills: DetectedSkill[],
  targetDir: string,
  mode: ConversionMode,
  conflictResolution: ConflictResolution = "skip",
): Effect.Effect<ConversionResult[], Error> =>
  Effect.all(
    skills.map((skill) =>
      convertSkill(skill, targetDir, mode, conflictResolution).pipe(
        Effect.catchAll((error) =>
          Effect.succeed({
            skill,
            success: false,
            action: "skipped" as const,
            targetPath: path.join(targetDir, skill.name),
            error: error.message,
          }),
        ),
      ),
    ),
  );

export const validateSkill = (
  skill: DetectedSkill,
): { valid: boolean; warnings: string[] } => {
  const warnings: string[] = [];

  if (!skill.frontmatter.name && !skill.frontmatter.description) {
    warnings.push("Missing name and description in frontmatter");
  }

  if (skill.hasRules && !skill.hasAgentsMd) {
    warnings.push(
      "Has rules/ directory but no AGENTS.md - may need to run build",
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
};
