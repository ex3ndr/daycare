import path from "node:path";

/**
 * Rewrites a host path under user home into its container /home/<userId> equivalent.
 * Expects: hostHomeDir is the host-side user home mount; absolute input paths are preferred.
 */
export function sandboxPathHostToContainer(
    hostHomeDir: string,
    _userId: string,
    targetPath: string,
    hostSkillsActiveDir?: string,
    hostExamplesDir?: string
): string {
    if (!path.isAbsolute(targetPath)) {
        return targetPath;
    }

    const resolvedHomeDir = path.resolve(hostHomeDir);
    const resolvedTargetPath = path.resolve(targetPath);

    if (hostSkillsActiveDir) {
        const resolvedSkillsDir = path.resolve(hostSkillsActiveDir);
        const skillsRelativePath = path.relative(resolvedSkillsDir, resolvedTargetPath);
        if (!(skillsRelativePath.startsWith("..") || skillsRelativePath === "")) {
            return path.posix.join("/shared/skills", skillsRelativePath.split(path.sep).join(path.posix.sep));
        }
        if (skillsRelativePath === "") {
            return "/shared/skills";
        }
    }

    if (hostExamplesDir) {
        const resolvedExamplesDir = path.resolve(hostExamplesDir);
        const examplesRelativePath = path.relative(resolvedExamplesDir, resolvedTargetPath);
        if (!(examplesRelativePath.startsWith("..") || examplesRelativePath === "")) {
            return path.posix.join("/shared/examples", examplesRelativePath.split(path.sep).join(path.posix.sep));
        }
        if (examplesRelativePath === "") {
            return "/shared/examples";
        }
    }

    const relativePath = path.relative(resolvedHomeDir, resolvedTargetPath);

    if (relativePath.startsWith("..") || relativePath === "") {
        if (relativePath === "") {
            return "/home";
        }
        return targetPath;
    }

    const containerHomeDir = "/home";
    const containerRelativePath = relativePath.split(path.sep).join(path.posix.sep);
    return path.posix.join(containerHomeDir, containerRelativePath);
}
