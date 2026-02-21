import type { Context } from "../agents/context.js";

export type SignalSource =
    | { type: "system"; userId: string }
    | { type: "agent"; id: string; userId: string }
    | { type: "webhook"; id?: string; userId: string }
    | { type: "process"; id?: string; userId: string };

export type SignalGenerateInput = {
    type: string;
    source: SignalSource;
    data?: unknown;
};

export type Signal = {
    id: string;
    type: string;
    source: SignalSource;
    data?: unknown;
    createdAt: number;
};

export type SignalSubscription = {
    ctx: Context;
    pattern: string;
    silent: boolean;
    createdAt: number;
    updatedAt: number;
};

export type SignalSubscribeInput = {
    ctx: Context;
    pattern: string;
    silent?: boolean;
};

export type SignalUnsubscribeInput = {
    ctx: Context;
    pattern: string;
};

export type DelayedSignalScheduleInput = {
    type: string;
    deliverAt: number;
    source: SignalSource;
    data?: unknown;
    repeatKey?: string;
};

export type DelayedSignalCancelRepeatKeyInput = {
    type: string;
    repeatKey: string;
};

export type DelayedSignal = {
    id: string;
    type: string;
    deliverAt: number;
    source: SignalSource;
    data?: unknown;
    repeatKey?: string;
    createdAt: number;
    updatedAt: number;
};
