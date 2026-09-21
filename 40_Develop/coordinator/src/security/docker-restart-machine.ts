/**
 * docker-restart-machineに属する責務をまとめる。
 *
 * @responsibility Sessionを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  createWindowsDockerCliEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../core/windows-child-environment.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./docker-cli-trust.ts";
import type { DockerDesktopRestartNativeHelperOutcome } from "./docker-desktop-repair-native-process.ts";
import {
  type DockerWslState,
  observeDockerWslState,
} from "./docker-wsl-state.ts";

/**
 * docker-restart-machineで使用するSessionの値契約を定義する。
 *
 * @responsibility SessionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Sessionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sessionで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sessionの宣言は外部境界を開かない。
 * @security SessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Sessionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Session = NonNullable<DockerDesktopRestartNativeHelperOutcome["session"]>;
/**
 * docker-restart-machineで使用するDocker Restart Engine Observationの値契約を定義する。
 *
 * @responsibility Docker Restart Engine ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartEngineObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartEngineObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartEngineObservationの宣言は外部境界を開かない。
 * @security DockerRestartEngineObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartEngineObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRestartEngineObservation =
  | "ready"
  | "known_unavailable"
  | "unknown";
/**
 * docker-restart-machineで使用するDocker Restart Engine Pipe Observationの値契約を定義する。
 *
 * @responsibility Docker Restart Engine Pipe ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartEnginePipeObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartEnginePipeObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartEnginePipeObservationの宣言は外部境界を開かない。
 * @security DockerRestartEnginePipeObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartEnginePipeObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRestartEnginePipeObservation =
  | "present"
  | "absent"
  | "unknown";
/**
 * docker-restart-machineで使用するDocker Restart Engine Observation 結果の値契約を定義する。
 *
 * @responsibility Docker Restart Engine Observation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartEngineObservationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartEngineObservationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartEngineObservationResultの宣言は外部境界を開かない。
 * @security DockerRestartEngineObservationResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartEngineObservationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRestartEngineObservationResult = Readonly<{
  state: DockerRestartEngineObservation;
  cleanup: "confirmed" | "unknown";
}>;
/**
 * docker-restart-machineで使用するDocker Restart Engine Pipe Observation 結果の値契約を定義する。
 *
 * @responsibility Docker Restart Engine Pipe Observation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartEnginePipeObservationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartEnginePipeObservationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartEnginePipeObservationResultの宣言は外部境界を開かない。
 * @security DockerRestartEnginePipeObservationResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartEnginePipeObservationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRestartEnginePipeObservationResult = Readonly<{
  state: DockerRestartEnginePipeObservation;
  cleanup: "confirmed" | "unknown";
}>;
/**
 * docker-restart-machineで使用するMachine Portsの値契約を定義する。
 *
 * @responsibility Machine PortsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape MachinePortsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MachinePortsで宣言した値と責務の対応を維持する。
 * @boundary N/A: MachinePortsの宣言は外部境界を開かない。
 * @security MachinePortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility MachinePortsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type MachinePorts = Readonly<{
  session: Session;
  observeWsl: () => DockerWslState;
  observeEngine: () =>
    | DockerRestartEngineObservation
    | DockerRestartEngineObservationResult;
  containersAbsent: () => boolean;
  now: () => number;
  wait: () => Promise<void>;
  boundary?: () => boolean;
  signal?: AbortSignal;
}>;

/**
 * Machineを構築する。
 *
 * @responsibility Machineの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input ports: MachinePorts
 * @returns createMachineの計算結果を返す。
 * @precondition 「ports: MachinePorts」がcreateMachineの入力契約を満たす。
 * @postcondition createMachineの責務を完了した結果だけを返す。
 * @effect N/A: createMachineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createMachineは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createMachineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createMachineはProcess内の同一Subsystemで完結する。
 * @security createMachineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createMachineは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function createMachine(ports: MachinePorts) {
  const { session } = ports;
  let stopConfirmed = false;
  let isEffectOutcomeUnknown = false;
  let isEngineObservationCleanupUnknown = false;
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
  const observeEngine = () => {
    const observed = ports.observeEngine();
    if (typeof observed === "string") return observed;
    if (observed.cleanup === "unknown")
      isEngineObservationCleanupUnknown = true;
    return observed.state;
  };
  const stopped = async () =>
    (await trusted()) &&
    (await session.inspectClientProcesses()) === "absent" &&
    (await session.inspectProcesses()) === "absent" &&
    observeEngine() === "known_unavailable" &&
    ports.observeWsl() === "stopped" &&
    (await trusted());
  return Object.freeze({
    getEffectOutcomeUnknown: () => isEffectOutcomeUnknown,
    observeStopped: async () => {
      stopConfirmed = await stopped();
      return stopConfirmed;
    },
    observeReady: async () =>
      (await trusted()) && observeEngine() === "ready" && (await trusted()),
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
        const beforeEngine = observeEngine();
        if (
          beforeWsl === "unknown" ||
          beforeEngine === "unknown" ||
          ((beforeEngine === "ready" ||
            beforeWsl === "running" ||
            processes === "verified") &&
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
          if (observeEngine() === "ready" && (await trusted())) {
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
      const underlying =
        abortOutcome ?? Promise.resolve().then(() => session.release());
      releaseOutcome = Promise.resolve(underlying).then((outcome) =>
        isEngineObservationCleanupUnknown
          ? Object.freeze({ ...outcome, cleanup: "unknown" as const })
          : outcome,
      );
      return releaseOutcome;
    },
  });
}

/**
 * Wslを検索する。
 *
 * @responsibility Wslの検索条件、参照範囲、未検出結果境界を所有する。
 * @trace ARCH-000008
 * @input kind: "registered" | "running"
 * @returns queryWslの計算結果を返す。
 * @precondition 「kind: "registered" | "running"」がqueryWslの入力契約を満たす。
 * @postcondition queryWslの責務を完了した結果だけを返す。
 * @effect queryWslは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: queryWslは独自の失敗分岐を所有しない。
 * @invariant queryWslは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security queryWslはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: queryWslは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Wslを観測する。
 *
 * @responsibility Wslの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns DockerWslStateを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveWslの入力契約を満たす。
 * @postcondition observeWslの責務を完了した結果だけを返す。
 * @effect N/A: observeWslは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeWslは独自の失敗分岐を所有しない。
 * @invariant observeWslは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeWslはProcess内の同一Subsystemで完結する。
 * @security observeWslはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeWslは共有非同期状態を持たない同期処理である。
 */
