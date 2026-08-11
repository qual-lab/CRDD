import path from "node:path";

import { snapshotPlainArray } from "../security/plain-data-snapshot.mjs";

const MAXIMUM_ARGUMENTS = 16;
const MAXIMUM_ARGUMENT_LENGTH = 4_096;

function response(status, reason, value = null, jsonRequested = false) {
  return Object.freeze({ status, reason, value, jsonRequested });
}

function commandResponse(status, reason, value = null, jsonRequested = false, usageError = false) {
  return Object.freeze({ status, reason, value, jsonRequested, usageError });
}

function validToken(value) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAXIMUM_ARGUMENT_LENGTH && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validAbsolutePath(value) {
  return validToken(value) && path.isAbsolute(value);
}

function parsePathCommandArguments(rawArguments, options) {
  const snapshot = snapshotPlainArray(rawArguments, MAXIMUM_ARGUMENTS);
  if (snapshot.status !== "ok") {
    return commandResponse("blocked", `${options.command}_arguments_invalid`, null, false, true);
  }
  const argumentsList = snapshot.value;
  const jsonRequested = argumentsList.includes("--json");
  if (argumentsList.some((value) => !validToken(value))) {
    return commandResponse("blocked", `${options.command}_arguments_invalid`, null, jsonRequested, true);
  }
  const allowed = new Set(["--json", "--runtime-root", ...(options.allowAuthorityRoot ? ["--authority-root"] : [])]);
  const seen = new Set();
  let json = false;
  let runtimeCliOverride = null;
  let authorityCliOverride = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const token = argumentsList[index];
    if (!allowed.has(token) || seen.has(token)) {
      return commandResponse("blocked", `${options.command}_arguments_invalid`, null, jsonRequested, true);
    }
    seen.add(token);
    if (token === "--json") {
      json = true;
      continue;
    }
    const value = argumentsList[index + 1];
    if (!validAbsolutePath(value) || value.startsWith("--")) {
      return commandResponse("blocked", `${options.command}_arguments_invalid`, null, jsonRequested, true);
    }
    index += 1;
    if (token === "--runtime-root") runtimeCliOverride = value;
    else authorityCliOverride = value;
  }

  const runtimeEnvironmentOverride = runtimeCliOverride !== null || options.runtimeEnvironmentRoot === undefined
    ? null
    : options.runtimeEnvironmentRoot;
  if (runtimeEnvironmentOverride !== null && !validAbsolutePath(runtimeEnvironmentOverride)) {
    return commandResponse("blocked", "runtime_root_environment_invalid", null, jsonRequested, false);
  }
  let authorityEnvironmentOverride = null;
  if (options.allowAuthorityRoot) {
    authorityEnvironmentOverride = authorityCliOverride !== null || options.authorityEnvironmentRoot === undefined
      ? null
      : options.authorityEnvironmentRoot;
    if (authorityEnvironmentOverride !== null && !validAbsolutePath(authorityEnvironmentOverride)) {
      return commandResponse("blocked", "authority_root_environment_invalid", null, jsonRequested, false);
    }
    if (authorityCliOverride === null && authorityEnvironmentOverride === null) {
      return commandResponse("blocked", "authority_root_explicit_path_required", null, jsonRequested, false);
    }
  }

  return commandResponse("ok", null, Object.freeze({
    json,
    runtimeRootRequest: Object.freeze({
      cliOverride: runtimeCliOverride,
      environmentOverride: runtimeEnvironmentOverride,
      activationIntent: "explicit_enable_request"
    }),
    authorityRootRequest: options.allowAuthorityRoot
      ? Object.freeze({
          cliOverride: authorityCliOverride,
          environmentOverride: authorityEnvironmentOverride,
          activationIntent: "explicit_activate_request"
        })
      : null
  }), jsonRequested, false);
}

export function parseActivateArguments(rawArguments, runtimeEnvironmentRoot, authorityEnvironmentRoot) {
  return parsePathCommandArguments(rawArguments, {
    command: "activate",
    allowAuthorityRoot: true,
    runtimeEnvironmentRoot,
    authorityEnvironmentRoot
  });
}

export function parseDisableArguments(rawArguments, runtimeEnvironmentRoot) {
  return parsePathCommandArguments(rawArguments, {
    command: "disable",
    allowAuthorityRoot: false,
    runtimeEnvironmentRoot,
    authorityEnvironmentRoot: undefined
  });
}

export function parseDoctorArguments(rawArguments, environmentRoot) {
  const snapshot = snapshotPlainArray(rawArguments, MAXIMUM_ARGUMENTS);
  if (snapshot.status !== "ok" || snapshot.value.some((value) => !validToken(value))) {
    return response("blocked", "doctor_arguments_invalid");
  }
  const argumentsList = snapshot.value;
  const jsonRequested = argumentsList.includes("--json");
  const seen = new Set();
  let json = false;
  let activeIsolation = false;
  let recoveryId = null;
  let enableRuntime = false;
  let cliOverride = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const token = argumentsList[index];
    if (!["--json", "--isolation", "--recover-isolation", "--enable-runtime", "--runtime-root"].includes(token) ||
        seen.has(token)) {
      return response("blocked", "doctor_arguments_invalid", null, jsonRequested);
    }
    seen.add(token);
    if (token === "--json") json = true;
    else if (token === "--isolation") activeIsolation = true;
    else if (token === "--enable-runtime") enableRuntime = true;
    else {
      const value = argumentsList[index + 1];
      if (!validToken(value) || value.startsWith("--")) {
        return response("blocked", "doctor_arguments_invalid", null, jsonRequested);
      }
      index += 1;
      if (token === "--recover-isolation") recoveryId = value;
      else cliOverride = value;
    }
  }

  if (cliOverride !== null && !enableRuntime) {
    return response("blocked", "runtime_root_requires_enable_request", null, jsonRequested);
  }
  if (recoveryId !== null && (activeIsolation || enableRuntime || cliOverride !== null)) {
    return response("blocked", "doctor_arguments_incompatible", null, jsonRequested);
  }
  const runtimeRootRequest = enableRuntime
    ? Object.freeze({
        cliOverride,
        environmentOverride: environmentRoot === undefined ? null : environmentRoot,
        activationIntent: "explicit_enable_request"
      })
    : null;
  return response("ok", null, Object.freeze({
    json,
    activeIsolation,
    recoveryId,
    runtimeRootRequest
  }), jsonRequested);
}
