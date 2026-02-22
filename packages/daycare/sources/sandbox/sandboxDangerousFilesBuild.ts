type SandboxDangerousFiles = {
    files: string[];
    directories: string[];
};

const SANDBOX_RUNTIME_DANGEROUS_FILES = [
    ".gitconfig",
    ".gitmodules",
    ".bashrc",
    ".bash_profile",
    ".zshrc",
    ".zprofile",
    ".profile",
    ".ripgreprc",
    ".mcp.json"
];

const SANDBOX_RUNTIME_DANGEROUS_DIRECTORIES = [".vscode", ".idea", ".claude/commands", ".claude/agents", ".git/hooks"];

/**
 * Builds the dangerous filename and directory patterns used by sandbox-runtime.
 * Expects: consumers match these values against normalized target paths.
 */
export function sandboxDangerousFilesBuild(): SandboxDangerousFiles {
    return {
        files: [...SANDBOX_RUNTIME_DANGEROUS_FILES],
        directories: [...SANDBOX_RUNTIME_DANGEROUS_DIRECTORIES]
    };
}
