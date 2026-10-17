/**
 * Docker Engineの固定用途別観測を所有する。
 * @responsibility CLI・endpoint・結果分類と観測資源回収を上位から隠す。
 * @trace ARCH-000008
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createDockerCliEnvironment } from "../execution/cli-environment.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "../execution/cli-trust.ts";

/**
 * docker-restart-machineで使用するDocker Restart Engine Observationの値契約を定義する。
 *
 * @responsibility Docker Restart Engine ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRuntimeEngineStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRuntimeEngineStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRuntimeEngineStateの宣言は外部境界を開かない。
 * @security DockerRuntimeEngineStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRuntimeEngineStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRuntimeEngineState =
  | "ready"
  | "known_unavailable"
  | "unknown";
/**
 * docker-restart-machineで使用するDocker Restart Engine Pipe Observationの値契約を定義する。
 *
 * @responsibility Docker Restart Engine Pipe ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerEnginePipeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerEnginePipeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerEnginePipeStateの宣言は外部境界を開かない。
 * @security DockerEnginePipeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerEnginePipeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerEnginePipeState = "present" | "absent" | "unknown";
/**
 * docker-restart-machineで使用するDocker Restart Engine Observation 結果の値契約を定義する。
 *
 * @responsibility Docker Restart Engine Observation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRuntimeEngineObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRuntimeEngineObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRuntimeEngineObservationの宣言は外部境界を開かない。
 * @security DockerRuntimeEngineObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRuntimeEngineObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRuntimeEngineObservation = Readonly<{
  state: DockerRuntimeEngineState;
  cleanup: "confirmed" | "unknown";
}>;
/**
 * docker-restart-machineで使用するDocker Restart Engine Pipe Observation 結果の値契約を定義する。
 *
 * @responsibility Docker Restart Engine Pipe Observation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerEnginePipeObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerEnginePipeObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerEnginePipeObservationの宣言は外部境界を開かない。
 * @security DockerEnginePipeObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerEnginePipeObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerEnginePipeObservation = Readonly<{
  state: DockerEnginePipeState;
  cleanup: "confirmed" | "unknown";
}>;
/**
 * Docker Restart Engine Readyかを判定する。
 *
 * @responsibility Docker Restart Engine Readyの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input result: Readonly<{ status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>
 * @returns isDockerEngineReadyの計算結果を返す。
 * @precondition 「result: Readonly<{ status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>」がisDockerEngineReadyの入力契約を満たす。
 * @postcondition isDockerEngineReadyの責務を完了した結果だけを返す。
 * @effect N/A: isDockerEngineReadyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDockerEngineReadyは独自の失敗分岐を所有しない。
 * @invariant isDockerEngineReadyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDockerEngineReadyはProcess内の同一Subsystemで完結する。
 * @security isDockerEngineReadyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDockerEngineReadyは共有非同期状態を持たない同期処理である。
 */
