import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { Effect } from "effect";
import {
  countReferences,
  detectSkills,
  directoryExists,
  formatSkillDisplay,
  parseFrontmatter,
} from "../src/detector.js";
import type { DetectedSkill } from "../src/types.js";

const fixturesDir = path.join(import.meta.dir, "fixtures");
const agentsSkillsDir = path.join(fixturesDir, "agents-skills");
const claudeSkillsDir = path.join(fixturesDir, "claude-skills");
const invalidDir = path.join(fixturesDir, "invalid");

describe("parseFrontmatter", () => {
  it("parses valid YAML frontmatter", () => {
    const content = `---
name: Test Skill
description: A test description
version: "1.0.0"
---

# Content`;

    const result = parseFrontmatter(content);
    expect(result.name).toBe("Test Skill");
    expect(result.description).toBe("A test description");
    expect(result.version).toBe("1.0.0");
  });

  it("returns empty object for content without frontmatter", () => {
    const content = "# No frontmatter here";
    const result = parseFrontmatter(content);
    expect(result).toEqual({});
  });

  it("returns empty object for invalid YAML", () => {
    const content = `---
invalid: yaml: content: [
---

# Content`;

    const result = parseFrontmatter(content);
    expect(result).toEqual({});
  });

  it("parses allowed-tools field", () => {
    const content = `---
name: Tool Skill
allowed-tools: Bash, Read, Write
---`;

    const result = parseFrontmatter(content);
    expect(result["allowed-tools"]).toBe("Bash, Read, Write");
  });
});

describe("countReferences", () => {
  it("counts wiki-style links", () => {
    const content = "See [[link1]] and [[link2]] for more info";
    expect(countReferences(content)).toBe(2);
  });

  it("counts markdown links", () => {
    const content =
      "Check [Google](https://google.com) and [GitHub](https://github.com)";
    expect(countReferences(content)).toBe(2);
  });

  it("counts both link types together", () => {
    const content = "See [[internal]] and [external](https://example.com)";
    expect(countReferences(content)).toBe(2);
  });

  it("returns 0 for content without links", () => {
    const content = "No links here at all";
    expect(countReferences(content)).toBe(0);
  });
});

describe("formatSkillDisplay", () => {
  it("displays size in KB", () => {
    const skill: DetectedSkill = {
      name: "test",
      path: "/test",
      hasSkillMd: true,
      hasAgentsMd: false,
      hasRules: false,
      hasScripts: false,
      hasTemplates: false,
      hasReferences: false,
      sizeKb: 42,
      frontmatter: {},
      isSymlink: false,
    };

    const display = formatSkillDisplay(skill);
    expect(display).toBe("42KB");
  });

  it("includes all present features", () => {
    const skill: DetectedSkill = {
      name: "full-skill",
      path: "/test",
      hasSkillMd: true,
      hasAgentsMd: true,
      hasRules: true,
      hasScripts: true,
      hasTemplates: true,
      hasReferences: true,
      sizeKb: 100,
      frontmatter: {},
      isSymlink: true,
    };

    const display = formatSkillDisplay(skill);
    expect(display).toContain("100KB");
    expect(display).toContain("has references");
    expect(display).toContain("has templates");
    expect(display).toContain("has rules/");
    expect(display).toContain("has scripts/");
    expect(display).toContain("AGENTS.md present");
    expect(display).toContain("symlink");
  });
});

describe("directoryExists", () => {
  it("returns true for existing directory", () => {
    expect(directoryExists(fixturesDir)).toBe(true);
  });

  it("returns false for non-existent path", () => {
    expect(directoryExists("/nonexistent/path/12345")).toBe(false);
  });

  it("returns false for a file path", () => {
    const filePath = path.join(agentsSkillsDir, "test-skill-a", "SKILL.md");
    expect(directoryExists(filePath)).toBe(false);
  });
});

describe("detectSkills", () => {
  it("detects skills in agents-skills directory", async () => {
    const result = await Effect.runPromise(detectSkills(agentsSkillsDir));

    expect(result.length).toBe(2);
    const skillNames = result.map((s) => s.name);
    expect(skillNames).toContain("test-skill-a");
    expect(skillNames).toContain("test-skill-b");
  });

  it("parses frontmatter correctly for detected skills", async () => {
    const result = await Effect.runPromise(detectSkills(agentsSkillsDir));

    const skillA = result.find((s) => s.name === "test-skill-a");
    expect(skillA?.frontmatter.name).toBe("Test Skill A");
    expect(skillA?.frontmatter.description).toBe(
      "A simple test skill for unit testing",
    );

    const skillB = result.find((s) => s.name === "test-skill-b");
    expect(skillB?.frontmatter.name).toBe("Test Skill B");
    expect(skillB?.frontmatter["allowed-tools"]).toBe("Bash, Read, Write");
  });

  it("detects skill features correctly", async () => {
    const result = await Effect.runPromise(detectSkills(agentsSkillsDir));

    const skillA = result.find((s) => s.name === "test-skill-a");
    expect(skillA?.hasRules).toBe(false);
    expect(skillA?.hasAgentsMd).toBe(false);
    expect(skillA?.hasReferences).toBe(false);

    const skillB = result.find((s) => s.name === "test-skill-b");
    expect(skillB?.hasRules).toBe(true);
    expect(skillB?.hasAgentsMd).toBe(true);
    expect(skillB?.hasReferences).toBe(true);
  });

  it("returns empty array for non-existent directory", async () => {
    const result = await Effect.runPromise(detectSkills("/nonexistent/path"));
    expect(result).toEqual([]);
  });

  it("skips directories without SKILL.md", async () => {
    const result = await Effect.runPromise(detectSkills(invalidDir));
    expect(result).toEqual([]);
  });

  it("detects skills in claude-skills directory", async () => {
    const result = await Effect.runPromise(detectSkills(claudeSkillsDir));

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("existing-skill");
  });

  it("calculates size correctly", async () => {
    const result = await Effect.runPromise(detectSkills(agentsSkillsDir));

    for (const skill of result) {
      expect(skill.sizeKb).toBeGreaterThanOrEqual(0);
      expect(typeof skill.sizeKb).toBe("number");
    }
  });
});
