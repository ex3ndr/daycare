import { describe, expect, it } from "vitest";

import { agentMessageRunPythonTerminalTrim } from "./agentMessageRunPythonTerminalTrim.js";

describe("agentMessageRunPythonTerminalTrim", () => {
    it("returns null when no closing run_python tag exists", () => {
        expect(agentMessageRunPythonTerminalTrim("<run_python>echo()")).toBeNull();
    });

    it("trims everything after the first closing run_python tag", () => {
        const text = "<say>before</say><run_python>echo()</run_python><say>after</say><run_python>tail()</run_python>";
        expect(agentMessageRunPythonTerminalTrim(text)).toBe("<say>before</say><run_python>echo()</run_python>");
    });

    it("matches run_python closing tags with different letter case", () => {
        const text = "<run_python>echo()</RuN_PyThOn><say>after</say>";
        expect(agentMessageRunPythonTerminalTrim(text)).toBe("<run_python>echo()</RuN_PyThOn>");
    });

    it("returns null when the first closing run_python tag is already at the end", () => {
        const text = "<say>before</say><run_python>echo()</run_python>";
        expect(agentMessageRunPythonTerminalTrim(text)).toBeNull();
    });
});
