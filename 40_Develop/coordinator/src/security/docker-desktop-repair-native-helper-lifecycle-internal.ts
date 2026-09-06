import type { ChildProcessWithoutNullStreams } from "node:child_process";

const RESPONSE_BYTES = 41;
const COMMAND_TIMEOUT_MS = 60_000;
const START_TIMEOUT_MS = 30_000;
const RELEASE_TIMEOUT_MS = 5_000;
const responseMagic = Buffer.from("CRDDDR04", "ascii");

export type DockerDesktopRepairHelperReleaseOutcome = Readonly<{
  cleanup: "confirmed" | "unknown";
  protocol: "completed" | "failed" | "not_applicable";
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

function validatedStatus(frame: Buffer, expectedPolicyHash: string) {
  if (
    frame.length !== RESPONSE_BYTES ||
    !frame.subarray(0, 8).equals(responseMagic) ||
    frame.subarray(9).toString("hex") !== expectedPolicyHash
  )
    return null;
  const status = frame[8];
  return typeof status === "number" ? String.fromCharCode(status) : null;
}

export function createDockerDesktopRepairNativeHelperLifecycle(
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
  let hasFailed = false;
  let released = false;
  let isReleaseInProgress = false;
  let releaseFrameCompleted = false;
  let releaseLifecycle: Promise<DockerDesktopRepairHelperReleaseOutcome> | null =
    null;
  let isChildExitObserved = child.exitCode !== null;
  let isChildCloseObserved = false;
  let failureCleanup: Promise<boolean> | null = null;
  let resolveFailure!: () => void;
  const failureDetected = new Promise<void>((resolve) => {
    resolveFailure = resolve;
  });
  const failureListeners = new Set<() => void>();
  child.once("close", () => {
    isChildCloseObserved = true;
  });
  const waitForExitAndStdioSettlement = (timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const inspect = () => {
        const settled =
          isChildExitObserved &&
          isChildCloseObserved &&
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
      const finish = (didSucceed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(didSucceed);
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
      const finish = (didSucceed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.stdin.removeListener("error", onError);
        resolve(didSucceed);
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
    if (hasFailed) return;
    hasFailed = true;
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
  const onOwnedStdinError = () => {
    if (!released && !releaseFrameCompleted) fail();
    else void beginFailureCleanup();
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
    if (hasFailed || !Buffer.isBuffer(chunk)) return fail();
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > RESPONSE_BYTES * 2) return fail();
    while (buffer.length >= RESPONSE_BYTES) {
      const frame = Buffer.from(buffer.subarray(0, RESPONSE_BYTES));
      buffer = Buffer.from(buffer.subarray(RESPONSE_BYTES));
      deliver(frame);
    }
  });
  child.stderr.on("data", () => fail());
  // Once the exact C frame has been received, failure to close stdin affects
  // cleanup only.  stdout/stderr are the protocol evidence channels: an error
  // on either channel makes the transcript unknowable at every phase.
  child.stdin.on("error", onOwnedStdinError);
  child.stdout.on("error", fail);
  child.stderr.on("error", fail);
  child.once("error", fail);
  child.once("exit", () => {
    isChildExitObserved = true;
    if (!released && !isReleaseInProgress) fail();
  });

  const receive = (timeoutMs: number) => {
    if (frames.length > 0) return Promise.resolve(frames.shift() ?? null);
    if (hasFailed || pending) return Promise.resolve(null);
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
    if (hasFailed || released || !child.stdin.writable) return null;
    const response = receive(COMMAND_TIMEOUT_MS);
    const written = new Promise<boolean>((resolve) => {
      try {
        child.stdin.write(Buffer.from(value, "ascii"), (error) =>
          resolve(error === null || error === undefined),
        );
      } catch {
        resolve(false);
      }
    });
    const writeCompleted = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (didSucceed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(didSucceed);
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
      !hasFailed &&
      !released &&
      child.exitCode === null &&
      child.signalCode === null &&
      child.stdin.writable,
    onFailureDetected: (listener) => {
      if (hasFailed) {
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
        isReleaseInProgress = true;
        released = true;
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve(null);
          pending = null;
        }
        frames.length = 0;
        const protocol = hasFailed ? "failed" : "not_applicable";
        if (!hasFailed && !(await endStdinBounded()))
          void beginFailureCleanup();
        return joinFailedCleanup(protocol);
      })();
      return releaseLifecycle;
    },
    release: async () => {
      if (releaseLifecycle) return releaseLifecycle;
      releaseLifecycle = (async () => {
        if (
          hasFailed ||
          released ||
          isReleaseInProgress ||
          !child.stdin.writable
        )
          return joinFailedCleanup("failed");
        isReleaseInProgress = true;
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
        releaseFrameCompleted = true;
        released = true;
        const endCompleted = await endStdinBounded();
        const settled = endCompleted
          ? await waitForExitAndStdioSettlement(RELEASE_TIMEOUT_MS)
          : await beginFailureCleanup();
        const protocolCompleted =
          releaseFrameCompleted &&
          !hasFailed &&
          settled &&
          child.exitCode === 0 &&
          child.signalCode === null &&
          frames.length === 0 &&
          buffer.length === 0 &&
          pending === null;
        child.stdout.removeAllListeners();
        child.stderr.removeAllListeners();
        child.removeAllListeners();
        child.unref();
        return Object.freeze({
          cleanup: settled ? ("confirmed" as const) : ("unknown" as const),
          protocol: protocolCompleted
            ? ("completed" as const)
            : ("failed" as const),
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
      if (!hasFailed) fail();
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
