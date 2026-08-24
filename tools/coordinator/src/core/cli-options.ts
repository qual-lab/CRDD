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
  if (
    argumentValues.length < 3 ||
    argumentValues.length > 4 ||
    (argumentValues[0] !== "export" && argumentValues[0] !== "discard") ||
    argumentValues[1] !== "--candidate-id" ||
    typeof argumentValues[2] !== "string" ||
    !/^candidate\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(argumentValues[2]) ||
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
      candidateId: argumentValues[2],
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
      else cliOverride = value;
    }
  }

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
      runtimeRootRequest,
    }),
    isJsonRequested,
  );
}
