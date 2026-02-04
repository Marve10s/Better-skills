import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Effect } from "effect";
import { convertSkill, validateSkill } from "../src/converter.js";
import type { DetectedSkill } from "../src/types.js";

const fixturesDir = path.join(import.meta.dir, "fixtures");
const agentsSkillsDir = path.join(fixturesDir, "agents-skills");

const createMockSkill = (
  overrides: Partial<DetectedSkill> = {},
): DetectedSkill => ({
  name: "mock-skill",
  path: path.join(agentsSkillsDir, "test-skill-a"),
  hasSkillMd: true,
  hasAgentsMd: false,
  hasRules: false,
  hasScripts: false,
  hasTemplates: false,
  hasReferences: false,
  sizeKb: 1,
  frontmatter: {},
  isSymlink: false,
  ...overrides,
});

describe("validateSkill", () => {
  it("returns valid for skill with complete frontmatter", () => {
    const skill = createMockSkill({
      frontmatter: { name: "Test", description: "A test skill" },
    });

    const result = validateSkill(skill);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when frontmatter is missing name and description", () => {
    const skill = createMockSkill({ frontmatter: {} });

    const result = validateSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Missing name and description in frontmatter",
    );
  });

  it("warns when rules exist but no AGENTS.md", () => {
    const skill = createMockSkill({
      hasRules: true,
      hasAgentsMd: false,
      frontmatter: { name: "Test", description: "Test" },
    });

    const result = validateSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Has rules/ directory but no AGENTS.md - may need to run build",
    );
  });

  it("returns valid when rules exist with AGENTS.md", () => {
    const skill = createMockSkill({
      hasRules: true,
      hasAgentsMd: true,
      frontmatter: { name: "Test", description: "Test" },
    });

    const result = validateSkill(skill);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("convertSkill", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-converter-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("symlink mode", () => {
    it("creates symlink to source skill", async () => {
      const skill = createMockSkill({
        name: "test-skill-a",
        path: path.join(agentsSkillsDir, "test-skill-a"),
      });

      const result = await Effect.runPromise(
        convertSkill(skill, tempDir, "symlink"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("symlinked");

      const targetPath = path.join(tempDir, "test-skill-a");
      // Use lstatSync to check the symlink itself (not following it)
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true);

      // Verify symlink points to correct location by resolving it
      const linkTarget = fs.readlinkSync(targetPath);
      const resolvedTarget = path.resolve(tempDir, linkTarget);
      expect(fs.existsSync(resolvedTarget)).toBe(true);
      expect(fs.existsSync(path.join(resolvedTarget, "SKILL.md"))).toBe(true);
    });

    it("skips if already linked to same target", async () => {
      const skill = createMockSkill({
        name: "test-skill-a",
        path: path.join(agentsSkillsDir, "test-skill-a"),
      });

      // First conversion
      const firstResult = await Effect.runPromise(
        convertSkill(skill, tempDir, "symlink"),
      );
      expect(firstResult.success).toBe(true);
      expect(firstResult.action).toBe("symlinked");

      // Second conversion should skip
      const result = await Effect.runPromise(
        convertSkill(skill, tempDir, "symlink"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("skipped");
      expect(result.error).toBe("Already linked");
    });
  });

  describe("copy mode", () => {
    it("copies skill directory to target", async () => {
      const skill = createMockSkill({
        name: "test-skill-a",
        path: path.join(agentsSkillsDir, "test-skill-a"),
      });

      const result = await Effect.runPromise(
        convertSkill(skill, tempDir, "copy"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("copied");

      const targetPath = path.join(tempDir, "test-skill-a");
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(false);
      expect(fs.lstatSync(targetPath).isDirectory()).toBe(true);

      // Verify SKILL.md was copied
      const copiedSkillMd = path.join(targetPath, "SKILL.md");
      expect(fs.existsSync(copiedSkillMd)).toBe(true);

      const content = fs.readFileSync(copiedSkillMd, "utf-8");
      expect(content).toContain("Test Skill A");
    });

    it("copies nested directories", async () => {
      const skill = createMockSkill({
        name: "test-skill-b",
        path: path.join(agentsSkillsDir, "test-skill-b"),
      });

      const result = await Effect.runPromise(
        convertSkill(skill, tempDir, "copy"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("copied");

      // Verify rules directory was copied
      const rulesDir = path.join(tempDir, "test-skill-b", "rules");
      expect(fs.existsSync(rulesDir)).toBe(true);
      expect(fs.existsSync(path.join(rulesDir, "rule1.md"))).toBe(true);

      // Verify AGENTS.md was copied
      expect(
        fs.existsSync(path.join(tempDir, "test-skill-b", "AGENTS.md")),
      ).toBe(true);
    });
  });

  describe("move mode", () => {
    it("moves skill directory to target", async () => {
      // Create a temporary source skill to move
      const sourceDir = path.join(tempDir, "source-skills");
      const skillDir = path.join(sourceDir, "movable-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Movable\n");

      const targetDir = path.join(tempDir, "target-skills");

      const skill = createMockSkill({
        name: "movable-skill",
        path: skillDir,
      });

      const result = await Effect.runPromise(
        convertSkill(skill, targetDir, "move"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("moved");

      // Source should no longer exist
      expect(fs.existsSync(skillDir)).toBe(false);

      // Target should exist
      const targetPath = path.join(targetDir, "movable-skill");
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.existsSync(path.join(targetPath, "SKILL.md"))).toBe(true);
    });
  });

  describe("conflict resolution", () => {
    it("skips existing skill with skip resolution", async () => {
      const skill = createMockSkill({
        name: "conflict-skill",
        path: path.join(agentsSkillsDir, "test-skill-a"),
      });

      // Create pre-existing skill at target
      const existingPath = path.join(tempDir, "conflict-skill");
      fs.mkdirSync(existingPath, { recursive: true });
      fs.writeFileSync(path.join(existingPath, "SKILL.md"), "# Existing\n");

      const result = await Effect.runPromise(
        convertSkill(skill, tempDir, "copy", "skip"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("skipped");
      expect(result.error).toBe("Already exists");

      // Original content should be preserved
      const content = fs.readFileSync(
        path.join(existingPath, "SKILL.md"),
        "utf-8",
      );
      expect(content).toBe("# Existing\n");
    });

    it("overwrites existing skill with overwrite resolution", async () => {
      const skill = createMockSkill({
        name: "conflict-skill",
        path: path.join(agentsSkillsDir, "test-skill-a"),
      });

      // Create pre-existing skill at target
      const existingPath = path.join(tempDir, "conflict-skill");
      fs.mkdirSync(existingPath, { recursive: true });
      fs.writeFileSync(path.join(existingPath, "SKILL.md"), "# Existing\n");

      const result = await Effect.runPromise(
        convertSkill(skill, tempDir, "copy", "overwrite"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("copied");

      // Content should be replaced with source
      const content = fs.readFileSync(
        path.join(existingPath, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain("Test Skill A");
    });

    it("backs up existing skill with backup resolution", async () => {
      const skill = createMockSkill({
        name: "conflict-skill",
        path: path.join(agentsSkillsDir, "test-skill-a"),
      });

      // Create pre-existing skill at target
      const existingPath = path.join(tempDir, "conflict-skill");
      fs.mkdirSync(existingPath, { recursive: true });
      fs.writeFileSync(path.join(existingPath, "SKILL.md"), "# Existing\n");

      const result = await Effect.runPromise(
        convertSkill(skill, tempDir, "copy", "backup"),
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("copied");

      // Backup directory should exist
      const backupDir = path.join(tempDir, "_backup");
      expect(fs.existsSync(backupDir)).toBe(true);

      // At least one backup should exist
      const backups = fs.readdirSync(backupDir);
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0]).toMatch(/^conflict-skill-\d+$/);

      // New content should be in place
      const content = fs.readFileSync(
        path.join(existingPath, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain("Test Skill A");
    });
  });
});
