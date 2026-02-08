# Engine Modules Registry

The engine modules now live under `sources/engine/modules/`. `ModuleRegistry` aggregates the registries and is exposed on the engine instance as `modules`.

```mermaid
flowchart TD
  Engine[Engine]
  Registry[ModuleRegistry]
  Connector[modules/connectors]
  Inference[modules/inference]
  Images[modules/images]
  Tools[modules/tools]
  ConnectorReg[ConnectorRegistry]
  InferenceReg[InferenceRegistry]
  ImagesReg[ImageGenerationRegistry]
  ToolsReg[ToolResolver]

  Engine --> Registry
  Registry --> ConnectorReg
  Registry --> InferenceReg
  Registry --> ImagesReg
  Registry --> ToolsReg
  ConnectorReg --> Connector
  InferenceReg --> Inference
  ImagesReg --> Images
  ToolsReg --> Tools
```
