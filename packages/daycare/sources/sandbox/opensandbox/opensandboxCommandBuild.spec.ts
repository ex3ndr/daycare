import { describe, expect, it } from "vitest";

import { opensandboxCommandBuild } from "./opensandboxCommandBuild.js";

describe("opensandboxCommandBuild", () => {
    it("quotes env entries and preserves bash command execution", () => {
        const command = opensandboxCommandBuild({
            command: 'echo "$GREETING" && echo done',
            env: {
                GREETING: "hello world",
                "WEIRD-NAME": "it's fine"
            }
        });

        expect(command).toContain("env -i");
        expect(command).toContain("'GREETING=hello world'");
        expect(command).toContain("'WEIRD-NAME=it'\"'\"'s fine'");
        expect(command).toContain("bash -lc 'echo \"$GREETING\" && echo done'");
    });
});
