import { describe, expect, it } from "vitest";

import { agentMessageRunPythonSayAfterTrim } from "./agentMessageRunPythonSayAfterTrim.js";

describe("agentMessageRunPythonSayAfterTrim", () => {
    it("returns null when no run_python tags are present", () => {
        expect(agentMessageRunPythonSayAfterTrim("<say>hello</say>")).toBeNull();
    });

    it("removes say tags after the first run_python tag", () => {
        const text = "<say>before</say><run_python>echo()</run_python><say>after</say>";
        expect(agentMessageRunPythonSayAfterTrim(text)).toBe("<say>before</say><run_python>echo()</run_python>");
    });

    it("trims only after the first run_python tag and keeps content before it", () => {
        const text = [
            "<say>before</say>",
            "prefix",
            "<run_python>first()</run_python>",
            "<say>drop-this</say>",
            "<run_python>second()</run_python>",
            "<say>drop-this-too</say>"
        ].join("");
        expect(agentMessageRunPythonSayAfterTrim(text)).toBe(
            "<say>before</say>prefix<run_python>first()</run_python><run_python>second()</run_python>"
        );
    });

    it("matches run_python and say tags with different letter case", () => {
        const text = "<SaY>before</SaY><RuN_PyThOn>echo()</RuN_PyThOn><sAy>after</sAy>";
        expect(agentMessageRunPythonSayAfterTrim(text)).toBe("<SaY>before</SaY><RuN_PyThOn>echo()</RuN_PyThOn>");
    });

    it("returns null when there are no say tags after run_python", () => {
        const text = "<say>before</say><run_python>echo()</run_python>";
        expect(agentMessageRunPythonSayAfterTrim(text)).toBeNull();
    });
});
