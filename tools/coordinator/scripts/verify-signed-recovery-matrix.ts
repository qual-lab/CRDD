import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isSupportedCoordinatorNodeRuntime,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";
import { createInteractiveConsoleReaderEnvironment } from "../src/core/windows-child-environment.ts";
import {
  createDynamicFakeProviderRecoverableResidue,
  recoverDockerIsolationProbe,
} from "../src/security/docker-isolation.ts";
import { createOwnedOperationDirectories } from "../src/security/execution-environment.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../src/security/platform-provisioner-package-filesystem.ts";
import { verifyDynamicFakeProviderCancellation } from "./verify-dynamic-fake-provider-cancellation.ts";
import { verifyDynamicFakeProviderFailures } from "./verify-dynamic-fake-provider-failures.ts";

export const SIGNED_RECOVERY_MATRIX_CONTRACT =
  "crdd-coordinator/signed-recovery-matrix-verification";
export const SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION = 1;

const INTERNAL_CHILD_ARGUMENT = "--internal-parent-loss-child";
const CHILD_READY_CONTRACT =
  "crdd-coordinator/signed-recovery-matrix-parent-loss-child";
const CHILD_READY_TIMEOUT_MS = 60_000;
const CHILD_EXIT_TIMEOUT_MS = 10_000;

type RuntimeRecord = Readonly<Record<string, unknown>>;

function blocked(reason: string, extra: RuntimeRecord = Object.freeze({})) {
  return Object.freeze({
    contract: SIGNED_RECOVERY_MATRIX_CONTRACT,
    contractRevision: SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: false,
    manualRecoveryRequired: false,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
    ...extra,
  });
}

function verifySignedPackagePrerequisite() {
  if (!isSupportedCoordinatorNodeRuntime(process.versions.node))
    return Object.freeze({
      status: "blocked" as const,
      reason: "signed_recovery_matrix_node_version_unsupported",
      release: null,
    });
  try {
    const issued = issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
      evaluationTime: new Date().toISOString(),
    });
    const release = issued.verification as RuntimeRecord;
    if (
      release?.status !== "candidate" ||
      release.qualLabManifestCryptographicMatch !== true ||
      release.runtimeOwnedReleaseTrustConfirmed !== true ||
      release.releaseIdentityRuntimeOwned !== true ||
      release.crddDistributionConfirmed !== true ||
      !issued.capability ||
      typeof issued.capability !== "object"
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "signed_recovery_matrix_release_verification_failed",
        release,
      });
    return Object.freeze({
      status: "verified" as const,
      reason: "signed_recovery_matrix_release_verified",
      release,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "signed_recovery_matrix_release_verification_failed",
      release: null,
    });
  }
}

function recoveryCompleted(result: RuntimeRecord | null) {
  return (
    result?.status === "recovered" &&
    result.hostCleanupCompleted === true &&
    result.recoveryId === null
  );
}

function verifyCleanupUnknownThenRecover() {
  const owned = createOwnedOperationDirectories();
  const residue = createDynamicFakeProviderRecoverableResidue(owned);
  if (
    residue.status !== "ready" ||
    residue.manualRecoveryRequired !== true ||
    residue.containerRunning !== true ||
    typeof residue.recoveryId !== "string"
  )
    throw new Error(residue.reason);
  const recovered = recoverDockerIsolationProbe(
    residue.recoveryId,
  ) as RuntimeRecord | null;
  if (!recoveryCompleted(recovered) || fs.existsSync(owned.root))
    throw new Error("signed_recovery_matrix_cleanup_unknown_recovery_failed");
  return Object.freeze({
    scenario: "cleanup_observation_unknown_then_recover",
    initialStatus: "blocked",
    initialReason: "cleanup_observation_intentionally_withheld",
    initialManualRecoveryRequired: true,
    exactRecoveryIdReturned: true,
    freshRecoveryCompleted: true,
    residualOperationDirectory: false,
  });
}

function waitForChildReady(child: ChildProcess): Promise<RuntimeRecord> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("signed_recovery_matrix_parent_child_timeout"));
    }, CHILD_READY_TIMEOUT_MS);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (settled) return;
      output += chunk;
      const newline = output.indexOf("\n");
      if (newline < 0) return;
      settled = true;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(output.slice(0, newline)) as RuntimeRecord);
      } catch {
        reject(new Error("signed_recovery_matrix_parent_child_output_invalid"));
      }
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("signed_recovery_matrix_parent_child_exited_early"));
    });
  });
}