function observeWsl(): DockerWslState {
  const registered = queryWsl("registered");
  const running = queryWsl("running");
  return registered && running
    ? observeDockerWslState(registered, running)
    : "unknown";
}

/**
 * Docker Restart Engine Readyかを判定する。
 *
 * @responsibility Docker Restart Engine Readyの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input result: Readonly<{ status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>
 * @returns isDockerRestartEngineReadyの計算結果を返す。
 * @precondition 「result: Readonly<{ status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>」がisDockerRestartEngineReadyの入力契約を満たす。
 * @postcondition isDockerRestartEngineReadyの責務を完了した結果だけを返す。
 * @effect N/A: isDockerRestartEngineReadyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDockerRestartEngineReadyは独自の失敗分岐を所有しない。
 * @invariant isDockerRestartEngineReadyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDockerRestartEngineReadyはProcess内の同一Subsystemで完結する。
 * @security isDockerRestartEngineReadyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDockerRestartEngineReadyは共有非同期状態を持たない同期処理である。
 */
export function isDockerRestartEngineReady(
  result: Readonly<{
    status: number | null;
    signal: string | null;
    error?: unknown;
    stdout: unknown;
    stderr: unknown;
  }>,
) {
  return (
    observeDockerRestartEngineResult(result, () =>
      Object.freeze({ state: "unknown", cleanup: "confirmed" }),
    ).state === "ready"
  );
}

