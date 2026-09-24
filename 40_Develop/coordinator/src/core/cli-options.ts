/**
 * cli-optionsに属する責務をまとめる。
 *
 * @responsibility responseを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { parseDockerTaskRecoveryId } from "../security/docker-recovery-identity.ts";
import { snapshotPlainArray } from "../security/plain-data-snapshot.ts";

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
 * 候補 Argumentsを構造化値へ解析する。
 *
 * @responsibility 候補 Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawArguments: unknown
 * @returns parseCandidateArgumentsの計算結果を返す。
 * @precondition 「rawArguments: unknown」がparseCandidateArgumentsの入力契約を満たす。
 * @postcondition parseCandidateArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: parseCandidateArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseCandidateArgumentsは独自の失敗分岐を所有しない。
 * @invariant parseCandidateArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseCandidateArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseCandidateArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseCandidateArgumentsは共有非同期状態を持たない同期処理である。
 */
export function parseCandidateArguments(rawArguments: unknown) {
  const snapshot = snapshotPlainArray<string>(rawArguments, MAXIMUM_ARGUMENTS);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.some((value) => !validToken(value))
  ) {
    return commandResponse(
      "blocked",
      "candidate_arguments_invalid",
      null,
      false,
      true,
    );
  }
  const argumentValues = snapshot.value;
  const isJsonRequested = argumentValues.includes("--json");
  if (argumentValues[0] === "recover-store") {
    const recoveryId = argumentValues[2];
    if (
      (argumentValues.length !== 4 && argumentValues.length !== 5) ||
      argumentValues[1] !== "--recovery-id" ||
      typeof recoveryId !== "string" ||
      !/^candidate-store-recovery\.[0-9a-f]{64}$/u.test(recoveryId) ||
      argumentValues[3] !== "--confirm" ||
      (argumentValues.length === 5 && argumentValues[4] !== "--json")
    ) {
      return commandResponse(
        "blocked",
        "candidate_arguments_invalid",
        null,
        isJsonRequested,
        true,
      );
    }
    return commandResponse(
      "ok",
      null,
      Object.freeze({
        action: "recover-store" as const,
        recoveryId,
        json: isJsonRequested,
      }),
      isJsonRequested,
      false,
    );
  }
  const candidateId = argumentValues[2];
  const isPublishedCandidateId =
    typeof candidateId === "string" &&
    /^candidate\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(candidateId);
  const isRecoveryCandidateId =
    typeof candidateId === "string" &&
    /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(candidateId);
  if (
    argumentValues.length < 3 ||
    argumentValues.length > 4 ||
    (argumentValues[0] !== "export" && argumentValues[0] !== "discard") ||
    argumentValues[1] !== "--candidate-id" ||
    typeof candidateId !== "string" ||
    (argumentValues[0] === "export"
      ? !isPublishedCandidateId
      : !isPublishedCandidateId && !isRecoveryCandidateId) ||
    (argumentValues.length === 4 && argumentValues[3] !== "--json") ||
    (argumentValues[0] === "export" && !isJsonRequested)
  ) {
    return commandResponse(
      "blocked",
      "candidate_arguments_invalid",
      null,
      isJsonRequested,
      true,
    );
  }
  return commandResponse(
    "ok",
    null,
    Object.freeze({
      action: argumentValues[0] as "export" | "discard",
      candidateId,
      json: isJsonRequested,
    }),
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
  ) {
    return response("blocked", "doctor_arguments_invalid");
  }
  const argumentValues = snapshot.value;
  const isJsonRequested = argumentValues.includes("--json");
  const seen = new Set();
  let shouldOutputJson = false;
  let isActiveIsolation = false;
  let recoveryId: string | null = null;
  let shouldRepairDockerDesktopRuntime = false;
  let closeDockerDesktopRepairId: string | null = null;
  let adoptDockerDesktopRepairId: string | null = null;
  let afterDockerDesktopRepairId: string | null = null;
  let repairReleaseRoot: string | null = null;
  let restartDockerForRecoveryId: string | null = null;
  let restartOriginReleaseRoot: string | null = null;
  let isAfterRecordedDockerRestart = false;

  for (let index = 0; index < argumentValues.length; index += 1) {
    const token = argumentValues[index];
    if (
      token === undefined ||
      ![
        "--json",
        "--isolation",
        "--recover-isolation",
        "--repair-docker-desktop-runtime",
        "--close-docker-desktop-runtime-repair",
        "--adopt-docker-desktop-repair",
        "--after-docker-desktop-repair",
        "--repair-release-root",
        "--restart-docker-for-recovery",
        "--restart-origin-release-root",
        "--after-recorded-docker-restart",
      ].includes(token) ||
      seen.has(token)
    ) {
      return response(
        "blocked",
        "doctor_arguments_invalid",
        null,
        isJsonRequested,
      );
    }
    seen.add(token);
    if (token === "--json") shouldOutputJson = true;
    else if (token === "--isolation") isActiveIsolation = true;
    else if (token === "--repair-docker-desktop-runtime")
      shouldRepairDockerDesktopRuntime = true;
    else if (token === "--after-recorded-docker-restart")
      isAfterRecordedDockerRestart = true;
    else {
      const value = argumentValues[index + 1];
      if (!validToken(value) || value.startsWith("--")) {
        return response(
          "blocked",
          "doctor_arguments_invalid",
          null,
          isJsonRequested,
        );
      }
      index += 1;
      if (token === "--recover-isolation") recoveryId = value;
      else if (token === "--restart-docker-for-recovery") {
        if (!parseDockerTaskRecoveryId(value))
          return response(
            "blocked",
            "doctor_arguments_invalid",
            null,
            isJsonRequested,
          );
        restartDockerForRecoveryId = value;
      } else if (token === "--close-docker-desktop-runtime-repair") {
        if (!/^docker-desktop-repair\.[a-f0-9]{32}$/u.test(value)) {
          return response(
            "blocked",
            "doctor_arguments_invalid",
            null,
            isJsonRequested,
          );
        }
        closeDockerDesktopRepairId = value;
      } else if (token === "--adopt-docker-desktop-repair") {
        if (!/^docker-desktop-repair\.[a-f0-9]{32}$/u.test(value))
          return response(
            "blocked",
            "doctor_arguments_invalid",
            null,
            isJsonRequested,
          );
        adoptDockerDesktopRepairId = value;
      } else if (token === "--after-docker-desktop-repair") {
        if (!/^docker-desktop-repair\.[a-f0-9]{32}$/u.test(value))
          return response(
            "blocked",
            "doctor_arguments_invalid",
            null,
            isJsonRequested,
          );
        afterDockerDesktopRepairId = value;
      } else if (token === "--repair-release-root") repairReleaseRoot = value;
      else if (token === "--restart-origin-release-root")
        restartOriginReleaseRoot = value;
    }
  }

  if (
    (restartOriginReleaseRoot !== null &&
      restartDockerForRecoveryId === null) ||
    (restartDockerForRecoveryId !== null &&
      (isActiveIsolation ||
        recoveryId !== null ||
        shouldRepairDockerDesktopRuntime ||
        closeDockerDesktopRepairId !== null ||
        adoptDockerDesktopRepairId !== null ||
        afterDockerDesktopRepairId !== null ||
        repairReleaseRoot !== null ||
        isAfterRecordedDockerRestart)) ||
    (isAfterRecordedDockerRestart &&
      (!parseDockerTaskRecoveryId(recoveryId) ||
        afterDockerDesktopRepairId !== null ||
        repairReleaseRoot !== null))
  )
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  if (
    (adoptDockerDesktopRepairId === null &&
      afterDockerDesktopRepairId === null) !==
      (repairReleaseRoot === null) ||
    (adoptDockerDesktopRepairId !== null &&
      afterDockerDesktopRepairId !== null) ||
    (adoptDockerDesktopRepairId !== null &&
      (isActiveIsolation ||
        recoveryId !== null ||
        shouldRepairDockerDesktopRuntime ||
        closeDockerDesktopRepairId !== null))
  )
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  if (
    recoveryId !== null &&
    (isActiveIsolation ||
      shouldRepairDockerDesktopRuntime ||
      closeDockerDesktopRepairId !== null ||
      adoptDockerDesktopRepairId !== null)
  ) {
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  }
  if (
    afterDockerDesktopRepairId !== null &&
    (recoveryId === null ||
      typeof recoveryId !== "string" ||
      !recoveryId.startsWith("docker-task."))
  )
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  if (
    shouldRepairDockerDesktopRuntime &&
    (isActiveIsolation || closeDockerDesktopRepairId !== null)
  ) {
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  }
  if (closeDockerDesktopRepairId !== null && isActiveIsolation) {
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  }
  return response(
    "ok",
    null,
    Object.freeze({
      json: shouldOutputJson,
      activeIsolation: isActiveIsolation,
      recoveryId,
      repairDockerDesktopRuntime: shouldRepairDockerDesktopRuntime,
      closeDockerDesktopRepairId,
      ...(restartDockerForRecoveryId !== null
        ? { restartDockerForRecoveryId }
        : {}),
      ...(restartOriginReleaseRoot !== null
        ? { restartOriginReleaseRoot }
        : {}),
      ...(isAfterRecordedDockerRestart
        ? { afterRecordedDockerRestart: true }
        : {}),
      ...(afterDockerDesktopRepairId !== null
        ? { afterDockerDesktopRepairId, repairReleaseRoot }
        : {}),
      ...(adoptDockerDesktopRepairId !== null
        ? { adoptDockerDesktopRepairId, repairReleaseRoot }
        : {}),
    }),
    isJsonRequested,
  );
}
