/**
 * 固定Runtimeの準備、署名、昇格および終了処理を一つの端末所有権で実行する。
 *
 * @packageDocumentation
 * @responsibility Release Runtimeの一時所有権を公開CLIの終了まで保持する。
 * @trace ARCH-000004
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyRepositoryRoot } from "../../version-control/src/index.ts";
import {
  prepareReleaseRuntime,
  recoverAppliedReleaseRuntimePreparation,
  releaseReleaseRuntimePreparation,
} from "./prepare-release-runtime.ts";
import { main as signReleaseManifest } from "./sign-release-manifest.ts";
import { runReleaseTerminalCommand } from "./sign-release-terminal.ts";

export const RELEASE_CANDIDATE_PREPARATION_CONTRACT =
  "crdd-coordinator/release-candidate-preparation";
export const RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION = 2;

const COMMIT = /^[a-f0-9]{40}$/u;
const TREE = /^[a-f0-9]{40}$/u;
const OPERATION_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const PROMOTION_TIMEOUT_MS = 5 * 60 * 1000;
const VALUE_ARGUMENTS = new Set([
  "--crdd-version",
  "--release-sequence",
  "--crdd-commit",
  "--crdd-tree",
  "--private-key",
  "--valid-for-days",
  "--operation-id",
  "--operation-identity",
]);
const FLAG_ARGUMENTS = new Set(["--no-expiry"]);
const requiredValueArguments = [
  "--crdd-version",
  "--release-sequence",
  "--crdd-commit",
  "--crdd-tree",
  "--operation-id",
  "--operation-identity",
] as const;

/**
 * Effect前検証を通過した公開Release引数を表す。
 *
 * @responsibility 固定Git IdentityとSignerへ渡す非秘密引数を結合する。
 * @trace ARCH-000004
 * @shape commit、tree、呼出し側が保持するoperationId／identityと署名専用signerArgumentsから成る。
 * @invariant commitとtreeは小文字40桁hexであり、Signer引数と一致する。
 * @boundary 公開CLI ParserとRelease Lifecycleの間だけで利用する。
 * @security passphrase値を保持せず、操作識別子をSignerへ渡さない。秘密鍵はPath指定だけを含み得る。
 * @compatibility contract revision 2の公開引数文法へ対応する。
 */
type ParsedReleaseCandidateArguments = Readonly<{
  commit: string;
  tree: string;
  operationId: string;
  identity: string;
  signerArguments: readonly string[];
}>;

/**
 * 固定Node昇格Processの終了観測を表す。
 *
 * @responsibility status、signalおよび起動・timeout Errorの相関を保持する。
 * @trace ARCH-000004
 * @shape spawnSyncのstatus、signalおよびoptional errorから成る。
 * @invariant statusだけから成功を推定せず、signalとerrorも共同評価する。
 * @boundary Node child_process AdapterとRelease Lifecycleの間で利用する。
 * @security Process出力や秘密値を複製しない。
 * @compatibility Node SpawnSyncReturnsの必要部分だけを安定契約とする。
 */
type PromotionResult = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error | undefined;
}>;

/**
 * Release Lifecycleが利用する四つの外部境界を表す。
 *
 * @responsibility Runtime準備・終了、SignerおよびPromotion Adapterを注入可能にする。
 * @trace ARCH-000004
 * @shape prepareRuntime、releaseRuntime、runSignerおよびrunPromotionから成る。
 * @invariant Productionは既存所有Moduleと固定Promotion Adapterだけを結合する。
 * @boundary Release LifecycleからRuntime Data、Signer、子Processへの境界。
 * @security Test BindingはAuthorityを発行せず、Production Bindingの意味を拡張しない。
 * @compatibility 各所有Moduleの現行公開Signatureへ一致する。
 */
type LifecycleBindings = Readonly<{
  prepareRuntime: typeof prepareReleaseRuntime;
  releaseRuntime: typeof releaseReleaseRuntimePreparation;
  runSigner: (args: readonly string[]) => Promise<void>;
  runPromotion: (
    workDirectory: string,
    repositoryRoot: string,
  ) => PromotionResult;
}>;