/**
 * Docker Restart Engine Pipeを観測する。
 *
 * @responsibility Docker Restart Engine Pipeの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input openPipe: () => number、closePipe: (handle: number) => void
 * @returns DockerRestartEnginePipeObservationResultを返す。
 * @precondition 「openPipe: () => number、closePipe: (handle: number) => void」がobserveDockerRestartEnginePipeの入力契約を満たす。
 * @postcondition observeDockerRestartEnginePipeの責務を完了した結果だけを返す。
 * @effect N/A: observeDockerRestartEnginePipeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeDockerRestartEnginePipeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDockerRestartEnginePipeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeDockerRestartEnginePipeはProcess内の同一Subsystemで完結する。
 * @security observeDockerRestartEnginePipeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerRestartEnginePipeは共有非同期状態を持たない同期処理である。
 */
export function observeDockerRestartEnginePipe(
  openPipe: () => number = () =>
    fs.openSync("\\\\.\\pipe\\dockerDesktopLinuxEngine", "r+"),
  closePipe: (handle: number) => void = (handle) => fs.closeSync(handle),
): DockerRestartEnginePipeObservationResult {
  let handle: number;
  try {
    handle = openPipe();
  } catch (error) {
    return Object.freeze({
      state:
        error instanceof Error && "code" in error && error.code === "ENOENT"
          ? "absent"
          : "unknown",
      cleanup: "confirmed",
    });
  }
  try {
    closePipe(handle);
    return Object.freeze({ state: "present", cleanup: "confirmed" });
  } catch {
    return Object.freeze({ state: "unknown", cleanup: "unknown" });
  }
}

/**
 * Docker Restart Engine 結果を観測する。
 *
 * @responsibility Docker Restart Engine 結果の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input result: Readonly<{ pid?: number; status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>、observeEnginePipe: () => DockerRestartEnginePipeObservationResult
 * @returns DockerRestartEngineObservationResultを返す。
 * @precondition 「result: Readonly<{ pid?: number; status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>、observeEnginePipe: () => DockerRestartEnginePipeObservationResult」がobserveDockerRestartEngineResultの入力契約を満たす。
 * @postcondition observeDockerRestartEngineResultの責務を完了した結果だけを返す。
 * @effect N/A: observeDockerRestartEngineResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeDockerRestartEngineResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDockerRestartEngineResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeDockerRestartEngineResultはProcess内の同一Subsystemで完結する。
 * @security observeDockerRestartEngineResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerRestartEngineResultは共有非同期状態を持たない同期処理である。
 */
export function observeDockerRestartEngineResult(
  result: Readonly<{
    pid?: number;
    status: number | null;
    signal: string | null;
    error?: unknown;
    stdout: unknown;
    stderr: unknown;
  }>,
  observeEnginePipe: () => DockerRestartEnginePipeObservationResult,
): DockerRestartEngineObservationResult {
  if (
    result.status === 0 &&
    result.signal === null &&
    result.error == null &&
    result.stderr === "" &&
    typeof result.stdout === "string" &&
    result.stdout.length <= 16_384
  )
    try {
      const server: unknown = JSON.parse(result.stdout);
      if (!server || typeof server !== "object" || Array.isArray(server))
        return Object.freeze({ state: "unknown", cleanup: "confirmed" });
      const value = server as Record<string, unknown>;
      return value.Os === "linux" &&
        typeof value.Version === "string" &&
        /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(value.Version) &&
        typeof value.ApiVersion === "string" &&
        /^1\.\d+$/u.test(value.ApiVersion) &&
        typeof value.Arch === "string" &&
        /^(?:amd64|arm64)$/u.test(value.Arch)
        ? Object.freeze({ state: "ready", cleanup: "confirmed" })
        : Object.freeze({ state: "unknown", cleanup: "confirmed" });
    } catch {
      return Object.freeze({ state: "unknown", cleanup: "confirmed" });
    }
  if (
    result.pid === undefined ||
    result.error != null ||
    result.signal !== null ||
    result.status === null ||
    result.status === 0 ||
    typeof result.stdout !== "string" ||
    !["", "\n", "\r\n", "null", "null\n", "null\r\n"].includes(result.stdout)
  )
    return Object.freeze({ state: "unknown", cleanup: "confirmed" });
  const pipe = observeEnginePipe();
  return Object.freeze({
    state: pipe.state === "absent" ? "known_unavailable" : "unknown",
    cleanup: pipe.cleanup,
  });
}

