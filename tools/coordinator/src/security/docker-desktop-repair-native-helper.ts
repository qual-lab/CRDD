import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createWindowsDockerDesktopRepairHelperEnvironment } from "../core/windows-child-environment.ts";
import { observeRuntimeOwnedDockerDesktopRepairPolicy } from "./docker-desktop-repair-policy.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";

const RESPONSE_BYTES = 41;
const RESPONSE_MAGIC = Buffer.from("CRDDDR04", "ascii");
const COMMAND_TIMEOUT_MS = 60_000;
const START_TIMEOUT_MS = 30_000;
const RELEASE_TIMEOUT_MS = 5_000;
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

type NativeChild = ChildProcessWithoutNullStreams;
type SpawnFactory = typeof spawn;

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

function validatedStatus(frame: Buffer, expectedPolicyHash: string) {
  if (
    frame.length !== RESPONSE_BYTES ||
    !frame.subarray(0, 8).equals(RESPONSE_MAGIC) ||
    frame.subarray(9).toString("hex") !== expectedPolicyHash
  )
    return null;
  const status = frame[8];
  return typeof status === "number" ? String.fromCharCode(status) : null;
}

export function createDockerDesktopRepairNativeHelperSessionUsingChild(
  child: NativeChild,
  expectedPolicyHash: string,
): Readonly<{
  waitForInitial: () => Promise<string | null>;
  waitForUnavailableExit: () => Promise<boolean>;
  failProtocol: () => Promise<DockerDesktopRepairHelperReleaseOutcome>;
  session: DockerDesktopRepairNativeHelperSession;
}> {
  let buffer = Buffer.alloc(0);
  const frames: Buffer[] = [];
  let pending: Readonly<{
    resolve: (frame: Buffer | null) => void;
    timer: NodeJS.Timeout;
  }> | null = null;
  let failed = false;
  let released = false;
  let releaseInProgress = false;
  let releaseLifecycle: Promise<DockerDesktopRepairHelperReleaseOutcome> | null =
    null;
  let childExitObserved = child.exitCode !== null;
  let childCloseObserved = false;
  let failureCleanup: Promise<boolean> | null = null;
  let resolveFailure!: () => void;
  const failureDetected = new Promise<void>((resolve) => {
    resolveFailure = resolve;
  });
  const failureListeners = new Set<() => void>();
  child.once("close", () => {
    childCloseObserved = true;
  });
  const waitForExitAndStdioSettlement = (timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const inspect = () => {
        const settled =
          childExitObserved &&
          childCloseObserved &&
          (child.stdout.readableEnded || child.stdout.destroyed) &&
          (child.stderr.readableEnded || child.stderr.destroyed) &&
          (child.stdin.writableEnded || child.stdin.destroyed);
        if (settled) return resolve(true);
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(inspect, 10);
      };
      inspect();
    });
  const beginFailureCleanup = () => {
    if (failureCleanup) return failureCleanup;
    try {
      child.stdin.destroy();
    } catch {
      // The bounded settlement observer owns the remaining cleanup evidence.
    }
    failureCleanup = waitForExitAndStdioSettlement(RELEASE_TIMEOUT_MS).then(
      (settled) => {
        child.stdout.destroy();
        child.stderr.destroy();
        child.removeAllListeners();
        child.unref();
        return settled;
      },
    );
    return failureCleanup;
  };
  const boundedWrite = (value: "Q") =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => finish(false), RELEASE_TIMEOUT_MS);
      try {
        child.stdin.write(Buffer.from(value, "ascii"), (error) =>
          finish(error === null || error === undefined),
        );
      } catch {
        finish(false);
      }
      void failureDetected.then(() => finish(false));
    });
  const endStdinBounded = () =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.stdin.removeListener("error", onError);
        resolve(result);
      };
      const onError = () => finish(false);
      const timer = setTimeout(() => finish(false), RELEASE_TIMEOUT_MS);
      child.stdin.once("error", onError);
      try {
        child.stdin.end(() => finish(true));
      } catch {
        finish(false);
      }
    });
  const joinFailedCleanup = async (
    protocol: "failed" | "not_applicable",
  ): Promise<DockerDesktopRepairHelperReleaseOutcome> =>
    Object.freeze({
      cleanup: (await beginFailureCleanup()) ? "confirmed" : "unknown",
      protocol,
    });
  const fail = () => {
    if (failed) return;
    failed = true;
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(null);
      pending = null;
    }
    for (const listener of failureListeners) {
      try {
        listener();
      } catch {
        // Failure detection is monotonic; one listener cannot suppress another.
      }
    }
    failureListeners.clear();
    resolveFailure();
    void beginFailureCleanup();
  };
  const deliver = (frame: Buffer) => {
    if (pending) {
      const current = pending;
      pending = null;
      clearTimeout(current.timer);
      current.resolve(frame);
    } else frames.push(frame);
  };
  child.stdout.on("data", (chunk: Buffer) => {
    if (failed || !Buffer.isBuffer(chunk)) return fail();
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > RESPONSE_BYTES * 2) return fail();
    while (buffer.length >= RESPONSE_BYTES) {
      const frame = Buffer.from(buffer.subarray(0, RESPONSE_BYTES));
      buffer = Buffer.from(buffer.subarray(RESPONSE_BYTES));
      deliver(frame);
    }
  });
  child.stderr.on("data", () => fail());
  child.once("error", fail);
  child.once("exit", () => {
    childExitObserved = true;
    if (!released && !releaseInProgress) fail();
  });

  const receive = (timeoutMs: number) => {
    if (frames.length > 0) return Promise.resolve(frames.shift() ?? null);
    if (failed || pending) return Promise.resolve(null);
    return new Promise<Buffer | null>((resolve) => {
      const timer = setTimeout(() => {
        if (!pending) return;
        pending = null;
        resolve(null);
        fail();
      }, timeoutMs);
      pending = Object.freeze({ resolve, timer });
    });
  };
  const command = async (value: "I" | "K" | "L" | "V") => {
    if (failed || released || !child.stdin.writable) return null;
    const response = receive(COMMAND_TIMEOUT_MS);
    const written = new Promise<boolean>((resolve) => {
      child.stdin.write(Buffer.from(value, "ascii"), (error) =>
        resolve(error === null || error === undefined),
      );
    });
    const writeCompleted = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(false), COMMAND_TIMEOUT_MS);
      void written.then(finish);
      void failureDetected.then(() => finish(false));
    });
    if (!writeCompleted) {
      fail();
      return null;
    }
    const frame = await response;
    return frame ? validatedStatus(frame, expectedPolicyHash) : null;
  };
  const session: DockerDesktopRepairNativeHelperSession = Object.freeze({
    assertLive: () =>
      !failed &&
      !released &&
      child.exitCode === null &&
      child.signalCode === null &&
      child.stdin.writable,
    onFailureDetected: (listener) => {
      if (failed) {
        listener();
        return () => undefined;
      }
      failureListeners.add(listener);
      return () => failureListeners.delete(listener);
    },
    failureDetected,
    verifyArtifacts: async () =>
      (await command("V")) === "V" ? "verified" : "unknown",
    inspectProcesses: async () => {
      const status = await command("I");
      if (status === "A") return "absent";
      if (status === "V") return "verified";
      return "unknown";
    },
    terminateProcesses: async () => {
      const status = await command("K");
      if (status === "A") return "absent";
      if (status === "N") return "not_issued_unknown";
      if (status === "T") return "terminated";
      if (status === "P") return "partial_or_unknown";
      return "unknown";
    },
    launchDesktop: async () => {
      const status = await command("L");
      if (status === "N") return "not_started";
      if (status === "S") return "started";
      if (status === "P") return "partial_or_unknown";
      return "unknown";
    },
    abort: async () => {
      if (releaseLifecycle) return releaseLifecycle;
      releaseLifecycle = (async () => {
        releaseInProgress = true;
        released = true;
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve(null);
          pending = null;
        }
        frames.length = 0;
        const protocol = failed ? "failed" : "not_applicable";
        if (!failed && !(await endStdinBounded())) void beginFailureCleanup();
        return joinFailedCleanup(protocol);
      })();
      return releaseLifecycle;
    },
    release: async () => {
      if (releaseLifecycle) return releaseLifecycle;
      releaseLifecycle = (async () => {
        if (failed || released || releaseInProgress || !child.stdin.writable)
          return joinFailedCleanup("failed");
        releaseInProgress = true;
        const response = receive(RELEASE_TIMEOUT_MS);
        if (!(await boundedWrite("Q"))) {
          fail();
          return joinFailedCleanup("failed");
        }
        const frame = await response;
        if (!frame || validatedStatus(frame, expectedPolicyHash) !== "C") {
          fail();
          return joinFailedCleanup("failed");
        }
        released = true;
        const endCompleted = await endStdinBounded();
        const settled = endCompleted
          ? await waitForExitAndStdioSettlement(RELEASE_TIMEOUT_MS)
          : await beginFailureCleanup();
        child.stdout.removeAllListeners();
        child.stderr.removeAllListeners();
        child.removeAllListeners();
        child.unref();
        return Object.freeze({
          cleanup: settled ? ("confirmed" as const) : ("unknown" as const),
          protocol:
            child.exitCode === 0 ? ("completed" as const) : ("failed" as const),
        });
      })();
      return releaseLifecycle;
    },
  });
  return Object.freeze({
    waitForInitial: async () => {
      const frame = await receive(START_TIMEOUT_MS);
      return frame ? validatedStatus(frame, expectedPolicyHash) : null;
    },
    waitForUnavailableExit: async () => {
      if (!failed) fail();
      const settled = await beginFailureCleanup();
      return settled && child.exitCode === 2;
    },
    failProtocol: async () => {
      fail();
      return joinFailedCleanup("failed");
    },
    session,
  });
}

export async function acquireRuntimeOwnedDockerDesktopRepairNativeHelperUsingFactory(
  expectedPlatformArtifact: unknown,
  spawnFactory: SpawnFactory,
): Promise<DockerDesktopRepairNativeHelperOutcome> {
  if (process.platform !== "win32")
    return Object.freeze({ status: "unavailable", session: null });
  const policy = observeRuntimeOwnedDockerDesktopRepairPolicy();
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
    child = spawnFactory(executablePath, ["--docker-desktop-repair-helper"], {
      cwd: bundledDistributionRoot,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    }) as NativeChild;
  } catch {
    return Object.freeze({ status: "cleanup_unknown", session: null });
  }
  const created = createDockerDesktopRepairNativeHelperSessionUsingChild(
    child,
    policy.policySha256,
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

export function acquireRuntimeOwnedDockerDesktopRepairNativeHelper(
  expectedPlatformArtifact: unknown,
) {
  return acquireRuntimeOwnedDockerDesktopRepairNativeHelperUsingFactory(
    expectedPlatformArtifact,
    spawn,
  );
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
