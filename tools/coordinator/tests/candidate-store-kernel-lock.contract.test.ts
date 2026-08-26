import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { EventEmitter, once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireInteractiveConsoleKernelLockOutcomeUsingFactory,
  acquireHostOperationSupervisorLockUsingFactory,
  acquireRuntimeOwnedCandidateStoreKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedHostOperationSupervisorLock,
  acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome,
  describeCandidateStoreKernelLockContract,
} from "../src/security/candidate-store-kernel-lock.ts";

const FAST_SUPERVISOR_TIMING = Object.freeze({
  acquireTimeoutMs: 10,
  releaseTimeoutMs: 10,
});

async function acquireInteractiveConsoleLockForConcurrentTestRun() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const outcome =
      await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
    if (outcome.status !== "unavailable") return outcome;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
}

function supervisorChildScenario(
  scenario:
    | "normal"
    | "acquire_timeout_terminated"
    | "acquire_timeout_unconfirmed"
    | "ready_malformed"
    | "ready_exit"
    | "released_without_exit"
    | "exit_without_released"
    | "release_nonzero_exit",
) {
  let captured: Readonly<{
    executable: string;
    args: readonly string[];
    options: unknown;
  }> | null = null;
  const factory = (
    executable: string,
    args: readonly string[],
    options: unknown,
  ) => {
    captured = Object.freeze({ executable, args, options });
    const child = new EventEmitter() as EventEmitter & {
      connected: boolean;
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
      channel: Readonly<{ unref: () => void }>;
      send: (message: unknown) => boolean;
      kill: () => boolean;
      unref: () => void;
    };
    child.connected = true;
    child.exitCode = null;
    child.signalCode = null;
    child.channel = Object.freeze({ unref: () => undefined });
    child.unref = () => undefined;
    const exit = (code: number) => {
      if (child.exitCode !== null) return;
      child.exitCode = code;
      child.connected = false;
      child.emit("exit", code, null);
    };
    child.kill = () => {
      if (scenario !== "acquire_timeout_unconfirmed")
        queueMicrotask(() => exit(1));
      return true;
    };
    child.send = (message) => {
      if (message === "confirm-ready") {
        if (scenario === "ready_malformed")
          queueMicrotask(() => child.emit("message", { status: "wrong" }));
        else if (scenario === "ready_exit") queueMicrotask(() => exit(1));
        else queueMicrotask(() => child.emit("message", { status: "ready" }));
      } else if (message === "release") {
        if (scenario === "released_without_exit")
          queueMicrotask(() => child.emit("message", { status: "released" }));
        else if (scenario === "exit_without_released")
          queueMicrotask(() => exit(0));
        else if (scenario === "release_nonzero_exit")
          queueMicrotask(() => {
            child.emit("message", { status: "released" });
            exit(1);
          });
        else
          queueMicrotask(() => {
            child.emit("message", { status: "released" });
            exit(0);
          });
      }
      return true;
    };
    if (!scenario.startsWith("acquire_timeout"))
      queueMicrotask(() => child.emit("message", { status: "acquired" }));
    return child as unknown as ReturnType<typeof spawn>;
  };
  return Object.freeze({ factory, captured: () => captured });
}

function interactiveLockWorkerScenario(initialState: 1 | -1) {
  const listeners = new Map<string, (value: unknown) => void>();
  return Object.freeze({
    factory: (_pipeName: string, sharedState: SharedArrayBuffer) => {
      const state = new Int32Array(sharedState);
      Atomics.store(state, 0, initialState);
      Atomics.notify(state, 0);
      return Object.freeze({
        unref: () => undefined,
        postMessage: () => {
          Atomics.store(state, 0, 2);
          Atomics.notify(state, 0);
          queueMicrotask(() => listeners.get("exit")?.(0));
        },
        terminate: async () => {
          queueMicrotask(() => listeners.get("exit")?.(0));
          return 0;
        },
        once: (event: "error" | "exit", listener: (value: never) => void) => {
          listeners.set(event, listener as (value: unknown) => void);
        },
      });
    },
  });
}

