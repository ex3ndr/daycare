import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import Handlebars from "handlebars";
import type { Tool } from "@mariozechner/pi-ai";

import { getLogger } from "../../../log.js";
import {
  DEFAULT_AGENTS_PATH,
  DEFAULT_MEMORY_PATH,
  DEFAULT_SOUL_PATH,
  DEFAULT_TOOLS_PATH,
  DEFAULT_USER_PATH
} from "../../../paths.js";
import type { AgentDescriptor, Config, SessionPermissions } from "@/types";
import { permissionWorkspaceGranted } from "../../permissions/permissionWorkspaceGranted.js";
import { rlmNoToolsPromptBuild } from "../../modules/rlm/rlmNoToolsPromptBuild.js";
import { skillPromptFormat } from "../../skills/skillPromptFormat.js";
import { Skills } from "../../skills/skills.js";
import type { AgentSystem } from "../agentSystem.js";
import { agentAppFolderPathResolve } from "./agentAppFolderPathResolve.js";
import { agentDescriptorIsCron } from "./agentDescriptorIsCron.js";
import { agentPermanentList } from "./agentPermanentList.js";
import { agentPermanentPrompt } from "./agentPermanentPrompt.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptFilesEnsure } from "./agentPromptFilesEnsure.js";
import { agentPromptResolve } from "./agentPromptResolve.js";

const logger = getLogger("agent.prompt-build");

type AgentPromptFeatures = {
  noTools: boolean;
  rlm: boolean;
  say: boolean;
};

type AgentSystemPromptPluginManager = Pick<
  AgentSystem["pluginManager"],
  "getSystemPrompts" | "listRegisteredSkills"
>;
type AgentSystemPromptConnectorRegistry = Pick<AgentSystem["connectorRegistry"], "get">;
type AgentSystemPromptCrons = Pick<AgentSystem["crons"], "listTasks">;
type AgentSystemPromptAgentSystem = Pick<
  AgentSystem,
  "config" | "pluginManager" | "toolResolver" | "connectorRegistry" | "crons"
>;

type AgentSystemPromptPaths = {
  soulPath: string;
  userPath: string;
  agentsPath: string;
  toolsPath: string;
  memoryPath: string;
};

type AgentSystemPromptFiles = {
  soul: string;
  user: string;
  agents: string;
  tools: string;
  memory: string;
};

type AgentSystemPromptSections = {
  pluginPrompt: string;
  skillsPrompt: string;
  permanentAgentsPrompt: string;
  agentPrompt: string;
  noToolsPrompt: string;
  replaceSystemPrompt: boolean;
};

type AgentSystemPromptRuntime = {
  config: Config | null;
  configDir: string;
  features: AgentPromptFeatures;
  skillsPath: string;
  pluginManager: AgentSystemPromptPluginManager | null;
  connectorRegistry: AgentSystemPromptConnectorRegistry | null;
  crons: AgentSystemPromptCrons | null;
  availableTools: Tool[];
};

type AgentSystemPromptCronContext = {
  cronTaskId: string;
  cronTaskName: string;
  cronMemoryPath: string;
  cronFilesPath: string;
  cronTaskIds: string;
};

type AgentSystemPromptConnectorContext = {
  connector: string;
  canSendFiles: boolean;
  fileSendModes: string;
  messageFormatPrompt: string;
  channelId: string;
  userId: string;
};

type AgentSystemPromptTemplateRuntime = {
  workspace: string;
  writeDirs: string[];
  network: boolean;
  events: boolean;
  appFolderPath: string;
  workspacePermissionGranted: boolean;
  agentKind: "background" | "foreground";
  parentAgentId: string;
  connectorContext: AgentSystemPromptConnectorContext;
  cronContext: AgentSystemPromptCronContext;
};

type AgentSystemPromptTemplates = {
  systemTemplate: string;
  permissionsTemplate: string;
  agenticTemplate: string;
};

export type AgentSystemPromptContext = {
  model?: string;
  provider?: string;
  permissions?: SessionPermissions;
  soulPath?: string;
  userPath?: string;
  agentsPath?: string;
  toolsPath?: string;
  memoryPath?: string;
  agentSystem?: AgentSystemPromptAgentSystem;
  descriptor?: AgentDescriptor;
  ensurePromptFiles?: boolean;
};

export type AgentSystemPromptBuildContext = AgentSystemPromptContext;

/**
 * Builds the system prompt text from deterministic sections and bundled templates.
 * Expects: prompt templates exist under engine/prompts.
 */
