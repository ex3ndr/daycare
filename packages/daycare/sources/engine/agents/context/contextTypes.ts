import type { DurableRuntimeKind } from "../../../durable/durableTypes.js";
import type { Context } from "./Context.js";

export type ContextJsonValue =
    | null
    | boolean
    | number
    | string
    | ContextJsonValue[]
    | { [key: string]: ContextJsonValue };

export type ContextDurableState = {
    active: true;
    kind: DurableRuntimeKind;
};

export type ContextNamespaceValues = Record<string, ContextJsonValue>;

export type ContextJson = {
    userId: string;
    personUserId?: string;
    agentId?: string;
    durable?: ContextDurableState;
    namespaces?: ContextNamespaceValues;
};

export type ContextSerialized = {
    version: 1;
    ctx: ContextJson;
};

export type ContextNamespaceValueWiden<TValue extends ContextJsonValue> = TValue extends string
    ? string
    : TValue extends number
      ? number
      : TValue extends boolean
        ? boolean
        : TValue extends (infer TEntry)[]
          ? ContextNamespaceValueWiden<TEntry & ContextJsonValue>[]
          : TValue extends { [key: string]: ContextJsonValue }
            ? { [K in keyof TValue]: ContextNamespaceValueWiden<TValue[K]> }
            : TValue;

export type ContextNamespace<TValue extends ContextJsonValue> = {
    readonly id: string;
    readonly defaultValue: TValue;
    get(ctx: Context): TValue;
    set(ctx: Context, value: TValue): Context;
};
