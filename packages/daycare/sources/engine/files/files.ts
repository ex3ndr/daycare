import path from "node:path";

import { FileFolder } from "./fileFolder.js";

/**
 * User-home file folders exposed to agents and tools.
 * Expects: homePath points to a concrete user home directory.
 */
export class Files {
    readonly downloads: FileFolder;
    readonly desktop: FileFolder;
    readonly tmp: FileFolder;

    constructor(homePath: string) {
        this.downloads = new FileFolder(path.join(homePath, "downloads"));
        this.desktop = new FileFolder(path.join(homePath, "desktop"));
        this.tmp = new FileFolder(path.join(homePath, "tmp"));
    }
}
