import fs from "node:fs";
import path from "node:path";

const DEPENDENCY_DIRECTORY_NAME = "node_modules";
const TEST_FILE_SUFFIX = ".test.ts";

export type TestDiscoveryMetadata = Readonly<{
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}>;

export type TestDiscoveryOperations = Readonly<{
  inspectPath(target: string): TestDiscoveryMetadata;
  listNames(target: string): readonly string[];
  resolvePath(target: string): string;
}>;

const testDiscoveryOperations: TestDiscoveryOperations = Object.freeze({
  inspectPath: (target: string) => fs.lstatSync(target),
  listNames: (target: string) => fs.readdirSync(target),
  resolvePath: (target: string) => fs.realpathSync.native(target),
});

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function resolveContainedPath(
  root: string,
  target: string,
  operations: TestDiscoveryOperations,
): { absolutePath: string; relativePath: string } {
  const absolutePath = operations.resolvePath(target);
  const relativePath = path.relative(root, absolutePath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Checker test path resolves outside its root: ${target}`);
  }
  return {
    absolutePath,
    relativePath: normalizeRelativePath(relativePath),
  };
}

export function discoverCheckerTestFiles(
  root: string,
  operations: TestDiscoveryOperations = testDiscoveryOperations,
): readonly string[] {
  const rootMetadata = operations.inspectPath(root);
  if (rootMetadata.isSymbolicLink())
    throw new Error(`Checker test root is symbolic: ${root}`);
  if (!rootMetadata.isDirectory())
    throw new Error(`Checker test root is not a directory: ${root}`);

  const canonicalRoot = operations.resolvePath(root);
  const discoveredFiles: Array<{
    absolutePath: string;
    relativePath: string;
  }> = [];
  const relativePathKeys = new Set<string>();

  function visitDirectory(directory: string): void {
    const names = [...operations.listNames(directory)].sort(compareOrdinal);
    for (const name of names) {
      if (
        name === "" ||
        name === "." ||
        name === ".." ||
        path.basename(name) !== name
      )
        throw new Error(`Invalid Checker test entry name: ${name}`);
      const target = path.join(directory, name);
      const metadata = operations.inspectPath(target);
      if (metadata.isSymbolicLink())
        throw new Error(`Checker test entry is symbolic: ${target}`);
      if (name === DEPENDENCY_DIRECTORY_NAME) {
        if (!metadata.isDirectory())
          throw new Error(
            `Checker dependency entry is not a directory: ${target}`,
          );
        continue;
      }
      if (metadata.isDirectory()) {
        const { absolutePath } = resolveContainedPath(
          canonicalRoot,
          target,
          operations,
        );
        visitDirectory(absolutePath);
        continue;
      }
      if (!metadata.isFile())
        throw new Error(`Unsupported Checker test entry: ${target}`);
      if (!name.endsWith(TEST_FILE_SUFFIX)) continue;

      const discoveredFile = resolveContainedPath(
        canonicalRoot,
        target,
        operations,
      );
      const relativePathKey = discoveredFile.relativePath.toLowerCase();
      if (relativePathKeys.has(relativePathKey))
        throw new Error(
          `Duplicate or case-colliding Checker test path: ${discoveredFile.relativePath}`,
        );
      relativePathKeys.add(relativePathKey);
      discoveredFiles.push(discoveredFile);
    }
  }

  visitDirectory(canonicalRoot);
  return discoveredFiles
    .sort((left, right) =>
      compareOrdinal(left.relativePath, right.relativePath),
    )
    .map((entry) => entry.absolutePath);
}

export function requireCheckerTestFiles(
  files: readonly string[],
): readonly string[] {
  if (files.length === 0) throw new Error("Checker test files were not found.");
  return files;
}

function normalizePopulationPath(file: string): string {
  return normalizeRelativePath(path.normalize(file)).toLowerCase();
}

export function assertExactCheckerTestPopulation(
  discoveredFiles: readonly string[],
  ownedFiles: readonly string[],
): void {
  const discoveredPaths = new Map(
    discoveredFiles.map((file) => [normalizePopulationPath(file), file]),
  );
  const ownedPaths = new Map(
    ownedFiles.map((file) => [normalizePopulationPath(file), file]),
  );
  if (discoveredPaths.size !== discoveredFiles.length)
    throw new Error(
      "Checker test discovery contains duplicate or case-colliding paths.",
    );
  if (ownedPaths.size !== ownedFiles.length)
    throw new Error(
      "Checker test project contains duplicate or case-colliding paths.",
    );

  const missingRunnerTests = [...ownedPaths]
    .filter(([key]) => !discoveredPaths.has(key))
    .map(([, file]) => file)
    .sort(compareOrdinal);
  const missingProjectTests = [...discoveredPaths]
    .filter(([key]) => !ownedPaths.has(key))
    .map(([, file]) => file)
    .sort(compareOrdinal);
  if (missingRunnerTests.length > 0 || missingProjectTests.length > 0) {
    throw new Error(
      [
        `Checker tests missing from runner: ${missingRunnerTests.join(", ") || "none"}`,
        `Checker tests missing from project: ${missingProjectTests.join(", ") || "none"}`,
      ].join("\n"),
    );
  }
}
