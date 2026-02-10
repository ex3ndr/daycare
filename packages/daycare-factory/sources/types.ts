export interface FactoryBuildCliOptions {
  environment: string;
  config: string;
  out: string;
  keepOut: boolean;
  containerName?: string;
  keepContainer: boolean;
  removeExisting: boolean;
}

export interface FactoryContainerBuildCliOptions {
  task: string;
  out: string;
  template: string;
}

export interface FactoryBuildPaths {
  taskDirectory: string;
  environmentDirectory: string;
  taskFilePath: string;
  templateDirectory: string;
  configPath: string;
  outDirectory: string;
}

export interface FactoryConfigResolved {
  image: string;
  buildCommand: string[];
  testCommand?: string[];
  testMaxAttempts: number;
  containerName?: string;
  command: string[];
  workingDirectory: string;
  taskMountPath: string;
  templateMountPath: string;
  outMountPath: string;
  env: Record<string, string>;
  removeExistingContainer: boolean;
  removeContainerOnExit: boolean;
}

export interface FactoryContainerRunInput {
  paths: FactoryBuildPaths;
  config: FactoryConfigResolved;
}
