import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  createWindowsDockerCliEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../core/windows-child-environment.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./docker-cli-trust.ts";
import type { DockerDesktopRestartNativeHelperOutcome } from "./docker-desktop-repair-native-helper.ts";
import {
  type DockerWslState,
  observeDockerWslState,
} from "./docker-wsl-state.ts";

type Session = NonNullable<DockerDesktopRestartNativeHelperOutcome["session"]>;
type MachinePorts = Readonly<{
  session: Session;
  observeWsl: () => DockerWslState;
  engineReady: () => boolean;
  containersAbsent: () => boolean;
  now: () => number;
  wait: () => Promise<void>;
  boundary?: () => boolean;
  signal?: AbortSignal;
}>;

function createMachine(ports: MachinePorts) {
  const { session } = ports;
  let stopConfirmed = false;
  let isEffectOutcomeUnknown = false;
  let abortOutcome: ReturnType<Session["abort"]> | null = null;
  let releaseOutcome: ReturnType<Session["release"]> | null = null;
  const cancel = () => {
    if (abortOutcome || releaseOutcome) return;
    // Start asynchronously so synchronous adapter failures are joined as well.
    abortOutcome = Promise.resolve()
      .then(() => session.abort())
      .catch(() => ({
        cleanup: "unknown" as const,
        protocol: "failed" as const,
      }));
  };
  ports.signal?.addEventListener("abort", cancel, { once: true });
  if (ports.signal?.aborted) cancel();
  const live = () =>
    !ports.signal?.aborted &&
    (ports.boundary?.() ?? true) &&
    session.assertLive();
  const trusted = async () =>
    live() && (await session.verifyArtifacts()) === "verified" && live();
  const stopped = async () =>
    (await trusted()) &&
    (await session.inspectClientProcesses()) === "absent" &&
    (await session.inspectProcesses()) === "absent" &&
    ports.observeWsl() === "stopped" &&
    (await trusted());
  return Object.freeze({
    getEffectOutcomeUnknown: () => isEffectOutcomeUnknown,
    observeStopped: async () => {
      stopConfirmed = await stopped();
      return stopConfirmed;
    },
    observeReady: async () =>
      (await trusted()) &&
      ports.engineReady() &&
      ports.observeWsl() === "running" &&
      (await trusted()),
    observeWslState: () => ports.observeWsl(),
    stop: async (): Promise<"stopped" | "unknown"> => {
      stopConfirmed = false;
      isEffectOutcomeUnknown = false;
      try {
        if (
          !(await trusted()) ||
          (await session.inspectClientProcesses()) !== "absent"
        )
          return "unknown";
        const processes = await session.inspectProcesses();
        if (processes === "unknown" || !live()) return "unknown";
        const beforeWsl = ports.observeWsl();
        if (
          beforeWsl === "unknown" ||
          ((beforeWsl === "running" || processes === "verified") &&
            !ports.containersAbsent()) ||
          !live()
        )
          return "unknown";
        if (processes === "verified" || beforeWsl === "running") {
          if (!(await trusted())) return "unknown";
          isEffectOutcomeUnknown = true;
          const result = await session.stopDesktop();
          if (result === "not_issued") isEffectOutcomeUnknown = false;
          if (result !== "command_completed" || !live()) return "unknown";
          // CLI completion can precede Desktop process exit. Observe, never infer it.
          const deadline = ports.now() + 30_000;
          for (let attempt = 0; attempt < 30; attempt += 1) {
            if (!live()) return "unknown";
            stopConfirmed = await stopped();
            if (stopConfirmed) {
              isEffectOutcomeUnknown = false;
              return "stopped";
            }
            if (!live() || ports.now() >= deadline || attempt === 29)
              return "unknown";
            await ports.wait();
          }
        }
        stopConfirmed = await stopped();
        if (stopConfirmed) isEffectOutcomeUnknown = false;
        return stopConfirmed ? "stopped" : "unknown";
      } catch {
        return "unknown";
      }
    },
    start: async (): Promise<"ready" | "unknown"> => {
      isEffectOutcomeUnknown = false;
      try {
        if (!stopConfirmed || !(await stopped()) || !live()) return "unknown";
        isEffectOutcomeUnknown = true;
        if ((await session.launchDesktop()) !== "started") return "unknown";
        const deadline = ports.now() + 90_000;
        for (
          let attempt = 0;
          attempt < 45 && ports.now() < deadline;
          attempt += 1
        ) {
          if (!(await trusted())) return "unknown";
          if (
            ports.engineReady() &&
            ports.observeWsl() === "running" &&
            (await trusted())
          ) {
            isEffectOutcomeUnknown = false;
            return "ready";
          }
          await ports.wait();
        }
        return "unknown";
      } catch {
        return "unknown";
      }
    },
    release: () => {
      if (releaseOutcome) return releaseOutcome;
      ports.signal?.removeEventListener("abort", cancel);
      releaseOutcome =
        abortOutcome ?? Promise.resolve().then(() => session.release());
      return releaseOutcome;
    },
  });
}

