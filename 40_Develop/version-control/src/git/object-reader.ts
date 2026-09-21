import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

/**
 * ContentPolicyが扱う値の構造を表す。
 *
 * @responsibility ContentPolicyに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape ContentPolicyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ContentPolicyで宣言した値と責務の対応を維持する。
 * @boundary N/A: ContentPolicyの宣言は外部境界を開かない。
 * @security N/A: ContentPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ContentPolicyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ContentPolicy = (relativePath: string, bytes: Uint8Array) => boolean;

export const GIT_OBJECT_READER_CONTRACT =
  "crdd-version-control/git-object-reader/v1";
export const GIT_OBJECT_READER_CONTRACT_REVISION = 4;

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

/**
 * GitObjectTypeが扱う値の構造を表す。
 *
 * @responsibility GitObjectTypeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape GitObjectTypeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant GitObjectTypeで宣言した値と責務の対応を維持する。
 * @boundary N/A: GitObjectTypeの宣言は外部境界を開かない。
 * @security N/A: GitObjectTypeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility GitObjectTypeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type GitObjectType = "commit" | "tree" | "blob" | "tag";
/**
 * GitObjectが扱う値の構造を表す。
 *
 * @responsibility GitObjectに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape GitObjectが表すProperty、識別子およびRelationを型として固定する。
 * @invariant GitObjectで宣言した値と責務の対応を維持する。
 * @boundary N/A: GitObjectの宣言は外部境界を開かない。
 * @security N/A: GitObjectはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility GitObjectの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type GitObject = Readonly<{ type: GitObjectType; bytes: Buffer }>;
/**
 * PackIndexが扱う値の構造を表す。
 *
 * @responsibility PackIndexに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape PackIndexが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PackIndexで宣言した値と責務の対応を維持する。
 * @boundary N/A: PackIndexの宣言は外部境界を開かない。
 * @security N/A: PackIndexはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PackIndexの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PackIndex = Readonly<{
  indexPath: string;
  packPath: string;
  packChecksum: Buffer;
  objectOffsets: ReadonlyMap<string, number>;
  offsetObjectIds: ReadonlyMap<number, string>;
  sortedOffsets: readonly number[];
}>;
/**
 * WorkspaceEntryが扱う値の構造を表す。
 *
 * @responsibility WorkspaceEntryに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape WorkspaceEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant WorkspaceEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: WorkspaceEntryの宣言は外部境界を開かない。
 * @security N/A: WorkspaceEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility WorkspaceEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type WorkspaceEntry = Readonly<{
  relativePath: string;
  mode: "100644" | "100755";
  bytes: Buffer;
}>;

/**
 * pathSelectedの処理を実行する。
 *
 * @responsibility pathSelectedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input relativePath: string、readPaths: readonly string[]
 * @returns pathSelectedの計算結果を返す。
 * @precondition 「relativePath: string、readPaths: readonly string[]」がpathSelectedの入力契約を満たす。
 * @postcondition pathSelectedの責務を完了した結果だけを返す。
 * @effect N/A: pathSelectedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathSelectedは独自の失敗分岐を所有しない。
 * @invariant pathSelectedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathSelectedはProcess内の同一Subsystemで完結する。
 * @security N/A: pathSelectedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathSelectedは共有非同期状態を持たない同期処理である。
 */
function pathSelected(relativePath: string, readPaths: readonly string[]) {
  return readPaths.some((readPath) =>
    readPath.endsWith("/")
      ? relativePath.startsWith(readPath)
      : relativePath === readPath,
  );
}

/**
 * treeSelectedの処理を実行する。
 *
 * @responsibility treeSelectedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input relativePath: string、readPaths: readonly string[]
 * @returns treeSelectedの計算結果を返す。
 * @precondition 「relativePath: string、readPaths: readonly string[]」がtreeSelectedの入力契約を満たす。
 * @postcondition treeSelectedの責務を完了した結果だけを返す。
 * @effect N/A: treeSelectedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: treeSelectedは独自の失敗分岐を所有しない。
 * @invariant treeSelectedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: treeSelectedはProcess内の同一Subsystemで完結する。
 * @security N/A: treeSelectedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: treeSelectedは共有非同期状態を持たない同期処理である。
 */
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

