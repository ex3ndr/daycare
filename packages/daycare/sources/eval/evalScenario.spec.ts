import { describe, expect, it } from "vitest";

import { evalScenarioParse } from "./evalScenario.js";

describe("evalScenarioParse", () => {
    it("parses a valid scenario", () => {
        const scenario = evalScenarioParse({
            name: "greeting-test",
            agent: {
                kind: "agent",
                path: "test-agent"
            },
            turns: [{ role: "user", text: "Hello, what can you do?" }]
        });

        expect(scenario).toEqual({
            name: "greeting-test",
            agent: {
                kind: "agent",
                path: "test-agent"
            },
            turns: [{ role: "user", text: "Hello, what can you do?" }]
        });
    });

    it("rejects scenarios with missing fields", () => {
        expect(() => evalScenarioParse({ turns: [] })).toThrow("Invalid eval scenario at name");
        expect(() =>
            evalScenarioParse({
                name: "missing-agent",
                turns: [{ role: "user", text: "hello" }]
            })
        ).toThrow("Invalid eval scenario at agent");
    });

    it("rejects unsupported or malformed agent kinds", () => {
        expect(() =>
            evalScenarioParse({
                name: "bad-kind",
                agent: {
                    kind: "memory",
                    path: "worker"
                },
                turns: [{ role: "user", text: "hello" }]
            })
        ).toThrow("Invalid eval scenario at agent.kind");
    });

    it("rejects empty turns and invalid path segments", () => {
        expect(() =>
            evalScenarioParse({
                name: "empty-turns",
                agent: {
                    kind: "agent",
                    path: "test-agent"
                },
                turns: []
            })
        ).toThrow("Invalid eval scenario at turns");

        expect(() =>
            evalScenarioParse({
                name: "bad-path",
                agent: {
                    kind: "agent",
                    path: "nested/path"
                },
                turns: [{ role: "user", text: "hello" }]
            })
        ).toThrow("Invalid eval scenario at agent.path");
    });
});
