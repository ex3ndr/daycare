import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAssetSourceFileIs } from "./buildAssetSourceFileIs.js";
import { buildCompiledFileIs } from "./buildCompiledFileIs.js";
import { buildSpecArtifactFileIs } from "./buildSpecArtifactFileIs.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "../..");
const sourcesRoot = path.resolve(packageRoot, "sources");
const distRoot = path.resolve(packageRoot, "dist");
const dashboardOutRoot = path.resolve(packageRoot, "../daycare-dashboard/out");
const dashboardSiteRoot = path.resolve(distRoot, "plugins/dashboard/site");

/**
 * Copies all non-TypeScript source assets into dist and removes generated spec artifacts.
 * Expects: tsc already emitted JavaScript into dist and dashboard export output exists.
 */
export async function buildAssetsSync(): Promise<void> {
    const assetFiles = new Map<string, string>();
    await assetFilesCollect(sourcesRoot, sourcesRoot, assetFiles);
    await distAssetFilesDelete(distRoot, assetFiles);
    await assetFilesCopy(assetFiles);
    await specArtifactsDelete(distRoot);
    await dashboardSiteCopy();
}

async function assetFilesCollect(root: string, current: string, assetFiles: Map<string, string>): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.resolve(current, entry.name);
        if (entry.isDirectory()) {
            await assetFilesCollect(root, sourcePath, assetFiles);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        if (!buildAssetSourceFileIs(sourcePath)) {
            continue;
        }
        assetFiles.set(path.relative(root, sourcePath), sourcePath);
    }
}

async function distAssetFilesDelete(root: string, assetFiles: Map<string, string>): Promise<void> {
    await distWalk(root, async (distPath) => {
        const relativePath = path.relative(root, distPath);
        if (compiledFileIs(relativePath)) {
            return;
        }
        if (assetFiles.has(relativePath)) {
            return;
        }
        await fs.rm(distPath, { force: true });
    });
    await emptyDirsDelete(root);
}

async function distWalk(root: string, visitor: (distPath: string) => Promise<void>): Promise<void> {
    let entries: Dirent[];
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const distPath = path.resolve(root, entry.name);
        if (entry.isDirectory()) {
            await distWalk(distPath, visitor);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        await visitor(distPath);
    }
}

function compiledFileIs(relativePath: string): boolean {
    return buildCompiledFileIs(relativePath);
}

async function assetFilesCopy(assetFiles: Map<string, string>): Promise<void> {
    for (const [relativePath, sourcePath] of assetFiles) {
        const targetPath = path.resolve(distRoot, relativePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
    }
}

async function specArtifactsDelete(root: string): Promise<void> {
    await distWalk(root, async (distPath) => {
        const relativePath = path.relative(root, distPath);
        if (!buildSpecArtifactFileIs(relativePath)) {
            return;
        }
        await fs.rm(distPath, { force: true });
    });
    await emptyDirsDelete(root);
}

async function emptyDirsDelete(root: string): Promise<boolean> {
    let entries: Dirent[];
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
        return false;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            return false;
        }
        const childPath = path.resolve(root, entry.name);
        const childEmpty = await emptyDirsDelete(childPath);
        if (!childEmpty) {
            return false;
        }
    }
    await fs.rmdir(root);
    return true;
}

async function dashboardSiteCopy(): Promise<void> {
    await fs.rm(dashboardSiteRoot, { recursive: true, force: true });
    await fs.mkdir(path.dirname(dashboardSiteRoot), { recursive: true });
    await fs.cp(dashboardOutRoot, dashboardSiteRoot, { recursive: true });
}

await buildAssetsSync();
