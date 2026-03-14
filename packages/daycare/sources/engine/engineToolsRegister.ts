import type { PsqlService } from "../services/psql/PsqlService.js";
import { psqlToolsBuild } from "../services/psql/psqlTools.js";
import type { ObservationLogRepository } from "../storage/observationLogRepository.js";
import type { AcpSessions } from "./acp/acpSessions.js";
import type { Channels } from "./channels/channels.js";
import type { ConfigModule } from "./config/configModule.js";
import type { Crons } from "./cron/crons.js";
import type { Friends } from "./friends/friends.js";
import type { MiniApps } from "./mini-apps/MiniApps.js";
import { miniAppCreateToolBuild } from "./mini-apps/miniAppCreateToolBuild.js";
import { miniAppDeleteToolBuild } from "./mini-apps/miniAppDeleteToolBuild.js";
import { miniAppEjectToolBuild } from "./mini-apps/miniAppEjectToolBuild.js";
import { miniAppUpdateToolBuild } from "./mini-apps/miniAppUpdateToolBuild.js";
import type { ImageGenerationRegistry } from "./modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "./modules/inference/router.js";
import type { MediaAnalysisRegistry } from "./modules/mediaAnalysisRegistry.js";
import type { SpeechGenerationRegistry } from "./modules/speechGenerationRegistry.js";
import type { ToolResolver } from "./modules/toolResolver.js";
import { acpSessionMessageToolBuild } from "./modules/tools/acpSessionMessageToolBuild.js";
import { acpSessionStartToolBuild } from "./modules/tools/acpSessionStartToolBuild.js";
import { agentAskTool } from "./modules/tools/agentAskTool.js";
import { agentCompactToolBuild } from "./modules/tools/agentCompactTool.js";
import { agentModelSetToolBuild } from "./modules/tools/agentModelSetToolBuild.js";
import { agentResetToolBuild } from "./modules/tools/agentResetTool.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./modules/tools/background.js";
import { channelCreateToolBuild } from "./modules/tools/channelCreateTool.js";
import { channelHistoryToolBuild } from "./modules/tools/channelHistoryTool.js";
import { channelAddMemberToolBuild, channelRemoveMemberToolBuild } from "./modules/tools/channelMemberTool.js";
import { channelSendToolBuild } from "./modules/tools/channelSendTool.js";
import { fragmentArchiveToolBuild } from "./modules/tools/fragmentArchiveToolBuild.js";
import { fragmentCreateToolBuild } from "./modules/tools/fragmentCreateToolBuild.js";
import { fragmentListToolBuild } from "./modules/tools/fragmentListToolBuild.js";
import { fragmentReadToolBuild } from "./modules/tools/fragmentReadToolBuild.js";
import { fragmentUpdateToolBuild } from "./modules/tools/fragmentUpdateToolBuild.js";
import { friendAddToolBuild } from "./modules/tools/friendAddToolBuild.js";
import { friendRemoveToolBuild } from "./modules/tools/friendRemoveToolBuild.js";
import { friendSendToolBuild } from "./modules/tools/friendSendToolBuild.js";
import { buildImageGenerationTool } from "./modules/tools/image-generation.js";
import { inferenceClassifyToolBuild } from "./modules/tools/inference/inferenceClassifyToolBuild.js";
import { inferenceSummaryToolBuild } from "./modules/tools/inference/inferenceSummaryToolBuild.js";
import { buildMediaAnalysisTool } from "./modules/tools/media-analysis.js";
import { buildMermaidPngTool } from "./modules/tools/mermaid-png.js";
import { nowTool } from "./modules/tools/nowTool.js";
import { pdfProcessTool } from "./modules/tools/pdf-process.js";
import { permanentAgentToolBuild } from "./modules/tools/permanentAgentToolBuild.js";
import { buildReactionTool } from "./modules/tools/reaction.js";
import { sayTool } from "./modules/tools/sayTool.js";
import { secretAddToolBuild } from "./modules/tools/secretAddToolBuild.js";
import { secretRemoveToolBuild } from "./modules/tools/secretRemoveToolBuild.js";
import { secretCopyToolBuild } from "./modules/tools/secretsCopyToolBuild.js";
import { buildSendFileTool } from "./modules/tools/send-file.js";
import { sendUserMessageToolBuild } from "./modules/tools/sendUserMessageTool.js";
import { sessionHistoryToolBuild } from "./modules/tools/sessionHistoryToolBuild.js";
import { buildSignalGenerateTool } from "./modules/tools/signal.js";
import { signalEventsCsvToolBuild } from "./modules/tools/signalEventsCsvToolBuild.js";
import { buildSignalSubscribeTool } from "./modules/tools/signalSubscribeToolBuild.js";
import { buildSignalUnsubscribeTool } from "./modules/tools/signalUnsubscribeToolBuild.js";
import { skillAddToolBuild } from "./modules/tools/skillAddToolBuild.js";
import { skillEjectToolBuild } from "./modules/tools/skillEjectToolBuild.js";
import { skillRemoveToolBuild } from "./modules/tools/skillRemoveToolBuild.js";
import { skillToolBuild } from "./modules/tools/skillToolBuild.js";
import { buildSpeechGenerationTool } from "./modules/tools/speech-generation.js";
import { startBackgroundWorkflowToolBuild } from "./modules/tools/startBackgroundWorkflowTool.js";
import {
    buildTaskCreateTool,
    buildTaskDeleteTool,
    buildTaskReadTool,
    buildTaskRunTool,
    buildTaskTriggerAddTool,
    buildTaskTriggerRemoveTool,
    buildTaskUpdateTool
} from "./modules/tools/task.js";
import { topologyTool } from "./modules/tools/topologyToolBuild.js";
import { userProfileUpdateTool } from "./modules/tools/userProfileUpdateTool.js";
import { vaultAppendToolBuild } from "./modules/tools/vaultAppendToolBuild.js";
import { vaultPatchToolBuild } from "./modules/tools/vaultPatchToolBuild.js";
import { vaultReadToolBuild } from "./modules/tools/vaultReadToolBuild.js";
import { vaultSearchToolBuild } from "./modules/tools/vaultSearchToolBuild.js";
import { vaultTreeToolBuild } from "./modules/tools/vaultTreeToolBuild.js";
import { vaultWriteToolBuild } from "./modules/tools/vaultWriteToolBuild.js";
import { buildVoiceListTool } from "./modules/tools/voice-list.js";
import { voiceAgentCreateToolBuild } from "./modules/tools/voiceAgentCreateToolBuild.js";
import { observationQueryToolBuild } from "./observations/observationQueryToolBuild.js";
import type { Secrets } from "./secrets/secrets.js";
import type { Signals } from "./signals/signals.js";
import { workspaceCreateToolBuild } from "./workspaces/workspaceCreateToolBuild.js";
import type { Workspaces } from "./workspaces/workspaces.js";

