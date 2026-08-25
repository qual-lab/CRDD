import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

export const GIT_OBJECT_READER_CONTRACT = "crdd-coordinator/git-object-reader";
export const GIT_OBJECT_READER_CONTRACT_REVISION = 2;

const OBJECT_ID = /^[a-f0-9]{40}$/u;
const PACK_INDEX_MAGIC = 0xff744f63;
const MAXIMUM_PACK_BYTES = 512 * 1024 * 1024;
const MAXIMUM_INDEX_BYTES = 96 * 1024 * 1024;
const MAXIMUM_OBJECT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_WORKSPACE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_WORKSPACE_FILES = 20_000;
const MAXIMUM_TREE_DEPTH = 64;
const MAXIMUM_RELATIVE_PATH_BYTES = 1_024;
const RESERVED_WINDOWS_SEGMENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_WINDOWS_CHARACTER = /[<>:"|?*\\\x00-\x1f\x7f]/u;

type GitObjectType = "commit" | "tree" | "blob" | "tag";
type GitObject = Readonly<{ type: GitObjectType; bytes: Buffer }>;
type PackIndex = Readonly<{
  indexPath: string;
  packPath: string;
  packChecksum: Buffer;
  objectOffsets: ReadonlyMap<string, number>;
  offsetObjectIds: ReadonlyMap<number, string>;
  sortedOffsets: readonly number[];
}>;
type WorkspaceEntry = Readonly<{
  relativePath: string;
  mode: "100644" | "100755";
  bytes: Buffer;
}>;

function pathSelected(relativePath: string, readPaths: readonly string[]) {
  return readPaths.some((readPath) =>
    readPath.endsWith("/")
      ? relativePath.startsWith(readPath)
      : relativePath === readPath,
  );
}

function treeSelected(relativePath: string, readPaths: readonly string[]) {
  const prefix = `${relativePath}/`;
  return readPaths.some((readPath) => {
    const normalized = readPath.endsWith("/")
      ? readPath.slice(0, -1)
      : readPath;
    return (
      normalized === relativePath ||
      normalized.startsWith(prefix) ||
      relativePath.startsWith(`${normalized}/`)
    );
  });
}

function stableFile(target: string, maximumBytes: number) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("git_object_file_invalid");
    }
    const bytes = Buffer.alloc(Number(before.size));
    let readBytes = 0;
    while (readBytes < bytes.byteLength) {
      const readLength = fs.readSync(
        handle,
        bytes,
        readBytes,
        bytes.byteLength - readBytes,
        readBytes,
      );
      if (readLength <= 0) throw new Error("git_object_file_changed");
      readBytes += readLength;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      throw new Error("git_object_file_changed");
    }
    const current = fs.lstatSync(target, { bigint: true });
    if (
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("git_object_file_changed");
    }
    return bytes;
  } finally {
    fs.closeSync(handle);
  }
}

function sha1(bytes: Buffer) {
  return createHash("sha1").update(bytes).digest();
}

