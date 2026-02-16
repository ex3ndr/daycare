import type { ConnectorRegistryOptions } from "./connectorRegistry.js";
import { CommandRegistry } from "./commandRegistry.js";
import { ConnectorRegistry } from "./connectorRegistry.js";
import { ImageGenerationRegistry } from "./imageGenerationRegistry.js";
import { InferenceRegistry } from "./inferenceRegistry.js";
import { ToolResolver } from "./toolResolver.js";

export type ModuleRegistryOptions = Omit<ConnectorRegistryOptions, "commandRegistry">;

export class ModuleRegistry {
  readonly commands: CommandRegistry;
  readonly connectors: ConnectorRegistry;
  readonly inference: InferenceRegistry;
  readonly images: ImageGenerationRegistry;
  readonly tools: ToolResolver;

  constructor(options: ModuleRegistryOptions) {
    this.commands = new CommandRegistry();
    this.connectors = new ConnectorRegistry({
      ...options,
      commandRegistry: this.commands
    });
    this.inference = new InferenceRegistry();
    this.images = new ImageGenerationRegistry();
    this.tools = new ToolResolver();
  }
}
