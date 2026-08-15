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

function response<T>(
  status: string,
  reason: string | null,
  value: T | null = null,
  jsonRequested = false,
) {
  return Object.freeze({ status, reason, value, jsonRequested });
}

function commandResponse<T>(
  status: string,
  reason: string | null,
  value: T | null = null,
  jsonRequested = false,
  usageError = false,
) {
  return Object.freeze({ status, reason, value, jsonRequested, usageError });
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
  const argumentsList = snapshot.value;
  const jsonRequested = argumentsList.includes("--json");
  if (argumentsList.some((value) => !validToken(value))) {
    return commandResponse(
      "blocked",
      `${options.command}_arguments_invalid`,
      null,
      jsonRequested,
      true,
    );
  }
  const allowed = new Set([
    "--json",
    "--runtime-root",
    ...(options.allowAuthorityRoot ? ["--authority-root"] : []),
  ]);
  const seen = new Set();
  let json = false;
  let runtimeCliOverride: string | null = null;
  let authorityCliOverride: string | null = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const token = argumentsList[index];
    if (token === undefined || !allowed.has(token) || seen.has(token)) {
      return commandResponse(
        "blocked",
        `${options.command}_arguments_invalid`,
        null,
        jsonRequested,
        true,
      );
    }
    seen.add(token);
    if (token === "--json") {
      json = true;
      continue;
    }
    const value = argumentsList[index + 1];
    if (!validAbsolutePath(value) || value.startsWith("--")) {
      return commandResponse(
        "blocked",
        `${options.command}_arguments_invalid`,
        null,
        jsonRequested,
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
      jsonRequested,
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
          jsonRequested,
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
        jsonRequested,
        false,
      );
    }
  }

  return commandResponse(
    "ok",
    null,
    Object.freeze({
      json,
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
    jsonRequested,
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
  const jsonRequested = snapshot.value.includes("--json");
  if (
    snapshot.value.length > 1 ||
    (snapshot.value.length === 1 && snapshot.value[0] !== "--json")
  ) {
    return commandResponse(
      "blocked",
      "provision_arguments_invalid",
      null,
      jsonRequested,
      true,
    );
  }
  return commandResponse(
    "ok",
    null,
    Object.freeze({ json: jsonRequested }),
    jsonRequested,
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
  const argumentsList = snapshot.value;
  const jsonRequested = argumentsList.includes("--json");
  const seen = new Set();
  let json = false;
  let activeIsolation = false;
  let recoveryId: string | null = null;
  let enableRuntime = false;
  let cliOverride: string | null = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const token = argumentsList[index];
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
        jsonRequested,
      );
    }
    seen.add(token);
    if (token === "--json") json = true;
    else if (token === "--isolation") activeIsolation = true;
    else if (token === "--enable-runtime") enableRuntime = true;
    else {
      const value = argumentsList[index + 1];
      if (!validToken(value) || value.startsWith("--")) {
        return response(
          "blocked",
          "doctor_arguments_invalid",
          null,
          jsonRequested,
        );
      }
      index += 1;
      if (token === "--recover-isolation") recoveryId = value;
      else cliOverride = value;
    }
  }

  if (cliOverride !== null && !enableRuntime) {
    return response(
      "blocked",
      "runtime_root_requires_enable_request",
      null,
      jsonRequested,
    );
  }
  if (
    recoveryId !== null &&
    (activeIsolation || enableRuntime || cliOverride !== null)
  ) {
    return response(
      "blocked",
      "doctor_arguments_incompatible",
      null,
      jsonRequested,
    );
  }
  const runtimeRootRequest = enableRuntime
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
      json,
      activeIsolation,
      recoveryId,
      runtimeRootRequest,
    }),
    jsonRequested,
  );
}
