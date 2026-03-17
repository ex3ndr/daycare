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

    it("parses scripted inference branches for scenario-driven mock routing", () => {
        const scenario = evalScenarioParse({
            name: "scripted-inference",
            agent: {
                kind: "agent",
                path: "test-agent"
            },
            turns: [{ role: "user", text: "Investigate this." }],
            inference: {
                type: "scripted",
                calls: [
                    {
                        branches: [
                            {
                                whenSystemPromptIncludes: ["start_background_agent"],
                                toolCall: {
                                    id: "tool-1",
                                    name: "start_background_agent",
                                    arguments: {
                                        prompt: "Investigate this."
                                    }
                                }
                            },
                            {
                                message: "fallback"
                            }
                        ]
                    }
                ]
            }
        });

        expect(scenario.inference).toEqual({
            type: "scripted",
            calls: [
                {
                    branches: [
                        {
                            whenSystemPromptIncludes: ["start_background_agent"],
                            toolCall: {
                                id: "tool-1",
                                name: "start_background_agent",
                                arguments: {
                                    prompt: "Investigate this."
                                }
                            }
                        },
                        {
                            message: "fallback"
                        }
                    ]
                }
            ]
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

    it("rejects scripted inference branches without a response", () => {
        expect(() =>
            evalScenarioParse({
                name: "bad-inference",
                agent: {
                    kind: "agent",
                    path: "worker"
                },
                turns: [{ role: "user", text: "hello" }],
                inference: {
                    type: "scripted",
                    calls: [
                        {
                            branches: [{}]
                        }
                    ]
                }
            })
        ).toThrow("Invalid eval scenario at inference.calls.0.branches.0");
    });
});
