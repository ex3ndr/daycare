import type { FileReference } from "../../files/types.js";

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
  reactions?: boolean;
  typing?: boolean;
};

export type ConnectorMessage = {
  text: string | null;
  files?: ConnectorFile[];
  replyToMessageId?: string;
};

export type MessageContext = {
  channelId: string;
  channelType?: "private" | "group" | "supergroup" | "channel" | "unknown";
  userId: string | null;
  sessionId?: string;
  messageId?: string;
  providerId?: string;
};

export type MessageHandler = (
  message: ConnectorMessage,
  context: MessageContext
) => void | Promise<void>;

export type MessageUnsubscribe = () => void;

export interface Connector {
  capabilities: ConnectorCapabilities;
  onMessage(handler: MessageHandler): MessageUnsubscribe;
  sendMessage(targetId: string, message: ConnectorMessage): Promise<void>;
  startTyping?: (targetId: string) => () => void;
  setReaction?: (
    targetId: string,
    messageId: string,
    reaction: string
  ) => Promise<void>;
  shutdown?: (reason?: string) => void | Promise<void>;
}
