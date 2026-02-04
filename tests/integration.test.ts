import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Effect } from "effect";
import { convertSkill, convertSkills } from "../src/converter.js";
import { detectSkills } from "../src/detector.js";

describe("Integration Tests", () => {
  let tempDir: string;
  let agentsDir: string;
  let claudeDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "skills-integration-test-"),
    );
    agentsDir = path.join(tempDir, ".agents", "skills");
    claudeDir = path.join(tempDir, ".claude", "skills");
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createSkill = (dir: string, name: string, content: string) => {
    const skillDir = path.join(dir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);
    return skillDir;
  };

  describe("Full conversion .agents -> .claude", () => {
    it("converts all skills from agents to claude directory", async () => {
      // Setup: Create skills in .agents/skills
      createSkill(
        agentsDir,
        "skill-one",
        `---
name: Skill One
description: First skill
---
# Skill One`,
      );

      createSkill(
        agentsDir,
        "skill-two",
        `---
name: Skill Two
description: Second skill
---
# Skill Two`,
      );

      // Detect skills
      const skills = await Effect.runPromise(detectSkills(agentsDir));
      expect(skills.length).toBe(2);

      // Convert all skills
      const results = await Effect.runPromise(
        convertSkills(skills, claudeDir, "symlink"),
      );

      // Verify results
      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.action === "symlinked")).toBe(true);

      // Verify skills are accessible from .claude/skills
      expect(fs.existsSync(path.join(claudeDir, "skill-one", "SKILL.md"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(claudeDir, "skill-two", "SKILL.md"))).toBe(
        true,
      );

      // Verify they are symlinks
      expect(
        fs.lstatSync(path.join(claudeDir, "skill-one")).isSymbolicLink(),
      ).toBe(true);
      expect(
        fs.lstatSync(path.join(claudeDir, "skill-two")).isSymbolicLink(),
      ).toBe(true);
    });
  });

  describe("Full conversion .claude -> .agents", () => {
    it("converts all skills from claude to agents directory", async () => {
      // Setup: Create skills in .claude/skills
      createSkill(
        claudeDir,
        "claude-skill",
        `---
name: Claude Skill
description: A Claude-native skill
---
# Claude Skill`,
      );

      // Detect skills
      const skills = await Effect.runPromise(detectSkills(claudeDir));
      expect(skills.length).toBe(1);

      // Convert to .agents/skills using copy mode
      const results = await Effect.runPromise(
        convertSkills(skills, agentsDir, "copy"),
      );

      // Verify results
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].action).toBe("copied");

      // Verify skill exists in .agents/skills
      const agentsSkillPath = path.join(agentsDir, "claude-skill", "SKILL.md");
      expect(fs.existsSync(agentsSkillPath)).toBe(true);

      const content = fs.readFileSync(agentsSkillPath, "utf-8");
      expect(content).toContain("Claude Skill");
    });
  });

  describe("Bidirectional sync", () => {
    it("syncs skills in both directions", async () => {
      // Create skill in agents
      createSkill(
        agentsDir,
        "agents-skill",
        `---
name: Agents Skill
---
# From Agents`,
      );

      // Create skill in claude
      createSkill(
        claudeDir,
        "claude-skill",
        `---
name: Claude Skill
---
# From Claude`,
      );

      // Sync agents -> claude
      const agentsSkills = await Effect.runPromise(detectSkills(agentsDir));
      await Effect.runPromise(
        convertSkills(agentsSkills, claudeDir, "symlink"),
      );

      // Sync claude -> agents
      const claudeSkills = await Effect.runPromise(detectSkills(claudeDir));
      // Filter out the newly created symlink to avoid circular reference
      const originalClaudeSkills = claudeSkills.filter(
        (s) => s.name === "claude-skill" && !s.isSymlink,
      );
      await Effect.runPromise(
        convertSkills(originalClaudeSkills, agentsDir, "symlink"),
      );

      // Verify both directions
      expect(
        fs.existsSync(path.join(claudeDir, "agents-skill", "SKILL.md")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(agentsDir, "claude-skill", "SKILL.md")),
      ).toBe(true);
    });
  });

  describe("Symlink handling", () => {
    it("follows symlinks when detecting skills", async () => {
      // Create actual skill
      const actualSkillDir = path.join(tempDir, "actual-skills", "real-skill");
      fs.mkdirSync(actualSkillDir, { recursive: true });
      fs.writeFileSync(
        path.join(actualSkillDir, "SKILL.md"),
        `---
name: Real Skill
---
# Real`,
      );

      // Create symlink in agents directory
      fs.mkdirSync(agentsDir, { recursive: true });
      const symlinkPath = path.join(agentsDir, "linked-skill");
      fs.symlinkSync(actualSkillDir, symlinkPath);

      // Detect should find the symlinked skill
      const skills = await Effect.runPromise(detectSkills(agentsDir));
      expect(skills.length).toBe(1);
      expect(skills[0].name).toBe("linked-skill");
      expect(skills[0].isSymlink).toBe(true);
    });

    it("resolves symlinks when converting", async () => {
      // Create actual skill
      const actualSkillDir = path.join(tempDir, "actual-skills", "real-skill");
      fs.mkdirSync(actualSkillDir, { recursive: true });
      fs.writeFileSync(path.join(actualSkillDir, "SKILL.md"), "# Real\n");

      // Create symlink in agents directory
      fs.mkdirSync(agentsDir, { recursive: true });
      const symlinkPath = path.join(agentsDir, "linked-skill");
      fs.symlinkSync(actualSkillDir, symlinkPath);

      // Detect and convert
      const skills = await Effect.runPromise(detectSkills(agentsDir));
      const result = await Effect.runPromise(
        convertSkill(skills[0], claudeDir, "symlink"),
      );

      expect(result.success).toBe(true);

      // The new symlink should point to the actual skill, not the intermediate symlink
      const targetPath = path.join(claudeDir, "linked-skill");
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true);

      // Verify the symlink resolves to a valid target with the expected content
      const linkTarget = fs.readlinkSync(targetPath);
      const resolvedTarget = path.resolve(claudeDir, linkTarget);
      expect(fs.existsSync(resolvedTarget)).toBe(true);

      // Should be able to read the content through the resolved path
      const content = fs.readFileSync(
        path.join(resolvedTarget, "SKILL.md"),
        "utf-8",
      );
      expect(content).toBe("# Real\n");
    });
  });

  describe("Error handling", () => {
    it("handles missing source gracefully in convertSkills", async () => {
      const fakeSkill = {
        name: "nonexistent",
        path: "/nonexistent/path/skill",
        hasSkillMd: true,
        hasAgentsMd: false,
        hasRules: false,
        hasScripts: false,
        hasTemplates: false,
        hasReferences: false,
        sizeKb: 0,
        frontmatter: {},
        isSymlink: false,
      };

      const results = await Effect.runPromise(
        convertSkills([fakeSkill], claudeDir, "copy"),
      );

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });

  describe("Complex skill structures", () => {
    it("preserves directory structure when copying", async () => {
      // Create complex skill structure
      const skillDir = path.join(agentsDir, "complex-skill");
      fs.mkdirSync(path.join(skillDir, "rules"), { recursive: true });
      fs.mkdirSync(path.join(skillDir, "templates"));
      fs.mkdirSync(path.join(skillDir, "scripts"));

      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Complex\n");
      fs.writeFileSync(path.join(skillDir, "AGENTS.md"), "# Agents\n");
      fs.writeFileSync(path.join(skillDir, "rules", "rule1.md"), "# Rule 1\n");
      fs.writeFileSync(path.join(skillDir, "rules", "rule2.md"), "# Rule 2\n");
      fs.writeFileSync(
        path.join(skillDir, "templates", "tmpl.md"),
        "# Template\n",
      );
      fs.writeFileSync(
        path.join(skillDir, "scripts", "script.sh"),
        "#!/bin/bash\n",
      );
      fs.chmodSync(path.join(skillDir, "scripts", "script.sh"), 0o755);

      // Detect and copy
      const skills = await Effect.runPromise(detectSkills(agentsDir));
      await Effect.runPromise(convertSkills(skills, claudeDir, "copy"));

      // Verify structure is preserved
      const targetDir = path.join(claudeDir, "complex-skill");
      expect(fs.existsSync(path.join(targetDir, "SKILL.md"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "rules", "rule1.md"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(targetDir, "rules", "rule2.md"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(targetDir, "templates", "tmpl.md"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(targetDir, "scripts", "script.sh"))).toBe(
        true,
      );

      // Verify executable permission is preserved
      const scriptStats = fs.statSync(
        path.join(targetDir, "scripts", "script.sh"),
      );
      expect(scriptStats.mode & 0o111).toBeTruthy();
    });
  });
});
