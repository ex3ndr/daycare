const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

// In this monorepo, force Metro to resolve packages from the workspace root
// so React is loaded exactly once across router/navigation dependencies.
const workspaceRoot = path.resolve(__dirname, "../..");
const appNodeModules = path.join(__dirname, "node_modules");
const workspaceNodeModules = path.join(workspaceRoot, "node_modules");

config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [appNodeModules, workspaceNodeModules];
config.resolver.extraNodeModules = {
    react: path.join(appNodeModules, "react"),
    "react-dom": path.join(appNodeModules, "react-dom"),
    "react-native": path.join(appNodeModules, "react-native"),
    "use-sync-external-store": path.join(appNodeModules, "use-sync-external-store")
};

module.exports = config;
