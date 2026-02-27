import type { FileReference } from "../../../files/types.js";
import type { AgentDescriptor } from "../../agents/ops/agentDescriptorTypes.js";

export type ConnectorFileMode = "document" | "photo" | "video";
export type ConnectorFileDisposition = ConnectorFileMode | "auto";

export type ConnectorFile = FileReference & {
    sendAs?: ConnectorFileDisposition;
};

export type ConnectorCapabilities = {
    sendText: boolean;
    sendFiles?: {
        modes: ConnectorFileMode[];
    };
    messageFormatPrompt?: string;
    reactions?: boolean;
    typing?: boolean;
};

export type ConnectorMessage = {
    text: string | null;
    rawText?: string | null;
    files?: ConnectorFile[];
    replyToMessageId?: string;
};

export type MessageContext = {
    messageId?: string;
    timezone?: string;
    enrichments?: MessageContextEnrichment[];
};

export type MessageContextEnrichment = {
    key: string;
    value: string;
};

export type MessageHandler = (
    message: ConnectorMessage,
    context: MessageContext,
    descriptor: AgentDescriptor
) => void | Promise<void>;

export type CommandHandler = (
    command: string,
    context: MessageContext,
    descriptor: AgentDescriptor
) => void | Promise<void>;

export type SlashCommandEntry = {
    command: string;
    description: string;
};

export type PluginCommandDefinition = SlashCommandEntry & {
    handler: CommandHandler;
};

export type MessageUnsubscribe = () => void;
export type CommandUnsubscribe = () => void;

export interface Connector {
    capabilities: ConnectorCapabilities;
    onMessage(handler: MessageHandler): MessageUnsubscribe;
    onCommand?: (handler: CommandHandler) => CommandUnsubscribe;
    updateCommands?: (commands: SlashCommandEntry[]) => void | Promise<void>;
    sendMessage(targetId: string, message: ConnectorMessage): Promise<void>;
    startTyping?: (targetId: string) => () => void;
    setReaction?: (targetId: string, messageId: string, reaction: string) => Promise<void>;
    shutdown?: (reason?: string) => void | Promise<void>;
}