/**
 * stableFileの処理を実行する。
 *
 * @responsibility stableFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input target: string、maximumBytes: number
 * @returns stableFileの計算結果を返す。
 * @precondition 「target: string、maximumBytes: number」がstableFileの入力契約を満たす。
 * @postcondition stableFileの責務を完了した結果だけを返す。
 * @effect stableFileはFilesystemの読取りまたは書込みを実行する。
 * @failure stableFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: stableFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableFileは共有非同期状態を持たない同期処理である。
 */
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

/**
 * sha1の処理を実行する。
 *
 * @responsibility sha1に対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input bytes: Buffer
 * @returns sha1の計算結果を返す。
 * @precondition 「bytes: Buffer」がsha1の入力契約を満たす。
 * @postcondition sha1の責務を完了した結果だけを返す。
 * @effect N/A: sha1は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sha1は独自の失敗分岐を所有しない。
 * @invariant sha1は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sha1はProcess内の同一Subsystemで完結する。
 * @security N/A: sha1はAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sha1は共有非同期状態を持たない同期処理である。
 */
function sha1(bytes: Buffer) {
  return createHash("sha1").update(bytes).digest();
}

/**
 * verifyObjectIdentityの処理を実行する。
 *
 * @responsibility verifyObjectIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input objectId: string、type: GitObjectType、bytes: Buffer
 * @returns N/A: verifyObjectIdentityは戻り値を返さない。
 * @precondition 「objectId: string、type: GitObjectType、bytes: Buffer」がverifyObjectIdentityの入力契約を満たす。
 * @postcondition verifyObjectIdentityの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyObjectIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyObjectIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyObjectIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyObjectIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: verifyObjectIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyObjectIdentityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * parseLooseObjectの処理を実行する。
 *
 * @responsibility parseLooseObjectに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input objectId: string、compressed: Buffer
 * @returns GitObjectを返す。
 * @precondition 「objectId: string、compressed: Buffer」がparseLooseObjectの入力契約を満たす。
 * @postcondition parseLooseObjectの責務を完了した結果だけを返す。
 * @effect N/A: parseLooseObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseLooseObjectは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseLooseObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseLooseObjectはProcess内の同一Subsystemで完結する。
 * @security N/A: parseLooseObjectはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseLooseObjectは共有非同期状態を持たない同期処理である。
 */
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

/**
 * parsePackIndexの処理を実行する。
 *
 * @responsibility parsePackIndexに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input indexPath: string
 * @returns PackIndexを返す。
 * @precondition 「indexPath: string」がparsePackIndexの入力契約を満たす。
 * @postcondition parsePackIndexの責務を完了した結果だけを返す。
 * @effect N/A: parsePackIndexは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parsePackIndexは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parsePackIndexは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parsePackIndexはProcess内の同一Subsystemで完結する。
 * @security N/A: parsePackIndexはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parsePackIndexは共有非同期状態を持たない同期処理である。
 */
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

/**
 * readVariableIntegerの処理を実行する。
 *
 * @responsibility readVariableIntegerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input bytes: Buffer、startIndex: number
 * @returns readVariableIntegerの計算結果を返す。
 * @precondition 「bytes: Buffer、startIndex: number」がreadVariableIntegerの入力契約を満たす。
 * @postcondition readVariableIntegerの責務を完了した結果だけを返す。
 * @effect N/A: readVariableIntegerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readVariableIntegerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readVariableIntegerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readVariableIntegerはProcess内の同一Subsystemで完結する。
 * @security N/A: readVariableIntegerはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readVariableIntegerは共有非同期状態を持たない同期処理である。
 */
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