function waitForChildExit(child: ChildProcess): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), CHILD_EXIT_TIMEOUT_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function verifyParentLossThenRecover() {
  const observedEnvironment = createInteractiveConsoleReaderEnvironment();
  if (!observedEnvironment)
    throw new Error("signed_recovery_matrix_child_environment_unavailable");
  const childEnvironment: NodeJS.ProcessEnv = { ...observedEnvironment };
  const child: ChildProcess = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), INTERNAL_CHILD_ARGUMENT],
    {
      cwd: process.cwd(),
      env: childEnvironment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let recoveryId: string | null = null;
  try {
    const ready = await waitForChildReady(child);
    if (
      ready.contract !== CHILD_READY_CONTRACT ||
      ready.status !== "ready" ||
      typeof ready.recoveryId !== "string" ||
      ready.manualRecoveryRequired !== true
    )
      throw new Error("signed_recovery_matrix_parent_child_contract_invalid");
    recoveryId = ready.recoveryId;
    if (!child.pid)
      throw new Error("signed_recovery_matrix_parent_child_pid_missing");
    const killed = spawnSync(
      path.join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32",
        "taskkill.exe",
      ),
      ["/PID", String(child.pid), "/T", "/F"],
      {
        encoding: "utf8",
        env: childEnvironment,
        windowsHide: true,
        timeout: CHILD_EXIT_TIMEOUT_MS,
      },
    );
    if (killed.error || (killed.status !== 0 && child.exitCode === null))
      throw new Error("signed_recovery_matrix_parent_child_kill_failed");
    if (!(await waitForChildExit(child)))
      throw new Error("signed_recovery_matrix_parent_child_exit_unconfirmed");
    const recovered = recoverDockerIsolationProbe(
      recoveryId,
    ) as RuntimeRecord | null;
    if (!recoveryCompleted(recovered))
      throw new Error("signed_recovery_matrix_parent_loss_recovery_failed");
    recoveryId = null;
    return Object.freeze({
      scenario: "parent_process_loss_then_fresh_recovery",
      childProcessTerminationObserved: true,
      exactRecoveryIdReturned: true,
      freshRecoveryCompleted: true,
      manualRecoveryRequiredAfterRecovery: false,
    });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    if (recoveryId) void recoverDockerIsolationProbe(recoveryId);
  }
}

async function runInternalParentLossChild() {
  const prerequisite = verifySignedPackagePrerequisite();
  if (prerequisite.status !== "verified") {
    process.stdout.write(
      `${JSON.stringify({ contract: CHILD_READY_CONTRACT, status: "blocked", reason: prerequisite.reason })}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const owned = createOwnedOperationDirectories();
  const residue = createDynamicFakeProviderRecoverableResidue(owned);
  process.stdout.write(
    `${JSON.stringify({
      contract: CHILD_READY_CONTRACT,
      status: residue.status,
      reason: residue.reason,
      recoveryId: residue.recoveryId,
      manualRecoveryRequired: residue.manualRecoveryRequired,
    })}\n`,
  );
  if (residue.status !== "ready") {
    process.exitCode = 2;
    return;
  }
  setInterval(() => undefined, 1_000);
  await new Promise<never>(() => undefined);
}

export async function runSignedRecoveryMatrixVerification() {
  const prerequisite = verifySignedPackagePrerequisite();
  if (prerequisite.status !== "verified") return blocked(prerequisite.reason);
  try {
    const failures = verifyDynamicFakeProviderFailures();
    const failureScenarios = failures.scenarios.map((scenario) => ({
      scenario: scenario.scenario,
      status: scenario.status,
      reason: scenario.reason,
      cleanup: scenario.cleanup,
      residualOperationDirectory: scenario.residualOperationDirectory,
    }));
    const cancellation = await verifyDynamicFakeProviderCancellation();
    const cleanupUnknown = verifyCleanupUnknownThenRecover();
    const parentLoss = await verifyParentLossThenRecover();
    return Object.freeze({
      contract: SIGNED_RECOVERY_MATRIX_CONTRACT,
      contractRevision: SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
      status: "completed" as const,
      reason: "signed_recovery_matrix_verified",
      minimumNodeVersion: MINIMUM_COORDINATOR_NODE_VERSION,
      packageVerification: "signed_release_and_exact_distribution",
      scenarios: Object.freeze([
        ...failureScenarios,
        Object.freeze({
          scenario: "cancel",
          status: cancellation.status,
          reason: cancellation.reason,
          cleanup: cancellation.cleanup,
          residualOperationDirectory: cancellation.residualOperationDirectory,
        }),
        cleanupUnknown,
        parentLoss,
      ]),
      fixedVerificationWorkerOnly: true,
      providerCredentialUsed: false,
      providerNetworkEffectIssued: false,
      apiKeyFallbackAllowed: false,
      paidApiFallbackAllowed: false,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      rawProviderOutputReported: false,
      hostPathReported: false,
      credentialReported: false,
    });
  } catch (error) {
    return blocked(
      error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "signed_recovery_matrix_failed_closed",
    );
  }
}

export function describeSignedRecoveryMatrixContract() {
  return Object.freeze({
    contract: SIGNED_RECOVERY_MATRIX_CONTRACT,
    contractRevision: SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
    normalTaskSchemaChanged: false,
    publicScenarioArgumentsAllowed: false,
    fixedScenarios: Object.freeze([
      "nonzero_exit",
      "timeout",
      "output_limit",
      "invalid_output",
      "cancel",
      "parent_process_loss_then_fresh_recovery",
      "cleanup_observation_unknown_then_recover",
    ]),
    parentLoss: "real_child_process_termination_then_fresh_recovery",
    recoveryIdentity: "exact_durable_runtime_owned_token",
    providerCredentialAllowed: false,
    providerNetworkAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === INTERNAL_CHILD_ARGUMENT) {
    await runInternalParentLossChild();
    return;
  }
  if (args.length !== 0)
    throw new Error("signed_recovery_matrix_arguments_invalid");
  const result = await runSignedRecoveryMatrixVerification();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stdout.write(
      `${JSON.stringify(
        blocked(
          error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
            ? error.message
            : "signed_recovery_matrix_failed_closed",
        ),
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
  });
}
