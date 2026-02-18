// Central type re-exports for cross-cutting concerns.
// Import via: import type { ... } from "@/types";

// Permissions
export type { SessionPermissions } from "./engine/permissions.js";

// Scheduling
export type { ExecGateDefinition } from "./engine/scheduling/execGateTypes.js";
export type { SandboxPackageManager } from "./sandbox/sandboxPackageManagers.js";

// Connectors
export type {
  Connector,
  ConnectorCapabilities,
  ConnectorFile,
  ConnectorFileDisposition,
  ConnectorFileMode,
  ConnectorMessage,
  CommandHandler,
  CommandUnsubscribe,
  MessageContext,
  MessageHandler,
  MessageUnsubscribe,
  PluginCommandDefinition,
  PermissionAccess,
  PermissionEntry,
  PermissionDecision,
  PermissionHandler,
  PermissionKind,
  PermissionRequestScope,
  PermissionRequest,
  SlashCommandEntry
} from "./engine/modules/connectors/types.js";

// Files
export type { FileReference } from "./files/types.js";

// Plugins
export type {
  PluginApi,
  PluginInstance,
  PluginModule,
  PluginOnboardingApi,
  PluginOnboardingResult
} from "./engine/plugins/types.js";

// Agents
export type {
  AgentMessage,
  AgentState,
  AgentTokenEntry,
  AgentTokenSize,
  AgentTokenSnapshotSize,
  AgentTokenStats,
  AgentLifecycleState,
  AgentHistoryRecord,
  AgentHistoryAssistantRewriteRecord,
  AgentHistoryRlmCompleteRecord,
  AgentHistoryRlmStartRecord,
  AgentHistoryRlmToolCallRecord,
  AgentHistoryRlmToolResultRecord,
  AgentInboxItem,
  AgentInboxResult,
  AgentPostTarget,
  BackgroundAgentState
} from "./engine/agents/ops/agentTypes.js";
export type { AgentDescriptor, AgentFetchStrategy } from "./engine/agents/ops/agentDescriptorTypes.js";

// Inference
export type {
  InferenceClient,
  InferenceProvider,
  InferenceProviderOptions
} from "./engine/modules/inference/types.js";

// Images
export type { ImageGenerationProvider } from "./engine/modules/images/types.js";

// Tools
export type {
  ToolDefinition,
  ToolResultContract,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolResultPrimitive,
  ToolResultRow,
  ToolResultShallowObject
} from "./engine/modules/tools/types.js";

// Skills
export type { AgentSkill } from "./engine/skills/skillTypes.js";

// Config
export type { Config } from "./config/configTypes.js";

// Signals
export type {
  Signal,
  DelayedSignal,
  DelayedSignalCancelRepeatKeyInput,
  DelayedSignalScheduleInput,
  SignalGenerateInput,
  SignalSource,
  SignalSubscription,
  SignalSubscribeInput,
  SignalUnsubscribeInput
} from "./engine/signals/signalTypes.js";

// Channels
export type {
  Channel,
  ChannelMember,
  ChannelMessage,
  ChannelSignalData
} from "./engine/channels/channelTypes.js";

// Apps
export type {
  AppDescriptor,
  AppManifest,
  AppPermissions,
  AppReviewDecision,
  AppRule,
  AppRuleSet
} from "./engine/apps/appTypes.js";

// Expose
export type {
  ExposeCreateInput,
  ExposeEndpoint,
  ExposeEndpointAuth,
  ExposeMode,
  ExposeProviderRegistrationApi,
  ExposeTarget,
  ExposeTunnelProvider,
  ExposeUpdateInput
} from "./engine/expose/exposeTypes.js";
