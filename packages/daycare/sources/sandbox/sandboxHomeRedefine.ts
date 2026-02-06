import { promises as fs } from "node:fs";
import path from "node:path";

type SandboxHomeRedefineInput = {
  env: NodeJS.ProcessEnv;
  home?: string;
};

type SandboxHomeRedefineResult = {
  env: NodeJS.ProcessEnv;
  homeDir?: string;
};

/**
 * Redefines home-related environment variables inside the workspace.
 * Expects: home is absolute and writable when provided.
 */
export async function sandboxHomeRedefine(
  input: SandboxHomeRedefineInput
): Promise<SandboxHomeRedefineResult> {
  if (!input.home) {
    return { env: input.env };
  }

  const homeDir = path.resolve(input.home, ".daycare-home");
  const xdgConfig = path.join(homeDir, ".config");
  const xdgCache = path.join(homeDir, ".cache");
  const xdgData = path.join(homeDir, ".local", "share");
  const xdgState = path.join(homeDir, ".local", "state");
  const tempDir = path.join(homeDir, ".tmp");

  const dirsToEnsure = [
    homeDir,
    xdgConfig,
    xdgCache,
    xdgData,
    xdgState,
    tempDir,
    path.join(homeDir, ".cargo"),
    path.join(homeDir, ".rustup"),
    path.join(homeDir, ".gem"),
    path.join(homeDir, ".bundle"),
    path.join(homeDir, ".pub-cache"),
    path.join(homeDir, ".nuget", "packages"),
    path.join(homeDir, ".composer"),
    path.join(homeDir, ".config", "pip")
  ];
  await Promise.all(dirsToEnsure.map((target) => fs.mkdir(target, { recursive: true })));

  return {
    env: {
      ...input.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      XDG_CONFIG_HOME: xdgConfig,
      XDG_CACHE_HOME: xdgCache,
      XDG_DATA_HOME: xdgData,
      XDG_STATE_HOME: xdgState,
      TMPDIR: tempDir,
      TMP: tempDir,
      TEMP: tempDir,
      CARGO_HOME: path.join(homeDir, ".cargo"),
      RUSTUP_HOME: path.join(homeDir, ".rustup"),
      DOTNET_CLI_HOME: homeDir,
      NUGET_PACKAGES: path.join(homeDir, ".nuget", "packages"),
      GEM_HOME: path.join(homeDir, ".gem"),
      BUNDLE_USER_HOME: path.join(homeDir, ".bundle"),
      PUB_CACHE: path.join(homeDir, ".pub-cache"),
      COMPOSER_HOME: path.join(homeDir, ".composer"),
      PIP_CONFIG_FILE: path.join(homeDir, ".config", "pip", "pip.conf"),
      NPM_CONFIG_USERCONFIG: path.join(homeDir, ".npmrc"),
      npm_config_userconfig: path.join(homeDir, ".npmrc")
    },
    homeDir
  };
}