function verifyObjectIdentity(
  objectId: string,
  type: GitObjectType,
  bytes: Buffer,
) {
  const identity = createHash("sha1")
    .update(`${type} ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
  if (identity !== objectId) throw new Error("git_object_identity_mismatch");
}

function parseLooseObject(objectId: string, compressed: Buffer): GitObject {
  const inflated = inflateSync(compressed, {
    maxOutputLength: MAXIMUM_OBJECT_BYTES + 128,
  });
  const headerEnd = inflated.indexOf(0);
  if (headerEnd < 1) throw new Error("git_loose_object_invalid");
  const header = inflated.subarray(0, headerEnd).toString("ascii");
  const match = /^(commit|tree|blob|tag) ([0-9]+)$/u.exec(header);
  if (!match) throw new Error("git_loose_object_invalid");
  const type = match[1] as GitObjectType;
  const declaredSize = Number(match[2]);
  const bytes = Buffer.from(inflated.subarray(headerEnd + 1));
  if (
    !Number.isSafeInteger(declaredSize) ||
    declaredSize !== bytes.byteLength ||
    bytes.byteLength > MAXIMUM_OBJECT_BYTES
  ) {
    throw new Error("git_loose_object_invalid");
  }
  verifyObjectIdentity(objectId, type, bytes);
  return Object.freeze({ type, bytes });
}

function parsePackIndex(indexPath: string): PackIndex {
  const bytes = stableFile(indexPath, MAXIMUM_INDEX_BYTES);
  if (
    bytes.byteLength < 8 + 256 * 4 + 40 ||
    bytes.readUInt32BE(0) !== PACK_INDEX_MAGIC ||
    bytes.readUInt32BE(4) !== 2 ||
    !sha1(bytes.subarray(0, -20)).equals(bytes.subarray(-20))
  ) {
    throw new Error("git_pack_index_invalid");
  }
  const fanoutStart = 8;
  let priorCount = 0;
  for (let index = 0; index < 256; index += 1) {
    const count = bytes.readUInt32BE(fanoutStart + index * 4);
    if (count < priorCount) throw new Error("git_pack_index_invalid");
    priorCount = count;
  }
  const objectCount = priorCount;
  if (objectCount > 2_000_000)
    throw new Error("git_pack_index_budget_exceeded");
  const identifiersStart = fanoutStart + 256 * 4;
  const crcStart = identifiersStart + objectCount * 20;
  const offsetsStart = crcStart + objectCount * 4;
  const fixedEnd = offsetsStart + objectCount * 4;
  if (fixedEnd + 40 > bytes.byteLength)
    throw new Error("git_pack_index_invalid");
  const largeOffsetBytes = bytes.byteLength - fixedEnd - 40;
  if (largeOffsetBytes % 8 !== 0) throw new Error("git_pack_index_invalid");
  const largeOffsetCount = largeOffsetBytes / 8;
  const objectOffsets = new Map<string, number>();
  const offsetObjectIds = new Map<number, string>();
  let previousObjectId = "";
  for (let index = 0; index < objectCount; index += 1) {
    const objectId = bytes
      .subarray(
        identifiersStart + index * 20,
        identifiersStart + (index + 1) * 20,
      )
      .toString("hex");
    if (previousObjectId && objectId <= previousObjectId)
      throw new Error("git_pack_index_invalid");
    previousObjectId = objectId;
    const encodedOffset = bytes.readUInt32BE(offsetsStart + index * 4);
    let objectOffset: number;
    if ((encodedOffset & 0x80000000) === 0) {
      objectOffset = encodedOffset;
    } else {
      const largeIndex = encodedOffset & 0x7fffffff;
      if (largeIndex >= largeOffsetCount)
        throw new Error("git_pack_index_invalid");
      const largeOffset = bytes.readBigUInt64BE(fixedEnd + largeIndex * 8);
      if (largeOffset > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("git_pack_index_invalid");
      objectOffset = Number(largeOffset);
    }
    if (objectOffset < 12 || offsetObjectIds.has(objectOffset))
      throw new Error("git_pack_index_invalid");
    objectOffsets.set(objectId, objectOffset);
    offsetObjectIds.set(objectOffset, objectId);
  }
  const packChecksum = Buffer.from(bytes.subarray(-40, -20));
  const packPath = `${indexPath.slice(0, -4)}.pack`;
  return Object.freeze({
    indexPath,
    packPath,
    packChecksum,
    objectOffsets,
    offsetObjectIds,
    sortedOffsets: Object.freeze(
      [...offsetObjectIds.keys()].sort((left, right) => left - right),
    ),
  });
}

function readVariableInteger(bytes: Buffer, startIndex: number) {
  let value = 0;
  let shift = 0;
  let nextIndex = startIndex;
  while (nextIndex < bytes.byteLength && shift <= 56) {
    const current = bytes[nextIndex] as number;
    nextIndex += 1;
    value += (current & 0x7f) * 2 ** shift;
    if ((current & 0x80) === 0) {
      if (!Number.isSafeInteger(value))
        throw new Error("git_delta_integer_invalid");
      return Object.freeze({ value, nextIndex });
    }
    shift += 7;
  }
  throw new Error("git_delta_integer_invalid");
}

function applyDelta(base: Buffer, delta: Buffer) {
  const baseSize = readVariableInteger(delta, 0);
  if (baseSize.value !== base.byteLength)
    throw new Error("git_delta_base_size_mismatch");
  const resultSize = readVariableInteger(delta, baseSize.nextIndex);
  if (resultSize.value > MAXIMUM_OBJECT_BYTES)
    throw new Error("git_delta_budget_exceeded");
  const chunks: Buffer[] = [];
  let outputSize = 0;
  let nextIndex = resultSize.nextIndex;
  while (nextIndex < delta.byteLength) {
    const instruction = delta[nextIndex] as number;
    nextIndex += 1;
    if (instruction === 0) throw new Error("git_delta_instruction_invalid");
    if ((instruction & 0x80) === 0) {
      const length = instruction & 0x7f;
      if (nextIndex + length > delta.byteLength)
        throw new Error("git_delta_instruction_invalid");
      chunks.push(Buffer.from(delta.subarray(nextIndex, nextIndex + length)));
      nextIndex += length;
      outputSize += length;
      continue;
    }
    let copyOffset = 0;
    let copySize = 0;
    for (let byteIndex = 0; byteIndex < 4; byteIndex += 1) {
      if ((instruction & (1 << byteIndex)) !== 0) {
        if (nextIndex >= delta.byteLength)
          throw new Error("git_delta_instruction_invalid");
        copyOffset += (delta[nextIndex] as number) * 2 ** (byteIndex * 8);
        nextIndex += 1;
      }
    }
    for (let byteIndex = 0; byteIndex < 3; byteIndex += 1) {
      if ((instruction & (1 << (byteIndex + 4))) !== 0) {
        if (nextIndex >= delta.byteLength)
          throw new Error("git_delta_instruction_invalid");
        copySize += (delta[nextIndex] as number) * 2 ** (byteIndex * 8);
        nextIndex += 1;
      }
    }
    if (copySize === 0) copySize = 0x10000;
    if (copyOffset + copySize > base.byteLength)
      throw new Error("git_delta_copy_invalid");
    chunks.push(Buffer.from(base.subarray(copyOffset, copyOffset + copySize)));
    outputSize += copySize;
    if (outputSize > resultSize.value)
      throw new Error("git_delta_result_size_mismatch");
  }
  if (outputSize !== resultSize.value)
    throw new Error("git_delta_result_size_mismatch");
  return Buffer.concat(chunks, outputSize);
}

function decodePackOffset(
  bytes: Buffer,
  startIndex: number,
  objectOffset: number,
) {
  let nextIndex = startIndex;
  let current = bytes[nextIndex] as number;
  nextIndex += 1;
  let distance = current & 0x7f;
  while ((current & 0x80) !== 0) {
    if (nextIndex >= bytes.byteLength)
      throw new Error("git_pack_offset_invalid");
    current = bytes[nextIndex] as number;
    nextIndex += 1;
    distance = (distance + 1) * 128 + (current & 0x7f);
    if (!Number.isSafeInteger(distance))
      throw new Error("git_pack_offset_invalid");
  }
  const baseOffset = objectOffset - distance;
  if (baseOffset < 12) throw new Error("git_pack_offset_invalid");
  return Object.freeze({ baseOffset, nextIndex });
}

function safePackIndexes(commonDirectory: string) {
  const objectDirectory = path.join(commonDirectory, "objects");
  const alternates = path.join(objectDirectory, "info", "alternates");
  if (fs.existsSync(alternates))
    throw new Error("git_alternates_not_supported");
  const packDirectory = path.join(objectDirectory, "pack");
  let names: string[];
  try {
    names = fs.readdirSync(packDirectory);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return Object.freeze([] as PackIndex[]);
    }
    throw error;
  }
  const indexNames = names.filter((name) =>
    /^pack-[a-f0-9]{40}\.idx$/u.test(name),
  );
  if (indexNames.length > 128) throw new Error("git_pack_count_exceeded");
  return Object.freeze(
    indexNames
      .sort()
      .map((name) => parsePackIndex(path.join(packDirectory, name))),
  );
}

function createObjectReader(commonDirectory: string) {
  const indexes = safePackIndexes(commonDirectory);
  const objectCache = new Map<string, GitObject>();
  const packCache = new Map<string, Buffer>();
  const resolvingObjectIds = new Set<string>();

  function packBytes(index: PackIndex) {
    const cached = packCache.get(index.packPath);
    if (cached) return cached;
    const bytes = stableFile(index.packPath, MAXIMUM_PACK_BYTES);
    if (
      bytes.byteLength < 32 ||
      bytes.subarray(0, 4).toString("ascii") !== "PACK" ||
      ![2, 3].includes(bytes.readUInt32BE(4)) ||
      bytes.readUInt32BE(8) !== index.objectOffsets.size ||
      !sha1(bytes.subarray(0, -20)).equals(bytes.subarray(-20)) ||
      !index.packChecksum.equals(bytes.subarray(-20))
    ) {
      throw new Error("git_pack_invalid");
    }
    for (const offset of index.sortedOffsets) {
      if (offset >= bytes.byteLength - 20)
        throw new Error("git_pack_index_invalid");
    }
    packCache.set(index.packPath, bytes);
    return bytes;
  }

  function resolvePackObject(
    index: PackIndex,
    objectId: string,
    objectOffset: number,
    depth: number,
  ): GitObject {
    if (depth > MAXIMUM_TREE_DEPTH) throw new Error("git_delta_depth_exceeded");
    const bytes = packBytes(index);
    const sortedIndex = index.sortedOffsets.indexOf(objectOffset);
    if (sortedIndex < 0) throw new Error("git_pack_index_invalid");
    const nextOffset =
      index.sortedOffsets[sortedIndex + 1] ?? bytes.byteLength - 20;
    let nextIndex = objectOffset;
    let current = bytes[nextIndex] as number;
    nextIndex += 1;
    const typeCode = (current >> 4) & 7;
    let declaredSize = current & 0x0f;
    let shift = 4;
    while ((current & 0x80) !== 0) {
      if (nextIndex >= nextOffset || shift > 56)
        throw new Error("git_pack_object_header_invalid");
      current = bytes[nextIndex] as number;
      nextIndex += 1;
      declaredSize += (current & 0x7f) * 2 ** shift;
      shift += 7;
    }
    if (
      !Number.isSafeInteger(declaredSize) ||
      declaredSize > MAXIMUM_OBJECT_BYTES
    )
      throw new Error("git_pack_object_budget_exceeded");
    let baseOffset: number | null = null;
    let baseObjectId: string | null = null;
    if (typeCode === 6) {
      const decoded = decodePackOffset(bytes, nextIndex, objectOffset);
      baseOffset = decoded.baseOffset;
      nextIndex = decoded.nextIndex;
    } else if (typeCode === 7) {
      if (nextIndex + 20 > nextOffset)
        throw new Error("git_pack_object_header_invalid");
      baseObjectId = bytes.subarray(nextIndex, nextIndex + 20).toString("hex");
      nextIndex += 20;
    }
    const inflated = Buffer.from(
      inflateSync(bytes.subarray(nextIndex, nextOffset), {
        maxOutputLength: MAXIMUM_OBJECT_BYTES + 1,
      }),
    );
    if (inflated.byteLength !== declaredSize)
      throw new Error("git_pack_object_size_mismatch");
    let result: GitObject;
    if (typeCode >= 1 && typeCode <= 4) {
      const type = (["", "commit", "tree", "blob", "tag"] as const)[typeCode];
      if (!type) throw new Error("git_pack_object_type_invalid");
      result = Object.freeze({ type, bytes: inflated });
    } else {
      let base: GitObject;
      if (baseObjectId) {
        base = readObject(baseObjectId, depth + 1);
      } else if (baseOffset !== null) {
        const offsetObjectId = index.offsetObjectIds.get(baseOffset);
        if (!offsetObjectId) throw new Error("git_pack_delta_base_missing");
        base = resolvePackObject(index, offsetObjectId, baseOffset, depth + 1);
      } else {
        throw new Error("git_pack_object_type_invalid");
      }
      result = Object.freeze({
        type: base.type,
        bytes: applyDelta(base.bytes, inflated),
      });
    }
    verifyObjectIdentity(objectId, result.type, result.bytes);
    return result;
  }

  function readObject(objectId: string, depth = 0): GitObject {
    if (!OBJECT_ID.test(objectId)) throw new Error("git_object_id_invalid");
    const cached = objectCache.get(objectId);
    if (cached) return cached;
    if (resolvingObjectIds.has(objectId))
      throw new Error("git_object_cycle_detected");
    resolvingObjectIds.add(objectId);
    try {
      const loosePath = path.join(
        commonDirectory,
        "objects",
        objectId.slice(0, 2),
        objectId.slice(2),
      );
      let result: GitObject | null = null;
      try {
        result = parseLooseObject(
          objectId,
          stableFile(loosePath, MAXIMUM_OBJECT_BYTES),
        );
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          throw error;
        }
      }
      if (!result) {
        for (const index of indexes) {
          const objectOffset = index.objectOffsets.get(objectId);
          if (objectOffset === undefined) continue;
          result = resolvePackObject(index, objectId, objectOffset, depth);
          break;
        }
      }
      if (!result) throw new Error("git_object_not_found");
      objectCache.set(objectId, result);
      return result;
    } finally {
      resolvingObjectIds.delete(objectId);
    }
  }

  return readObject;
}

function validSegment(segment: string) {
  return !(
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.toLowerCase() === ".git" ||
    Buffer.byteLength(segment, "utf8") > 255 ||
    INVALID_WINDOWS_CHARACTER.test(segment) ||
    RESERVED_WINDOWS_SEGMENT.test(segment) ||
    segment.endsWith(".") ||
    segment.endsWith(" ")
  );
}

function decodeTreeName(bytes: Buffer) {
  const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!validSegment(name)) throw new Error("git_tree_name_invalid");
  return name;
}

function commitTree(object: GitObject) {
  if (object.type !== "commit") throw new Error("git_revision_not_commit");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(object.bytes);
  if (text.includes("\r")) throw new Error("git_commit_invalid");
  const matches = text.split("\n").filter((line) => line.startsWith("tree "));
  if (matches.length !== 1) throw new Error("git_commit_invalid");
  const treeId = matches[0]?.slice(5) ?? "";
  if (!OBJECT_ID.test(treeId)) throw new Error("git_commit_invalid");
  return treeId;
}

function parseTree(
  readObject: (objectId: string) => GitObject,
  treeId: string,
  parentPath: string,
  entries: WorkspaceEntry[],
  depth: number,
  budget: { bytes: number; files: number },
  readPaths: readonly string[] | null,
) {
  if (depth > MAXIMUM_TREE_DEPTH) throw new Error("git_tree_depth_exceeded");
  const tree = readObject(treeId);
  if (tree.type !== "tree") throw new Error("git_tree_object_invalid");
  let nextIndex = 0;
  const comparisonNames = new Set<string>();
  while (nextIndex < tree.bytes.byteLength) {
    const spaceIndex = tree.bytes.indexOf(0x20, nextIndex);
    const nulIndex = tree.bytes.indexOf(0, spaceIndex + 1);
    if (
      spaceIndex <= nextIndex ||
      nulIndex <= spaceIndex + 1 ||
      nulIndex + 21 > tree.bytes.byteLength
    ) {
      throw new Error("git_tree_object_invalid");
    }
    const mode = tree.bytes.subarray(nextIndex, spaceIndex).toString("ascii");
    const segment = decodeTreeName(
      tree.bytes.subarray(spaceIndex + 1, nulIndex),
    );
    const comparisonName = segment.toUpperCase();
    if (comparisonNames.has(comparisonName))
      throw new Error("git_tree_case_collision");
    comparisonNames.add(comparisonName);
    const objectId = tree.bytes
      .subarray(nulIndex + 1, nulIndex + 21)
      .toString("hex");
    const relativePath = parentPath ? `${parentPath}/${segment}` : segment;
    if (Buffer.byteLength(relativePath, "utf8") > MAXIMUM_RELATIVE_PATH_BYTES)
      throw new Error("git_tree_path_budget_exceeded");
    if (mode === "40000" || mode === "040000") {
      if (!readPaths || treeSelected(relativePath, readPaths)) {
        parseTree(
          readObject,
          objectId,
          relativePath,
          entries,
          depth + 1,
          budget,
          readPaths,
        );
      }
    } else if (mode === "100644" || mode === "100755") {
      if (readPaths && !pathSelected(relativePath, readPaths)) {
        nextIndex = nulIndex + 21;
        continue;
      }
      const blob = readObject(objectId);
      if (blob.type !== "blob") throw new Error("git_blob_object_invalid");
      budget.files += 1;
      budget.bytes += blob.bytes.byteLength;
      if (
        budget.files > MAXIMUM_WORKSPACE_FILES ||
        budget.bytes > MAXIMUM_WORKSPACE_BYTES
      ) {
        throw new Error("git_workspace_budget_exceeded");
      }
      entries.push(
        Object.freeze({
          relativePath,
          mode,
          bytes: Buffer.from(blob.bytes),
        }),
      );
    } else {
      throw new Error("git_tree_mode_not_supported");
    }
    nextIndex = nulIndex + 21;
  }
}

function workspaceRoot(target: string) {
  const resolved = fs.realpathSync.native(target);
  const metadata = fs.lstatSync(resolved);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.readdirSync(resolved).length !== 0
  ) {
    throw new Error("git_workspace_target_invalid");
  }
  return resolved;
}

function contentManifest(entries: readonly WorkspaceEntry[]) {
  const hash = createHash("sha256").update("crdd-workspace-content-v1\0");
  for (const entry of entries) {
    hash
      .update(entry.mode)
      .update("\0")
      .update(entry.relativePath)
      .update("\0")
      .update(entry.bytes.byteLength.toString())
      .update("\0")
      .update(createHash("sha256").update(entry.bytes).digest("hex"))
      .update("\0");
  }
  return hash.digest("hex");
}

export function inspectGitCommitTreeCandidate(candidate: unknown) {
  try {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      Reflect.ownKeys(candidate).length !== 2 ||
      !Reflect.ownKeys(candidate).every(
        (key) =>
          typeof key === "string" &&
          ["commonDirectory", "revision"].includes(key),
      )
    ) {
      return null;
    }
    const value = candidate as Record<string, unknown>;
    if (
      typeof value.commonDirectory !== "string" ||
      !path.isAbsolute(value.commonDirectory) ||
      typeof value.revision !== "string" ||
      !OBJECT_ID.test(value.revision)
    ) {
      return null;
    }
    const commonDirectory = fs.realpathSync.native(value.commonDirectory);
    const readObject = createObjectReader(commonDirectory);
    const tree = commitTree(readObject(value.revision));
    return Object.freeze({
      status: "candidate" as const,
      commit: value.revision,
      tree,
      externalGitCliUsed: false,
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

export function materializeGitCommitTreeCandidate(candidate: unknown) {
  try {
    const candidateKeys =
      candidate && typeof candidate === "object"
        ? Reflect.ownKeys(candidate)
        : [];
    if (
      !candidate ||
      typeof candidate !== "object" ||
      ![3, 4].includes(candidateKeys.length) ||
      candidateKeys.some(
        (key) =>
          typeof key !== "string" ||
          !["commonDirectory", "revision", "workspace", "readPaths"].includes(
            key,
          ),
      )
    ) {
      return null;
    }
    const value = candidate as Record<string, unknown>;
    if (
      typeof value.commonDirectory !== "string" ||
      typeof value.revision !== "string" ||
      typeof value.workspace !== "string" ||
      (value.readPaths !== undefined &&
        (!Array.isArray(value.readPaths) ||
          value.readPaths.length === 0 ||
          value.readPaths.some(
            (readPath) =>
              typeof readPath !== "string" ||
              readPath.length === 0 ||
              path.isAbsolute(readPath) ||
              readPath.includes("\\") ||
              readPath
                .split("/")
                .some((segment, index, segments) =>
                  index === segments.length - 1 && segment === ""
                    ? false
                    : !validSegment(segment),
                ),
          ))) ||
      !path.isAbsolute(value.commonDirectory) ||
      !path.isAbsolute(value.workspace) ||
      !OBJECT_ID.test(value.revision)
    ) {
      return null;
    }
    const commonDirectory = fs.realpathSync.native(value.commonDirectory);
    const workspace = workspaceRoot(value.workspace);
    const readObject = createObjectReader(commonDirectory);
    const treeId = commitTree(readObject(value.revision));
    const entries: WorkspaceEntry[] = [];
    const budget = { bytes: 0, files: 0 };
    const readPaths = Array.isArray(value.readPaths)
      ? Object.freeze([...(value.readPaths as string[])])
      : null;
    parseTree(readObject, treeId, "", entries, 0, budget, readPaths);
    entries.sort((left, right) =>
      Buffer.from(left.relativePath).compare(Buffer.from(right.relativePath)),
    );
    for (const entry of entries) {
      const destination = path.join(
        workspace,
        ...entry.relativePath.split("/"),
      );
      const destinationParent = path.dirname(destination);
      fs.mkdirSync(destinationParent, { recursive: true });
      const resolvedParent = fs.realpathSync.native(destinationParent);
      const relativeParent = path.relative(workspace, resolvedParent);
      if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) {
        throw new Error("git_workspace_parent_escape");
      }
      fs.writeFileSync(destination, entry.bytes, {
        flag: "wx",
        mode: entry.mode === "100755" ? 0o755 : 0o644,
      });
    }
    return Object.freeze({
      status: "materialized" as const,
      baseCommit: value.revision,
      baseTree: treeId,
      fileCount: budget.files,
      byteLength: budget.bytes,
      contentManifestHash: contentManifest(entries),
      repositoryPathReported: false,
      workspacePathReported: false,
    });
  } catch {
    return null;
  }
}

export function readGitCommitFileCandidate(candidate: unknown) {
  try {
    const value = candidate as Record<string, unknown>;
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      Reflect.ownKeys(candidate).length !== 3 ||
      !Reflect.ownKeys(candidate).every(
        (key) =>
          typeof key === "string" &&
          ["commonDirectory", "revision", "relativePath"].includes(key),
      ) ||
      typeof value.commonDirectory !== "string" ||
      typeof value.revision !== "string" ||
      typeof value.relativePath !== "string" ||
      !path.isAbsolute(value.commonDirectory) ||
      !OBJECT_ID.test(value.revision) ||
      value.relativePath.length === 0 ||
      value.relativePath.endsWith("/") ||
      value.relativePath.includes("\\") ||
      value.relativePath.split("/").some((segment) => !validSegment(segment))
    ) {
      return null;
    }
    const commonDirectory = fs.realpathSync.native(value.commonDirectory);
    const readObject = createObjectReader(commonDirectory);
    const treeId = commitTree(readObject(value.revision));
    const entries: WorkspaceEntry[] = [];
    const budget = { bytes: 0, files: 0 };
    parseTree(
      readObject,
      treeId,
      "",
      entries,
      0,
      budget,
      Object.freeze([value.relativePath]),
    );
    if (
      entries.length !== 1 ||
      entries[0]?.relativePath !== value.relativePath ||
      entries[0].bytes.byteLength > 65_536
    ) {
      return null;
    }
    return Object.freeze({
      status: "read" as const,
      revision: value.revision,
      relativePath: value.relativePath,
      mode: entries[0].mode,
      bytes: Buffer.from(entries[0].bytes),
      sha256: createHash("sha256").update(entries[0].bytes).digest("hex"),
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

export function describeGitObjectReaderContract() {
  return Object.freeze({
    contract: GIT_OBJECT_READER_CONTRACT,
    contractRevision: GIT_OBJECT_READER_CONTRACT_REVISION,
    objectFormat: "sha1_only",
    objectStorage: Object.freeze(["loose", "pack_v2_index", "pack_v2_or_v3"]),
    externalGitCliUsed: false,
    supportedTreeModes: Object.freeze(["040000", "100644", "100755"]),
    rejectedTreeModes: Object.freeze(["120000", "160000", "unknown"]),
    windowsNameCollision: "fail_closed",
    maximumWorkspaceFiles: MAXIMUM_WORKSPACE_FILES,
    maximumWorkspaceBytes: MAXIMUM_WORKSPACE_BYTES,
    pathReported: false,
    readProjection: "explicit_file_or_directory_prefix_when_supplied",
    fixedRevisionFileRead:
      "single_explicit_non_git_path_bounded_to_65536_bytes",
    authorityEstablished: false,
  });
}