type EngineToolsRegisterOptions = {
    toolResolver: ToolResolver;
    inferenceRouter: InferenceRouter;
    config: ConfigModule;
    crons: Crons;
    signals: Signals;
    channels: Channels;
    secrets: Secrets;
    acpSessions: AcpSessions;
    workspaces: Workspaces;
    miniApps: MiniApps;
    friends: Friends;
    imageRegistry: ImageGenerationRegistry;
    speechRegistry: SpeechGenerationRegistry;
    mediaRegistry: MediaAnalysisRegistry;
    psqlService: PsqlService;
    observationLog: ObservationLogRepository;
};

/**
 * Registers the full built-in core tool catalog onto a tool resolver.
 * Expects: all supporting facades match the current runtime boot and are ready for tool execution.
 */
export function engineToolsRegister(options: EngineToolsRegisterOptions): void {
    options.toolResolver.register("core", buildTaskCreateTool());
    options.toolResolver.register("core", buildTaskReadTool());
    options.toolResolver.register("core", buildTaskUpdateTool());
    options.toolResolver.register("core", buildTaskDeleteTool());
    options.toolResolver.register("core", buildTaskRunTool());
    options.toolResolver.register("core", buildTaskTriggerAddTool());
    options.toolResolver.register("core", buildTaskTriggerRemoveTool());
    options.toolResolver.register("core", buildStartBackgroundAgentTool());
    options.toolResolver.register("core", startBackgroundWorkflowToolBuild());
    options.toolResolver.register("core", buildSendAgentMessageTool());
    options.toolResolver.register("core", acpSessionStartToolBuild(options.acpSessions));
    options.toolResolver.register("core", acpSessionMessageToolBuild(options.acpSessions));
    options.toolResolver.register("core", agentAskTool());
    options.toolResolver.register("core", vaultSearchToolBuild());
    options.toolResolver.register("core", inferenceSummaryToolBuild(options.inferenceRouter, options.config));
    options.toolResolver.register("core", inferenceClassifyToolBuild(options.inferenceRouter, options.config));
    options.toolResolver.register("core", agentModelSetToolBuild());
    options.toolResolver.register("core", agentResetToolBuild());
    options.toolResolver.register("core", agentCompactToolBuild());
    options.toolResolver.register("core", sendUserMessageToolBuild());
    options.toolResolver.register("core", skillToolBuild());
    options.toolResolver.register("core", skillAddToolBuild());
    options.toolResolver.register("core", skillRemoveToolBuild());
    options.toolResolver.register("core", skillEjectToolBuild());
    options.toolResolver.register("core", secretAddToolBuild());
    options.toolResolver.register("core", secretRemoveToolBuild());
    options.toolResolver.register("core", secretCopyToolBuild());
    options.toolResolver.register("core", userProfileUpdateTool());
    options.toolResolver.register(
        "core",
        topologyTool(options.crons, options.signals, options.channels, options.secrets, options.acpSessions)
    );
    options.toolResolver.register("core", sessionHistoryToolBuild());
    options.toolResolver.register("core", permanentAgentToolBuild());
    options.toolResolver.register("core", workspaceCreateToolBuild(options.workspaces));
    options.toolResolver.register("core", miniAppCreateToolBuild(options.miniApps));
    options.toolResolver.register("core", miniAppUpdateToolBuild(options.miniApps));
    options.toolResolver.register("core", miniAppDeleteToolBuild(options.miniApps));
    options.toolResolver.register("core", miniAppEjectToolBuild(options.miniApps));
    options.toolResolver.register("core", channelCreateToolBuild(options.channels));
    options.toolResolver.register("core", channelSendToolBuild(options.channels));
    options.toolResolver.register("core", channelHistoryToolBuild(options.channels));
    options.toolResolver.register("core", channelAddMemberToolBuild(options.channels));
    options.toolResolver.register("core", channelRemoveMemberToolBuild(options.channels));
    options.toolResolver.register("core", friendAddToolBuild(options.friends));
    options.toolResolver.register("core", friendRemoveToolBuild(options.friends));
    options.toolResolver.register("core", friendSendToolBuild());
    options.toolResolver.register("core", buildImageGenerationTool(options.imageRegistry));
    options.toolResolver.register("core", buildSpeechGenerationTool(options.speechRegistry));
    options.toolResolver.register("core", buildVoiceListTool(options.speechRegistry));
    options.toolResolver.register("core", voiceAgentCreateToolBuild());
    options.toolResolver.register("core", buildMediaAnalysisTool(options.mediaRegistry));
    options.toolResolver.register("core", buildMermaidPngTool());
    options.toolResolver.register("core", buildReactionTool());
    options.toolResolver.register("core", nowTool());
    options.toolResolver.register("core", sayTool());
    options.toolResolver.register("core", buildSendFileTool());
    options.toolResolver.register("core", pdfProcessTool());
    options.toolResolver.register("core", buildSignalGenerateTool(options.signals));
    options.toolResolver.register("core", signalEventsCsvToolBuild(options.signals));
    options.toolResolver.register("core", buildSignalSubscribeTool(options.signals));
    options.toolResolver.register("core", buildSignalUnsubscribeTool(options.signals));
    options.toolResolver.register("core", observationQueryToolBuild(options.observationLog));
    options.toolResolver.register("core", vaultReadToolBuild());
    options.toolResolver.register("core", vaultTreeToolBuild());
    options.toolResolver.register("core", vaultAppendToolBuild());
    options.toolResolver.register("core", vaultPatchToolBuild());
    options.toolResolver.register("core", vaultWriteToolBuild());
    options.toolResolver.register("core", fragmentCreateToolBuild());
    options.toolResolver.register("core", fragmentReadToolBuild());
    options.toolResolver.register("core", fragmentListToolBuild());
    options.toolResolver.register("core", fragmentUpdateToolBuild());
    options.toolResolver.register("core", fragmentArchiveToolBuild());
    for (const tool of psqlToolsBuild(options.psqlService)) {
        options.toolResolver.register("core", tool);
    }
}
