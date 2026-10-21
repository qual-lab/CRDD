/**
 * cli-optionsに属する責務をまとめる。
 *
 * @responsibility responseを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import { snapshotPlainArray } from "../../../domain-model/src/index.ts";

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
 * command Responseを決定する。
 *
 * @responsibility command Responseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input status: S、reason: string | null、value: T | null、isJsonRequested、hasUsageError
 * @returns commandResponseの計算結果を返す。
 * @precondition 「status: S、reason: string | null、value: T | null、isJsonRequested、hasUsageError」がcommandResponseの入力契約を満たす。
 * @postcondition commandResponseの責務を完了した結果だけを返す。
 * @effect N/A: commandResponseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: commandResponseは独自の失敗分岐を所有しない。
 * @invariant commandResponseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: commandResponseはProcess内の同一Subsystemで完結する。
 * @security N/A: commandResponseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: commandResponseは共有非同期状態を持たない同期処理である。
 */
function commandResponse<const S extends string, T>(
  status: S,
  reason: string | null,
  value: T | null = null,
  isJsonRequested = false,
  hasUsageError = false,
) {
  return Object.freeze({
    status,
    reason,
    value,
    jsonRequested: isJsonRequested,
    usageError: hasUsageError,
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
 * Task Argumentsを構造化値へ解析する。
 *
 * @responsibility Task Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawArguments: unknown
 * @returns parseTaskArgumentsの計算結果を返す。
 * @precondition 「rawArguments: unknown」がparseTaskArgumentsの入力契約を満たす。
 * @postcondition parseTaskArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: parseTaskArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseTaskArgumentsは独自の失敗分岐を所有しない。
 * @invariant parseTaskArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseTaskArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseTaskArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseTaskArgumentsは共有非同期状態を持たない同期処理である。
 */
export function parseTaskArguments(rawArguments: unknown) {
  const snapshot = snapshotPlainArray<string>(rawArguments, MAXIMUM_ARGUMENTS);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.some((value) => !validToken(value))
  ) {
    return commandResponse(
      "blocked",
      "task_arguments_invalid",
      null,
      false,
      true,
    );
  }
  const isJsonRequested = snapshot.value.includes("--json");
  const expected = new Set(["--request-stdin", "--json"]);
  if (
    !snapshot.value.includes("--request-stdin") ||
    snapshot.value.some((value) => !expected.has(value)) ||
    new Set(snapshot.value).size !== snapshot.value.length
  ) {
    return commandResponse(
      "blocked",
      "task_arguments_invalid",
      null,
      isJsonRequested,
      true,
    );
  }
  return commandResponse(
    "ok",
    null,
    Object.freeze({ json: isJsonRequested, requestFromStdin: true as const }),
    isJsonRequested,
    false,
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
