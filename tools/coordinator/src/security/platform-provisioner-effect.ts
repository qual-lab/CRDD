import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluatePlatformProvisionerActiveReleaseCandidate } from "./platform-provisioner-active-release.ts";
import { loadPlatformProvisionerActiveReleaseForEffect } from "./platform-provisioner-active-release-store.ts";
import {
  PLATFORM_PROVISIONER_RELEASE_MANIFEST_SEGMENTS,
  resolveWindowsProvisionerInstallLayoutForEffect,
} from "./platform-provisioner-install-layout.ts";
import {
  inspectPlatformProvisionerPackageFilesystemCandidate,
  verifyBundledCoordinatorPackageFromFixedManifestCandidate,
  verifyInstalledCoordinatorPackageCandidate,
} from "./platform-provisioner-package-filesystem.ts";
import { evaluatePlatformProvisionerReleaseFloorCandidate } from "./platform-provisioner-release-floor.ts";
import { loadPlatformProvisionerReleaseFloorForEffect } from "./platform-provisioner-release-floor-store.ts";
import {
  persistPlatformProvisionerStateTransactionForEffect,
  recoverPlatformProvisionerStateTransactionForEffect,
} from "./platform-provisioner-state-transaction.ts";
import {
  applyWindowsProvisionerInstallDaclForEffect,
  inspectWindowsPackageDaclCandidate,
} from "./platform-provisioner-windows-dacl.ts";

