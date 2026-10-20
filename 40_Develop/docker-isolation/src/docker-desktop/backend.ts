/**
 * Docker実行backendの一覧結果を分類する。
 *
 * @responsibility Windows／WSLの詳細を下位に閉じ、稼働・停止・観測不能だけを上位へ返す。
 * @trace ARCH-000008
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createWindowsNativeHelperEnvironment } from "../../../platform-access/src/index.ts";

/**
 * 修復Ownerの要求で固定Docker Desktop backendだけを停止する。
 * @responsibility Windows実行物・引数・環境・上限と発行結果の分類を下位に閉じる。
 * @trace ARCH-000008
 * @input N/A: 任意の対象や実行設定を受け取らない。
 * @returns コマンド発行有無と終了確認。Engine停止の証明ではない。
 * @precondition 呼出し側が修復用途・意図保存・排他・直前境界・取消を確認済み。
 * @postcondition 他のWSL Distributionや全WSL停止へ拡張しない。
 * @effect 固定System32のwsl.exeへ--terminate docker-desktopを同期発行する。
 * @failure 環境欠落は未発行、発行後失敗はunknown、例外は上位へ伝播する。
 * @invariant pidを終了権限に使わず、要求発行の観測にだけ使う。
 * @boundary DI内部の修復compositionと固定Windows CLI。
 * @security 任意argv・env・実行物を公開せず、Root APIへexportしない。
 * @concurrency 15秒・16KiBの既存上限を維持し、自動再要求しない。
 */
export function terminateDockerDesktopBackendForRepair(): Readonly<{
  issued: boolean;
  confirmation: "not_issued" | "confirmed" | "unknown";
}> {
  const environment = createWindowsNativeHelperEnvironment();
  const systemRoot = environment?.SystemRoot;
  if (!environment || !systemRoot)
    return Object.freeze({ issued: false, confirmation: "not_issued" });
  const executable = path.win32.join(systemRoot, "System32", "wsl.exe");
  const result = spawnSync(executable, ["--terminate", "docker-desktop"], {
    env: environment,
    shell: false,
    windowsHide: true,
    encoding: "buffer",
    timeout: 15_000,
    maxBuffer: 16_384,
  });
  return Object.freeze({
    issued: result.pid !== undefined,
    confirmation:
      result.pid === undefined
        ? "not_issued"
        : result.status === 0 && result.signal === null && !result.error
          ? "confirmed"
          : "unknown",
  });
}

/**
 * 下位内部のWSL一覧Process結果を表す。
 *
 * @responsibility Wsl List CompletionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape WslListCompletionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant WslListCompletionで宣言した値と責務の対応を維持する。
 * @boundary N/A: WslListCompletionの宣言は外部境界を開かない。
 * @security WslListCompletionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility WslListCompletionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type WslListCompletion = Readonly<{
  status: number | null;
  signal: string | null;
  error?: unknown;
  stdout: Uint8Array;
  stderr: Uint8Array;
}>;

/**
 * 上位へ返す環境共通のbackend稼働分類を表す。
 *
 * @responsibility Docker Wsl 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRuntimeBackendStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRuntimeBackendStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRuntimeBackendStateの宣言は外部境界を開かない。
 * @security DockerRuntimeBackendStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRuntimeBackendStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRuntimeBackendState = "stopped" | "running" | "unknown";

/**
 * Distribution Listを構造化値へ解析する。
 *
 * @responsibility Distribution Listの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input result: WslListCompletion
 * @returns readonly string[] | nullを返す。
 * @precondition 「result: WslListCompletion」がparseDistributionListの入力契約を満たす。
 * @postcondition parseDistributionListの責務を完了した結果だけを返す。
 * @effect N/A: parseDistributionListは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseDistributionListは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseDistributionListは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDistributionListはProcess内の同一Subsystemで完結する。
 * @security parseDistributionListはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDistributionListは共有非同期状態を持たない同期処理である。
 */
