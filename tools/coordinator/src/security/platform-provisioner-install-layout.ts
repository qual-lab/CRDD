import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const WINDOWS_ROOT = /^[A-Za-z]:\\(?:[^<>:"|?*\0]+\\?)*$/u;
const ACTIVE_ID = /^[0-9a-f]{32}$/u;
const INPUT_KEYS = new Set(["activeId", "programDataRoot"]);

export const PLATFORM_PROVISIONER_INSTALL_ROOT_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "Coordinator",
]);
export const PLATFORM_PROVISIONER_IMAGES_DIRECTORY = "images";
export const PLATFORM_PROVISIONER_STAGING_DIRECTORY = "staging";
export const PLATFORM_PROVISIONER_STATE_DIRECTORY = "state";
export const PLATFORM_PROVISIONER_ACTIVE_POINTER_FILE = "active-pointer.json";
export const PLATFORM_PROVISIONER_RELEASE_PACKAGE_SEGMENTS = Object.freeze([
  "tools",
  "coordinator",
]);
export const PLATFORM_PROVISIONER_RELEASE_MANIFEST_SEGMENTS = Object.freeze([
  "90_Release",
  "coordinator-package-manifest.json",
]);

function invalid(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    activeId: null,
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
  activeId: unknown,
) {
  const root = validatedProgramDataRoot(programDataRoot);
  if (!root || typeof activeId !== "string" || !ACTIVE_ID.test(activeId)) {
    return null;
  }
  const installRoot = path.win32.join(
    root,
    ...PLATFORM_PROVISIONER_INSTALL_ROOT_SEGMENTS,
  );
  const imagesRoot = path.win32.join(
    installRoot,
    PLATFORM_PROVISIONER_IMAGES_DIRECTORY,
  );
  const stagingContainerRoot = path.win32.join(
    installRoot,
    PLATFORM_PROVISIONER_STAGING_DIRECTORY,
  );
  const stateRoot = path.win32.join(
    installRoot,
    PLATFORM_PROVISIONER_STATE_DIRECTORY,
  );
  const stagingRoot = path.win32.join(stagingContainerRoot, activeId);
  const activeImageRoot = path.win32.join(imagesRoot, activeId);
  return Object.freeze({
    installRoot,
    imagesRoot,
    stagingContainerRoot,
    stagingRoot,
    activeImageRoot,
    stagingPackageRoot: path.win32.join(
      stagingRoot,
      ...PLATFORM_PROVISIONER_RELEASE_PACKAGE_SEGMENTS,
    ),
    stagingManifestFile: path.win32.join(
      stagingRoot,
      ...PLATFORM_PROVISIONER_RELEASE_MANIFEST_SEGMENTS,
    ),
    stateRoot,
    activePointerFile: path.win32.join(
      stateRoot,
      PLATFORM_PROVISIONER_ACTIVE_POINTER_FILE,
    ),
  });
}

export function evaluateWindowsProvisionerInstallLayoutCandidate(raw: unknown) {
  const input = snapshotPlainRecord(raw, INPUT_KEYS);
  if (
    !input ||
    !resolveWindowsProvisionerInstallLayoutForEffect(
      input.programDataRoot,
      input.activeId,
    )
  ) {
    return invalid("platform_provisioner_install_layout_input_invalid");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "platform_provisioner_install_layout_resolved_effect_required",
    activeId: input.activeId as string,
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
    imageLayout:
      "exactly_one_exclusive_staging_active_id_and_atomic_active_pointer",
    activeImageSelection: "pointer_only_without_directory_fallback",
    stateLayout: "single_canonical_active_pointer_without_separate_floor",
    repositoryRuntimeStateRequired: false,
    externalStateReason: "installed_machine_state_only",
    compatibilityLayout: "prohibited",
    multipleActiveImages: "prohibited",
    automaticRollback: "prohibited",
    symlinkOrJunctionLayout: "prohibited",
    filesystemEffect: "not_implemented_effective_access_required",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
