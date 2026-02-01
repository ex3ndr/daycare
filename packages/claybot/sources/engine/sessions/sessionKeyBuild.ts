import type { SessionDescriptor } from "./descriptor.js";

export function sessionKeyBuild(descriptor: SessionDescriptor): string | null {
  switch (descriptor.type) {
    case "cron":
      return `cron:${descriptor.id}`;
    case "heartbeat":
      return "heartbeat";
    case "user":
      return `user:${descriptor.connector}:${descriptor.channelId}:${descriptor.userId}`;
    default:
      return null;
  }
}
