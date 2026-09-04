import fs from "node:fs";
import path from "node:path";
import {
  publishRepairHistoryFileUsingOperations,
  type RepairHistoryPublicationFaultPoint,
  type RepairHistoryPublicationOperations,
} from "../../src/security/docker-desktop-repair-history-publication.ts";

const MAXIMUM_BYTES = 65_536;

function stableBytes(target: string) {
  let descriptor: number | null = null;
  try {
    const before = fs.lstatSync(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(MAXIMUM_BYTES)
    )
      return null;
    descriptor = fs.openSync(target, "r");
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs ||
      opened.size !== before.size
    )
      return null;
    const bytes = Buffer.alloc(Number(opened.size));
    if (fs.readSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length)
      return null;
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(target, { bigint: true });
    return after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.birthtimeNs === opened.birthtimeNs &&
      after.size === opened.size &&
      pathAfter.dev === opened.dev &&
      pathAfter.ino === opened.ino &&
      pathAfter.birthtimeNs === opened.birthtimeNs &&
      pathAfter.size === opened.size
      ? bytes
      : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function sameIdentity(left: string, right: string) {
  try {
    const a = fs.lstatSync(left, { bigint: true });
    const b = fs.lstatSync(right, { bigint: true });
    return (
      a.isFile() &&
      !a.isSymbolicLink() &&
      b.isFile() &&
      !b.isSymbolicLink() &&
      a.dev === b.dev &&
      a.ino === b.ino &&
      a.birthtimeNs === b.birthtimeNs
    );
  } catch {
    return false;
  }
}

export function createRepairHistoryPublicationTestingAdapter(
  directory: string,
  options: Readonly<{
    injectFault?: (point: RepairHistoryPublicationFaultPoint) => void;
    observeBeforeLink?: () => void;
    observeDirectoryCommit?: () => void;
  }> = {},
) {
  const root = path.resolve(directory);
  if (!path.isAbsolute(root)) throw new Error("testing_root_invalid");
  const operations: RepairHistoryPublicationOperations = Object.freeze({
    present: (target) => {
      try {
        fs.lstatSync(target);
        return true;
      } catch (error) {
        return error &&
          typeof error === "object" &&
          Reflect.get(error, "code") === "ENOENT"
          ? false
          : null;
      }
    },
    stableBytes,
    sameRegularFileIdentity: sameIdentity,
    openExclusive: (target) => fs.openSync(target, "wx", 0o600),
    write: (descriptor, bytes) => fs.writeFileSync(descriptor, bytes),
    sync: (descriptor) => fs.fsyncSync(descriptor),
    close: (descriptor) => fs.closeSync(descriptor),
    link: (source, target) => fs.linkSync(source, target),
    unlink: (target) => fs.unlinkSync(target),
    commitDirectory: (target) => {
      if (path.resolve(target) !== root)
        throw new Error("testing_root_changed");
      const metadata = fs.lstatSync(target);
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("testing_root_invalid");
      options.observeDirectoryCommit?.();
    },
    observeBeforeLink: options.observeBeforeLink ?? (() => {}),
    injectFault: options.injectFault ?? (() => {}),
  });
  return Object.freeze({
    publish: (targetName: string, preparationName: string, bytes: Buffer) => {
      if (
        path.basename(targetName) !== targetName ||
        path.basename(preparationName) !== preparationName
      )
        throw new Error("testing_name_invalid");
      return publishRepairHistoryFileUsingOperations(
        operations,
        root,
        path.join(root, targetName),
        path.join(root, preparationName),
        bytes,
        MAXIMUM_BYTES,
      );
    },
  });
}
