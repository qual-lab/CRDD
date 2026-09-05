import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  publishRepairHistoryFileUsingOperations,
  type RepairHistoryPublicationFaultPoint,
  type RepairHistoryPublicationOperations,
} from "../../../src/security/docker-desktop-repair-history-publication.ts";

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
    observePlatformConfirmation?: () => void;
    overridePlatformConfirmation?: () => boolean | undefined;
    overridePresent?: (target: string) => boolean | null | undefined;
  }> = {},
) {
  const temporaryRoot = fs.realpathSync.native(os.tmpdir());
  const requestedRoot = path.resolve(directory);
  const root = fs.realpathSync.native(requestedRoot);
  const comparablePath = (value: string) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  if (comparablePath(requestedRoot) !== comparablePath(root))
    throw new Error("testing_root_invalid");
  const relativeRoot = path.relative(temporaryRoot, root);
  if (
    relativeRoot.length === 0 ||
    relativeRoot.startsWith(`..${path.sep}`) ||
    relativeRoot === ".." ||
    path.isAbsolute(relativeRoot)
  )
    throw new Error("testing_root_invalid");
  let cursor = temporaryRoot;
  for (const segment of relativeRoot.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const metadata = fs.lstatSync(cursor);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("testing_root_invalid");
  }
  const operations: RepairHistoryPublicationOperations = Object.freeze({
    present: (target) => {
      const isOverridden = options.overridePresent?.(target);
      if (isOverridden !== undefined) return isOverridden;
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
    captureDirectoryIdentity: (target) => {
      if (path.resolve(target) !== root)
        throw new Error("testing_root_changed");
      const metadata = fs.lstatSync(target, { bigint: true });
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("testing_root_invalid");
      return Object.freeze({
        dev: metadata.dev,
        ino: metadata.ino,
        birthtimeNs: metadata.birthtimeNs,
      });
    },
    confirmPublicationSettlementForCurrentInvocation: (target, initial) => {
      if (path.resolve(target) !== root)
        throw new Error("testing_root_changed");
      options.observePlatformConfirmation?.();
      const isOverridden = options.overridePlatformConfirmation?.();
      if (isOverridden !== undefined) return isOverridden;
      const metadata = fs.lstatSync(target, { bigint: true });
      return (
        metadata.isDirectory() &&
        !metadata.isSymbolicLink() &&
        !!initial &&
        typeof initial === "object" &&
        Reflect.get(initial, "dev") === metadata.dev &&
        Reflect.get(initial, "ino") === metadata.ino &&
        Reflect.get(initial, "birthtimeNs") === metadata.birthtimeNs
      );
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
      for (const candidate of [
        path.join(root, targetName),
        path.join(root, preparationName),
      ]) {
        const relative = path.relative(root, candidate);
        if (
          relative.length === 0 ||
          relative.startsWith(`..${path.sep}`) ||
          relative === ".." ||
          path.isAbsolute(relative)
        )
          throw new Error("testing_target_invalid");
        try {
          if (fs.lstatSync(candidate).isSymbolicLink())
            throw new Error("testing_target_invalid");
        } catch (error) {
          if (
            !error ||
            typeof error !== "object" ||
            Reflect.get(error, "code") !== "ENOENT"
          )
            throw error;
        }
      }
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
