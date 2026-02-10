export interface FactoryBuildCliOptions {
  config: string;
  out: string;
  keepOut: boolean;
  containerName?: string;
  keepContainer: boolean;
  removeExisting: boolean;
}

export interface FactoryBuildPaths {
  taskDirectory: string;
  taskFilePath: string;
  configPath: string;
  outDirectory: string;
}

export interface FactoryConfigResolved {
  image: string;
  containerName?: string;
  command: string[];
  workingDirectory: string;
  taskMountPath: string;
  outMountPath: string;
  env: Record<string, string>;
  removeExistingContainer: boolean;
  removeContainerOnExit: boolean;
}

export interface FactoryContainerRunInput {
  paths: FactoryBuildPaths;
  config: FactoryConfigResolved;
}