/**
 * applyDeltaの処理を実行する。
 *
 * @responsibility applyDeltaに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input base: Buffer、delta: Buffer
 * @returns applyDeltaの計算結果を返す。
 * @precondition 「base: Buffer、delta: Buffer」がapplyDeltaの入力契約を満たす。
 * @postcondition applyDeltaの責務を完了した結果だけを返す。
 * @effect N/A: applyDeltaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure applyDeltaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant applyDeltaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: applyDeltaはProcess内の同一Subsystemで完結する。
 * @security N/A: applyDeltaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: applyDeltaは共有非同期状態を持たない同期処理である。
 */
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

/**
 * decodePackOffsetの処理を実行する。
 *
 * @responsibility decodePackOffsetに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input bytes: Buffer、startIndex: number、objectOffset: number
 * @returns decodePackOffsetの計算結果を返す。
 * @precondition 「bytes: Buffer、startIndex: number、objectOffset: number」がdecodePackOffsetの入力契約を満たす。
 * @postcondition decodePackOffsetの責務を完了した結果だけを返す。
 * @effect N/A: decodePackOffsetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodePackOffsetは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodePackOffsetは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodePackOffsetはProcess内の同一Subsystemで完結する。
 * @security N/A: decodePackOffsetはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodePackOffsetは共有非同期状態を持たない同期処理である。
 */
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

/**
 * safePackIndexesの処理を実行する。
 *
 * @responsibility safePackIndexesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input commonDirectory: string
 * @returns safePackIndexesの計算結果を返す。
 * @precondition 「commonDirectory: string」がsafePackIndexesの入力契約を満たす。
 * @postcondition safePackIndexesの責務を完了した結果だけを返す。
 * @effect safePackIndexesはFilesystemの読取りまたは書込みを実行する。
 * @failure safePackIndexesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant safePackIndexesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: safePackIndexesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: safePackIndexesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createObjectReaderの処理を実行する。
 *
 * @responsibility createObjectReaderに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input commonDirectory: string
 * @returns createObjectReaderの計算結果を返す。
 * @precondition 「commonDirectory: string」がcreateObjectReaderの入力契約を満たす。
 * @postcondition createObjectReaderの責務を完了した結果だけを返す。
 * @effect N/A: createObjectReaderは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createObjectReaderは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createObjectReaderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createObjectReaderはProcess内の同一Subsystemで完結する。
 * @security N/A: createObjectReaderはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createObjectReaderは共有非同期状態を持たない同期処理である。
 */
function createObjectReader(commonDirectory: string) {
  const indexes = safePackIndexes(commonDirectory);
  const objectCache = new Map<string, GitObject>();
  const packCache = new Map<string, Buffer>();
  const resolvingObjectIds = new Set<string>();

  /**
   * packBytesの処理を実行する。
   *
   * @responsibility packBytesに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000002
   * @input index: PackIndex
   * @returns packBytesの計算結果を返す。
   * @precondition 「index: PackIndex」がpackBytesの入力契約を満たす。
   * @postcondition packBytesの責務を完了した結果だけを返す。
   * @effect N/A: packBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure packBytesは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant packBytesは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: packBytesはProcess内の同一Subsystemで完結する。
   * @security N/A: packBytesはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: packBytesは共有非同期状態を持たない同期処理である。
   */
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

  /**
   * resolvePackObjectの処理を実行する。
   *
   * @responsibility resolvePackObjectに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000002
   * @input index: PackIndex、objectId: string、objectOffset: number、depth: number
   * @returns GitObjectを返す。
   * @precondition 「index: PackIndex、objectId: string、objectOffset: number、depth: number」がresolvePackObjectの入力契約を満たす。
   * @postcondition resolvePackObjectの責務を完了した結果だけを返す。
   * @effect N/A: resolvePackObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure resolvePackObjectは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant resolvePackObjectは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: resolvePackObjectはProcess内の同一Subsystemで完結する。
   * @security N/A: resolvePackObjectはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: resolvePackObjectは共有非同期状態を持たない同期処理である。
   */
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

  /**
   * readObjectの処理を実行する。
   *
   * @responsibility readObjectに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000002
   * @input objectId: string、depth
   * @returns GitObjectを返す。
   * @precondition 「objectId: string、depth」がreadObjectの入力契約を満たす。
   * @postcondition readObjectの責務を完了した結果だけを返す。
   * @effect N/A: readObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure readObjectは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant readObjectは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: readObjectはProcess内の同一Subsystemで完結する。
   * @security N/A: readObjectはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: readObjectは共有非同期状態を持たない同期処理である。
   */
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

/**
 * validSegmentの処理を実行する。
 *
 * @responsibility validSegmentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input segment: string
 * @returns validSegmentの計算結果を返す。
 * @precondition 「segment: string」がvalidSegmentの入力契約を満たす。
 * @postcondition validSegmentの責務を完了した結果だけを返す。
 * @effect N/A: validSegmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validSegmentは独自の失敗分岐を所有しない。
 * @invariant validSegmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validSegmentはProcess内の同一Subsystemで完結する。
 * @security N/A: validSegmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validSegmentは共有非同期状態を持たない同期処理である。
 */
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

/**
 * decodeTreeNameの処理を実行する。
 *
 * @responsibility decodeTreeNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input bytes: Buffer
 * @returns decodeTreeNameの計算結果を返す。
 * @precondition 「bytes: Buffer」がdecodeTreeNameの入力契約を満たす。
 * @postcondition decodeTreeNameの責務を完了した結果だけを返す。
 * @effect N/A: decodeTreeNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodeTreeNameは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodeTreeNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeTreeNameはProcess内の同一Subsystemで完結する。
 * @security N/A: decodeTreeNameはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodeTreeNameは共有非同期状態を持たない同期処理である。
 */
function decodeTreeName(bytes: Buffer) {
  const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!validSegment(name)) throw new Error("git_tree_name_invalid");
  return name;
}