/**
 * 公開引数を重複のない値引数とFlagへ分離する。
 *
 * @responsibility 公開CLI引数の語彙、重複および値境界を所有する。
 * @trace ARCH-000004
 * @input args: 公開CLIから受け取った非秘密引数。
 * @returns 文法に適合する引数Map、または不適合時にnullを返す。
 * @precondition argsは外部入力であり、妥当性を仮定しない。
 * @postcondition 未知引数、重複または欠損値を受理しない。
 * @effect N/A: 入力と局所値だけを扱う。
 * @failure 不正文法は例外にせずnullへ閉じる。
 * @invariant 秘密値を生成、保存または表示しない。
 * @boundary 公開CLIとProcess内引数解析の境界。
 * @security 未知引数を下位署名処理へ搬送しない。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function argumentMap(args: readonly string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (!name || (!VALUE_ARGUMENTS.has(name) && !FLAG_ARGUMENTS.has(name))) {
      return null;
    }
    if (values.has(name) || flags.has(name)) return null;
    if (FLAG_ARGUMENTS.has(name)) {
      flags.add(name);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) return null;
    values.set(name, value);
    index += 1;
  }
  return { values, flags };
}

/**
 * 公開CLIの非秘密引数をEffect前に閉じた文法で検証する。
 *
 * @responsibility 固定Commit/Treeと署名条件の公開入力契約を所有する。
 * @trace ARCH-000004
 * @input args: 公開CLIから受け取った非秘密引数。
 * @returns 固定Identityと署名引数、または不正時にnullを返す。
 * @precondition argsは外部入力であり、妥当性を仮定しない。
 * @postcondition repository rootやcandidate名を公開入力として受理しない。
 * @effect N/A: 外部Effectを発行しない。
 * @failure 不正値を署名またはRuntime準備へ到達させない。
 * @invariant CommitとTreeは小文字40桁hexのまま保持する。
 * @boundary 公開CLIとRelease Runtime Lifecycleの境界。
 * @security 秘密鍵Path以外の秘密値を引数として受理しない。
 * @concurrency N/A: 同期的な入力検証である。
 */
export function parseReleaseCandidateArguments(
  args: readonly string[],
): ParsedReleaseCandidateArguments | null {
  const parsed = argumentMap(args);
  if (!parsed) return null;
  if (requiredValueArguments.some((name) => !parsed.values.has(name))) {
    return null;
  }
  const hasDays = parsed.values.has("--valid-for-days");
  const hasNoExpiry = parsed.flags.has("--no-expiry");
  if (hasDays === hasNoExpiry) return null;
  const commit = parsed.values.get("--crdd-commit") ?? "";
  const tree = parsed.values.get("--crdd-tree") ?? "";
  const operationId = parsed.values.get("--operation-id") ?? "";
  const identity = parsed.values.get("--operation-identity") ?? "";
  if (!COMMIT.test(commit) || !TREE.test(tree)) return null;
  if (
    !OPERATION_IDENTITY.test(operationId) ||
    !OPERATION_IDENTITY.test(identity)
  )
    return null;
  const signerArguments: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (
      args[index] === "--operation-id" ||
      args[index] === "--operation-identity"
    ) {
      index += 1;
      continue;
    }
    const argument = args[index];
    if (argument === undefined) return null;
    signerArguments.push(argument);
  }
  return Object.freeze({
    commit,
    tree,
    operationId,
    identity,
    signerArguments: Object.freeze(signerArguments),
  });
}

/**
 * 端末検証済み署名引数の配布Rootだけを準備済みworkへ結合する。
 *
 * @responsibility 同じRuntime Snapshotを署名へ渡す引数変換を所有する。
 * @trace ARCH-000004
 * @input args: 端末Helperが検証・正規化した署名引数、workDirectory: 準備済みRoot。
 * @returns 配布Rootだけを差し替えた新しい引数列を返す。
 * @precondition argsはdistribution-rootをexactに一つ持つ。
 * @postcondition 元の配列を変更せず、その他の引数を保持する。
 * @effect N/A: 引数の局所コピーだけを扱う。
 * @failure distribution-root欠損時は署名前に停止する。
 * @invariant Commit、Treeおよび署名条件を変更しない。
 * @boundary Runtime Data所有RootとSigner入力の境界。
 * @security workDirectoryを診断出力へ含めない。
 * @concurrency N/A: 同期的な局所変換である。
 */
function replaceDistributionRoot(
  args: readonly string[],
  workDirectory: string,
) {
  const index = args.indexOf("--distribution-root");
  if (index < 0 || index + 1 >= args.length) {
    throw new Error("release_candidate_distribution_root_missing");
  }
  const replacedEntries = [...args];
  replacedEntries[index + 1] = workDirectory;
  return replacedEntries;
}

/**
 * cleanupを主張できない失敗へexact回復参照を結合する。
 *
 * @responsibility 保持されたOperationの再入場Identityを失敗結果へ保持する。
 * @trace ARCH-000004
 * @input reason: 停止理由、recoveryReference: Runtime Data所有者のexact参照。
 * @returns 公開可能な非Authority回復参照を持つErrorを返す。
 * @precondition recoveryReferenceは準備結果が返した値を変更せず使用する。
 * @postcondition Repository Pathや秘密値をErrorへ含めない。
 * @effect N/A: Error値を構築するだけである。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant Recovery Identityと世代を変更しない。
 * @boundary Runtime Data回復契約と端末診断の境界。
 * @security 回復参照はAuthorityを付与しない。
 * @concurrency N/A: 同期的な値構築である。
 */
