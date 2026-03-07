import path from "node:path";

/**
 * Resolves all per-user home paths under the configured users directory.
 * Expects: usersDir is absolute and userId is a non-empty stable id.
 */
export class UserHome {
    readonly root: string;
    readonly skills: string;
    readonly skillsActive: string;
    readonly skillsPersonal: string;
    readonly home: string;
    readonly databases: string;
    readonly desktop: string;
    readonly downloads: string;
    readonly documents: string;
    readonly developer: string;
    readonly tmp: string;

    constructor(usersDir: string, userId: string) {
        this.root = path.resolve(usersDir, userId);
        this.skills = path.join(this.root, "skills");
        this.skillsActive = path.join(this.skills, "active");
        this.skillsPersonal = path.join(this.skills, "personal");
        this.home = path.join(this.root, "home");
        this.databases = path.join(this.root, "databases");
        this.desktop = path.join(this.home, "desktop");
        this.downloads = path.join(this.home, "downloads");
        this.documents = path.join(this.home, "documents");
        this.developer = path.join(this.home, "developer");
        this.tmp = path.join(this.home, "tmp");
    }
}
