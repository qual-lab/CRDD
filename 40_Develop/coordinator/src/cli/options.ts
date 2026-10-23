/**
 * cli-optionsに属する責務をまとめる。
 *
 * @responsibility responseを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */

import fs from "node:fs";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import { snapshotPlainArray } from "../../../domain-model/src/index.ts";
import { parseUnambiguousJsonDocument } from "../../../ai-adapter/src/index.ts";

const MAXIMUM_ARGUMENTS = 16;
const MAXIMUM_ARGUMENT_LENGTH = 4_096;

/**
 * responseを決定する。
 *
 * @responsibility responseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input status: S、reason: string | null、value: T | null、isJsonRequested
 * @returns responseの計算結果を返す。
 * @precondition 「status: S、reason: string | null、value: T | null、isJsonRequested」がresponseの入力契約を満たす。
 * @postcondition responseの責務を完了した結果だけを返す。
 * @effect N/A: responseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: responseは独自の失敗分岐を所有しない。
 * @invariant responseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: responseはProcess内の同一Subsystemで完結する。
 * @security N/A: responseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: responseは共有非同期状態を持たない同期処理である。
 */
function response<const S extends string, T>(
  status: S,
  reason: string | null,
  value: T | null = null,
  isJsonRequested = false,
) {
  return Object.freeze({
    status,
    reason,
    value,
    jsonRequested: isJsonRequested,
  });
}

/**
 * Tokenが有効か判定する。
 *
 * @responsibility Tokenの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTokenの入力契約を満たす。
 * @postcondition validTokenの責務を完了した結果だけを返す。
 * @effect N/A: validTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTokenは独自の失敗分岐を所有しない。
 * @invariant validTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTokenはProcess内の同一Subsystemで完結する。
 * @security N/A: validTokenはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTokenは共有非同期状態を持たない同期処理である。
 */
function validToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_ARGUMENT_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/**
 * Doctor Argumentsを構造化値へ解析する。
 *
 * @responsibility Doctor Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawArguments: unknown、_environmentRoot: unknown
 * @returns parseDoctorArgumentsの計算結果を返す。
 * @precondition 「rawArguments: unknown、_environmentRoot: unknown」がparseDoctorArgumentsの入力契約を満たす。
 * @postcondition parseDoctorArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: parseDoctorArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseDoctorArgumentsは独自の失敗分岐を所有しない。
 * @invariant parseDoctorArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDoctorArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseDoctorArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseDoctorArgumentsは共有非同期状態を持たない同期処理である。
 */
export function parseDoctorArguments(
  rawArguments: unknown,
  _environmentRoot: unknown,
) {
  const snapshot = snapshotPlainArray<string>(rawArguments, MAXIMUM_ARGUMENTS);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.some((value) => !validToken(value))
  )
    return response("blocked", "doctor_arguments_invalid");
  const argumentsSnapshot = snapshot.value;
  const json = argumentsSnapshot.includes("--json");
  const seen = new Set<string>();
  let activeIsolation = false;
  let repairDockerDesktopRuntime = false;
  let recoveryId: string | null = null;
  let restartDockerForRecoveryId: string | null = null;
  let retainDockerRuntimeRepairId: string | null = null;
  for (let index = 0; index < argumentsSnapshot.length; index++) {
    const token = argumentsSnapshot[index];
    if (
      !token ||
      ![
        "--json",
        "--isolation",
        "--recover-isolation",
        "--repair-docker-desktop-runtime",
        "--restart-docker-for-recovery",
        "--retain-docker-runtime-repair",
      ].includes(token) ||
      seen.has(token)
    )
      return response("blocked", "doctor_arguments_invalid", null, json);
    seen.add(token);
    if (token === "--json") continue;
    if (token === "--isolation") activeIsolation = true;
    else if (token === "--repair-docker-desktop-runtime")
      repairDockerDesktopRuntime = true;
    else {
      const value = argumentsSnapshot[++index];
      if (!validToken(value) || value.startsWith("--"))
        return response("blocked", "doctor_arguments_invalid", null, json);
      if (token === "--recover-isolation") recoveryId = value;
      else if (token === "--restart-docker-for-recovery") {
        if (!parseDockerTaskRecoveryId(value))
          return response("blocked", "doctor_arguments_invalid", null, json);
        restartDockerForRecoveryId = value;
      } else {
        if (!/^docker-runtime-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(value))
          return response("blocked", "doctor_arguments_invalid", null, json);
        retainDockerRuntimeRepairId = value;
      }
    }
  }
  if (
    [
      activeIsolation,
      repairDockerDesktopRuntime,
      recoveryId !== null,
      restartDockerForRecoveryId !== null,
      retainDockerRuntimeRepairId !== null,
    ].filter(Boolean).length > 1
  )
    return response("blocked", "doctor_arguments_incompatible", null, json);
  return response(
    "ok",
    null,
    Object.freeze({
      json,
      activeIsolation,
      recoveryId,
      repairDockerDesktopRuntime,
      ...(restartDockerForRecoveryId !== null
        ? { restartDockerForRecoveryId }
        : {}),
      ...(retainDockerRuntimeRepairId !== null
        ? { retainDockerRuntimeRepairId }
        : {}),
    }),
    json,
  );
}

/**
 * UsageErrorが担う状態と操作を提供する。
 *
 * @responsibility UsageErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000004
 * @construction UsageErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle UsageErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: UsageErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: UsageErrorの宣言自体は実行時失敗を所有しない。
 * @invariant UsageErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: UsageErrorの宣言は外部境界を開かない。
 * @security N/A: UsageErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: UsageErrorは共有非同期状態を持たない同期処理である。
 */
export class UsageError extends Error {
  readonly usage = true;
}

const MAXIMUM_TASK_REQUEST_BYTES = 128 * 1024;

/**
 * Bounded Task Request From Stdinを読み取る。
 *
 * @responsibility Bounded Task Request From Stdinの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns readBoundedTaskRequestFromStdinの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がreadBoundedTaskRequestFromStdinの入力契約を満たす。
 * @postcondition readBoundedTaskRequestFromStdinの責務を完了した結果だけを返す。
 * @effect readBoundedTaskRequestFromStdinはFilesystemの読取りまたは書込みを実行する。
 * @failure readBoundedTaskRequestFromStdinは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readBoundedTaskRequestFromStdinは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readBoundedTaskRequestFromStdinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readBoundedTaskRequestFromStdinは共有非同期状態を持たない同期処理である。
 */
export function readBoundedTaskRequestFromStdin() {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const buffer = Buffer.alloc(8 * 1024);
  for (;;) {
    const readBytes = fs.readSync(0, buffer, 0, buffer.length, null);
    if (readBytes === 0) break;
    totalBytes += readBytes;
    if (totalBytes > MAXIMUM_TASK_REQUEST_BYTES) {
      throw new UsageError("task_request_too_large");
    }
    chunks.push(Buffer.from(buffer.subarray(0, readBytes)));
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, totalBytes),
    );
  } catch {
    throw new UsageError("task_request_invalid_utf8");
  }
  const parsed = parseUnambiguousJsonDocument(source);
  if (!parsed) throw new UsageError("task_request_invalid_json");
  return parsed;
}
