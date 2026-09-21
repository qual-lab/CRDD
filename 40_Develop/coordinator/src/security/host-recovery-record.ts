import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";

/**
 * formatHostRecoveryTokenの処理を実行する。
 *
 * @responsibility formatHostRecoveryTokenに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input rootName: string、nonce: string、recordHash: string
 * @returns formatHostRecoveryTokenの計算結果を返す。
 * @precondition 「rootName: string、nonce: string、recordHash: string」がformatHostRecoveryTokenの入力契約を満たす。
 * @postcondition formatHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: formatHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: formatHostRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant formatHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: formatHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security formatHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: formatHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function formatHostRecoveryToken(
  rootName: string,
  nonce: string,
  recordHash: string,
) {
  return `host.${rootName}.${nonce}.${recordHash}`;
}

/**
 * parseHostRecoveryTokenの処理を実行する。
 *
 * @responsibility parseHostRecoveryTokenに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns parseHostRecoveryTokenの計算結果を返す。
 * @precondition 「token: unknown」がparseHostRecoveryTokenの入力契約を満たす。
 * @postcondition parseHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: parseHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseHostRecoveryTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security parseHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function parseHostRecoveryToken(token: unknown) {
  if (typeof token !== "string") throw new Error("host_recovery_token_invalid");
  const match =
    /^host\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(
      token ?? "",
    );
  if (!match) throw new Error("host_recovery_token_invalid");
  const rootName = match[1];
  const nonce = match[2];
  const recordHash = match[3];
  if (!rootName || !nonce || !recordHash)
    throw new Error("host_recovery_token_invalid");
  return { rootName, nonce, recordHash };
}

/**
 * loadHostRecoveryRecordByTokenの処理を実行する。
 *
 * @responsibility loadHostRecoveryRecordByTokenに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns loadHostRecoveryRecordByTokenの計算結果を返す。
 * @precondition 「token: unknown」がloadHostRecoveryRecordByTokenの入力契約を満たす。
 * @postcondition loadHostRecoveryRecordByTokenの責務を完了した結果だけを返す。
 * @effect loadHostRecoveryRecordByTokenはFilesystemの読取りまたは書込みを実行する。
 * @failure loadHostRecoveryRecordByTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadHostRecoveryRecordByTokenは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security loadHostRecoveryRecordByTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadHostRecoveryRecordByTokenは共有非同期状態を持たない同期処理である。
 */
export function loadHostRecoveryRecordByToken(token: unknown) {
  const parsed = parseHostRecoveryToken(token);
  const parent = fs.realpathSync(os.tmpdir());
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  const realDirectory = fs.realpathSync(directory);
  const directoryMetadata = fs.lstatSync(realDirectory);
  if (
    realDirectory !== directory ||
    path.dirname(realDirectory) !== parent ||
    !directoryMetadata.isDirectory() ||
    directoryMetadata.isSymbolicLink()
  )
    throw new Error("host_recovery_directory_untrusted");
  const marker = path.join(
    realDirectory,
    `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`,
  );
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (
    createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash
  )
    throw new Error("host_recovery_record_mismatch");
  const record = JSON.parse(serialized);
  if (
    record.schema !== "crdd-coordinator-host-recovery/v1" ||
    record.rootName !== parsed.rootName
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  return {
    parsed,
    parent,
    directory: realDirectory,
    marker,
    record,
    serialized,
  };
}
