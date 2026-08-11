import { snapshotPlainArray } from "../security/plain-data-snapshot.mjs";

const MAXIMUM_ARGUMENTS = 16;
const MAXIMUM_ARGUMENT_LENGTH = 4_096;

function response(status, reason, value = null, jsonRequested = false) {
  return Object.freeze({ status, reason, value, jsonRequested });
}

function validToken(value) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAXIMUM_ARGUMENT_LENGTH && !/[\u0000-\u001f\u007f]/u.test(value);
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
