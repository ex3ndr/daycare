import type { AgentPath, ConnectorMessage, MessageContext } from "@/types";
import { messageContextMerge } from "./messageContextMerge.js";
import { messageIsEmpty } from "./messageIsEmpty.js";

export type IncomingMessageInput = {
    path: AgentPath;
    message: ConnectorMessage;
    context: MessageContext;
};

export type IncomingMessageBatch = IncomingMessageInput & {
    count: number;
};

export type IncomingMessagesOptions = {
    delayMs: number;
    onFlush: (items: IncomingMessageBatch[]) => Promise<void>;
};

/**
 * Debounces and coalesces connector messages before agent dispatch.
 * Expects: callers post connector-originated message items only.
 */
export class IncomingMessages {
    private readonly delayMs: number;
    private readonly onFlush: (items: IncomingMessageBatch[]) => Promise<void>;
    private pending: IncomingMessageInput[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private flushing: Promise<void> | null = null;

    constructor(options: IncomingMessagesOptions) {
        this.delayMs = options.delayMs;
        this.onFlush = options.onFlush;
    }

    post(input: IncomingMessageInput): void {
        if (messageIsEmpty(input.message)) {
            return;
        }
        this.pending.push(input);
        this.schedule();
    }

    /**
     * Drops queued (not yet flushed) messages for one path.
     * Expects: caller uses this for command-style control flows like /reset.
     */
    dropForPath(path: AgentPath): number {
        if (this.pending.length === 0) {
            return 0;
        }
        const key = batchKeyBuild(path);
        const before = this.pending.length;
        this.pending = this.pending.filter((entry) => batchKeyBuild(entry) !== key);
        return before - this.pending.length;
    }

    async flush(): Promise<void> {
        this.cancelTimer();
        for (;;) {
            if (this.flushing) {
                await this.flushing;
                continue;
            }
            if (this.pending.length === 0) {
                return;
            }
            await this.flushOnce();
        }
    }

    private schedule(): void {
        this.cancelTimer();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flushOnce();
        }, this.delayMs);
    }

    private async flushOnce(): Promise<void> {
        if (this.flushing || this.pending.length === 0) {
            return;
        }
        const batch = batchBuild(this.pending);
        this.pending = [];
        this.flushing = this.onFlush(batch).finally(() => {
            this.flushing = null;
            if (this.pending.length > 0) {
                this.schedule();
            }
        });
        await this.flushing;
    }

    private cancelTimer(): void {
        if (!this.timer) {
            return;
        }
        clearTimeout(this.timer);
        this.timer = null;
    }
}

function batchBuild(inputs: IncomingMessageInput[]): IncomingMessageBatch[] {
    const grouped = new Map<string, IncomingMessageBatch>();
    const keys: string[] = [];
    for (const input of inputs) {
        const key = batchKeyBuild(input);
        const existing = grouped.get(key);
        if (!existing) {
            grouped.set(key, { ...input, count: 1 });
            keys.push(key);
            continue;
        }
        existing.message = connectorMessageMerge(existing.message, input.message);
        existing.context = messageContextMerge(existing.context, input.context);
        existing.count += 1;
    }
    return keys.map((key) => grouped.get(key)).filter((item): item is IncomingMessageBatch => !!item);
}

function batchKeyBuild(value: IncomingMessageInput | AgentPath): string {
    if (typeof value === "string") {
        return value;
    }
    return value.path;
}

function connectorMessageMerge(left: ConnectorMessage, right: ConnectorMessage): ConnectorMessage {
    const files = [...(left.files ?? []), ...(right.files ?? [])];
    const replyToMessageId = right.replyToMessageId ?? left.replyToMessageId;
    const rawText = textMerge(left.rawText ?? left.text, right.rawText ?? right.text);
    return {
        text: textMerge(left.text, right.text),
        ...(rawText !== null ? { rawText } : {}),
        ...(files.length > 0 ? { files } : {}),
        ...(replyToMessageId ? { replyToMessageId } : {})
    };
}

function textMerge(left: string | null | undefined, right: string | null | undefined): string | null {
    const parts = [left, right].filter((value): value is string => value !== null && value !== undefined);
    if (parts.length === 0) {
        return null;
    }
    return parts.join("\n");
}