/**
 * commitTreeの処理を実行する。
 *
 * @responsibility commitTreeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input object: GitObject
 * @returns commitTreeの計算結果を返す。
 * @precondition 「object: GitObject」がcommitTreeの入力契約を満たす。
 * @postcondition commitTreeの責務を完了した結果だけを返す。
 * @effect N/A: commitTreeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure commitTreeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant commitTreeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: commitTreeはProcess内の同一Subsystemで完結する。
 * @security N/A: commitTreeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: commitTreeは共有非同期状態を持たない同期処理である。
 */
function commitTree(object: GitObject) {
  if (object.type !== "commit") throw new Error("git_revision_not_commit");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(object.bytes);
  if (text.includes("\r")) throw new Error("git_commit_invalid");
  const separatorIndex = text.indexOf("\n\n");
  if (separatorIndex < 0) throw new Error("git_commit_invalid");
  const headerLines = text.slice(0, separatorIndex).split("\n");
  const treeHeader = headerLines[0] ?? "";
  if (!/^tree [0-9a-f]{40}$/u.test(treeHeader)) {
    throw new Error("git_commit_invalid");
  }
  if (headerLines.slice(1).some((line) => line.startsWith("tree "))) {
    throw new Error("git_commit_invalid");
  }
  const treeId = treeHeader.slice(5);
  if (!OBJECT_ID.test(treeId)) throw new Error("git_commit_invalid");
  return treeId;
}

/**
 * parseTreeの処理を実行する。
 *
 * @responsibility parseTreeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input readObject: (objectId: string) => GitObject、treeId: string、parentPath: string、entries: WorkspaceEntry[]、depth: number、budget: { bytes: number; files: number }、readPaths: readonly string[] | null
 * @returns N/A: parseTreeは戻り値を返さない。
 * @precondition 「readObject: (objectId: string) => GitObject、treeId: string、parentPath: string、entries: WorkspaceEntry[]、depth: number、budget: { bytes: number; files: number }、readPaths: readonly string[] | null」がparseTreeの入力契約を満たす。
 * @postcondition parseTreeの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: parseTreeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseTreeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseTreeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseTreeはProcess内の同一Subsystemで完結する。
 * @security N/A: parseTreeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseTreeは共有非同期状態を持たない同期処理である。
 */
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
    } else if (
      !readPaths ||
      pathSelected(relativePath, readPaths) ||
      treeSelected(relativePath, readPaths)
    ) {
      throw new Error("git_tree_mode_not_supported");
    }
    nextIndex = nulIndex + 21;
  }
}

