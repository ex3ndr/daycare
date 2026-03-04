import { describe, expect, it } from "vitest";
import type { ModelRoleRuleDbRecord } from "../storage/modelRoleRulesRepository.js";
import { modelRoleRuleResolve } from "./modelRoles.js";

function rule(overrides: Partial<ModelRoleRuleDbRecord> & { model: string }): ModelRoleRuleDbRecord {
    return {
        id: overrides.id ?? "r1",
        role: overrides.role ?? null,
        kind: overrides.kind ?? null,
        userId: overrides.userId ?? null,
        agentId: overrides.agentId ?? null,
        model: overrides.model,
        createdAt: overrides.createdAt ?? 1000,
        updatedAt: overrides.updatedAt ?? 1000
    };
}

const ctx = {
    role: "user" as const,
    kind: "connector" as const,
    userId: "u1",
    agentId: "a1"
};

describe("modelRoleRuleResolve", () => {
    it("returns undefined when no rules", () => {
        expect(modelRoleRuleResolve([], ctx)).toBeUndefined();
    });

    it("matches rule with no matchers (wildcard)", () => {
        const rules = [rule({ model: "anthropic/claude-sonnet" })];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("anthropic/claude-sonnet");
    });

    it("matches rule by role", () => {
        const rules = [rule({ role: "user", model: "anthropic/opus" })];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("anthropic/opus");
    });

    it("rejects rule when role does not match", () => {
        const rules = [rule({ role: "memory", model: "anthropic/haiku" })];
        expect(modelRoleRuleResolve(rules, ctx)).toBeUndefined();
    });

    it("matches rule by kind", () => {
        const rules = [rule({ kind: "connector", model: "openai/gpt-4" })];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("openai/gpt-4");
    });

    it("matches rule by userId", () => {
        const rules = [rule({ userId: "u1", model: "openai/gpt-4" })];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("openai/gpt-4");
    });

    it("matches rule by agentId", () => {
        const rules = [rule({ agentId: "a1", model: "openai/gpt-4" })];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("openai/gpt-4");
    });

    it("prefers more specific rule (higher matcher count)", () => {
        const rules = [
            rule({ id: "broad", role: "user", model: "anthropic/sonnet" }),
            rule({ id: "specific", role: "user", kind: "connector", model: "anthropic/opus" })
        ];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("anthropic/opus");
    });

    it("prefers most specific rule across all matchers", () => {
        const rules = [
            rule({ id: "r1", role: "user", model: "model-a" }),
            rule({ id: "r2", role: "user", kind: "connector", model: "model-b" }),
            rule({ id: "r3", role: "user", kind: "connector", userId: "u1", model: "model-c" })
        ];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("model-c");
    });

    it("breaks ties by most recently created", () => {
        const rules = [
            rule({ id: "old", role: "user", model: "model-old", createdAt: 100 }),
            rule({ id: "new", role: "user", model: "model-new", createdAt: 200 })
        ];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("model-new");
    });

    it("skips non-matching rules among multiple", () => {
        const rules = [
            rule({ id: "r1", role: "memory", model: "model-a" }),
            rule({ id: "r2", kind: "sub", model: "model-b" }),
            rule({ id: "r3", userId: "other", model: "model-c" }),
            rule({ id: "r4", role: "user", model: "model-d" })
        ];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("model-d");
    });

    it("wildcard rule loses to any specific rule", () => {
        const rules = [
            rule({ id: "wildcard", model: "model-default" }),
            rule({ id: "specific", kind: "connector", model: "model-connector" })
        ];
        expect(modelRoleRuleResolve(rules, ctx)).toBe("model-connector");
    });

    it("handles null role in context", () => {
        const nullRoleCtx = { ...ctx, role: null };
        const rules = [rule({ role: "user", model: "model-a" }), rule({ kind: "connector", model: "model-b" })];
        // role="user" rule should NOT match since context role is null
        expect(modelRoleRuleResolve(rules, nullRoleCtx)).toBe("model-b");
    });
});
