/**
 * Windows単一entryの非追従メタデータを固定Nativeから読む。
 * @packageDocumentation
 * @responsibility OS属性の観測と対象選択・処置許可を分離する。
 * @trace ARCH-000008
 * @boundary 固定Native ProcessとFilesystemメタデータ。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginPlatformAccessArtifactObservation,
  PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactObservation,
} from "../artifact/identity.ts";

const distributionRoot = fileURLToPath(new URL("../../../..", import.meta.url));

/**
 * 単一entryの明示不存在またはNative固有単位の観測値。
 * @responsibility 観測不明を不存在や削除許可として表さない。
 * @trace ARCH-000008
 * @shape statusと、present時だけraw属性・tag・実体・linkCountを持つ。
 * @invariant Node実体単位への未実証の変換を行わない。
 * @boundary Platform Accessと呼出し側。
 * @security 内容・Path・handle・Authorityを保持しない。
 * @compatibility CRDDFE01の単位とfield相関を維持する。
 */
export type WindowsEntryObservation =
  | Readonly<{ status: "confirmed_absent" }>
  | Readonly<{
      status: "present";
      attributes: number;
      reparseTag: number;
      identity: Readonly<{
        volumeSerialNumber: number;
        fileIndex: string;
        creationTime: string;
      }>;
      linkCount: number;
    }>;

/**
 * 固定41byte応答を検査し、単位を保った凍結値へ変換する。
 * @responsibility 属性相関・完全frameと不存在のzero payloadを要求する。
 * @trace ARCH-000008
 * @input frame: 固定Nativeの応答候補。
 * @returns 観測値または不正を表すnull。
 * @precondition Process・Artifact・stderr・終了は呼出し側で確認する。
 * @postcondition 入力を変更せず、全層を凍結する。
 * @effect N/A: bufferの値読取りのみ。
 * @failure magic・長さ・状態・相関・実体不正はnull。
 * @invariant kindや削除可否を推定しない。
 * @boundary Native frameと非Authorityの観測値。
 * @security 不正応答を部分受理しない。
 * @concurrency N/A: 同期変換のみ。
 */
function decodeEntryObservation(
  frame: unknown,
): WindowsEntryObservation | null {
  if (
    !Buffer.isBuffer(frame) ||
    frame.length !== 41 ||
    !frame.subarray(0, 8).equals(Buffer.from("CRDDFE01", "ascii"))
  )
    return null;
  if (frame[8] === 65) {
    return frame.subarray(9).every((byte) => byte === 0)
      ? Object.freeze({ status: "confirmed_absent" })
      : null;
  }
  if (frame[8] !== 80) return null;
  const attributes = frame.readUInt32LE(9);
  const reparseTag = frame.readUInt32LE(13);
  const volumeSerialNumber = frame.readUInt32LE(17);
  const fileIndex = frame.readBigUInt64LE(21);
  const creationTime = frame.readBigUInt64LE(29);
  const linkCount = frame.readUInt32LE(37);
  if (
    attributes === 0 ||
    volumeSerialNumber === 0 ||
    fileIndex === 0n ||
    creationTime === 0n ||
    linkCount === 0 ||
    ((attributes & 0x400) === 0) !== (reparseTag === 0)
  )
    return null;
  return Object.freeze({
    status: "present",
    attributes,
    reparseTag,
    identity: Object.freeze({
      volumeSerialNumber,
      fileIndex: fileIndex.toString(),
      creationTime: creationTime.toString(),
    }),
    linkCount,
  });
}

/**
 * 単一のローカル絶対Pathを固定Nativeで読取り観測する。
 * @responsibility 一要求一Process・Artifact前後・完全応答を共同確認する。
 * @trace ARCH-000008
 * @input entryPath: 呼出し側Scope内で導出した絶対Path一件。
 * @returns 明示不存在・raw観測値、または観測不能のnull。
 * @precondition 対象選択、親実体、Owner、Scopeと処置許可は利用側が所有する。
 * @postcondition 不明を不存在へ補完せず、任意binaryや環境へfallbackしない。
 * @effect 固定Nativeの同期読取り一回。
 * @failure 不正Path・Artifact差・Process失敗・不正応答はnull。
 * @invariant この観測は削除許可、非使用、排他を保証しない。
 * @boundary Platform Accessの固定Nativeと利用側。
 * @security Pathや生出力をログへ複製せず、内容を読まない。
 * @concurrency 起動前後にArtifactを確認し、対象の継続不変は主張しない。
 */
export function observeWindowsFilesystemEntry(
  entryPath: string,
): WindowsEntryObservation | null {
  if (
    process.platform !== "win32" ||
    typeof entryPath !== "string" ||
    Buffer.byteLength(entryPath, "utf8") > 4096 ||
    !/^[A-Z]:\\/u.test(entryPath) ||
    path.win32.normalize(entryPath) !== entryPath ||
    entryPath.endsWith("\\") ||
    /[\u0000-\u001f\u007f<>"/|?*]/u.test(entryPath) ||
    entryPath.slice(2).includes(":")
  )
    return null;
  try {
    const snapshot = beginPlatformAccessArtifactObservation(distributionRoot);
    if (
      !snapshot ||
      snapshot.artifact.sha256 !== PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256
    )
      return null;
    const result = spawnSync(
      path.join(
        distributionRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      ),
      ["--filesystem-entry", entryPath],
      {
        env: {},
        cwd: distributionRoot,
        shell: false,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 42,
        encoding: "buffer",
      },
    );
    if (
      !verifyPlatformAccessArtifactObservation(snapshot.token) ||
      result.error ||
      result.status !== 0 ||
      result.signal !== null ||
      !Buffer.isBuffer(result.stderr) ||
      result.stderr.length !== 0
    )
      return null;
    return decodeEntryObservation(result.stdout);
  } catch {
    return null;
  }
}
