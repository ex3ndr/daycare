import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { factoryConfigResolve } from "./factoryConfigResolve.js";
import type { FactoryConfigResolved } from "../types.js";

/**
 * Reads and validates a daycare-factory.yaml config file.
 * Expects: configPath points to a YAML document with a valid factory config object.
 */
export async function factoryConfigRead(
  configPath: string
): Promise<FactoryConfigResolved> {
  let rawText: string;
  try {
    rawText = await readFile(configPath, "utf-8");
  } catch (error) {
    const details =
      error instanceof Error && error.message
        ? error.message
        : "could not read config";
    throw new Error(`Failed to read config at ${configPath}: ${details}`);
  }

  let parsed: unknown;
  try {
    parsed = parse(rawText);
  } catch (error) {
    const details =
      error instanceof Error && error.message ? error.message : "invalid yaml";
    throw new Error(`Failed to parse config at ${configPath}: ${details}`);
  }

  try {
    return factoryConfigResolve(parsed);
  } catch (error) {
    const details =
      error instanceof Error && error.message
        ? error.message
        : "unknown config error";
    throw new Error(`Invalid config at ${configPath}: ${details}`);
  }
}
