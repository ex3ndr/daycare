// Central type re-exports for cross-cutting concerns.
// Import via: import type { ... } from "@/types";

// Config
export type { Config } from "./config/configTypes.js";
export { Context, contextForAgent, contextForUser } from "./engine/agents/context.js";
export type { AgentDescriptor, AgentFetchStrategy } from "./engine/agents/ops/agentDescriptorTypes.js";
// Agents
export type {
    AgentHistoryAssistantRewriteRecord,
    AgentHistoryRecord,
    AgentHistoryRlmCompleteRecord,
    AgentHistoryRlmStartRecord,
    AgentHistoryRlmToolCallRecord,
    AgentHistoryRlmToolResultRecord,
    AgentInboxItem,
    AgentInboxResult,
    AgentLifecycleState,
    AgentMessage,
    AgentModelOverride,
    AgentPostTarget,
    AgentState,
    AgentTokenEntry,
    AgentTokenSize,
    AgentTokenSnapshotSize,
    AgentTokenStats,
    BackgroundAgentState
} from "./engine/agents/ops/agentTypes.js";
// Apps
export type {
    AppDescriptor,
    AppManifest,
    AppPermissions,
    AppReviewDecision,
    AppRule,
    AppRuleSet
} from "./engine/apps/appTypes.js";
// Channels
export type {
    Channel,
    ChannelMember,
    ChannelMessage,
    ChannelSignalData
} from "./engine/channels/channelTypes.js";
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
// Memory
export type { GraphNode, GraphNodeFrontmatter, GraphTree } from "./engine/memory/graph/graphTypes.js";
export type { Memory } from "./engine/memory/memory.js";
// Connectors
export type {
    CommandHandler,
    CommandUnsubscribe,
    Connector,
    ConnectorCapabilities,
    ConnectorFile,
    ConnectorFileDisposition,
    ConnectorFileMode,
    ConnectorMessage,
    MessageContext,
    MessageHandler,
    MessageUnsubscribe,
    PluginCommandDefinition,
    SlashCommandEntry
} from "./engine/modules/connectors/types.js";
// Images
export type { ImageGenerationProvider } from "./engine/modules/images/types.js";

// Inference
export type {
    InferenceClient,
    InferenceProvider,
    InferenceProviderOptions
} from "./engine/modules/inference/types.js";
// Tools
export type {
    ToolDefinition,
    ToolExecutionContext,
    ToolExecutionResult,
    ToolResultContract,
    ToolResultOutcomeObject,
    ToolResultPrimitive,
    ToolResultRow,
    ToolResultShallowObject,
    ToolVisibilityContext
} from "./engine/modules/tools/types.js";
// Permissions
export type { SessionPermissions } from "./engine/permissions.js";
// Plugins
export type {
    PluginApi,
    PluginInstance,
    PluginModule,
    PluginOnboardingApi,
    PluginOnboardingResult
} from "./engine/plugins/types.js";
// Signals
export type {
    DelayedSignal,
    DelayedSignalCancelRepeatKeyInput,
    DelayedSignalScheduleInput,
    Signal,
    SignalGenerateInput,
    SignalSource,
    SignalSubscribeInput,
    SignalSubscription,
    SignalUnsubscribeInput
} from "./engine/signals/signalTypes.js";
// Skills
export type { AgentSkill } from "./engine/skills/skillTypes.js";
// Files
export type { FileReference } from "./files/types.js";
export type { SandboxPackageManager } from "./sandbox/sandboxPackageManagers.js";
// Storage
export type {
    UserConnectorKeyDbRecord,
    UserDbRecord
} from "./storage/databaseTypes.js";
