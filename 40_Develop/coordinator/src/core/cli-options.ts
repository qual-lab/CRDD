import { snapshotPlainArray } from "../security/plain-data-snapshot.ts";

const MAXIMUM_ARGUMENTS = 16;
const MAXIMUM_ARGUMENT_LENGTH = 4_096;

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

function validToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_ARGUMENT_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

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
  let historicalReleaseRoot: string | null = null;

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
        "--from-release",
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
      else if (token === "--close-docker-desktop-runtime-repair") {
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
      } else if (token === "--from-release") historicalReleaseRoot = value;
    }
  }

  if (
    (adoptDockerDesktopRepairId === null &&
      afterDockerDesktopRepairId === null) !==
      (historicalReleaseRoot === null) ||
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
      ...(afterDockerDesktopRepairId !== null
        ? { afterDockerDesktopRepairId, historicalReleaseRoot }
        : {}),
      ...(adoptDockerDesktopRepairId !== null
        ? { adoptDockerDesktopRepairId, historicalReleaseRoot }
        : {}),
    }),
    isJsonRequested,
  );
}
