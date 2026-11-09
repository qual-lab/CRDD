/**
 * 旧attachと所有Processの終端反例を試験側に保持する。
 * @responsibility 有限試験の待機・取消・終了観測を接続し製品入口へ公開しない。
 * @trace ARCH-000008
 */

import type { CommandExecution } from "../../src/execution/result.ts";
import { captureDockerProcessEnvironment } from "../../src/process/environment.ts";
import { startOwnedWindowsProcess } from "../../src/process/start.ts";

/**
 * 診断attachの実行／終了観測Handle。
 * @responsibility ready、Process結果、元Processのcloseを独立に保持する。
 * @trace ARCH-000008
 * @shape started、ready、completion、終端操作と現在close観測。
 * @invariant ready成立をProcess完了や資源不存在へ読み替えない。
 * @boundary 下位所有Processと上位診断。
 * @security Handleから別Processや別Docker操作を開始しない。
 * @compatibility 既存診断の結果fieldを維持する。
 */
export type DockerAttachedProcess = Readonly<{
  started: Promise<boolean>;
  ready: Promise<boolean>;
  completion: Promise<CommandExecution>;
  terminateAndWait: () => Promise<CommandExecution | null>;
  isClosed: () => boolean;
  getTerminationRequestCount: () => number;
}>;

/**
 * 固定単一Processだけに元PIDの観測値を付与する返却型。
 * @responsibility 他のfixtureへ汎用stdoutやPID操作を公開しない。
 * @trace ARCH-000008
 * @shape 共通Handleとready_process限定の単一PID getter。
 * @invariant PIDは観測専用で処置入力ではない。
 * @boundary 固定fixtureと試験Consumer。
 * @security 任意Script・argv・PIDを入力にしない。
 * @compatibility 既存三scenarioのHandle形状を維持する。
 */
type AttachFixtureHandle<Scenario extends string> = DockerAttachedProcess &
  (Scenario extends "ready_process"
    ? Readonly<{
        observedProcessIds: () => readonly [number] | null;
      }>
    : object);

/**
 * 固定呼出しから渡されたProcessを共通Ownerで監視する。
 * @responsibility 出力prefixの観測と終了後joinを共通Process実装へ接続する。
 * @trace ARCH-000008
 * @input executable、argv、environment: 下位固定構成。readyPrefix: 診断出力。終端環境はPlatform Accessが所有する。
 * @returns 開始・ready・結果と所有終端Handle。
 * @precondition この内部関数をPackage外へ公開しない。
 * @postcondition errorだけからclose成立を返さない。
 * @effect 固定Processを開始し、取消時に元Process停止する。
 * @failure 出力超過・観測の不正返却・close不明は成功にしない。
 * @invariant actual spawnと元Process停止は共通Ownerだけが実行する。
 * @boundary 固定実行構成とWindows所有Process。
 * @security 捕捉出力は64KiB以内、Repository環境を継承しない。
 * @concurrency ready／結果／終端を同じHandleへ結合する。
 */
function startAttached(
  executable: string,
  argv: readonly string[],
  environment: Readonly<Record<string, string>>,
  readyPrefix: string,
  observeFixtureOutput?: (value: Buffer) => void,
): DockerAttachedProcess {
  let settleReady: (value: boolean) => void = () => undefined;
  const ready = new Promise<boolean>((resolve) => {
    settleReady = resolve;
  });
  let prefix = Buffer.alloc(0);
  let termination: Promise<CommandExecution | null> | null = null;
  const handle = startOwnedWindowsProcess(executable, argv, environment, null, {
    stdoutLimitBytes: 64 * 1024,
    stderrLimitBytes: 64 * 1024,
    observeStdout: (value) => {
      const observed: unknown = observeFixtureOutput?.(value);
      if (observed !== undefined) return observed;
      if (prefix.byteLength >= Buffer.byteLength(readyPrefix)) return;
      prefix = Buffer.concat([prefix, value]).subarray(
        0,
        Buffer.byteLength(readyPrefix),
      );
      if (prefix.toString("utf8") === readyPrefix) settleReady(true);
    },
  });
  const completion = handle.wait(2_147_483_647).then((result) => {
    settleReady(false);
    return (
      result ??
      Object.freeze({
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        outputExceeded: false,
      })
    );
  });
  return Object.freeze({
    started: handle.started(5_000),
    ready,
    completion,
    terminateAndWait: () => {
      if (termination) return termination;
      termination = handle
        .terminateAndWait(5_000)
        .then(async (closed) => (closed ? await completion : null));
      return termination;
    },
    isClosed: handle.closed,
    getTerminationRequestCount: () =>
      handle.terminationRequested?.() === true ? 1 : 0,
  });
}

