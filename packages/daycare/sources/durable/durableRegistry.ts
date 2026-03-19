import type { Context } from "@/types";
import type { DurableFunctionInput, DurableFunctionName, DurableFunctionOutput } from "./durableFunctions.js";

export type DurableInstance = {
    call<TName extends DurableFunctionName>(
        ctx: Context,
        id: string,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName> | undefined>;
    schedule<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<void>;
    step<TValue>(ctx: Context, id: string, execute: () => Promise<TValue> | TValue): Promise<TValue>;
};

const durableInstances = new Map<string, DurableInstance>();
let durableCurrentInstanceId: string | null = null;

export function durableInstanceRegister(instanceId: string, durable: DurableInstance): void {
    durableInstances.set(instanceId, durable);
}

export function durableInstanceUnregister(instanceId: string): void {
    durableInstances.delete(instanceId);
    if (durableCurrentInstanceId === instanceId) {
        durableCurrentInstanceId = null;
    }
}

export function durableInstanceCurrentGet(): string | null {
    return durableCurrentInstanceId;
}

export function durableInstanceCurrentSet(instanceId: string | null): void {
    durableCurrentInstanceId = instanceId;
}

export function durableInstanceCall<TName extends DurableFunctionName>(
    instanceId: string,
    ctx: Context,
    id: string,
    name: TName,
    input: DurableFunctionInput<TName>
): Promise<DurableFunctionOutput<TName> | undefined> {
    return durableInstanceGet(instanceId).call(ctx, id, name, input);
}

export function durableInstanceSchedule<TName extends DurableFunctionName>(
    instanceId: string,
    ctx: Context,
    name: TName,
    input: DurableFunctionInput<TName>
): Promise<void> {
    return durableInstanceGet(instanceId).schedule(ctx, name, input);
}

export function durableInstanceStep<TValue>(
    instanceId: string,
    ctx: Context,
    id: string,
    execute: () => Promise<TValue> | TValue
): Promise<TValue> {
    return durableInstanceGet(instanceId).step(ctx, id, execute);
}

function durableInstanceGet(instanceId: string): DurableInstance {
    const durable = durableInstances.get(instanceId);
    if (!durable) {
        throw new Error(`Durable instance "${instanceId}" is not registered.`);
    }
    return durable;
}
