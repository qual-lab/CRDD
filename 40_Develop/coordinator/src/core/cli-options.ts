import path from "node:path";

import { snapshotPlainArray } from "../security/plain-data-snapshot.ts";

const MAXIMUM_ARGUMENTS = 16;
const MAXIMUM_ARGUMENT_LENGTH = 4_096;

type PathCommandOptions = Readonly<{
  command: "activate" | "disable";
  allowAuthorityRoot: boolean;
  runtimeEnvironmentRoot: unknown;
  authorityEnvironmentRoot: unknown;
}>;

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

function validAbsolutePath(value: unknown): value is string {
  return validToken(value) && path.isAbsolute(value);
}

function parsePathCommandArguments(
  rawArguments: unknown,
  options: PathCommandOptions,
) {
  const snapshot = snapshotPlainArray<string>(rawArguments, MAXIMUM_ARGUMENTS);
  if (snapshot.status !== "ok") {
    return commandResponse(
      "blocked",
      `${options.command}_arguments_invalid`,
      null,
      false,
      true,
    );
  }
  const argumentValues = snapshot.value;
  const isJsonRequested = argumentValues.includes("--json");
  if (argumentValues.some((value) => !validToken(value))) {
    return commandResponse(
      "blocked",
      `${options.command}_arguments_invalid`,
      null,
      isJsonRequested,
      true,
    );
  }
  const allowed = new Set([
    "--json",
    "--runtime-root",
    ...(options.allowAuthorityRoot ? ["--authority-root"] : []),
  ]);
  const seen = new Set();
  let shouldOutputJson = false;
  let runtimeCliOverride: string | null = null;
  let authorityCliOverride: string | null = null;

  for (let index = 0; index < argumentValues.length; index += 1) {
    const token = argumentValues[index];
    if (token === undefined || !allowed.has(token) || seen.has(token)) {
      return commandResponse(
        "blocked",
        `${options.command}_arguments_invalid`,
        null,
        isJsonRequested,
        true,
      );
    }
    seen.add(token);
    if (token === "--json") {
      shouldOutputJson = true;
      continue;
    }
    const value = argumentValues[index + 1];
    if (!validAbsolutePath(value) || value.startsWith("--")) {
      return commandResponse(
        "blocked",
        `${options.command}_arguments_invalid`,
        null,
        isJsonRequested,
        true,
      );
    }
    index += 1;
    if (token === "--runtime-root") runtimeCliOverride = value;
    else authorityCliOverride = value;
  }

  const runtimeEnvironmentOverride =
    runtimeCliOverride !== null || options.runtimeEnvironmentRoot === undefined
      ? null
      : options.runtimeEnvironmentRoot;
  if (
    runtimeEnvironmentOverride !== null &&
    !validAbsolutePath(runtimeEnvironmentOverride)
  ) {
    return commandResponse(
      "blocked",
      "runtime_root_environment_invalid",
      null,
      isJsonRequested,
      false,
    );
  }
  let authorityEnvironmentOverride: string | null = null;
  if (options.allowAuthorityRoot) {
    const authorityEnvironmentCandidate =
      authorityCliOverride !== null ||
      options.authorityEnvironmentRoot === undefined
        ? null
        : options.authorityEnvironmentRoot;
    if (authorityEnvironmentCandidate !== null) {
      if (!validAbsolutePath(authorityEnvironmentCandidate)) {
        return commandResponse(
          "blocked",
          "authority_root_environment_invalid",
          null,
          isJsonRequested,
          false,
        );
      }
      authorityEnvironmentOverride = authorityEnvironmentCandidate;
    }
    if (
      authorityCliOverride === null &&
      authorityEnvironmentOverride === null
    ) {
      return commandResponse(
        "blocked",
        "authority_root_explicit_path_required",
        null,
        isJsonRequested,
        false,
      );
    }
  }

  return commandResponse(
    "ok",
    null,
    Object.freeze({
      json: shouldOutputJson,
      runtimeRootRequest: Object.freeze({
        cliOverride: runtimeCliOverride,
        environmentOverride: runtimeEnvironmentOverride,
        activationIntent: "explicit_enable_request",
      }),
      authorityRootRequest: options.allowAuthorityRoot
        ? Object.freeze({
            cliOverride: authorityCliOverride,
            environmentOverride: authorityEnvironmentOverride,
            activationIntent: "explicit_activate_request",
          })
        : null,
    }),
    isJsonRequested,
    false,
  );
}

