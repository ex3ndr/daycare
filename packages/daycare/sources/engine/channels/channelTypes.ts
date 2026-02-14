export type ChannelMember = {
  agentId: string;
  username: string;
  joinedAt: number;
};

export type Channel = {
  id: string;
  name: string;
  leader: string;
  members: ChannelMember[];
  createdAt: number;
  updatedAt: number;
};

export type ChannelMessage = {
  id: string;
  channelName: string;
  senderUsername: string;
  text: string;
  mentions: string[];
  createdAt: number;
};

export type ChannelSignalData = {
  channelName: string;
  messageId: string;
  senderUsername: string;
  text: string;
  mentions: string[];
  createdAt: number;
  history: ChannelMessage[];
};