/**
 * 検査済みの実Container IDへ固定start attachを発行する。
 * @responsibility argvを下位で再構築し、fresh CLI確認後だけ実Processを開始する。
 * @trace ARCH-000008
 * @input binding: CLI検証と最小環境。containerId: 実ID。readyPrefix: 診断の固定出力。
 * @returns 所有attach Handle。
 * @precondition 対象IDの構成と利用Authorityは上位が観測済み。
 * @postcondition 名前や任意commandへfallbackしない。
 * @effect 固定Docker Engineへstart --attachだけを発行する。
 * @failure 不正ID・prefix・CLI照合失敗はEffect前に停止する。
 * @invariant Diagnostic意味やRecovery Stateを下位に保持しない。
 * @boundary 上位の検査済みContainerと下位Process。
 * @security shell=false、固定Engine、64KiB上限。
 * @concurrency 開始と取消を同じ所有Handleへ結合する。
 */
export function startDockerProbeAttachedProcess(
  binding: Readonly<{
    verifyCli: () => string;
    environment: () => Readonly<Record<string, string>>;
  }>,
  containerId: string,
  readyPrefix: string,
) {
  if (
    !/^[a-f0-9]{64}$/u.test(containerId) ||
    !readyPrefix ||
    Buffer.byteLength(readyPrefix) > 1024
  )
    throw new Error("docker_probe_attach_input_invalid");
  const environment = captureDockerProcessEnvironment(binding.environment());
  const executable = binding.verifyCli();
  return startAttached(
    executable,
    [
      "-H",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      "start",
      "--attach",
      containerId,
    ],
    environment,
    readyPrefix,
  );
}

/**
 * 三つの固定故障fixtureだけを所有Processへ発行する。
 * @responsibility ready待機と出力超過の試験を任意Script実行から分離する。
 * @trace ARCH-000008
 * @input scenario: 固定三故障。environment: 上位の最小環境。
 * @returns 共通Ownerのattach観測Handle。
 * @precondition 実Docker／Provider成功の根拠として使用しない。
 * @postcondition fixtureの単一子Processを同じHandleで所有する。
 * @effect 固定Node Scriptを一つ起動する。
 * @failure 未知scenarioは開始前拒否、close不明は完了しない。
 * @invariant Script本文をCallerから受け取らない。
 * @boundary 固定試験Node子Processと下位Owner。
 * @security RepositoryのScript・環境を継承しない。
 * @concurrency 通常attachと同じready／close／元Process停止を使用する。
 */
export function startOwnedAttachTerminationFixture<
  Scenario extends
    | "never_ready"
    | "ready_then_never_complete"
    | "output_overflow"
    | "ready_process",
>(
  scenario: Scenario,
  environment: Readonly<Record<string, string>>,
): AttachFixtureHandle<Scenario> {
  const sources = {
    never_ready: "setInterval(() => undefined, 1000);",
    ready_then_never_complete:
      'process.stdout.write("crdd-owned-attach-ready\\n"); setInterval(() => undefined, 1000);',
    output_overflow:
      'process.stdout.write("x".repeat(65537)); setInterval(() => undefined, 1000);',
    ready_process: String.raw`process.stdout.write("crdd-owned-attach-ready\n"+JSON.stringify([process.pid])+"\n");setInterval(()=>undefined,1000);setTimeout(()=>process.exit(99),30000);`,
  };
  if (!Object.hasOwn(sources, scenario))
    throw new Error("docker_attach_fixture_scenario_invalid");
  let observation = Buffer.alloc(0);
  let invalid = false;
  let observed: readonly [number] | null = null;
  const handle = startAttached(
    process.execPath,
    ["-e", sources[scenario]],
    captureDockerProcessEnvironment(environment),
    "crdd-owned-attach-ready\n",
    scenario === "ready_process"
      ? (value) => {
          if (invalid) return;
          observation = Buffer.concat([observation, value]);
          if (observation.byteLength > 256) {
            invalid = true;
            observed = null;
            return;
          }
          const lines = observation.toString("utf8").split("\n");
          if (lines.length < 3) return;
          if (
            lines.length !== 3 ||
            lines[0] !== "crdd-owned-attach-ready" ||
            lines[2] !== ""
          ) {
            invalid = true;
            observed = null;
            return;
          }
          try {
            const ids: unknown = JSON.parse(lines[1] ?? "");
            if (
              !Array.isArray(ids) ||
              ids.length !== 1 ||
              !ids.every((id) => Number.isSafeInteger(id) && id > 0)
            )
              throw new Error("fixture_pid_tuple_invalid");
            observed = Object.freeze([ids[0]]) as readonly [number];
          } catch {
            invalid = true;
            observed = null;
          }
        }
      : undefined,
  );
  return Object.freeze(
    scenario === "ready_process"
      ? { ...handle, observedProcessIds: () => observed }
      : handle,
  ) as AttachFixtureHandle<Scenario>;
}
