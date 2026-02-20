import { describe, expect, it } from "vitest";

import { sandboxAllowedDomainsResolve } from "./sandboxAllowedDomainsResolve.js";

describe("sandboxAllowedDomainsResolve", () => {
    it("expands package manager presets and dedupes domains", () => {
        const result = sandboxAllowedDomainsResolve(
            ["example.com", "registry.npmjs.org", " example.com "],
            ["java", "node", "python"]
        );

        expect(result).toEqual([
            "example.com",
            "registry.npmjs.org",
            "repo.maven.apache.org",
            "repo1.maven.org",
            "plugins.gradle.org",
            "services.gradle.org",
            "registry.yarnpkg.com",
            "repo.yarnpkg.com",
            "bun.sh",
            "pypi.org",
            "files.pythonhosted.org",
            "pypi.python.org"
        ]);
    });

    it("throws on blank explicit allowedDomains entries", () => {
        expect(() => sandboxAllowedDomainsResolve(["  "], ["go"])).toThrow("allowedDomains entries cannot be blank.");
    });

    it("expands additional language ecosystems", () => {
        const result = sandboxAllowedDomainsResolve([], ["rust", "dotnet", "ruby", "php", "dart"]);

        expect(result).toEqual([
            "crates.io",
            "index.crates.io",
            "static.crates.io",
            "nuget.org",
            "api.nuget.org",
            "globalcdn.nuget.org",
            "rubygems.org",
            "packagist.org",
            "repo.packagist.org",
            "pub.dev",
            "storage.googleapis.com"
        ]);
    });
});