function parseDistributionList(
  result: WslListCompletion,
): readonly string[] | null {
  if (
    result.status !== 0 ||
    result.signal !== null ||
    result.error != null ||
    !(result.stdout instanceof Uint8Array) ||
    !(result.stderr instanceof Uint8Array) ||
    result.stderr.byteLength !== 0 ||
    result.stdout.byteLength > 65_536
  )
    return null;
  const bytes = result.stdout;
  if (bytes.byteLength === 0) return [];
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || bytes.includes(0);
  if (isUtf16 && bytes.byteLength % 2 !== 0) return null;
  try {
    const text = new TextDecoder(isUtf16 ? "utf-16le" : "utf-8", {
      fatal: true,
    }).decode(bytes);
    const lines = text.replace(/\r\n/gu, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    if (
      lines.length === 0 ||
      lines.some((line) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(line))
    )
      return null;
    const foldedNames = lines.map((line) => line.toLowerCase());
    return new Set(foldedNames).size === foldedNames.length
      ? foldedNames
      : null;
  } catch {
    return null;
  }
}

/**
 * 一時点の二一覧結果を分類し、再起動完了の証明とは分ける。
 *
 * @responsibility Docker Wsl 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input registeredResult: WslListCompletion、runningResult: WslListCompletion
 * @returns DockerRuntimeBackendStateを返す。
 * @precondition 「registeredResult: WslListCompletion、runningResult: WslListCompletion」がclassifyDockerBackendListsの入力契約を満たす。
 * @postcondition classifyDockerBackendListsの責務を完了した結果だけを返す。
 * @effect N/A: classifyDockerBackendListsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure Process失敗、不正文法、登録欠落・重複・集合不整合はunknown。
 * @invariant classifyDockerBackendListsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyDockerBackendListsはProcess内の同一Subsystemで完結する。
 * @security classifyDockerBackendListsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyDockerBackendListsは共有非同期状態を持たない同期処理である。
 */
export function classifyDockerBackendLists(
  registeredResult: WslListCompletion,
  runningResult: WslListCompletion,
): DockerRuntimeBackendState {
  const registeredNames = parseDistributionList(registeredResult);
  const runningNames = parseDistributionList(runningResult);
  if (
    !registeredNames ||
    !runningNames ||
    !registeredNames.includes("docker-desktop") ||
    runningNames.some((name) => !registeredNames.includes(name))
  )
    return "unknown";
  return runningNames.includes("docker-desktop") ? "running" : "stopped";
}

/**
 * 現在のDocker backendの稼働分類を取得する。
 * @responsibility 固定Windows一覧操作を下位で構成し、失敗・未対応をunknownへ閉じる。
 * @trace ARCH-000008
 * @input N/A: 現在OSと固定実行物を観測する。
 * @returns stopped／running／unknownの一時点分類。
 * @precondition Windowsと用途固定OS環境が確認できる。
 * @postcondition WSL名・生出力・実行物Pathを上位へ返さない。
 * @effect 固定NativeのOS所在観測とwsl.exeの二つの読取り一覧操作。Docker変更・再起動・Provider依頼は行わない。
 * @failure 未対応OS、環境不能、Process失敗、不正文法はunknown。
 * @invariant stoppedをEngine停止・Process不存在・再起動完了の証明にしない。
 * @boundary 固定OS一覧操作と環境共通の状態分類。
 * @security 親環境・任意argv・任意実行物・Runtime署名Authorityを使用しない。
 * @concurrency 同期の有界観測。二つの一覧をatomic Snapshotとは扱わない。
 */
export function observeDockerRuntimeBackendState(): DockerRuntimeBackendState {
  if (process.platform !== "win32") return "unknown";
  try {
    const environment: Readonly<Record<string, string>> | null =
      createWindowsNativeHelperEnvironment();
    if (!environment?.SystemRoot) return "unknown";
    const executable = path.win32.join(
      environment.SystemRoot,
      "System32",
      "wsl.exe",
    );
    const options = {
      env: environment,
      shell: false,
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 65_536,
      encoding: "buffer" as const,
    };
    const registered = spawnSync(executable, ["--list", "--quiet"], options);
    const running = spawnSync(
      executable,
      ["--list", "--running", "--quiet"],
      options,
    );
    return classifyDockerBackendLists(registered, running);
  } catch {
    return "unknown";
  }
}
