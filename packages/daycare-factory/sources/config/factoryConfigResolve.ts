import { z } from "zod";
import { FACTORY_INTERNAL_COMMAND } from "../constants.js";
import type { FactoryConfigResolved } from "../types.js";

const factoryConfigSchema = z
    .object({
        image: z.string().min(1),
        buildCommand: z.array(z.string().min(1)).min(1),
        testCommand: z.array(z.string().min(1)).min(1).optional(),
        testMaxAttempts: z.number().int().min(1).max(100).optional(),
        containerName: z.string().min(1).optional(),
        command: z.array(z.string().min(1)).min(1).optional(),
        workingDirectory: z.string().min(1).optional(),
        taskMountPath: z.string().min(1).optional(),
        templateMountPath: z.string().min(1).optional(),
        outMountPath: z.string().min(1).optional(),
        env: z.record(z.string()).optional(),
        removeExistingContainer: z.boolean().optional(),
        removeContainerOnExit: z.boolean().optional()
    })
    .strict();

/**
 * Resolves raw config input into a fully defaulted factory config.
 * Expects: rawConfig is a plain object compatible with the schema.
 */
export function factoryConfigResolve(rawConfig: unknown): FactoryConfigResolved {
    const parsed = factoryConfigSchema.parse(rawConfig);
    const taskMountPath = parsed.taskMountPath ?? "/workspace/TASK.md";
    const templateMountPath = parsed.templateMountPath ?? "/workspace/template";
    const outMountPath = parsed.outMountPath ?? "/workspace/out";

    return {
        image: parsed.image,
        buildCommand: parsed.buildCommand,
        testCommand: parsed.testCommand,
        testMaxAttempts: parsed.testMaxAttempts ?? 5,
        containerName: parsed.containerName,
        command: parsed.command ?? [
            "daycare-factory",
            FACTORY_INTERNAL_COMMAND,
            "--task",
            taskMountPath,
            "--template",
            templateMountPath,
            "--out",
            outMountPath
        ],
        workingDirectory: parsed.workingDirectory ?? "/workspace",
        taskMountPath,
        templateMountPath,
        outMountPath,
        env: parsed.env ?? {},
        removeExistingContainer: parsed.removeExistingContainer ?? true,
        removeContainerOnExit: parsed.removeContainerOnExit ?? true
    };
}
