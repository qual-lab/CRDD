import path from "node:path";

import { loadPlatformProvisionerActiveReleaseForEffect } from "./platform-provisioner-active-release-store.ts";
import {
  PLATFORM_PROVISIONER_INSTALL_ROOT_SEGMENTS,
  PLATFORM_PROVISIONER_STATE_DIRECTORY,
  resolveWindowsProvisionerInstallLayoutForEffect,
} from "./platform-provisioner-install-layout.ts";
import { verifyInstalledCoordinatorPackageCandidate } from "./platform-provisioner-package-filesystem.ts";
import { loadPlatformProvisionerReleaseFloorForEffect } from "./platform-provisioner-release-floor-store.ts";
import { inspectPlatformProvisionerStateTransactionForRuntime } from "./platform-provisioner-state-transaction.ts";
import { inspectWindowsPackageDaclCandidate } from "./platform-provisioner-windows-dacl.ts";
import { discoverWindowsCommonApplicationDataForEffect } from "./windows-common-application-data.ts";

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    manifestHash: null,
    activeHash: null,
    packageContentRootSha256: null,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

export function readPlatformProvisionerActiveReleaseCandidate() {
  try {
    const programDataRoot = discoverWindowsCommonApplicationDataForEffect();
    if (!programDataRoot)
      return blocked("active_release_reader_program_data_unavailable");
    const installRoot = path.win32.join(
      programDataRoot,
      ...PLATFORM_PROVISIONER_INSTALL_ROOT_SEGMENTS,
    );
    const stateRoot = path.win32.join(
      installRoot,
      PLATFORM_PROVISIONER_STATE_DIRECTORY,
    );
    const transaction =
      inspectPlatformProvisionerStateTransactionForRuntime(stateRoot);
    if (transaction.status !== "candidate") {
      return blocked("active_release_reader_transaction_incomplete");
    }
    const floor = loadPlatformProvisionerReleaseFloorForEffect(stateRoot);
    const active = loadPlatformProvisionerActiveReleaseForEffect(stateRoot);
    if (
      floor.status !== "candidate" ||
      active.status !== "candidate" ||
      !floor.floor ||
      !active.activeRelease ||
      floor.floorHash !== active.activeRelease.floorHash ||
      floor.releaseSequence !== active.releaseSequence
    ) {
      return blocked("active_release_reader_state_mismatch");
    }
    const layout = resolveWindowsProvisionerInstallLayoutForEffect(
      programDataRoot,
      active.releaseSequence,
    );
    if (!layout) return blocked("active_release_reader_layout_invalid");
    const expectedRelease = {
      manifestHash: active.activeRelease.manifestHash,
      releaseSequence: active.activeRelease.releaseSequence,
      crddVersion: active.activeRelease.crddVersion,
      crddCommit: active.activeRelease.crddCommit,
      crddTree: active.activeRelease.crddTree,
      packageContentRootSha256: active.activeRelease.packageContentRootSha256,
    };
    const installed = verifyInstalledCoordinatorPackageCandidate({
      distributionRoot: layout.releaseRoot,
      evaluationTime: new Date(),
      expectedRelease,
    });
    const dacl = inspectWindowsPackageDaclCandidate(layout.installRoot);
    if (installed.status !== "candidate" || dacl.status !== "candidate") {
      return blocked("active_release_reader_installed_release_invalid");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_release_reader_verified_installed_generation",
      releaseSequence: active.activeRelease.releaseSequence,
      manifestHash: active.activeRelease.manifestHash,
      activeHash: active.activeRelease.activeHash,
      packageContentRootSha256: active.activeRelease.packageContentRootSha256,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  } catch {
    return blocked("active_release_reader_failed");
  }
}

export function describePlatformProvisionerActiveReleaseReaderContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-active-release-reader",
    contractRevision: 1,
    platform: "windows_candidate_only",
    rootSelection: "windows_known_folder_common_application_data_only",
    stateTransactionRequirement: "no_pending_or_committed_intent",
    floorAndActiveBinding: "exact_sequence_and_floor_hash",
    installedReleaseReverification:
      "signed_manifest_tree_package_and_dacl_required",
    runtimeRead: "implemented_candidate",
    automaticRecovery: "prohibited",
    pathDisclosure: "prohibited",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