function retainedFailure(
  reason: string,
  recoveryReference: Readonly<{
    operationId: string;
    owner: string;
    identity: string;
    generation: number;
  }>,
) {
  return new Error(JSON.stringify({ reason, recoveryReference }));
}

/**
 * TTY callback内で準備から昇格後の終了処理までを一つの所有権として実行する。
 * Testは外部Processと署名EffectをBindingsで置換する。
 *
 * @responsibility 準備、署名、昇格および終了処理の順序と保持境界を所有する。
 * @trace ARCH-000004
 * @input parsed: 固定Identity、repositoryRoot: 検証済みRoot、repositoryRootPath: 同RootのPath、terminalArguments: 検証済み署名引数、bindings: 固定境界実装。
 * @returns 全Lifecycle完了時にvoidを返す。
 * @precondition repositoryRootとrepositoryRootPathは同じ検証済みRepositoryを表す。
 * @postcondition 成功時は昇格完了後のsettlementが確認済みである。
 * @effect Runtime準備、署名Manifest配置、固定Node子ProcessおよびRuntime終了処理を順に発行する。
 * @failure 署名結果不明、昇格失敗またはsettlement未確認ではOperationを保持しexact参照を返す。
 * @invariant 署名前のSnapshotと昇格対象workを同一に保つ。
 * @boundary Runtime Data、Signer、固定Node昇格Processの結合境界。
 * @security Authorityを新設せず、既存各境界の検証結果だけを利用する。
 * @concurrency 同じTTY callback内で逐次実行し、settlement前に子Process終了を確認する。
 */
export async function executeReleaseCandidateLifecycleForVerification(
  parsed: ParsedReleaseCandidateArguments,
  repositoryRoot: Parameters<typeof prepareReleaseRuntime>[0],
  repositoryRootPath: string,
  terminalArguments: readonly string[],
  bindings: LifecycleBindings,
) {
  const prepared = bindings.prepareRuntime(repositoryRoot, {
    commit: parsed.commit,
    tree: parsed.tree,
    operationId: parsed.operationId,
    identity: parsed.identity,
  });
  if (prepared.status !== "prepared" || !prepared.session) {
    throw new Error(JSON.stringify(prepared));
  }

  try {
    await bindings.runSigner(
      replaceDistributionRoot(terminalArguments, prepared.workDirectory),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "release_manifest_passphrase_invalid"
    ) {
      let failedSettlement: ReturnType<typeof releaseReleaseRuntimePreparation>;
      try {
        failedSettlement = bindings.releaseRuntime(prepared.session, "failed");
      } catch (settlementError) {
        throw retainedFailure(
          settlementError instanceof Error
            ? settlementError.message
            : "release_candidate_settlement_failed",
          prepared.recoveryReference,
        );
      }
      if (
        !failedSettlement.cleanupConfirmed ||
        failedSettlement.recoveryReference !== null
      ) {
        throw retainedFailure(
          "release_candidate_settlement_unconfirmed",
          failedSettlement.recoveryReference ?? prepared.recoveryReference,
        );
      }
      throw error;
    }
    throw retainedFailure(
      error instanceof Error
        ? error.message
        : "release_candidate_signing_failed",
      prepared.recoveryReference,
    );
  }

  let promotion: PromotionResult;
  try {
    promotion = bindings.runPromotion(
      prepared.workDirectory,
      repositoryRootPath,
    );
  } catch (error) {
    throw retainedFailure(
      error instanceof Error
        ? error.message
        : "release_candidate_promotion_failed",
      prepared.recoveryReference,
    );
  }
  if (promotion.error || promotion.signal !== null || promotion.status !== 0) {
    throw retainedFailure(
      "release_candidate_promotion_failed",
      prepared.recoveryReference,
    );
  }

  let settled: ReturnType<typeof releaseReleaseRuntimePreparation>;
  try {
    settled = bindings.releaseRuntime(prepared.session, "completed");
  } catch (error) {
    throw retainedFailure(
      error instanceof Error
        ? error.message
        : "release_candidate_settlement_failed",
      prepared.recoveryReference,
    );
  }
  if (!settled.cleanupConfirmed || settled.recoveryReference !== null) {
    throw retainedFailure(
      "release_candidate_settlement_unconfirmed",
      settled.recoveryReference ?? prepared.recoveryReference,
    );
  }
}

