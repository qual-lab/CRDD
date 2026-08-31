import fs from "node:fs";
import path from "node:path";

type DirectoryIdentity = Readonly<{
  device: bigint;
  inode: bigint;
  realPath: string;
}>;

export type CoverageRunRoot = Readonly<{
  coverageRoot: string;
  coverageIdentity: DirectoryIdentity;
  targetRoot: string;
  targetIdentity: DirectoryIdentity;
}>;

function inspectRealDirectory(directoryPath: string): DirectoryIdentity {
  const before = fs.lstatSync(directoryPath, { bigint: true });
  if (before.isSymbolicLink() || !before.isDirectory() || before.ino === 0n) {
    throw new Error(
      `coverage boundary is not a real directory: ${directoryPath}`,
    );
  }
  const realPath = fs.realpathSync.native(directoryPath);
  const after = fs.lstatSync(directoryPath, { bigint: true });
  if (
    after.isSymbolicLink() ||
    !after.isDirectory() ||
    after.ino === 0n ||
    before.dev !== after.dev ||
    before.ino !== after.ino
  ) {
    throw new Error(
      `coverage boundary changed during inspection: ${directoryPath}`,
    );
  }
  return Object.freeze({
    device: after.dev,
    inode: after.ino,
    realPath,
  });
}

function assertSameDirectory(
  directoryPath: string,
  expectedIdentity: DirectoryIdentity,
): void {
  const actualIdentity = inspectRealDirectory(directoryPath);
  if (
    actualIdentity.device !== expectedIdentity.device ||
    actualIdentity.inode !== expectedIdentity.inode ||
    actualIdentity.realPath !== expectedIdentity.realPath
  ) {
    throw new Error(`coverage directory identity changed: ${directoryPath}`);
  }
}

export function createCoverageRunRoot(
  platformAccessCrateRoot: string,
): CoverageRunRoot {
  const crateIdentity = inspectRealDirectory(platformAccessCrateRoot);
  const targetRoot = path.join(platformAccessCrateRoot, "target");
  if (path.dirname(targetRoot) !== platformAccessCrateRoot) {
    throw new Error("coverage target is not a direct crate child");
  }
  try {
    fs.mkdirSync(targetRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  assertSameDirectory(platformAccessCrateRoot, crateIdentity);
  const targetIdentity = inspectRealDirectory(targetRoot);
  if (path.dirname(targetIdentity.realPath) !== crateIdentity.realPath) {
    throw new Error("coverage target resolved outside the crate root");
  }
  const coverageRoot = fs.mkdtempSync(path.join(targetRoot, "coverage-"));
  assertSameDirectory(targetRoot, targetIdentity);
  const coverageIdentity = inspectRealDirectory(coverageRoot);
  if (path.dirname(coverageIdentity.realPath) !== targetIdentity.realPath) {
    throw new Error("coverage run directory resolved outside the target root");
  }
  return Object.freeze({
    coverageRoot,
    coverageIdentity,
    targetRoot,
    targetIdentity,
  });
}

export function assertCoverageRunRoot(runRoot: CoverageRunRoot): void {
  assertSameDirectory(runRoot.targetRoot, runRoot.targetIdentity);
  assertSameDirectory(runRoot.coverageRoot, runRoot.coverageIdentity);
  if (
    path.dirname(runRoot.coverageIdentity.realPath) !==
    runRoot.targetIdentity.realPath
  ) {
    throw new Error(
      "coverage run directory is no longer a direct target child",
    );
  }
}
