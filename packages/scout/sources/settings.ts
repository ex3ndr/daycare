import { promises as fs } from "node:fs";
import path from "node:path";

export type AgentProviderId = "codex" | "claude-code";

export type AgentConfig = {
  provider: AgentProviderId;
  model?: string;
  main?: boolean;
};

export type SettingsConfig = {
  agents?: AgentConfig[];
};

export const DEFAULT_SETTINGS_PATH = ".scout/settings.json";

export async function readSettingsFile(
  filePath: string = DEFAULT_SETTINGS_PATH
): Promise<SettingsConfig> {
  const resolvedPath = path.resolve(filePath);

  try {
    const raw = await fs.readFile(resolvedPath, "utf8");
    return JSON.parse(raw) as SettingsConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function writeSettingsFile(
  filePath: string,
  settings: SettingsConfig
): Promise<void> {
  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);

  if (dir && dir !== ".") {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(resolvedPath, `${JSON.stringify(settings, null, 2)}\n`, {
    mode: 0o600
  });
}

export async function updateSettingsFile(
  filePath: string,
  updater: (settings: SettingsConfig) => SettingsConfig
): Promise<SettingsConfig> {
  const settings = await readSettingsFile(filePath);
  const updated = updater(settings);
  await writeSettingsFile(filePath, updated);
  return updated;
}

export function getAgents(settings: SettingsConfig): AgentConfig[] {
  const agents = settings.agents ?? [];
  if (agents.length === 0) {
    return [];
  }

  const primary = agents.filter((entry) => entry.main);
  if (primary.length === 0) {
    return [...agents];
  }

  return [
    ...primary,
    ...agents.filter((entry) => !entry.main)
  ];
}

export function upsertAgent(
  agents: AgentConfig[] | undefined,
  entry: Omit<AgentConfig, "main">,
  makeMain?: boolean
): AgentConfig[] {
  const list = agents ?? [];
  const existing = list.find((item) => item.provider === entry.provider);
  const keepMain = makeMain === true ? true : existing?.main ?? false;
  const filtered = list.filter((item) => item.provider !== entry.provider);

  if (keepMain) {
    return [
      { ...entry, main: true },
      ...filtered.map((item) => ({ ...item, main: false }))
    ];
  }

  return [...filtered, { ...entry, main: false }];
}

export function removeAgent(
  agents: AgentConfig[] | undefined,
  provider: AgentProviderId
): AgentConfig[] {
  return (agents ?? []).filter((item) => item.provider !== provider);
}