test("Windows kernel lockは不正Identity、同時取得と二重releaseを拒否する", () => {
  assert.equal(acquireRuntimeOwnedCandidateStoreKernelLock("invalid"), null);
  if (process.platform !== "win32") return;
  const protectionHash = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
  const first = acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash);
  assert.ok(first);
  assert.equal(
    acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash),
    null,
  );
  assert.equal(first.release(), true);
  assert.equal(first.release(), false);
  const next = acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash);
  assert.ok(next);
  assert.equal(next.release(), true);
});

test("Host Operation lock Supervisorは往復、競合とexit確認済みreleaseを固定する", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = `crdd-coordinator-doctor-${randomBytes(6).toString("hex")}`;
  const nonce = randomBytes(16).toString("hex");
  const outcome = await acquireRuntimeOwnedHostOperationSupervisorLock(
    rootName,
    nonce,
  );
  assert.equal(outcome.status, "acquired");
  assert.ok(outcome.lock);
  assert.equal(await outcome.lock.confirmReady(), "ready");
  assert.equal(
    (await acquireRuntimeOwnedHostOperationSupervisorLock(rootName, nonce))
      .status,
    "unavailable",
  );
  assert.equal(await outcome.lock.release(), "released");
  assert.equal(await outcome.lock.confirmReady(), "cleanup_confirmed_failure");
  const next = await acquireRuntimeOwnedHostOperationSupervisorLock(
    rootName,
    nonce,
  );
  assert.equal(next.status, "acquired");
  assert.ok(next.lock);
  assert.equal(await next.lock.release(), "released");
});

test("Host Operation Supervisorは固定spawn Profileと異常状態を構造化する", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-SCENARIO";
  const nonce = "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff";
  const normal = supervisorChildScenario("normal");
  const acquired = await acquireHostOperationSupervisorLockUsingFactory(
    rootName,
    nonce,
    normal.factory,
    FAST_SUPERVISOR_TIMING,
  );
  assert.equal(acquired.status, "acquired");
  assert.ok(acquired.lock);
  assert.equal(await acquired.lock.confirmReady(), "ready");
  assert.equal(await acquired.lock.release(), "released");
  const spawnProfile = normal.captured();
  assert.ok(spawnProfile);
  assert.equal(spawnProfile.executable, process.execPath);
  assert.equal(spawnProfile.args.length, 2);
  assert.equal(
    path.basename(spawnProfile.args[0] ?? ""),
    "host-operation-lock-supervisor.ts",
  );
  const options = spawnProfile.options as Record<string, unknown>;
  assert.equal(options.shell, false);
  assert.equal(options.windowsHide, true);
  assert.deepEqual(options.stdio, ["ignore", "ignore", "ignore", "ipc"]);
  const environment = options.env as Record<string, string>;
  for (const name of [
    "PATH",
    "HOME",
    "USERPROFILE",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "GIT_ASKPASS",
    "NODE_OPTIONS",
    "NODE_PATH",
  ])
    assert.equal(environment[name], "");
  assert.equal(typeof environment.SystemRoot, "string");
  assert.equal(environment.WINDIR, environment.SystemRoot);

  for (const scenario of ["ready_malformed", "ready_exit"] as const) {
    const candidate = supervisorChildScenario(scenario);
    const outcome = await acquireHostOperationSupervisorLockUsingFactory(
      rootName,
      `${nonce.slice(0, -1)}${scenario === "ready_malformed" ? "1" : "2"}`,
      candidate.factory,
      FAST_SUPERVISOR_TIMING,
    );
    assert.equal(outcome.status, "acquired");
    assert.ok(outcome.lock);
    assert.equal(
      await outcome.lock.confirmReady(),
      "cleanup_confirmed_failure",
    );
  }

  for (const scenario of [
    "released_without_exit",
    "exit_without_released",
    "release_nonzero_exit",
  ] as const) {
    const candidate = supervisorChildScenario(scenario);
    const outcome = await acquireHostOperationSupervisorLockUsingFactory(
      rootName,
      `${nonce.slice(0, -1)}${scenario.length % 10}`,
      candidate.factory,
      FAST_SUPERVISOR_TIMING,
    );
    assert.equal(outcome.status, "acquired");
    assert.ok(outcome.lock);
    assert.equal(await outcome.lock.release(), "cleanup_confirmed_failure");
  }
});