export async function agentSystemPrompt(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const runtime = resolveRuntime(context);
  const promptPaths = resolvePromptPaths(context);
  if (context.ensurePromptFiles) {
    await agentPromptFilesEnsure();
  }

  const [sections, templateRuntime] = await Promise.all([
    resolvePromptSections(context, runtime),
    resolveTemplateRuntimeContext(context, runtime)
  ]);

  if (sections.replaceSystemPrompt) {
    const replaced = sections.agentPrompt.trim();
    if (!replaced) {
      throw new Error("System prompt replacement requires a non-empty agent prompt.");
    }
    return replaced;
  }

  const [promptFiles, templates] = await Promise.all([
    loadPromptFiles(promptPaths),
    loadPromptTemplates()
  ]);

  const additionalWriteDirs = resolveAdditionalWriteDirs(
    templateRuntime.writeDirs,
    templateRuntime.workspace,
    promptPaths.soulPath,
    promptPaths.userPath,
    promptPaths.agentsPath,
    promptPaths.toolsPath,
    promptPaths.memoryPath
  );

  const configDir = runtime.configDir;
  const skillsPath = runtime.skillsPath;
  const features = runtime.features;

  const templateContext = {
    date: new Date().toISOString().split("T")[0],
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    model: context.model ?? "unknown",
    provider: context.provider ?? "unknown",
    workspace: templateRuntime.workspace,
    network: templateRuntime.network,
    events: templateRuntime.events,
    connector: templateRuntime.connectorContext.connector,
    canSendFiles: templateRuntime.connectorContext.canSendFiles,
    fileSendModes: templateRuntime.connectorContext.fileSendModes,
    messageFormatPrompt: templateRuntime.connectorContext.messageFormatPrompt,
    channelId: templateRuntime.connectorContext.channelId,
    userId: templateRuntime.connectorContext.userId,
    cronTaskId: templateRuntime.cronContext.cronTaskId,
    cronTaskName: templateRuntime.cronContext.cronTaskName,
    cronMemoryPath: templateRuntime.cronContext.cronMemoryPath,
    cronFilesPath: templateRuntime.cronContext.cronFilesPath,
    cronTaskIds: templateRuntime.cronContext.cronTaskIds,
    appFolderPath: templateRuntime.appFolderPath,
    workspacePermissionGranted: templateRuntime.workspacePermissionGranted,
    soulPath: promptPaths.soulPath,
    userPath: promptPaths.userPath,
    agentsPath: promptPaths.agentsPath,
    toolsPath: promptPaths.toolsPath,
    memoryPath: promptPaths.memoryPath,
    pluginPrompt: sections.pluginPrompt,
    skillsPrompt: sections.skillsPrompt,
    parentAgentId: templateRuntime.parentAgentId,
    configDir,
    skillsPath,
    isForeground: templateRuntime.agentKind !== "background",
    soul: promptFiles.soul,
    user: promptFiles.user,
    agents: promptFiles.agents,
    tools: promptFiles.tools,
    memory: promptFiles.memory,
    additionalWriteDirs,
    permanentAgentsPrompt: sections.permanentAgentsPrompt,
    agentPrompt: sections.agentPrompt,
    noToolsPrompt: sections.noToolsPrompt,
    features
  };

  logger.debug("event: buildSystemPrompt compiling permissions template");
  const permissions = Handlebars.compile(templates.permissionsTemplate)(templateContext);

  logger.debug("event: buildSystemPrompt compiling agentic template");
  const agentic = Handlebars.compile(templates.agenticTemplate)(templateContext);

  logger.debug("event: buildSystemPrompt compiling main template");
  const template = Handlebars.compile(templates.systemTemplate);
  logger.debug("event: buildSystemPrompt rendering template");
  const rendered = template({
    ...templateContext,
    permissions,
    agentic
  });

  return rendered.trim();
}

async function resolveTemplateRuntimeContext(
  context: AgentSystemPromptContext,
  runtime: AgentSystemPromptRuntime
): Promise<AgentSystemPromptTemplateRuntime> {
  const permissions = context.permissions;
  const connectorContext = resolveConnectorContext(context.descriptor, runtime.connectorRegistry);
  const cronContext = await resolveCronContext(context.descriptor, runtime.crons);
  const appFolderPath = runtime.config && context.descriptor
    ? (agentAppFolderPathResolve(context.descriptor, runtime.config.workspaceDir) ?? "")
    : "";
  return {
    workspace: permissions?.workingDir ?? "unknown",
    writeDirs: permissions?.writeDirs ?? [],
    network: permissions?.network ?? false,
    events: permissions?.events ?? false,
    appFolderPath,
    workspacePermissionGranted: permissions ? permissionWorkspaceGranted(permissions) : false,
    agentKind: resolveAgentKind(context.descriptor),
    parentAgentId: resolveParentAgentId(context.descriptor),
    connectorContext,
    cronContext
  };
}

