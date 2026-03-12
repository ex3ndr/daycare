import type { FileReference } from "../../../files/types.js";
import type { AgentPath } from "../../agents/ops/agentPathTypes.js";

export type ConnectorTarget = AgentPath;

export type ConnectorRecipient = {
    connectorKey: string;
};

export type ConnectorResolvedTarget = {
    connector: string;
    targetId: string;
    recipient: ConnectorRecipient;
};

export type ConnectorFileMode = "document" | "photo" | "video" | "voice";
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
    buttons?: ConnectorMessageButton[];
};

export type ConnectorDraftReference = {
    type: "telegram";
    messageId: string;
};

export type ConnectorDraft = {
    reference?: ConnectorDraftReference;
    update: (message: ConnectorMessage) => Promise<void>;
    finish: (message?: ConnectorMessage) => Promise<void>;
};

export type ConnectorMessageButton =
    | {
          type: "url";
          text: string;
          url: string;
          openMode?: "auto" | "browser";
      }
    | {
          type: "callback";
          text: string;
          callback: string;
      };

export type MessageContext = {
    messageId?: string;
    connectorTargetId?: string;
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
    target: ConnectorTarget
) => void | Promise<void>;

export type CommandHandler = (
    command: string,
    context: MessageContext,
    target: ConnectorTarget
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
    sendMessage(recipient: ConnectorRecipient, message: ConnectorMessage): Promise<void>;
    createDraft?: (recipient: ConnectorRecipient, message: ConnectorMessage) => Promise<ConnectorDraft | null>;
    resumeDraft?: (recipient: ConnectorRecipient, reference: ConnectorDraftReference) => Promise<ConnectorDraft | null>;
    startTyping?: (recipient: ConnectorRecipient) => () => void;
    setReaction?: (recipient: ConnectorRecipient, messageId: string, reaction: string) => Promise<void>;
    shutdown?: (reason?: string) => void | Promise<void>;
}
