import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const WINDOWS_ROOT = /^[A-Za-z]:\\(?:[^<>:"|?*\0]+\\?)*$/u;
const INPUT_KEYS = new Set(["programDataRoot", "releaseSequence"]);

export const PLATFORM_PROVISIONER_INSTALL_ROOT_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "Coordinator",
]);
export const PLATFORM_PROVISIONER_RELEASES_DIRECTORY = "releases";
export const PLATFORM_PROVISIONER_STATE_DIRECTORY = "state";
export const PLATFORM_PROVISIONER_RELEASE_FLOOR_FILE = "release-floor.json";
export const PLATFORM_PROVISIONER_ACTIVE_RELEASE_FILE = "active-release.json";

function invalid(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    repositoryStateRequired: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

function validatedProgramDataRoot(raw: unknown) {
  if (
    typeof raw !== "string" ||
    raw.length < 3 ||
    raw.length > 260 ||
    raw.includes("\0") ||
    !path.win32.isAbsolute(raw) ||
    !WINDOWS_ROOT.test(raw)
  ) {
    return null;
  }
  const normalized = path.win32.normalize(raw);
  return normalized === raw || normalized === raw.replace(/[\\]+$/u, "")
    ? normalized.replace(/[\\]+$/u, "")
    : null;
}

export function resolveWindowsProvisionerInstallLayoutForEffect(
  programDataRoot: unknown,
  releaseSequence: unknown,
) {
  const root = validatedProgramDataRoot(programDataRoot);
  if (
    !root ||
    typeof releaseSequence !== "number" ||
    !Number.isSafeInteger(releaseSequence) ||
    releaseSequence < 1
  ) {
    return null;
  }
  const installRoot = path.win32.join(
    root,
    ...PLATFORM_PROVISIONER_INSTALL_ROOT_SEGMENTS,
  );
  const releasesRoot = path.win32.join(
    installRoot,
    PLATFORM_PROVISIONER_RELEASES_DIRECTORY,
  );
  const stateRoot = path.win32.join(
    installRoot,
    PLATFORM_PROVISIONER_STATE_DIRECTORY,
  );
  return Object.freeze({
    installRoot,
    releasesRoot,
    releaseRoot: path.win32.join(releasesRoot, String(releaseSequence)),
    stateRoot,
    releaseFloorFile: path.win32.join(
      stateRoot,
      PLATFORM_PROVISIONER_RELEASE_FLOOR_FILE,
    ),
    activeReleaseFile: path.win32.join(
      stateRoot,
      PLATFORM_PROVISIONER_ACTIVE_RELEASE_FILE,
    ),
  });
}

export function evaluateWindowsProvisionerInstallLayoutCandidate(raw: unknown) {
  const input = snapshotPlainRecord(raw, INPUT_KEYS);
  if (
    !input ||
    !resolveWindowsProvisionerInstallLayoutForEffect(
      input.programDataRoot,
      input.releaseSequence,
    )
  ) {
    return invalid("platform_provisioner_install_layout_input_invalid");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "platform_provisioner_install_layout_resolved_effect_required",
    releaseSequence: input.releaseSequence as number,
    repositoryStateRequired: false,
    externalInstallStateRequired: true,
    compatibilityLayoutRequired: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

export function describePlatformProvisionerInstallLayoutContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-install-layout",
    contractRevision: 1,
    sourceOwnership: "repository_owned_typescript_and_contract_tests",
    windowsRootSource: "program_data_environment_at_explicit_provision_time",
    installRootSegments: PLATFORM_PROVISIONER_INSTALL_ROOT_SEGMENTS,
    releaseLayout: "releases_positive_release_sequence",
    stateLayout: "state_release_floor_and_active_release_canonical_json",
    repositoryRuntimeStateRequired: false,
    externalStateReason: "installed_machine_state_only",
    compatibilityLayout: "prohibited",
    symlinkOrJunctionLayout: "prohibited",
    filesystemEffect: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