test("Host Operation Supervisorはterminate未確認だけをcleanup不明にする", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-TIMEOUT";
  const nonce = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
  const terminated = supervisorChildScenario("acquire_timeout_terminated");
  assert.equal(
    (
      await acquireHostOperationSupervisorLockUsingFactory(
        rootName,
        nonce,
        terminated.factory,
        FAST_SUPERVISOR_TIMING,
      )
    ).status,
    "cleanup_confirmed_failure",
  );
  const unconfirmed = supervisorChildScenario("acquire_timeout_unconfirmed");
  const unknown = await acquireHostOperationSupervisorLockUsingFactory(
    rootName,
    `${nonce.slice(0, -1)}1`,
    unconfirmed.factory,
    FAST_SUPERVISOR_TIMING,
  );
  assert.equal(unknown.status, "cleanup_unknown");
  assert.ok(unknown.lock);
  assert.equal(await unknown.lock.release(), "cleanup_unknown");
});

test("Host Operation Supervisor entrypointはexact argvとIPCなしでlistenしない", () => {
  const entrypoint = fileURLToPath(
    new URL(
      "../src/security/host-operation-lock-supervisor.ts",
      import.meta.url,
    ),
  );
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${"a".repeat(32)}`;
  for (const args of [
    [entrypoint, pipeName],
    [entrypoint, pipeName, "extra"],
  ]) {
    const result = spawnSync(process.execPath, args, {
      env: {},
      shell: false,
      windowsHide: true,
      encoding: "utf8",
      timeout: 5_000,
    });
    assert.equal(result.status, 64);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
});

test("Windows対話Console lockは同時承認readerを一つへ限定する", async () => {
  if (process.platform !== "win32") return;
  const first = await acquireInteractiveConsoleLockForConcurrentTestRun();
  assert.equal(first.status, "acquired");
  assert.ok(first.lock);
  const competing =
    await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
  assert.equal(competing.status, "unavailable");
  assert.equal(await first.lock.release(), "released");
  const next = await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
  assert.equal(next.status, "acquired");
  assert.ok(next.lock);
  assert.equal(await next.lock.release(), "released");
});

test("Windows対話Console lockは独立Processをrelease完了まで存続させる", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const fixture = fileURLToPath(
    new URL("./fixtures/interactive-console-lock-liveness.ts", import.meta.url),
  );
  const child = spawn(process.execPath, [fixture], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
  const [code, signal] = (await once(child, "exit")) as [
    number | null,
    NodeJS.Signals | null,
  ];
  assert.equal(signal, null);
  assert.equal(code, 0, Buffer.concat(stderr).toString("utf8"));
  assert.equal(Buffer.concat(stdout).toString("utf8"), "LOCK_RELEASED\n");
});

test("対話Console専用lockは終了確認済み非取得とcleanup不明を分離する", async () => {
  if (process.platform !== "win32") return;
  const unavailable =
    await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
      interactiveLockWorkerScenario(-1).factory,
    );
  assert.deepEqual(unavailable, { status: "unavailable", lock: null });

  const acquired = await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
    interactiveLockWorkerScenario(1).factory,
  );
  assert.equal(acquired.status, "acquired");
  assert.ok(acquired.lock);
  assert.equal(await acquired.lock.release(), "released");

  const timedOut = await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
    () =>
      Object.freeze({
        unref: () => undefined,
        postMessage: () => undefined,
        terminate: async () => 0,
        once: () => undefined,
      }),
  );
  assert.deepEqual(timedOut, { status: "cleanup_unknown", lock: null });
});

test("対話Console専用lockの非同期cleanup契約は共通同期lockの意味を変更しない", () => {
  const contract = describeCandidateStoreKernelLockContract();
  assert.equal(
    contract.interactiveConsoleLock,
    "dedicated_async_acquire_and_release_with_state_and_worker_exit_confirmation",
  );
  assert.deepEqual(contract.interactiveConsoleOutcomes, [
    "acquired",
    "unavailable",
    "cleanup_unknown_process_restart_required",
  ]);
  assert.equal(
    contract.interactiveConsoleWorkerKeepsProcessAliveUntilRelease,
    true,
  );
  assert.equal(contract.commonSynchronousLockMeaningChanged, false);
  assert.equal(
    contract.hostOperationCrossBoundaryReadiness,
    "dedicated_supervisor_process_round_trip_and_exit_confirmed_release_before_console_or_child_process",
  );
  assert.deepEqual(contract.hostOperationSupervisorOutcomes, [
    "acquired",
    "unavailable",
    "cleanup_confirmed_failure",
    "cleanup_unknown_process_restart_required",
  ]);
});

test("Host Operation owner lockはprocess世代をまたぐ同時取得を拒否し強制終了後に回復する", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-ABC123";
  const nonce = "11111111-2222-4333-8444-555555555555";
  const child = spawn(
    process.execPath,
    [fileURLToPath(ownerFixture), "host", rootName, nonce],
    {
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  context.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let stdout = "";
  while (!stdout.includes("READY\n")) {
    const [chunk] = (await once(child.stdout, "data")) as [Buffer];
    stdout += chunk.toString("utf8");
  }
  assert.equal(
    acquireRuntimeOwnedHostOperationKernelLock(rootName, nonce),
    null,
  );
  assert.equal(child.kill(), true);
  await once(child, "exit");
  const recovered = acquireRuntimeOwnedHostOperationKernelLock(rootName, nonce);
  assert.ok(recovered);
  assert.equal(recovered.release(), true);
});

test("Host Operation Supervisorは親process強制終了後にlockをkernelに残さない", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-SUP123";
  const nonce = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const child = spawn(
    process.execPath,
    [fileURLToPath(ownerFixture), "host-supervisor", rootName, nonce],
    {
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  context.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let stdout = "";
  while (!stdout.includes("READY\n")) {
    const [chunk] = (await once(child.stdout, "data")) as [Buffer];
    stdout += chunk.toString("utf8");
  }
  assert.equal(
    (await acquireRuntimeOwnedHostOperationSupervisorLock(rootName, nonce))
      .status,
    "unavailable",
  );
  assert.equal(child.kill(), true);
  await once(child, "exit");
  const recovered = await acquireRuntimeOwnedHostOperationSupervisorLock(
    rootName,
    nonce,
  );
  assert.equal(recovered.status, "acquired");
  assert.ok(recovered.lock);
  assert.equal(await recovered.lock.release(), "released");
});

const ownerFixture = new URL(
  "./fixtures/candidate-store-lock-owner.ts",
  import.meta.url,
);

test("Windows kernel lockはowner process強制終了後にstale residueなしで再取得できる", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const protectionHash = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
  const child = spawn(
    process.execPath,
    [fileURLToPath(ownerFixture), protectionHash],
    {
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  context.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let stdout = "";
  while (!stdout.includes("READY\n")) {
    const [chunk] = (await once(child.stdout, "data")) as [Buffer];
    stdout += chunk.toString("utf8");
  }
  assert.equal(
    acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash),
    null,
  );
  assert.equal(child.kill(), true);
  await once(child, "exit");
  const recovered = acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash);
  assert.ok(recovered);
  assert.equal(recovered.release(), true);
});