/**
 * 準備済みRuntime内の固定Launcherを一回のNode子Processとして実行する。
 *
 * @responsibility 昇格子Processの実行物、引数、cwd、待機上限および終了観測を所有する。
 * @trace ARCH-000004
 * @input workDirectory: 署名済みRuntime Root、repositoryRoot: 昇格先Repository Root。
 * @returns spawnSyncが観測した終了状態を返す。
 * @precondition workDirectoryは同Lifecycleで準備・署名されたRootである。
 * @postcondition spawnSyncが子Processの終了または停止要求後の返却を観測している。
 * @effect shellを使わず固定Node Launcherを一回起動する。
 * @failure nonzero、signal、timeout相当または起動例外を呼出し側が保持失敗へ変換する。
 * @invariant argvはlauncherとpromote-releaseだけである。
 * @boundary Coordinator親Processと署名済みstaging Launcherの境界。
 * @security stdioを継承し、秘密値をargvへ追加しない。
 * @concurrency spawnSyncで直接子の終了を待つ。5分経過時は直接子へSIGKILL停止要求を出して返却を待つが、厳密な経過時刻や子孫Processの停止までは保証しない。
 */
function runPromotion(workDirectory: string, repositoryRoot: string) {
  const launcher = path.join(
    workDirectory,
    "40_Develop",
    "coordinator",
    "bin",
    "coordinator.ts",
  );
  return spawnSync(process.execPath, [launcher, "promote-release"], {
    cwd: repositoryRoot,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    timeout: PROMOTION_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
}

const moduleRepositoryRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);

/**
 * 公開TTY入口を実行する。
 *
 * @responsibility Module所有Repositoryと一つのTTY Lifecycleを結合する。
 * @trace ARCH-000004
 * @input args: 公開CLIの非秘密引数。
 * @returns 端末Lifecycle終了後にvoidを返す。
 * @precondition 実行環境は対話TTY、対応Node版および検証可能なModule Repositoryを提供する。
 * @postcondition Enter待ち前に成功cleanupまたはexact回復参照付き停止が確定する。
 * @effect 端末入力、Runtime準備、署名、固定子Processおよび終了処理を呼び出す。
 * @failure 入力・環境不正はEffect前、Lifecycle失敗は端末Helperのnonzero結果で停止する。
 * @invariant Repository Rootを利用者入力から選択しない。
 * @boundary 外部TTYとRelease Runtime Lifecycleの公開境界。
 * @security passphraseはSignerのhidden inputだけが読み、保存しない。
 * @concurrency 一つのrunCommand callbackがLifecycle全体を所有する。
 */
export async function main(args = process.argv.slice(2)) {
  if (args[0] === "--recover-applied") {
    if (
      args.length !== 7 ||
      args[1] !== "--operation-id" ||
      args[3] !== "--operation-identity" ||
      args[5] !== "--generation" ||
      !OPERATION_IDENTITY.test(args[2] ?? "") ||
      !OPERATION_IDENTITY.test(args[4] ?? "") ||
      !/^[1-9][0-9]*$/u.test(args[6] ?? "") ||
      !Number.isSafeInteger(Number(args[6]))
    ) {
      process.stderr.write("release_candidate_recovery_arguments_invalid\n");
      process.exitCode = 2;
      return;
    }
    const root = verifyRepositoryRoot(moduleRepositoryRoot);
    if (root.status !== "completed") {
      process.stderr.write("release_candidate_repository_invalid\n");
      process.exitCode = 2;
      return;
    }
    const result = recoverAppliedReleaseRuntimePreparation(
      root.capability,
      {
        operationId: args[2] as string,
        identity: args[4] as string,
        generation: Number(args[6]),
        owner: "coordinator-release-runtime",
        storage: "signature",
      },
      randomUUID(),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.status === "completed" ? 0 : 2;
    return;
  }
  const parsed = parseReleaseCandidateArguments(args);
  if (!parsed) {
    process.stderr.write("release_candidate_arguments_invalid\n");
    process.exitCode = 2;
    return;
  }
  const verified = verifyRepositoryRoot(moduleRepositoryRoot);
  if (verified.status !== "completed") {
    process.stderr.write("release_candidate_repository_invalid\n");
    process.exitCode = 2;
    return;
  }

  const terminalArguments = [
    "--distribution-root",
    moduleRepositoryRoot,
    ...parsed.signerArguments,
  ];
  const exitCode = await runReleaseTerminalCommand(terminalArguments, {
    input: process.stdin,
    output: process.stdout,
    errorOutput: process.stderr,
    stdinIsTTY: process.stdin.isTTY === true,
    stdoutIsTTY: process.stdout.isTTY === true,
    nodeVersion: process.versions.node,
    now: () => new Date(),
    runCommand: async (normalizedArguments) =>
      executeReleaseCandidateLifecycleForVerification(
        parsed,
        verified.capability,
        moduleRepositoryRoot,
        normalizedArguments,
        {
          prepareRuntime: prepareReleaseRuntime,
          releaseRuntime: releaseReleaseRuntimePreparation,
          runSigner: (signerArguments) =>
            signReleaseManifest([...signerArguments]),
          runPromotion,
        },
      ),
  });
  process.exitCode = exitCode;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
