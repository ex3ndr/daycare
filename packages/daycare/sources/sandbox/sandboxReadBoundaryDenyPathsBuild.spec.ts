import path from "node:path";
import { describe, expect, it } from "vitest";

import { sandboxReadBoundaryDenyPathsBuild } from "./sandboxReadBoundaryDenyPathsBuild.js";

describe("sandboxReadBoundaryDenyPathsBuild", () => {
    it("includes OS home and daycare config roots", () => {
        const result = sandboxReadBoundaryDenyPathsBuild({
            osHomeDir: "/Users/host",
            daycareConfigDir: "/Users/host/.daycare"
        });

        expect(result).toEqual([path.resolve("/Users/host"), path.resolve("/Users/host/.daycare")]);
    });

    it("dedupes overlapping paths", () => {
        const result = sandboxReadBoundaryDenyPathsBuild({
            osHomeDir: "/Users/host",
            daycareConfigDir: "/Users/host"
        });

        expect(result).toEqual([path.resolve("/Users/host")]);
    });
});