function resolveConnectorContext(
  descriptor: AgentDescriptor | undefined,
  connectorRegistry: AgentSystemPromptConnectorRegistry | null
): AgentSystemPromptConnectorContext {
  const connector =
    descriptor?.type === "user"
      ? descriptor.connector
      : descriptor?.type === "system"
        ? descriptor.tag
        : descriptor?.type ?? "unknown";
  const capabilities = connectorRegistry?.get(connector)?.capabilities ?? null;
  const fileSendModes = capabilities?.sendFiles?.modes ?? [];
  return {
    connector,
    canSendFiles: fileSendModes.length > 0,
    fileSendModes: fileSendModes.length > 0 ? fileSendModes.join(", ") : "",
    messageFormatPrompt: capabilities?.messageFormatPrompt ?? "",
    channelId: descriptor?.type === "user" ? descriptor.channelId : "unknown",
    userId: descriptor?.type === "user" ? descriptor.userId : "unknown"
  };
}

async function resolveCronContext(
  descriptor: AgentDescriptor | undefined,
  crons: AgentSystemPromptCrons | null
): Promise<AgentSystemPromptCronContext> {
  if (!crons) {
    return {
      cronTaskId: "",
      cronTaskName: "",
      cronMemoryPath: "",
      cronFilesPath: "",
      cronTaskIds: ""
    };
  }
  const tasks = await crons.listTasks();
  const cronTaskIds = tasks.map((task) => task.id).join(", ");
  if (!descriptor || !agentDescriptorIsCron(descriptor)) {
    return {
      cronTaskId: "",
      cronTaskName: "",
      cronMemoryPath: "",
      cronFilesPath: "",
      cronTaskIds
    };
  }
  const cronTask = tasks.find((task) => task.taskUid === descriptor.id) ?? null;
  return {
    cronTaskId: cronTask?.id ?? "",
    cronTaskName: cronTask?.name ?? "",
    cronMemoryPath: cronTask?.memoryPath ?? "",
    cronFilesPath: cronTask?.filesPath ?? "",
    cronTaskIds
  };
}

function resolveAgentKind(descriptor: AgentDescriptor | undefined): "background" | "foreground" {
  return descriptor?.type === "user" ? "foreground" : "background";
}

function resolveParentAgentId(descriptor: AgentDescriptor | undefined): string {
  if (!descriptor) {
    return "";
  }
  if (descriptor.type !== "subagent" && descriptor.type !== "app") {
    return "";
  }
  return descriptor.parentAgentId ?? "";
}

function resolveRuntime(context: AgentSystemPromptContext): AgentSystemPromptRuntime {
  const config = context.agentSystem?.config.current ?? null;
  const configDir = config?.configDir ?? "";
  const skillsPath = configDir ? path.join(configDir, "skills") : "";
  const features = config?.features ?? {
    noTools: false,
    rlm: false,
    say: false
  };
  return {
    config,
    configDir,
    features,
    skillsPath,
    pluginManager: context.agentSystem?.pluginManager ?? null,
    connectorRegistry: context.agentSystem?.connectorRegistry ?? null,
    crons: context.agentSystem?.crons ?? null,
    availableTools: context.agentSystem?.toolResolver.listTools() ?? []
  };
}

function resolvePromptPaths(context: AgentSystemPromptContext): AgentSystemPromptPaths {
  return {
    soulPath: context.soulPath ?? DEFAULT_SOUL_PATH,
    userPath: context.userPath ?? DEFAULT_USER_PATH,
    agentsPath: context.agentsPath ?? DEFAULT_AGENTS_PATH,
    toolsPath: context.toolsPath ?? DEFAULT_TOOLS_PATH,
    memoryPath: context.memoryPath ?? DEFAULT_MEMORY_PATH
  };
}

async function loadPromptFiles(paths: AgentSystemPromptPaths): Promise<AgentSystemPromptFiles> {
  logger.debug(`event: buildSystemPrompt reading soul prompt path=${paths.soulPath}`);
  logger.debug(`event: buildSystemPrompt reading user prompt path=${paths.userPath}`);
  logger.debug(`event: buildSystemPrompt reading agents prompt path=${paths.agentsPath}`);
  logger.debug(`event: buildSystemPrompt reading tools prompt path=${paths.toolsPath}`);
  logger.debug(`event: buildSystemPrompt reading memory prompt path=${paths.memoryPath}`);
  const [soul, user, agents, tools, memory] = await Promise.all([
    promptFileRead(paths.soulPath, "SOUL.md"),
    promptFileRead(paths.userPath, "USER.md"),
    promptFileRead(paths.agentsPath, "AGENTS.md"),
    promptFileRead(paths.toolsPath, "TOOLS.md"),
    promptFileRead(paths.memoryPath, "MEMORY.md")
  ]);
  return {
    soul,
    user,
    agents,
    tools,
    memory
  };
}