/**
 * workspaceRootの処理を実行する。
 *
 * @responsibility workspaceRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input target: string
 * @returns workspaceRootの計算結果を返す。
 * @precondition 「target: string」がworkspaceRootの入力契約を満たす。
 * @postcondition workspaceRootの責務を完了した結果だけを返す。
 * @effect workspaceRootはFilesystemの読取りまたは書込みを実行する。
 * @failure workspaceRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant workspaceRootは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: workspaceRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: workspaceRootは共有非同期状態を持たない同期処理である。
 */
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

/**
 * contentManifestの処理を実行する。
 *
 * @responsibility contentManifestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input entries: readonly WorkspaceEntry[]
 * @returns contentManifestの計算結果を返す。
 * @precondition 「entries: readonly WorkspaceEntry[]」がcontentManifestの入力契約を満たす。
 * @postcondition contentManifestの責務を完了した結果だけを返す。
 * @effect N/A: contentManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: contentManifestは独自の失敗分岐を所有しない。
 * @invariant contentManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: contentManifestはProcess内の同一Subsystemで完結する。
 * @security N/A: contentManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: contentManifestは共有非同期状態を持たない同期処理である。
 */
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

/**
 * inspectGitCommitTreeCandidateの処理を実行する。
 *
 * @responsibility inspectGitCommitTreeCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns inspectGitCommitTreeCandidateの計算結果を返す。
 * @precondition 「candidate: unknown」がinspectGitCommitTreeCandidateの入力契約を満たす。
 * @postcondition inspectGitCommitTreeCandidateの責務を完了した結果だけを返す。
 * @effect inspectGitCommitTreeCandidateはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectGitCommitTreeCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectGitCommitTreeCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectGitCommitTreeCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectGitCommitTreeCandidateは共有非同期状態を持たない同期処理である。
 */
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
    if (readObject(tree).type !== "tree") return null;
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

/**
 * materializeGitCommitTreeCandidateUsingPolicyの処理を実行する。
 *
 * @responsibility materializeGitCommitTreeCandidateUsingPolicyに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown、shouldRejectContent: ContentPolicy | null
 * @returns materializeGitCommitTreeCandidateUsingPolicyの計算結果を返す。
 * @precondition 「candidate: unknown、shouldRejectContent: ContentPolicy | null」がmaterializeGitCommitTreeCandidateUsingPolicyの入力契約を満たす。
 * @postcondition materializeGitCommitTreeCandidateUsingPolicyの責務を完了した結果だけを返す。
 * @effect materializeGitCommitTreeCandidateUsingPolicyはFilesystemの読取りまたは書込みを実行する。
 * @failure materializeGitCommitTreeCandidateUsingPolicyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant materializeGitCommitTreeCandidateUsingPolicyは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: materializeGitCommitTreeCandidateUsingPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: materializeGitCommitTreeCandidateUsingPolicyは共有非同期状態を持たない同期処理である。
 */
function materializeGitCommitTreeCandidateUsingPolicy(
  candidate: unknown,
  shouldRejectContent: ContentPolicy | null,
) {
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
    if (
      shouldRejectContent !== null &&
      entries.some((entry) =>
        shouldRejectContent(entry.relativePath, entry.bytes),
      )
    ) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "git_read_projection_recognized_secret_rejected" as const,
        repositoryPathReported: false,
        workspacePathReported: false,
      });
    }
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

/**
 * materializeGitCommitTreeCandidateの処理を実行する。
 *
 * @responsibility materializeGitCommitTreeCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown、shouldRejectContent: ContentPolicy
 * @returns materializeGitCommitTreeCandidateの計算結果を返す。
 * @precondition 「candidate: unknown、shouldRejectContent: ContentPolicy」がmaterializeGitCommitTreeCandidateの入力契約を満たす。
 * @postcondition materializeGitCommitTreeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: materializeGitCommitTreeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: materializeGitCommitTreeCandidateは独自の失敗分岐を所有しない。
 * @invariant materializeGitCommitTreeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: materializeGitCommitTreeCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: materializeGitCommitTreeCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: materializeGitCommitTreeCandidateは共有非同期状態を持たない同期処理である。
 */