function queryWsl(kind: "registered" | "running") {
  const env = createWindowsNativeHelperEnvironment();
  if (!env?.SystemRoot) return null;
  const executable = path.win32.join(env.SystemRoot, "System32", "wsl.exe");
  return spawnSync(
    executable,
    kind === "registered"
      ? ["--list", "--quiet"]
      : ["--list", "--running", "--quiet"],
    {
      env,
      shell: false,
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 65_536,
      encoding: "buffer",
    },
  );
}

function observeWsl(): DockerWslState {
  const registered = queryWsl("registered");
  const running = queryWsl("running");
  return registered && running
    ? observeDockerWslState(registered, running)
    : "unknown";
}

export function isDockerRestartEngineReady(
  result: Readonly<{
    status: number | null;
    signal: string | null;
    error?: unknown;
    stdout: unknown;
    stderr: unknown;
  }>,
) {
  if (
    result.status !== 0 ||
    result.signal !== null ||
    result.error != null ||
    result.stderr !== "" ||
    typeof result.stdout !== "string" ||
    result.stdout.length > 16_384
  )
    return false;
  try {
    const server: unknown = JSON.parse(result.stdout);
    if (!server || typeof server !== "object" || Array.isArray(server))
      return false;
    const value = server as Record<string, unknown>;
    return (
      value.Os === "linux" &&
      typeof value.Version === "string" &&
      /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(value.Version) &&
      typeof value.ApiVersion === "string" &&
      /^1\.\d+$/u.test(value.ApiVersion) &&
      typeof value.Arch === "string" &&
      /^(?:amd64|arm64)$/u.test(value.Arch)
    );
  } catch {
    return false;
  }
}

function queryDocker(kind: "engine" | "containers") {
  try {
    const cli = observeTrustedDockerCli();
    const env = createWindowsDockerCliEnvironment({
      dockerConfig: null,
      dockerHome: null,
    });
    if (!env) return false;
    const result = spawnSync(
      cli.executablePath,
      kind === "engine"
        ? [
            "--host",
            "npipe:////./pipe/dockerDesktopLinuxEngine",
            "version",
            "--format",
            "{{json .Server}}",
          ]
        : [
            "--host",
            "npipe:////./pipe/dockerDesktopLinuxEngine",
            "container",
            "ls",
            "--quiet",
            "--no-trunc",
          ],
      {
        env,
        shell: false,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 16_384,
        encoding: "utf8",
      },
    );
    verifyTrustedDockerCliSnapshot(cli);
    return kind === "engine"
      ? isDockerRestartEngineReady(result)
      : result.status === 0 &&
          result.signal === null &&
          !result.error &&
          result.stdout === "" &&
          result.stderr === "";
  } catch {
    return false;
  }
}

/** Called only inside the signed host preparation, exclusion and durable phase boundary. */
export function createDockerRestartMachine(
  session: Session,
  boundary: () => boolean,
  signal: AbortSignal,
) {
  return createMachine({
    session,
    boundary,
    signal,
    observeWsl,
    engineReady: () => queryDocker("engine"),
    containersAbsent: () => queryDocker("containers"),
    now: Date.now,
    wait: () => new Promise((resolve) => setTimeout(resolve, 1_000)),
  });
}

/** Injected ports cannot obtain production preparation or issue production authority. */
export function createDockerRestartMachineForVerification(ports: MachinePorts) {
  return createMachine(ports);
}