export function parseActivateArguments(
  rawArguments: unknown,
  runtimeEnvironmentRoot: unknown,
  authorityEnvironmentRoot: unknown,
) {
  return parsePathCommandArguments(rawArguments, {
    command: "activate",
    allowAuthorityRoot: true,
    runtimeEnvironmentRoot,
    authorityEnvironmentRoot,
  });
}

export function parseDisableArguments(
  rawArguments: unknown,
  runtimeEnvironmentRoot: unknown,
) {
  return parsePathCommandArguments(rawArguments, {
    command: "disable",
    allowAuthorityRoot: false,
    runtimeEnvironmentRoot,
    authorityEnvironmentRoot: undefined,
  });
}

export function parseProvisionArguments(rawArguments: unknown) {
  const snapshot = snapshotPlainArray<string>(rawArguments, MAXIMUM_ARGUMENTS);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.some((value) => !validToken(value))
  ) {
    return commandResponse(
      "blocked",
      "provision_arguments_invalid",
      null,
      false,
      true,
    );
  }
  const isJsonRequested = snapshot.value.includes("--json");
  if (
    snapshot.value.length > 1 ||
    (snapshot.value.length === 1 && snapshot.value[0] !== "--json")
  ) {
    return commandResponse(
      "blocked",
      "provision_arguments_invalid",
      null,
      isJsonRequested,
      true,
    );
  }
  return commandResponse(
    "ok",
    null,
    Object.freeze({ json: isJsonRequested }),
    isJsonRequested,
    false,
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
  environmentRoot: unknown,
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
  let historicalReleaseRoot: string | null = null;
  let shouldEnableRuntime = false;
  let cliOverride: string | null = null;

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
        "--from-release",
        "--enable-runtime",
        "--runtime-root",
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
    else if (token === "--enable-runtime") shouldEnableRuntime = true;
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
      } else if (token === "--from-release") historicalReleaseRoot = value;
      else cliOverride = value;
    }
  }

  if (
    (adoptDockerDesktopRepairId === null) !==
      (historicalReleaseRoot === null) ||
    (adoptDockerDesktopRepairId !== null &&
      (isActiveIsolation ||
        recoveryId !== null ||
        shouldRepairDockerDesktopRuntime ||
        closeDockerDesktopRepairId !== null ||
        shouldEnableRuntime ||
        cliOverride !== null))
  )
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  if (cliOverride !== null && !shouldEnableRuntime) {
    return response(
      "blocked",
      "runtime_root_requires_enable_request",
      null,
      isJsonRequested,
    );
  }
  if (
    recoveryId !== null &&
    (isActiveIsolation ||
      shouldRepairDockerDesktopRuntime ||
      closeDockerDesktopRepairId !== null ||
      shouldEnableRuntime ||
      cliOverride !== null)
  ) {
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  }
  if (
    shouldRepairDockerDesktopRuntime &&
    (isActiveIsolation ||
      closeDockerDesktopRepairId !== null ||
      shouldEnableRuntime ||
      cliOverride !== null)
  ) {
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  }
  if (
    closeDockerDesktopRepairId !== null &&
    (isActiveIsolation || shouldEnableRuntime || cliOverride !== null)
  ) {
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      isJsonRequested,
    );
  }
  const runtimeRootRequest = shouldEnableRuntime
    ? Object.freeze({
        cliOverride,
        environmentOverride:
          environmentRoot === undefined ? null : environmentRoot,
        activationIntent: "explicit_enable_request",
      })
    : null;
  return response(
    "ok",
    null,
    Object.freeze({
      json: shouldOutputJson,
      activeIsolation: isActiveIsolation,
      recoveryId,
      repairDockerDesktopRuntime: shouldRepairDockerDesktopRuntime,
      closeDockerDesktopRepairId,
      ...(adoptDockerDesktopRepairId !== null
        ? { adoptDockerDesktopRepairId, historicalReleaseRoot }
        : {}),
      runtimeRootRequest,
    }),
    isJsonRequested,
  );
}
