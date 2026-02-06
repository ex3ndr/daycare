import type { ConnectorRegistryOptions } from "./connectorRegistry.js";
import { ConnectorRegistry } from "./connectorRegistry.js";
import { ImageGenerationRegistry } from "./imageGenerationRegistry.js";
import { InferenceRegistry } from "./inferenceRegistry.js";
import { ToolResolver } from "./toolResolver.js";

export type ModuleRegistryOptions = ConnectorRegistryOptions;

export class ModuleRegistry {
  readonly connectors: ConnectorRegistry;
  readonly inference: InferenceRegistry;
  readonly images: ImageGenerationRegistry;
  readonly tools: ToolResolver;

  constructor(options: ModuleRegistryOptions) {
    this.connectors = new ConnectorRegistry(options);
    this.inference = new InferenceRegistry();
    this.images = new ImageGenerationRegistry();
    this.tools = new ToolResolver();
  }
}
