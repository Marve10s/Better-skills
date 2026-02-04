export interface SkillFrontmatter {
  name?: string;
  description?: string;
  "allowed-tools"?: string;
  tools?: string;
  version?: string;
  globs?: string | string[];
  "disable-model-invocation"?: boolean;
  compatibility?: string;
}

export interface DetectedSkill {
  name: string;
  path: string;
  hasSkillMd: boolean;
  hasAgentsMd: boolean;
  hasRules: boolean;
  hasScripts: boolean;
  hasTemplates: boolean;
  hasReferences: boolean;
  sizeKb: number;
  frontmatter: SkillFrontmatter;
  isSymlink: boolean;
  symlinkTarget?: string;
}

export type ConversionMode = "symlink" | "copy" | "move";

export type ConflictResolution = "skip" | "overwrite" | "backup";

export type ConversionDirection = "to-claude" | "to-agents" | "sync";

export interface ConversionOptions {
  source: string;
  target: string;
  mode: ConversionMode;
  direction: ConversionDirection;
  nonInteractive: boolean;
  conflictResolution?: ConflictResolution;
}

export interface ConversionResult {
  skill: DetectedSkill;
  success: boolean;
  action: "symlinked" | "copied" | "moved" | "skipped" | "backed-up";
  error?: string;
  targetPath: string;
}

export interface ScanResult {
  skills: DetectedSkill[];
  sourceDir: string;
  targetDir: string;
  direction: ConversionDirection;
}
