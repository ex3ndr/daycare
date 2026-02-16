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
  permissionTags?: string[];
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

export type PermissionKind = "read" | "write" | "network" | "events";
export type PermissionRequestScope = "now" | "always";

export type PermissionAccess =
  | { kind: "network" }
  | { kind: "events" }
  | { kind: "read"; path: string }
  | { kind: "write"; path: string };

export type PermissionEntry = {
  permission: string;
  access: PermissionAccess;
};

export type PermissionRequest = {
  token: string;
  agentId: string;
  reason: string;
  message: string;
  permissions: PermissionEntry[];
  scope?: PermissionRequestScope;
  requester: {
    id: string;
    type: AgentDescriptor["type"];
    label: string;
    kind: "foreground" | "background";
  };
};

export type PermissionDecision = {
  token: string;
  agentId: string;
  approved: boolean;
  permissions: PermissionEntry[];
  scope?: PermissionRequestScope;
};

export type PermissionHandler = (
  decision: PermissionDecision,
  context: MessageContext,
  descriptor: AgentDescriptor
) => void | Promise<void>;

export interface Connector {
  capabilities: ConnectorCapabilities;
  onMessage(handler: MessageHandler): MessageUnsubscribe;
  onCommand?: (handler: CommandHandler) => CommandUnsubscribe;
  updateCommands?: (commands: SlashCommandEntry[]) => void | Promise<void>;
  onPermission?: (handler: PermissionHandler) => MessageUnsubscribe;
  sendMessage(targetId: string, message: ConnectorMessage): Promise<void>;
  requestPermission?: (
    targetId: string,
    request: PermissionRequest,
    context: MessageContext,
    descriptor: AgentDescriptor
  ) => Promise<void>;
  startTyping?: (targetId: string) => () => void;
  setReaction?: (
    targetId: string,
    messageId: string,
    reaction: string
  ) => Promise<void>;
  shutdown?: (reason?: string) => void | Promise<void>;
}
