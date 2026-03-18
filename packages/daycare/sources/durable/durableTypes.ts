export const DURABLE_RUNTIME_KINDS = ["local", "inngest"] as const;
export type DurableRuntimeKind = (typeof DURABLE_RUNTIME_KINDS)[number];

export type Durable = {
    kind: DurableRuntimeKind;
    start(): Promise<void>;
    stop(): Promise<void>;
};
