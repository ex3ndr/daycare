export const SANDBOX_PACKAGE_MANAGERS = [
    "dart",
    "dotnet",
    "go",
    "java",
    "node",
    "php",
    "python",
    "ruby",
    "rust"
] as const;

export type SandboxPackageManager = (typeof SANDBOX_PACKAGE_MANAGERS)[number];

export const SANDBOX_PACKAGE_MANAGER_DOMAINS: Record<SandboxPackageManager, string[]> = {
    dart: ["pub.dev", "storage.googleapis.com"],
    dotnet: ["nuget.org", "api.nuget.org", "globalcdn.nuget.org"],
    go: ["proxy.golang.org", "sum.golang.org", "index.golang.org", "golang.org"],
    java: ["repo.maven.apache.org", "repo1.maven.org", "plugins.gradle.org", "services.gradle.org"],
    // Node preset intentionally covers npm, pnpm, yarn, and bun workflows.
    node: ["registry.npmjs.org", "registry.yarnpkg.com", "repo.yarnpkg.com", "bun.sh"],
    php: ["packagist.org", "repo.packagist.org"],
    python: ["pypi.org", "files.pythonhosted.org", "pypi.python.org"],
    ruby: ["rubygems.org"],
    rust: ["crates.io", "index.crates.io", "static.crates.io"]
};
