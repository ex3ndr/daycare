import type { ToolResolver } from "../modules/toolResolver.js";
import { appDiscover } from "./appDiscover.js";
import { appToolBuild } from "./appToolBuild.js";
import { appToolNameFormat } from "./appToolNameFormat.js";
import type { AppDescriptor } from "./appTypes.js";

const APP_TOOLS_PLUGIN_ID = "core.apps";

type AppsOptions = {
    workspaceDir: string;
};

export class Apps {
    private readonly workspaceDir: string;
    private descriptors: AppDescriptor[] = [];
    private toolNames = new Set<string>();

    constructor(options: AppsOptions) {
        this.workspaceDir = options.workspaceDir;
    }

    async discover(): Promise<AppDescriptor[]> {
        this.descriptors = await appDiscover(this.workspaceDir);
        return this.list();
    }

    registerTools(toolResolver: ToolResolver): void {
        this.unregisterTools(toolResolver);
        for (const descriptor of this.descriptors) {
            const definition = appToolBuild(descriptor);
            toolResolver.register(APP_TOOLS_PLUGIN_ID, definition);
            this.toolNames.add(definition.tool.name);
        }
    }

    unregisterTools(toolResolver: ToolResolver): void {
        for (const toolName of this.toolNames) {
            toolResolver.unregister(toolName);
        }
        this.toolNames.clear();
    }

    list(): AppDescriptor[] {
        return [...this.descriptors].sort((left, right) => left.id.localeCompare(right.id));
    }

    get(id: string): AppDescriptor | null {
        for (const descriptor of this.descriptors) {
            if (descriptor.id === id) {
                return descriptor;
            }
        }
        return null;
    }

    toolNameFor(id: string): string {
        return appToolNameFormat(id);
    }
}
