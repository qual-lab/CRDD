import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createWindowsDockerDesktopRepairHelperEnvironment } from "../core/windows-child-environment.ts";
import { createDockerDesktopRepairNativeHelperLifecycle } from "./docker-desktop-repair-native-helper-lifecycle-internal.ts";
import { observeRuntimeOwnedDockerDesktopRepairPolicy } from "./docker-desktop-repair-policy.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";

export type DockerDesktopRepairHelperReleaseOutcome = Readonly<{
  cleanup: "confirmed" | "unknown";
  protocol: "completed" | "failed" | "not_applicable";
}>;
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const executablePath = path.join(
  bundledDistributionRoot,
  ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
);

type PlatformArtifact = Readonly<{
  relativePath: string;
  target: string;
  protocolRevision: number;
  rustToolchain: string;
  byteLength: number;
  sha256: string;
}>;

export type DockerDesktopRepairNativeHelperSession = Readonly<{
  assertLive: () => boolean;
  onFailureDetected: (listener: () => void) => () => void;
  failureDetected: Promise<void>;
  verifyArtifacts: () => Promise<"verified" | "unknown">;
  inspectProcesses: () => Promise<"absent" | "verified" | "unknown">;
  terminateProcesses: () => Promise<
    | "absent"
    | "not_issued_unknown"
    | "terminated"
    | "partial_or_unknown"
    | "unknown"
  >;
  launchDesktop: () => Promise<
    "not_started" | "started" | "partial_or_unknown" | "unknown"
  >;
  abort: () => Promise<DockerDesktopRepairHelperReleaseOutcome>;
  release: () => Promise<DockerDesktopRepairHelperReleaseOutcome>;
}>;

export type DockerDesktopRepairNativeHelperOutcome = Readonly<{
  status: "acquired" | "unavailable" | "protocol_failed" | "cleanup_unknown";
  session: DockerDesktopRepairNativeHelperSession | null;
}>;

export type DockerDesktopRestartNativeHelperOutcome = Readonly<{
  status: DockerDesktopRepairNativeHelperOutcome["status"];
  session:
    | (DockerDesktopRepairNativeHelperSession &
        Readonly<{
          stopDesktop: () => Promise<
            "not_issued" | "command_completed" | "outcome_unknown"
          >;
          inspectClientProcesses: () => Promise<
            "absent" | "verified" | "unknown"
          >;
        }>)
    | null;
}>;

type NativeChild = ChildProcessWithoutNullStreams;

function sameArtifact(left: unknown, right: unknown) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const first = left as Partial<PlatformArtifact>;
  const second = right as Partial<PlatformArtifact>;
  return (
    first.relativePath === second.relativePath &&
    first.target === second.target &&
    first.protocolRevision === second.protocolRevision &&
    first.rustToolchain === second.rustToolchain &&
    first.byteLength === second.byteLength &&
    first.sha256 === second.sha256
  );
}

export async function acquireRuntimeOwnedDockerDesktopRepairNativeHelper(
  expectedPlatformArtifact: unknown,
): Promise<DockerDesktopRepairNativeHelperOutcome> {
  return acquireRuntimeOwnedDockerDesktopNativeHelper(
    expectedPlatformArtifact,
    "repair",
  );
}

export async function acquireRuntimeOwnedDockerDesktopRestartNativeHelper(
  expectedPlatformArtifact: unknown,
): Promise<DockerDesktopRestartNativeHelperOutcome> {
  return acquireRuntimeOwnedDockerDesktopNativeHelper(
    expectedPlatformArtifact,
    "restart",
  );
}

async function acquireRuntimeOwnedDockerDesktopNativeHelper(
  expectedPlatformArtifact: unknown,
  protocol: "repair" | "restart",
): Promise<DockerDesktopRestartNativeHelperOutcome> {
  if (process.platform !== "win32")
    return Object.freeze({ status: "unavailable", session: null });
  const policy =
    protocol === "repair"
      ? observeRuntimeOwnedDockerDesktopRepairPolicy()
      : Object.freeze({
          policySha256: createHash("sha256")
            .update(
              "CRDD_DOCKER_RESTART_TRUST_V1|official-fixed-paths|Docker Inc|cache-only|deny-write-delete|optional-dev-envs",
              "ascii",
            )
            .digest("hex"),
        });
  const artifactBefore = observePlatformAccessReleaseArtifactCandidate(
    bundledDistributionRoot,
  );
  const signingObservation = beginPlatformAccessArtifactSigningObservation(
    bundledDistributionRoot,
  );
  const environment = createWindowsDockerDesktopRepairHelperEnvironment();
  if (
    !policy ||
    artifactBefore.status !== "candidate" ||
    !signingObservation ||
    !environment ||
    !sameArtifact(expectedPlatformArtifact, artifactBefore.artifact) ||
    !sameArtifact(artifactBefore.artifact, signingObservation.artifact)
  )
    return Object.freeze({ status: "unavailable", session: null });
  let child: NativeChild;
  try {
    child = spawn(
      executablePath,
      [
        protocol === "repair"
          ? "--docker-desktop-repair-helper"
          : "--docker-desktop-restart-helper",
      ],
      {
        cwd: bundledDistributionRoot,
        env: environment,
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ) as NativeChild;
  } catch {
    return Object.freeze({ status: "cleanup_unknown", session: null });
  }
  const created = createDockerDesktopRepairNativeHelperLifecycle(
    child,
    policy.policySha256,
    protocol,
  );
  const initial = await created.waitForInitial();
  const artifactAfter = observePlatformAccessReleaseArtifactCandidate(
    bundledDistributionRoot,
  );
  if (
    initial !== "R" ||
    !verifyPlatformAccessArtifactSigningObservation(signingObservation.token) ||
    artifactAfter.status !== "candidate" ||
    !sameArtifact(artifactBefore.artifact, artifactAfter.artifact)
  ) {
    if (initial === "L" || initial === "U") {
      const unavailableConfirmed = await created.waitForUnavailableExit();
      return Object.freeze({
        status: unavailableConfirmed
          ? ("unavailable" as const)
          : ("cleanup_unknown" as const),
        session: null,
      });
    }
    const released =
      initial === "R"
        ? await created.session.release()
        : await created.failProtocol();
    return Object.freeze({
      status:
        released.cleanup === "unknown"
          ? ("cleanup_unknown" as const)
          : released.protocol === "failed"
            ? ("protocol_failed" as const)
            : ("unavailable" as const),
      session: null,
    });
  }
  return Object.freeze({ status: "acquired", session: created.session });
}

export function describeDockerDesktopRepairNativeHelperContract() {
  return Object.freeze({
    implementation: "signed_platform_access_native_helper",
    protocolRevision: 4,
    lockIdentity: "global_selected_user_docker_desktop_repair_domain",
    policy: "single_signed_policy_embedded_in_native_and_read_by_runtime",
    packageUpdateExclusion: "read_handles_deny_write_and_delete_until_release",
    processTermination:
      "same_verified_kernel_process_handle_query_terminate_wait_close",
    desktopLaunch:
      "create_process_w_exact_locked_launcher_handle_identity_then_close",
    desktopLaunchEnvironment:
      "os_known_folder_and_windows_directory_minimal_unicode_block",
    pidAsTerminationAuthority: false,
    processTreeTermination: false,
    parentLoss: "stdin_eof_releases_mutex_artifact_and_process_handles",
    cancellationCleanup:
      "close_stdin_and_join_exit_child_close_and_all_stdio_within_bound",
    rawPathReported: false,
    rawProcessIdReported: false,
  });
}