const bundledPackageRoot = fileURLToPath(new URL("../../", import.meta.url));
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const MAXIMUM_FILES = 2_048;
const MAXIMUM_PACKAGE_BYTES = 64 * 1024 * 1024;
const POWERSHELL_TIMEOUT_MS = 30_000;
const POWERSHELL_OUTPUT_BYTES = 4_096;
const WINDOWS_ROOT = /^[A-Za-z]:\\Windows$/u;
const PROGRAM_DATA_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)
`;

type VerifiedRelease = Readonly<{
  manifestHash: string;
  releaseSequence: number;
  crddVersion: string;
  crddCommit: string;
  crddTree: string;
  packageContentRootSha256: string;
}>;

function blocked(reason: string, hasFilesystemEffect = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    packageInstalled: false,
    rollbackFloorPersisted: false,
    activeReleasePersisted: false,
    recoveryRequired: hasFilesystemEffect,
    crddDistributionConfirmed: false,
    qualLabManifestTrustConfirmed: false,
    permissionPolicyConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: hasFilesystemEffect,
    networkEffectIssued: false,
  });
}

function powershellExecutable() {
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !WINDOWS_ROOT.test(systemRoot)) return null;
  const executable = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const metadata = fs.lstatSync(executable);
  return metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    fs.realpathSync.native(executable) === executable
    ? executable
    : null;
}

function discoverProgramDataRoot() {
  if (process.platform !== "win32") return null;
  const executable = powershellExecutable();
  if (!executable) return null;
  const output = execFileSync(
    executable,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(PROGRAM_DATA_SCRIPT, "utf16le").toString("base64"),
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: POWERSHELL_TIMEOUT_MS,
      maxBuffer: POWERSHELL_OUTPUT_BYTES,
      env: { SystemRoot: process.env.SystemRoot },
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
  if (!path.win32.isAbsolute(output) || output.includes("\0")) return null;
  const normalized = path.win32.normalize(output);
  const metadata = fs.lstatSync(normalized);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(normalized) !== normalized
  ) {
    return null;
  }
  return normalized;
}

function ensureOwnedDirectory(target: string) {
  try {
    fs.mkdirSync(target);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "EEXIST"
    ) {
      throw error;
    }
  }
  const metadata = fs.lstatSync(target);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(target) !== target
  ) {
    throw new Error("platform_provisioner_directory_invalid");
  }
}

function ensureInstallRoot(programDataRoot: string) {
  let current = programDataRoot;
  for (const segment of ["Qual-Lab", "CRDD", "Coordinator"]) {
    current = path.win32.join(current, segment);
    ensureOwnedDirectory(current);
  }
  return current;
}

function copyPackageTree(sourceRoot: string, targetRoot: string) {
  let fileCount = 0;
  let packageBytes = 0;
  const visit = (source: string, target: string, isRoot: boolean) => {
    ensureOwnedDirectory(target);
    const entries = fs
      .readdirSync(source, { withFileTypes: true })
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      );
    for (const entry of entries) {
      if (
        isRoot &&
        (entry.name === "node_modules" || entry.name === ".gitignore")
      ) {
        continue;
      }
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);
      const metadata = fs.lstatSync(sourcePath);
      if (metadata.isSymbolicLink()) {
        throw new Error("platform_provisioner_copy_link_rejected");
      }
      if (metadata.isDirectory()) {
        visit(sourcePath, targetPath, false);
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error("platform_provisioner_copy_entity_invalid");
      }
      fileCount += 1;
      packageBytes += metadata.size;
      if (
        fileCount > MAXIMUM_FILES ||
        metadata.size < 0 ||
        packageBytes > MAXIMUM_PACKAGE_BYTES
      ) {
        throw new Error("platform_provisioner_copy_budget_exceeded");
      }
      fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
      const copied = fs.lstatSync(targetPath);
      if (!copied.isFile() || copied.isSymbolicLink()) {
        throw new Error("platform_provisioner_copy_entity_invalid");
      }
    }
  };
  visit(sourceRoot, targetRoot, true);
}

function verifiedRelease(result: Readonly<Record<string, unknown>>) {
  if (
    typeof result.manifestHash !== "string" ||
    typeof result.releaseSequence !== "number" ||
    typeof result.crddVersion !== "string" ||
    typeof result.crddCommit !== "string" ||
    typeof result.crddTree !== "string" ||
    typeof result.packageContentRootSha256 !== "string"
  ) {
    return null;
  }
  return Object.freeze({
    manifestHash: result.manifestHash,
    releaseSequence: result.releaseSequence,
    crddVersion: result.crddVersion,
    crddCommit: result.crddCommit,
    crddTree: result.crddTree,
    packageContentRootSha256: result.packageContentRootSha256,
  });
}

function copyReleaseToStaging(
  stagingRoot: string,
  release: VerifiedRelease,
  evaluationTime: Date,
) {
  ensureOwnedDirectory(stagingRoot);
  const packageRoot = path.join(stagingRoot, "tools", "coordinator");
  ensureOwnedDirectory(path.dirname(packageRoot));
  copyPackageTree(bundledPackageRoot, packageRoot);
  const manifestTarget = path.join(
    stagingRoot,
    ...PLATFORM_PROVISIONER_RELEASE_MANIFEST_SEGMENTS,
  );
  ensureOwnedDirectory(path.dirname(manifestTarget));
  fs.copyFileSync(
    path.join(
      bundledDistributionRoot,
      ...PLATFORM_PROVISIONER_RELEASE_MANIFEST_SEGMENTS,
    ),
    manifestTarget,
    fs.constants.COPYFILE_EXCL,
  );
  const verified = verifyInstalledCoordinatorPackageCandidate({
    distributionRoot: stagingRoot,
    evaluationTime,
    expectedRelease: release,
  });
  if (verified.status !== "candidate") {
    throw new Error("platform_provisioner_staged_release_invalid");
  }
}

export function runPlatformProvisionerEffect() {
  let hasFilesystemEffect = false;
  try {
    const evaluationTime = new Date();
    const sourceVerification =
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime,
      });
    if (sourceVerification.status !== "candidate") {
      return blocked("platform_provisioner_source_distribution_not_verified");
    }
    const release = verifiedRelease(sourceVerification);
    if (!release)
      return blocked("platform_provisioner_release_identity_invalid");
    const programDataRoot = discoverProgramDataRoot();
    if (!programDataRoot)
      return blocked("platform_provisioner_program_data_unavailable");
    const layout = resolveWindowsProvisionerInstallLayoutForEffect(
      programDataRoot,
      release.releaseSequence,
    );
    if (!layout) return blocked("platform_provisioner_install_layout_invalid");
    const installRoot = ensureInstallRoot(programDataRoot);
    hasFilesystemEffect = true;
    if (installRoot !== layout.installRoot) {
      return blocked("platform_provisioner_install_layout_mismatch", true);
    }
    const initialDacl =
      applyWindowsProvisionerInstallDaclForEffect(installRoot);
    if (initialDacl.status !== "candidate") {
      return blocked("platform_provisioner_install_dacl_failed", true);
    }
    ensureOwnedDirectory(layout.releasesRoot);
    ensureOwnedDirectory(layout.stateRoot);
    const recoveredState = recoverPlatformProvisionerStateTransactionForEffect(
      layout.stateRoot,
    );
    if (recoveredState.status !== "candidate") {
      return blocked("platform_provisioner_state_recovery_failed", true);
    }
    const stagingRoot = `${layout.releaseRoot}.pending`;
    if (fs.existsSync(stagingRoot)) {
      return blocked("platform_provisioner_release_recovery_required", true);
    }
    if (!fs.existsSync(layout.releaseRoot)) {
      copyReleaseToStaging(stagingRoot, release, evaluationTime);
      fs.renameSync(stagingRoot, layout.releaseRoot);
    } else {
      const installed = verifyInstalledCoordinatorPackageCandidate({
        distributionRoot: layout.releaseRoot,
        evaluationTime,
        expectedRelease: release,
      });
      if (installed.status !== "candidate") {
        return blocked("platform_provisioner_existing_release_conflict", true);
      }
    }
    const finalDacl = applyWindowsProvisionerInstallDaclForEffect(installRoot);
    if (finalDacl.status !== "candidate") {
      return blocked("platform_provisioner_final_dacl_failed", true);
    }
    const installedPackage =
      inspectPlatformProvisionerPackageFilesystemCandidate(
        layout.releasePackageRoot,
      );
    const dacl = inspectWindowsPackageDaclCandidate(installRoot);
    if (
      installedPackage.status !== "candidate" ||
      installedPackage.packageContentRootSha256 !==
        release.packageContentRootSha256 ||
      dacl.status !== "candidate"
    ) {
      return blocked(
        "platform_provisioner_installed_release_recheck_failed",
        true,
      );
    }
    const loadedFloor = loadPlatformProvisionerReleaseFloorForEffect(
      layout.stateRoot,
    );
    if (loadedFloor.status !== "candidate") {
      return blocked("platform_provisioner_release_floor_load_failed", true);
    }
    const floorTransition = evaluatePlatformProvisionerReleaseFloorCandidate({
      currentFloor: loadedFloor.floor,
      verifiedRelease: {
        manifestHash: release.manifestHash,
        releaseSequence: release.releaseSequence,
        crddVersion: release.crddVersion,
        crddCommit: release.crddCommit,
        crddTree: release.crddTree,
      },
    });
    if (floorTransition.status !== "candidate") {
      return blocked("platform_provisioner_release_floor_rejected", true);
    }
    const loadedActive = loadPlatformProvisionerActiveReleaseForEffect(
      layout.stateRoot,
    );
    if (loadedActive.status !== "candidate") {
      return blocked("platform_provisioner_active_release_load_failed", true);
    }
    const activeCandidate = evaluatePlatformProvisionerActiveReleaseCandidate({
      verifiedRelease: release,
      confirmedFloor: {
        floorHash: floorTransition.floorHash,
        releaseSequence: floorTransition.releaseSequence,
      },
    });
    if (activeCandidate.status !== "candidate") {
      return blocked("platform_provisioner_active_release_invalid", true);
    }
    const statePersistence =
      persistPlatformProvisionerStateTransactionForEffect(layout.stateRoot, {
        previousFloorHash: loadedFloor.floorHash,
        previousActiveHash: loadedActive.activeHash,
        nextFloor: floorTransition.nextFloor,
        nextActiveRelease: activeCandidate.nextActiveRelease,
      });
    if (statePersistence.status !== "candidate") {
      return blocked("platform_provisioner_state_transaction_failed", true);
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "platform_provisioner_release_installed_and_activated",
      releaseSequence: release.releaseSequence,
      packageInstalled: true,
      rollbackFloorPersisted: true,
      activeReleasePersisted: true,
      recoveryRequired: false,
      crddDistributionConfirmed: true,
      qualLabManifestTrustConfirmed: true,
      permissionPolicyConfirmed: true,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: true,
      networkEffectIssued: false,
    });
  } catch {
    return blocked("platform_provisioner_effect_failed", hasFilesystemEffect);
  }
}

export function describePlatformProvisionerEffectContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-effect",
    contractRevision: 1,
    effectController: "implemented_candidate",
    command: "explicit_provision_only",
    sourceSelection: "fixed_signed_crdd_distribution_only",
    sourceCheckoutBehavior: "blocked_before_program_data_discovery_or_write",
    platform: "windows_candidate_only",
    installRoot: "%ProgramData%/Qual-Lab/CRDD/Coordinator",
    releaseStaging: "release_sequence_pending_then_atomic_directory_rename",
    installedReleaseReverification: "required_before_activation",
    permissionMutation: "fixed_install_root_only_then_recursive_reverification",
    rollbackFloorPersistence: "implemented_candidate_in_state_transaction",
    activeReleasePersistence: "implemented_candidate_in_state_transaction",
    stateTransaction:
      "durable_intent_floor_then_active_explicit_provision_recovery",
    failureBehavior:
      "active_pointer_not_replaced_before_all_prior_steps_succeed_explicit_recovery_required_after_effect",
    repositoryRuntimeStateRequired: false,
    compatibilityLayout: "prohibited",
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