export function isDockerEngineReady(
  result: Readonly<{
    status: number | null;
    signal: string | null;
    error?: unknown;
    stdout: unknown;
    stderr: unknown;
  }>,
) {
  return (
    classifyDockerEngineResult(result, () =>
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
 * @returns DockerEnginePipeObservationを返す。
 * @precondition 「openPipe: () => number、closePipe: (handle: number) => void」がobserveDockerEnginePipeの入力契約を満たす。
 * @postcondition observeDockerEnginePipeの責務を完了した結果だけを返す。
 * @effect N/A: 既定では固定Engine endpointのopen／closeを行う。試験差替え時は指定した局所観測だけを呼ぶ。
 * @failure observeDockerEnginePipeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDockerEnginePipeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeDockerEnginePipeはProcess内の同一Subsystemで完結する。
 * @security observeDockerEnginePipeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerEnginePipeは共有非同期状態を持たない同期処理である。
 */
export function observeDockerEnginePipe(
  openPipe: () => number = () =>
    fs.openSync("\\\\.\\pipe\\dockerDesktopLinuxEngine", "r+"),
  closePipe: (handle: number) => void = (handle) => fs.closeSync(handle),
): DockerEnginePipeObservation {
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
 * docker-desktop-runtime-repairで使用するEngine Observationの値契約を定義する。
 *
 * @responsibility Engine ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRepairEngineStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRepairEngineStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRepairEngineStateの宣言は外部境界を開かない。
 * @security DockerRepairEngineStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRepairEngineStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRepairEngineState =
  | "ready"
  | "known_unavailable"
  | "transient_unavailable"
  | "startup_timeout"
  | "unknown";

export const DOCKER_ENGINE_STARTUP_WAIT_MS = 180_000;
const ENGINE_POLL_INTERVAL_MS = 1_000;

/**
 * Docker Desktop Engineを、Host操作を再発行せず期限まで再観測する。
 *
 * @responsibility 起動直後の一時的なCLI Timeoutと既知の未起動状態を、状態不明と区別して期限付きで再観測する。
 * @trace ARCH-000008
 * @input observe: Engine観測、shouldStop: 取消判定、stopDetected: 取消通知、options: 時計・待機・期限の試験差替え
 * @returns 最終的なEngine観測結果を返す。
 * @precondition observeは信頼済みDocker CLI境界の読取り観測だけを行う。
 * @postcondition ready、startup_timeout、unknownのいずれかへ期限内に収束する。
 * @effect N/A: 読取り観測とProcess内待機だけを行い、Host操作を発行しない。
 * @failure 観測不能または取消はunknown、期限超過はstartup_timeoutとして返す。
 * @invariant 再観測中にDocker Desktopの起動、停止、改名その他のHost Effectを再発行しない。
 * @boundary 信頼済みDocker CLI観測とProcess内待機の境界。
 * @security 信頼境界の変化または分類不能な失敗を一時的な未起動へ畳まない。
 * @concurrency 取消通知と待機完了を競合させ、取消後の再観測を行わない。
 */
export async function awaitDockerRepairEngineUsing(
  observe: () => DockerRepairEngineObservation["state"],
  shouldStop: () => boolean,
  stopDetected: Promise<void>,
  options: Readonly<{
    now?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }> = {},
): Promise<DockerRepairEngineState> {
  const now = options.now ?? (() => performance.now());
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const timeoutMs = options.timeoutMs ?? DOCKER_ENGINE_STARTUP_WAIT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? ENGINE_POLL_INTERVAL_MS;
  const deadline = now() + timeoutMs;
  for (;;) {
    if (shouldStop()) return "unknown";
    const observed = observe();
    if (observed === "ready") return "ready";
    if (observed === "unknown") return "unknown";
    const remaining = deadline - now();
    if (remaining <= 0) return "startup_timeout";
    await Promise.race([
      sleep(Math.min(pollIntervalMs, remaining)),
      stopDetected,
    ]);
    if (shouldStop()) return "unknown";
  }
}

/**
 * 修復時のEngine起動を固定期限・間隔で待機する。
 * @responsibility 既知の起動途中だけ再観測し、取消・不明・期限を区別する。
 * @trace ARCH-000008
 * @input observe: 読取り観測、shouldStop: 取消判定、stopDetected: 取消通知。
 * @returns Engine観測状態またはstartup_timeout。
 * @precondition 上位が技術観測のcleanup不明をstickyに保持する。
 * @postcondition 取消後に追加観測を発行しない。
 * @effect 観測callbackと固定期限180秒・間隔1秒の待機だけを行う。
 * @failure 不明はunknown、期限超過はstartup_timeout。例外は上位へ伝播する。
 * @invariant Host操作・再起動・記録保存を再発行しない。
 * @boundary Docker Engineの読取り結果と取消通知。
 * @security 任意clock・sleep・timeout設定をRoot APIへ公開しない。
 * @concurrency 取消通知と待機を競合させるが、sleep timerの取消完了までは保証しない。
 */
export function awaitDockerRepairEngine(
  observe: () => DockerRepairEngineObservation["state"],
  shouldStop: () => boolean,
  stopDetected: Promise<void>,
): Promise<DockerRepairEngineState> {
  return awaitDockerRepairEngineUsing(observe, shouldStop, stopDetected);
}

/**
 * Docker Restart Engine 結果を観測する。
 *
 * @responsibility Docker Restart Engine 結果の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input result: Readonly<{ pid?: number; status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>、observeEnginePipe: () => DockerEnginePipeObservation
 * @returns DockerRuntimeEngineObservationを返す。
 * @precondition 「result: Readonly<{ pid?: number; status: number | null; signal: string | null; error?: unknown; stdout: unknown; stderr: unknown; }>、observeEnginePipe: () => DockerEnginePipeObservation」がclassifyDockerEngineResultの入力契約を満たす。
 * @postcondition classifyDockerEngineResultの責務を完了した結果だけを返す。
 * @effect N/A: 入力を分類し、既知の未起動候補だけで固定pipe観測を呼ぶ。観測のcleanupは結果へ保持する。
 * @failure classifyDockerEngineResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant classifyDockerEngineResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyDockerEngineResultはProcess内の同一Subsystemで完結する。
 * @security classifyDockerEngineResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyDockerEngineResultは共有非同期状態を持たない同期処理である。
 */
export function classifyDockerEngineResult(
  result: Readonly<{
    pid?: number;
    status: number | null;
    signal: string | null;
    error?: unknown;
    stdout: unknown;
    stderr: unknown;
  }>,
  observeEnginePipe: () => DockerEnginePipeObservation,
): DockerRuntimeEngineObservation {
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
 * @returns DockerRuntimeEngineObservationを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveDockerRuntimeEngineの入力契約を満たす。
 * @postcondition observeDockerRuntimeEngineの責務を完了した結果だけを返す。
 * @effect observeDockerRuntimeEngineは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeDockerRuntimeEngineは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDockerRuntimeEngineは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeDockerRuntimeEngineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerRuntimeEngineは共有非同期状態を持たない同期処理である。
 */
export function observeDockerRuntimeEngine(): DockerRuntimeEngineObservation {
  if (process.platform !== "win32")
    return Object.freeze({ state: "unknown", cleanup: "confirmed" });
  try {
    const cli = observeTrustedDockerCli();
    const env = createDockerCliEnvironment({
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
    return classifyDockerEngineResult(result, observeDockerEnginePipe);
  } catch {
    return Object.freeze({ state: "unknown", cleanup: "confirmed" });
  }
}

/**
 * 修復用途のEngine状態と観測資源回収を定義する。
 * @responsibility 起動途中の一時的なTimeoutを観測不能・既知の未起動と区別する。
 * @trace ARCH-000008
 * @shape stateはready／known_unavailable／transient_unavailable／unknown、cleanupはconfirmed／unknown。
 * @invariant 観測要求の成功からDocker操作全体の成功を推定しない。
 * @boundary 値自体はOSのPath・Process・pipeを公開しない。
 * @security 観測結果から操作Authorityを発行しない。
 * @compatibility 実環境とcleanupの状態は独立して利用側へ渡す。
 */
export type DockerRepairEngineObservation = Readonly<{
  state: DockerRuntimeEngineState | "transient_unavailable";
  cleanup: "confirmed" | "unknown";
}>;

/**
 * 許可済み修復操作の構成領域を用いてEngineを観測する。
 * @responsibility 固定修復用途のCLI構成、出所・前後同一性、状態と回収結果を所有する。
 * @trace ARCH-000008
 * @input configurationRoot: 上位が検証した操作の構成領域。
 * @returns DockerRepairEngineObservation。
 * @precondition 呼出し元は対象Rootの用途と現在の操作許可を確認している。
 * @postcondition 実体や構成が不明ならreadyを返さない。
 * @effect 固定Docker CLIの読取り要求と、必要な固定pipeのopen／closeだけを行う。
 * @failure Timeoutはtransient_unavailable、その他の不明はunknown。pipe close不明はcleanup unknown。
 * @invariant config／Homeは同一Root、上限4,096 bytes、期限5秒、任意argvやambient環境を受け取らない。
 * @boundary Docker CLI・固定Engine endpoint。実体情報・生出力は返さない。
 * @security Publisherと前後Identityを確認し、許可・修復Effect・Provider依頼を発行しない。
 * @concurrency 同期観測は1回で終了し、再試行の判断は呼出し元が所有する。
 */
export function observeDockerRepairEngine(
  configurationRoot: string,
): DockerRepairEngineObservation {
  return typeof configurationRoot === "string"
    ? observeRepairEngineUsingConfiguration(configurationRoot)
    : Object.freeze({ state: "unknown", cleanup: "confirmed" });
}

/**
 * Desktop修復の読取りを固定endpoint・環境だけで行う。
 * @responsibility 旧RuntimeStateの構成領域を修復へ持ち込まない。
 * @trace ARCH-000008
 * @input N/A: 固定用途。
 * @returns Engine分類と観測資源回収。
 * @precondition 実処置許可と区別した読取りだけ。
 * @postcondition Timeoutを停止済みへ変換しない。
 * @effect 固定Docker versionと必要時のpipe観測。
 * @failure 出所・応答・close不明を保持する。
 * @invariant 4KiB・5秒・固定Linux endpoint。
 * @boundary DI内部のDesktop運用。
 * @security 任意argv・環境・設定Pathなし。Root非公開。
 * @concurrency 同期一回観測。
 */
export function observeDockerDesktopRepairEngine(): DockerRepairEngineObservation {
  return observeRepairEngineUsingConfiguration(null);
}

/**
 * 修復二用途の同じCLI観測を実行する。
 * @responsibility 明示構成の有無だけを変え、出所と分類を共用する。
 * @trace ARCH-000008
 * @input configurationRoot: 検証済み構成領域または内部固定null。
 * @returns Engine分類とcleanup。
 * @precondition 呼出しは用途固定wrapperだけ。
 * @postcondition 追加環境やendpointへfallbackしない。
 * @effect 固定CLI要求とpipe観測。
 * @failure 観測不能はunknown、pipe回収不明はcleanup unknown。
 * @invariant 要求の前後で同じ実行物を確認する。
 * @boundary 固定技術操作とDocker CLI。
 * @security ambient keyを追加しない。
 * @concurrency 5秒で一回終了。
 */
function observeRepairEngineUsingConfiguration(
  configurationRoot: string | null,
): DockerRepairEngineObservation {
  if (process.platform !== "win32")
    return Object.freeze({ state: "unknown", cleanup: "confirmed" });
  try {
    const env = createDockerCliEnvironment({
      dockerConfig: configurationRoot,
      dockerHome: configurationRoot,
    });
    if (!env) return Object.freeze({ state: "unknown", cleanup: "confirmed" });
    const cli = observeTrustedDockerCli();
    const result = spawnSync(
      cli.executablePath,
      [
        "--host",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
        ...(configurationRoot === null ? [] : ["--config", configurationRoot]),
        "version",
        "--format",
        "{{json .Server}}",
      ],
      {
        env,
        shell: false,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 4_096,
        encoding: "utf8",
      },
    );
    verifyTrustedDockerCliSnapshot(cli);
    if (isDockerEngineReady(result))
      return Object.freeze({ state: "ready", cleanup: "confirmed" });
    if (
      result.error &&
      "code" in result.error &&
      result.error.code === "ETIMEDOUT"
    )
      return Object.freeze({
        state: "transient_unavailable",
        cleanup: "confirmed",
      });
    return classifyDockerEngineResult(result, observeDockerEnginePipe);
  } catch {
    return Object.freeze({ state: "unknown", cleanup: "confirmed" });
  }
}
