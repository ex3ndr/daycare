import { DEFAULT_SANDBOX_RESOURCE_LIMITS } from "../settings.js";

import type { SandboxResourceLimitsConfig } from "./sandboxTypes.js";

const CPU_NANO_CPUS = 1_000_000_000;
const MEMORY_UNIT_BYTES: Record<string, number> = {
    "": 1,
    b: 1,
    k: 1_000,
    kb: 1_000,
    m: 1_000_000,
    mb: 1_000_000,
    g: 1_000_000_000,
    gb: 1_000_000_000,
    t: 1_000_000_000_000,
    tb: 1_000_000_000_000,
    p: 1_000_000_000_000_000,
    pb: 1_000_000_000_000_000,
    ki: 1_024,
    kib: 1_024,
    mi: 1_048_576,
    mib: 1_048_576,
    gi: 1_073_741_824,
    gib: 1_073_741_824,
    ti: 1_099_511_627_776,
    tib: 1_099_511_627_776,
    pi: 1_125_899_906_842_624,
    pib: 1_125_899_906_842_624
};

/**
 * Resolves sandbox CPU and memory limits into normalized settings plus Docker-ready numeric values.
 * Expects: cpu is positive; memory uses bytes or K/M/G/T/P, Ki/Mi/Gi/Ti/Pi units.
 */
export function sandboxResourceLimitsResolve(input?: SandboxResourceLimitsConfig): {
    cpu: number;
    memory: string;
    nanoCpus: number;
    memoryBytes: number;
} {
    const cpu = input?.cpu ?? DEFAULT_SANDBOX_RESOURCE_LIMITS.cpu;
    if (!Number.isFinite(cpu) || cpu <= 0) {
        throw new Error("Sandbox CPU limit must be a positive number.");
    }

    const nanoCpus = Math.round(cpu * CPU_NANO_CPUS);
    if (!Number.isSafeInteger(nanoCpus) || nanoCpus <= 0) {
        throw new Error("Sandbox CPU limit is out of range.");
    }

    const rawMemory = input?.memory ?? DEFAULT_SANDBOX_RESOURCE_LIMITS.memory;
    const memory = rawMemory.trim();
    if (memory.length === 0) {
        throw new Error("Sandbox memory limit is required.");
    }

    const memoryMatch = memory.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/);
    if (!memoryMatch) {
        throw new Error(`Sandbox memory limit is invalid: ${memory}`);
    }

    const unit = (memoryMatch[2] ?? "").toLowerCase();
    const multiplier = MEMORY_UNIT_BYTES[unit];
    if (!multiplier) {
        throw new Error(`Sandbox memory unit is unsupported: ${memory}`);
    }

    const amount = Number(memoryMatch[1]);
    const memoryBytesValue = amount * multiplier;
    const memoryBytes = Math.round(memoryBytesValue);
    if (!Number.isFinite(memoryBytesValue) || memoryBytesValue <= 0 || !Number.isSafeInteger(memoryBytes)) {
        throw new Error(`Sandbox memory limit is out of range: ${memory}`);
    }
    if (Math.abs(memoryBytesValue - memoryBytes) > 1e-6) {
        throw new Error(`Sandbox memory limit must resolve to whole bytes: ${memory}`);
    }

    return {
        cpu,
        memory,
        nanoCpus,
        memoryBytes
    };
}
