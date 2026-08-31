export const COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT =
  "crdd-coordinator/node-runtime-version";
export const COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT_REVISION = 1;
export const MINIMUM_COORDINATOR_NODE_VERSION = "24.12.0";

const MINIMUM = Object.freeze({ major: 24, minor: 12, patch: 0 });

export function isSupportedCoordinatorNodeRuntime(value: unknown) {
  if (typeof value !== "string") return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(value);
  if (!match) return false;
  const [major, minor, patch] = match
    .slice(1)
    .map((part) => Number.parseInt(part ?? "", 10));
  if (![major, minor, patch].every(Number.isSafeInteger)) return false;
  return (
    (major ?? -1) > MINIMUM.major ||
    ((major ?? -1) === MINIMUM.major &&
      ((minor ?? -1) > MINIMUM.minor ||
        ((minor ?? -1) === MINIMUM.minor && (patch ?? -1) >= MINIMUM.patch)))
  );
}

export function assertSupportedCoordinatorNodeRuntime(value: unknown) {
  if (!isSupportedCoordinatorNodeRuntime(value)) {
    throw new Error("coordinator_node_version_unsupported");
  }
}

export function describeCoordinatorNodeRuntimeVersionContract() {
  return Object.freeze({
    contract: COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT,
    contractRevision: COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT_REVISION,
    minimumVersion: MINIMUM_COORDINATOR_NODE_VERSION,
    checkTiming: "before_interactive_input_release_verification_or_effect",
    pathLookupAuthority: false,
    unsupportedRuntimeFallbackAllowed: false,
  });
}