export function materializeGitCommitTreeCandidate(
  candidate: unknown,
  shouldRejectContent: ContentPolicy,
) {
  return materializeGitCommitTreeCandidateUsingPolicy(
    candidate,
    shouldRejectContent,
  );
}

/**
 * materializeGitReleaseCandidateTreeの処理を実行する。
 *
 * @responsibility materializeGitReleaseCandidateTreeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns materializeGitReleaseCandidateTreeの計算結果を返す。
 * @precondition 「candidate: unknown」がmaterializeGitReleaseCandidateTreeの入力契約を満たす。
 * @postcondition materializeGitReleaseCandidateTreeの責務を完了した結果だけを返す。
 * @effect N/A: materializeGitReleaseCandidateTreeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: materializeGitReleaseCandidateTreeは独自の失敗分岐を所有しない。
 * @invariant materializeGitReleaseCandidateTreeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: materializeGitReleaseCandidateTreeはProcess内の同一Subsystemで完結する。
 * @security N/A: materializeGitReleaseCandidateTreeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: materializeGitReleaseCandidateTreeは共有非同期状態を持たない同期処理である。
 */
export function materializeGitReleaseCandidateTree(candidate: unknown) {
  return materializeGitCommitTreeCandidateUsingPolicy(candidate, null);
}

/**
 * readGitCommitFileCandidateの処理を実行する。
 *
 * @responsibility readGitCommitFileCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns readGitCommitFileCandidateの計算結果を返す。
 * @precondition 「candidate: unknown」がreadGitCommitFileCandidateの入力契約を満たす。
 * @postcondition readGitCommitFileCandidateの責務を完了した結果だけを返す。
 * @effect readGitCommitFileCandidateはFilesystemの読取りまたは書込みを実行する。
 * @failure readGitCommitFileCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readGitCommitFileCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readGitCommitFileCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readGitCommitFileCandidateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * describeGitObjectReaderContractの処理を実行する。
 *
 * @responsibility describeGitObjectReaderContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeGitObjectReaderContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeGitObjectReaderContractの入力契約を満たす。
 * @postcondition describeGitObjectReaderContractの責務を完了した結果だけを返す。
 * @effect N/A: describeGitObjectReaderContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeGitObjectReaderContractは独自の失敗分岐を所有しない。
 * @invariant describeGitObjectReaderContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeGitObjectReaderContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeGitObjectReaderContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeGitObjectReaderContractは共有非同期状態を持たない同期処理である。
 */
export function describeGitObjectReaderContract() {
  return Object.freeze({
    contract: GIT_OBJECT_READER_CONTRACT,
    contractRevision: GIT_OBJECT_READER_CONTRACT_REVISION,
    objectFormat: "sha1_only",
    objectStorage: Object.freeze(["loose", "pack_v2_index", "pack_v2_or_v3"]),
    externalGitCliUsed: false,
    supportedTreeModes: Object.freeze(["040000", "100644", "100755"]),
    rejectedTreeModes: Object.freeze(["120000", "160000", "unknown"]),
    unsupportedModeProjection:
      "unselected_skipped_selected_or_full_rejected" as const,
    windowsNameCollision: "fail_closed",
    maximumWorkspaceFiles: MAXIMUM_WORKSPACE_FILES,
    maximumWorkspaceBytes: MAXIMUM_WORKSPACE_BYTES,
    pathReported: false,
    readProjection: "explicit_file_or_directory_prefix_when_supplied",
    recognizedSecretMaterial:
      "high_confidence_path_or_content_rejected_before_workspace_write",
    completeSecretAbsenceVerified: false,
    fixedRevisionFileRead:
      "single_explicit_non_git_path_bounded_to_65536_bytes",
    authorityEstablished: false,
  });
}