/**
 * Docker Engineを検索する。
 *
 * @responsibility Docker Engineの検索条件、参照範囲、未検出結果境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns DockerRestartEngineObservationResultを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がqueryDockerEngineの入力契約を満たす。
 * @postcondition queryDockerEngineの責務を完了した結果だけを返す。
 * @effect queryDockerEngineは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure queryDockerEngineは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant queryDockerEngineは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security queryDockerEngineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: queryDockerEngineは共有非同期状態を持たない同期処理である。
 */
function queryDockerEngine(): DockerRestartEngineObservationResult {
  try {
    const cli = observeTrustedDockerCli();
    const env = createWindowsDockerCliEnvironment({
      dockerConfig: null,
      dockerHome: null,
    });
    if (!env) return Object.freeze({ state: "unknown", cleanup: "confirmed" });
    const result = spawnSync(
      cli.executablePath,
      [
        "--host",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
        "version",
        "--format",
        "{{json .Server}}",
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
    return observeDockerRestartEngineResult(
      result,
      observeDockerRestartEnginePipe,
    );
  } catch {
    return Object.freeze({ state: "unknown", cleanup: "confirmed" });
  }
}

/**
 * Containers Absentを検索する。
 *
 * @responsibility Containers Absentの検索条件、参照範囲、未検出結果境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns queryContainersAbsentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がqueryContainersAbsentの入力契約を満たす。
 * @postcondition queryContainersAbsentの責務を完了した結果だけを返す。
 * @effect queryContainersAbsentは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure queryContainersAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant queryContainersAbsentは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security queryContainersAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: queryContainersAbsentは共有非同期状態を持たない同期処理である。
 */
function queryContainersAbsent() {
  try {
    const cli = observeTrustedDockerCli();
    const env = createWindowsDockerCliEnvironment({
      dockerConfig: null,
      dockerHome: null,
    });
    if (!env) return false;
    const result = spawnSync(
      cli.executablePath,
      [
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
    return (
      result.status === 0 &&
      result.signal === null &&
      !result.error &&
      result.stdout === "" &&
      result.stderr === ""
    );
  } catch {
    return false;
  }
}

/**
 * Called only inside the signed host preparation, exclusion and durable phase boundary.
 *
 * @responsibility Docker Restart Machineの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input session: Session、boundary: () => boolean、signal: AbortSignal
 * @returns createDockerRestartMachineの計算結果を返す。
 * @precondition 「session: Session、boundary: () => boolean、signal: AbortSignal」がcreateDockerRestartMachineの入力契約を満たす。
 * @postcondition createDockerRestartMachineの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartMachineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDockerRestartMachineは独自の失敗分岐を所有しない。
 * @invariant createDockerRestartMachineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartMachineはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartMachineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createDockerRestartMachineは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
    observeEngine: queryDockerEngine,
    containersAbsent: queryContainersAbsent,
    now: Date.now,
    wait: () => new Promise((resolve) => setTimeout(resolve, 1_000)),
  });
}

/**
 * Injected ports cannot obtain production preparation or issue production authority.
 *
 * @responsibility Docker Restart Machine For Verificationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input ports: MachinePorts
 * @returns createDockerRestartMachineForVerificationの計算結果を返す。
 * @precondition 「ports: MachinePorts」がcreateDockerRestartMachineForVerificationの入力契約を満たす。
 * @postcondition createDockerRestartMachineForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartMachineForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDockerRestartMachineForVerificationは独自の失敗分岐を所有しない。
 * @invariant createDockerRestartMachineForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartMachineForVerificationはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartMachineForVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerRestartMachineForVerificationは共有非同期状態を持たない同期処理である。
 */
export function createDockerRestartMachineForVerification(ports: MachinePorts) {
  return createMachine(ports);
}
