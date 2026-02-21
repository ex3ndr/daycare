import { createId } from "@paralleldrive/cuid2";

import type {
    AgentInboxCompletion,
    AgentInboxEntry,
    AgentInboxItem,
    AgentInboxMessage,
    AgentInboxSteering
} from "./agentTypes.js";

/**
 * AgentInbox is a single-consumer queue for agent work items.
 * Expects: only one agent attaches to an inbox at a time.
 */
export class AgentInbox {
    readonly agentId: string;
    private items: AgentInboxEntry[] = [];
    private waiters: Array<(entry: AgentInboxEntry) => void> = [];
    private attached = false;
    private steeringMessage: AgentInboxSteering | null = null;

    constructor(agentId: string) {
        this.agentId = agentId;
    }

    attach(): void {
        if (this.attached) {
            throw new Error(`AgentInbox already attached: ${this.agentId}`);
        }
        this.attached = true;
    }

    detach(): void {
        this.attached = false;
    }

    post(
        item: AgentInboxItem,
        completion: AgentInboxCompletion | null = null,
        options?: AgentInboxPostOptions
    ): AgentInboxEntry {
        if (item.type === "message" && options?.merge !== false) {
            const merged = this.mergePendingMessage(item, completion);
            if (merged) {
                return merged;
            }
        }
        const entry: AgentInboxEntry = {
            id: options?.id ?? createId(),
            postedAt: options?.postedAt ?? Date.now(),
            item,
            completion
        };
        const waiter = this.waiters.shift();
        if (waiter) {
            waiter(entry);
            return entry;
        }
        this.items.push(entry);
        return entry;
    }

    private mergePendingMessage(
        item: AgentInboxMessage,
        completion: AgentInboxCompletion | null
    ): AgentInboxEntry | null {
        const lastEntry = this.items[this.items.length - 1];
        if (!lastEntry || lastEntry.item.type !== "message") {
            return null;
        }
        lastEntry.item = messageItemMerge(lastEntry.item, item);
        lastEntry.completion = completionMerge(lastEntry.completion, completion);
        return lastEntry;
    }

    async next(): Promise<AgentInboxEntry> {
        const next = this.items.shift();
        if (next) {
            return next;
        }
        return new Promise((resolve) => {
            this.waiters.push(resolve);
        });
    }

    size(): number {
        return this.items.length;
    }

    listPending(): AgentInboxEntry[] {
        return [...this.items];
    }

    /**
     * Removes and returns all queued inbox entries.
     * Expects: caller owns synchronization for queue mutation.
     */
    drainPending(): AgentInboxEntry[] {
        const pending = this.items;
        this.items = [];
        return pending;
    }

    /**
     * Store a steering message. Replaces any previous steering message.
     */
    steer(item: AgentInboxSteering): void {
        this.steeringMessage = item;
    }

    /**
     * Returns and clears the current steering message.
     */
    consumeSteering(): AgentInboxSteering | null {
        const message = this.steeringMessage;
        this.steeringMessage = null;
        return message;
    }

    /**
     * Check if there is a pending steering message.
     */
    hasSteering(): boolean {
        return this.steeringMessage !== null;
    }
}

type AgentInboxPostOptions = {
    id?: string;
    postedAt?: number;
    merge?: boolean;
};

function messageItemMerge(left: AgentInboxMessage, right: AgentInboxMessage): AgentInboxMessage {
    const files = [...(left.message.files ?? []), ...(right.message.files ?? [])];
    const rawText = textMerge(left.message.rawText ?? left.message.text, right.message.rawText ?? right.message.text);
    return {
        type: "message",
        message: {
            text: textMerge(left.message.text, right.message.text),
            ...(rawText !== null ? { rawText } : {}),
            ...(files.length > 0 ? { files } : {}),
            ...((right.message.replyToMessageId ?? left.message.replyToMessageId)
                ? { replyToMessageId: right.message.replyToMessageId ?? left.message.replyToMessageId }
                : {})
        },
        context: messageContextMerge(left.context, right.context)
    };
}

function messageContextMerge(
    left: AgentInboxMessage["context"],
    right: AgentInboxMessage["context"]
): AgentInboxMessage["context"] {
    const messageId = right.messageId ?? left.messageId;
    return {
        ...(messageId ? { messageId } : {})
    };
}

function completionMerge(
    left: AgentInboxCompletion | null,
    right: AgentInboxCompletion | null
): AgentInboxCompletion | null {
    if (!left) {
        return right;
    }
    if (!right) {
        return left;
    }
    return {
        resolve: (result) => {
            left.resolve(result);
            right.resolve(result);
        },
        reject: (error) => {
            left.reject(error);
            right.reject(error);
        }
    };
}

function textMerge(left: string | null | undefined, right: string | null | undefined): string | null {
    const parts = [left, right].filter((value): value is string => value !== null && value !== undefined);
    if (parts.length === 0) {
        return null;
    }
    return parts.join("\n");
}