async function loadPromptTemplates(): Promise<AgentSystemPromptTemplates> {
  logger.debug("event: buildSystemPrompt reading system template");
  logger.debug("event: buildSystemPrompt reading permissions template");
  logger.debug("event: buildSystemPrompt reading agentic template");
  const [systemTemplate, permissionsTemplate, agenticTemplate] = await Promise.all([
    agentPromptBundledRead("SYSTEM.md"),
    agentPromptBundledRead("PERMISSIONS.md"),
    agentPromptBundledRead("AGENTIC.md")
  ]);
  return {
    systemTemplate,
    permissionsTemplate: permissionsTemplate.trim(),
    agenticTemplate: agenticTemplate.trim()
  };
}

async function resolvePromptSections(
  context: AgentSystemPromptContext,
  runtime: AgentSystemPromptRuntime
): Promise<AgentSystemPromptSections> {
  const [pluginPrompt, skillsPrompt, permanentAgentsPrompt, agentPromptSection, noToolsPrompt] =
    await Promise.all([
      resolvePluginPrompt(runtime),
      resolveSkillsPrompt(runtime),
      resolvePermanentAgentsPrompt(runtime),
      resolveAgentPromptSection(context),
      resolveNoToolsPrompt(runtime)
    ]);
  return {
    pluginPrompt,
    skillsPrompt,
    permanentAgentsPrompt,
    agentPrompt: agentPromptSection.agentPrompt,
    replaceSystemPrompt: agentPromptSection.replaceSystemPrompt,
    noToolsPrompt
  };
}

async function resolvePluginPrompt(runtime: AgentSystemPromptRuntime): Promise<string> {
  if (!runtime.pluginManager) {
    return "";
  }
  const prompts = await runtime.pluginManager.getSystemPrompts();
  return prompts.length > 0 ? prompts.join("\n\n") : "";
}

async function resolveSkillsPrompt(runtime: AgentSystemPromptRuntime): Promise<string> {
  if (!runtime.skillsPath) {
    return "";
  }
  const pluginSkills = runtime.pluginManager ?? { listRegisteredSkills: () => [] };
  const skills = new Skills({
    configRoot: runtime.skillsPath,
    pluginManager: pluginSkills
  });
  const availableSkills = await skills.list();
  return skillPromptFormat(availableSkills);
}

async function resolvePermanentAgentsPrompt(runtime: AgentSystemPromptRuntime): Promise<string> {
  if (!runtime.config) {
    return "";
  }
  const permanentAgents = await agentPermanentList(runtime.config);
  return agentPermanentPrompt(permanentAgents);
}

async function resolveAgentPromptSection(
  context: AgentSystemPromptContext
): Promise<{ agentPrompt: string; replaceSystemPrompt: boolean }> {
  if (!context.descriptor) {
    return {
      agentPrompt: "",
      replaceSystemPrompt: false
    };
  }
  return agentPromptResolve(context.descriptor);
}

async function resolveNoToolsPrompt(runtime: AgentSystemPromptRuntime): Promise<string> {
  if (!runtime.features.noTools) {
    return "";
  }
  if (runtime.availableTools.length === 0) {
    return "";
  }
  return rlmNoToolsPromptBuild(runtime.availableTools);
}

function resolveAdditionalWriteDirs(
  writeDirs: string[],
  workspace: string,
  soulPath: string,
  userPath: string,
  agentsPath: string,
  toolsPath: string,
  memoryPath: string
): string[] {
  const excluded = new Set(
    [workspace, soulPath, userPath, agentsPath, toolsPath, memoryPath]
      .filter((entry) => entry && entry.trim().length > 0)
      .map((entry) => path.resolve(entry))
  );
  const filtered = writeDirs
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => path.resolve(entry))
    .filter((entry) => !excluded.has(entry));
  return Array.from(new Set(filtered)).sort();
}

async function promptFileRead(filePath: string, fallbackPrompt: string): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  try {
    const content = await fs.readFile(resolvedPath, "utf8");
    const trimmed = content.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaultContent = await agentPromptBundledRead(fallbackPrompt);
  return defaultContent.trim();
}
