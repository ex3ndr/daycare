import type { ResolvedFeaturesConfig, ResolvedSettingsConfig } from "../settings.js";
import type { SessionPermissions } from "../engine/permissions.js";

export type Config = {
  settingsPath: string;
  configDir: string;
  dataDir: string;
  agentsDir: string;
  dbPath: string;
  filesDir: string;
  authPath: string;
  socketPath: string;
  workspaceDir: string;
  features: ResolvedFeaturesConfig;
  settings: ResolvedSettingsConfig;
  defaultPermissions: SessionPermissions;
  verbose: boolean;
};

export type ConfigOverrides = {
  verbose?: boolean;
};
