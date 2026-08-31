import fs from "node:fs";
import path from "node:path";

export type StableFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

function identity(metadata: fs.BigIntStats, maximumBytes: number) {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size <= 0n ||
    metadata.size > BigInt(maximumBytes)
  )
    throw new Error("bounded_file_snapshot_invalid");
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    ctimeNs: metadata.ctimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

export function sameStableFileIdentity(
  left: StableFileIdentity,
  right: StableFileIdentity,
) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

export function readStableBoundedFileSnapshot(
  file: string,
  maximumBytes: number,
) {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes <= 0 ||
    !path.isAbsolute(file)
  )
    throw new Error("bounded_file_snapshot_invalid");
  const resolved = path.resolve(file);
  const before = identity(
    fs.lstatSync(resolved, { bigint: true }),
    maximumBytes,
  );
  if (fs.realpathSync.native(resolved) !== resolved)
    throw new Error("bounded_file_snapshot_invalid");
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY);
  try {
    const opened = identity(
      fs.fstatSync(descriptor, { bigint: true }),
      maximumBytes,
    );
    if (!sameStableFileIdentity(before, opened))
      throw new Error("bounded_file_snapshot_changed");
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes + 1));
    let byteLength = 0;
    while (true) {
      const remaining = maximumBytes + 1 - byteLength;
      if (remaining <= 0) throw new Error("bounded_file_snapshot_invalid");
      const count = fs.readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, remaining),
        null,
      );
      if (count === 0) break;
      byteLength += count;
      if (byteLength > maximumBytes)
        throw new Error("bounded_file_snapshot_invalid");
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const after = identity(
      fs.fstatSync(descriptor, { bigint: true }),
      maximumBytes,
    );
    const pathAfter = identity(
      fs.lstatSync(resolved, { bigint: true }),
      maximumBytes,
    );
    if (
      byteLength !== Number(opened.size) ||
      !sameStableFileIdentity(opened, after) ||
      !sameStableFileIdentity(opened, pathAfter) ||
      fs.realpathSync.native(resolved) !== resolved
    )
      throw new Error("bounded_file_snapshot_changed");
    return Object.freeze({
      path: resolved,
      identity: opened,
      bytes: Buffer.concat(chunks, byteLength),
    });
  } finally {
    fs.closeSync(descriptor);
  }
}
