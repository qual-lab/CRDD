/**
 * Git CLIによるChange Publication Adapter。
 *
 * @packageDocumentation
 * @responsibility Canonicalな準備・Revision・通常公開操作を固定Git Commandへ写像し、結果を正規化する。
 * @trace ARCH-000009
 * @boundary Version Control PortとGit Process／Remoteの外部Effect境界。
 * @effect Git index、Local commitおよび確認済みRemote Branchを変更し得る。
 * @security shell、Force Push、Credential出力および任意Commandを許可しない。
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

import type {
  ChangePublicationAdapter,
  ChangePublicationResult,
  ChangePublicationTargetObservation,
  ChangePublicationTargetObservationAdapter,
} from "../change-publication.ts";

/**
 * Git子Processから利用する最小結果を定義する。
 *
 * @responsibility 起動失敗、終了StatusおよびstdoutだけをAdapter内へ閉じる。
 * @trace ARCH-000009
 * @shape SpawnSyncReturnsからerror、status、stdoutだけを選ぶ。
 * @invariant stderrその他の生出力を公開結果へ搬送しない。
 * @boundary Node Process APIとGit Adapterの内部境界。
 * @security Credentialを含み得る追加出力を保持しない。
 * @compatibility Process Runner差替時も同じ三fieldを供給する。
 */
type ProcessResult = Pick<
  SpawnSyncReturns<Buffer>,
  "error" | "status" | "stdout"
>;

/**
 * Git Command Runnerの差替境界を定義する。
 *
 * @responsibility Repository Rootと固定引数配列をProcess実行へ接続する。
 * @trace ARCH-000009
 * @shape repositoryRootとreadonly引数からProcessResultを返す。
 * @invariant shell再解釈を行わないRunnerを前提とする。
 * @boundary Git AdapterとNode Process APIの境界。
 * @security 引数へCredentialを付加しない。
 * @compatibility 試験Runnerも本番Runnerと同じ結果分類を返す。
 */
export type ChangePublicationCommandRunner = (
  repositoryRoot: string,
  args: readonly string[],
) => ProcessResult;

/**
 * 固定Git Commandを実行する。
 *
 * @responsibility shellを介さず制限時間・出力量を固定してGit Processを完了まで所有する。
 * @trace ARCH-000009
 * @input repositoryRootと固定組立済み引数を受け取る。
 * @returns Processのerror、statusおよびstdoutを返す。
 * @precondition 引数は本Adapter内のallowlistから構築済みである。
 * @postcondition 子Processは同期完了しhandleを残さない。
 * @effect 指定Git操作に応じRepositoryまたはRemoteを変更し得る。
 * @failure 起動失敗、timeoutまたは非0終了を構造化前のProcess結果として返す。
 * @invariant shellとForce optionを使用しない。
 * @boundary Node Process APIとGit CLIの境界。
 * @security stdoutを外部公開せずCredentialを引数へ追加しない。
 * @concurrency 同じRepositoryへの並行呼出しはGitの競合結果へ委ねる。
 */
function runGit(
  repositoryRoot: string,
  args: readonly string[],
): ProcessResult {
  return spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "buffer",
    windowsHide: true,
    shell: false,
    timeout: 30_000,
    maxBuffer: 4 * 1_024 * 1_024,
  });
}

/**
 * Git Process結果からRevision Identityを読む。
 *
 * @responsibility UTF-8、終了Statusおよび単一OID形式を検証する。
 * @trace ARCH-000009
 * @input resultにrev-parse相当のProcess結果を受け取る。
 * @returns 検証済みRevision Identityまたはnullを返す。
 * @precondition stdoutはGitからのbytesである。
 * @postcondition 返却値は16進40桁または64桁に限る。
 * @effect N/A: Process結果だけを解析する。
 * @failure 起動失敗、非0、UTF-8不正または形式不正をnullにする。
 * @invariant 生出力をErrorまたは公開結果へ含めない。
 * @boundary Git stdoutとCanonical resultの境界。
 * @security 生出力を保持しない。
 * @concurrency N/A: 同期的な解析である。
 */
function revisionFrom(result: ProcessResult): string | null {
  if (result.error !== undefined || result.status !== 0) return null;
  try {
    const value = new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .trim();
    return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Remote参照観測からRevision Identityを読む。
 *
 * @responsibility ls-remoteの単一行を検証し、参照名を公開せずRevisionだけを返す。
 * @trace ARCH-000009
 * @input resultにls-remoteのProcess結果を受け取る。
 * @returns 検証済みRemote Revision Identityまたはnullを返す。
 * @precondition stdoutは単一参照を要求したGit出力である。
 * @postcondition 返却値は16進40桁または64桁に限る。
 * @effect N/A: Process結果だけを解析する。
 * @failure 複数行、形式不正または観測失敗をnullへ分類する。
 * @invariant Remote名や参照名を公開結果へ含めない。
 * @boundary Git Remote出力とCanonical Revision Identityの境界。
 * @security 生出力を保持しない。
 * @concurrency N/A: 同期的な解析である。
 */
function remoteRevisionFrom(result: ProcessResult): string | null {
  if (result.error !== undefined || result.status !== 0) return null;
  try {
    const lines = new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean);
    if (lines.length !== 1) return null;
    const identity = lines[0]?.split(/\s+/u)[0] ?? "";
    return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(identity) ? identity : null;
  } catch {
    return null;
  }
}

/**
 * Git Processの単一行UTF-8値を安全に読む。
 *
 * @responsibility Branch名とRemote名の観測結果を単一行の非秘密値へ制限する。
 * @trace ARCH-000009
 * @input resultに固定Git観測CommandのProcess結果を受け取る。
 * @returns 制御文字を含まない単一行、または観測不能時nullを返す。
 * @precondition stdoutはGitからのbytesである。
 * @postcondition 空値、複数行、制御文字またはProcess失敗をnullへ分類する。
 * @effect N/A: Process結果だけを解析する。
 * @failure 不正UTF-8をnullへ分類する。
 * @invariant 生出力をErrorまたは公開結果へ含めない。
 * @boundary Git stdoutとCanonical公開先名の境界。
 * @security Remote URLやCredentialを読むCommandには使用しない。
 * @concurrency N/A: 同期的な解析である。
 */
function singleLineValue(result: ProcessResult): string | null {
  if (result.error !== undefined || result.status !== 0) return null;
  try {
    const value = new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .trim();
    return value.length > 0 &&
      !/[\u0000-\u001f\u007f]/u.test(value) &&
      !value.includes("\n") &&
      !value.includes("\r")
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * Gitの現在Branch、Revisionおよび設定済み上流参照を観測するAdapterを構築する。
 *
 * @responsibility Human確認に必要な公開先だけを固定Git Commandで読み、未設定と観測不能を区別する。
 * @trace ARCH-000009
 * @input runnerに試験差替可能な固定Command Runnerを受け取る。
 * @returns ChangePublicationTargetObservationAdapterを返す。
 * @precondition runnerは引数配列をshellへ再解釈しない。
 * @postcondition available時はdestination、branch、revisionIdentityが全て存在する。
 * @effect RepositoryとRemoteを変更しないGit読取りCommandだけを実行する。
 * @failure Branch／Revision観測失敗はunknown、上流未設定はnot_configuredとする。
 * @invariant originや現在Branchを暗黙の公開先として補完しない。
 * @boundary Canonical公開先観測とGit設定／Revisionの境界。
 * @security Remote URL、CredentialおよびProcess生出力を公開しない。
 * @concurrency 観測途中のRepository変更は整合確認失敗としてunknownへ閉じる。
 */
export function createGitChangePublicationTargetObservationAdapter(
  runner: ChangePublicationCommandRunner = runGit,
): ChangePublicationTargetObservationAdapter {
  return (repositoryRoot): ChangePublicationTargetObservation => {
    const branch = singleLineValue(
      runner(repositoryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
    );
    const revisionIdentity = revisionFrom(
      runner(repositoryRoot, ["rev-parse", "HEAD"]),
    );
    if (branch === null || revisionIdentity === null)
      return Object.freeze({
        status: "unknown",
        reason: "publication_target_observation_failed",
        destination: null,
        branch: null,
        revisionIdentity: null,
      });
    const destination = singleLineValue(
      runner(repositoryRoot, ["config", "--get", `branch.${branch}.remote`]),
    );
    const mergeReference = singleLineValue(
      runner(repositoryRoot, ["config", "--get", `branch.${branch}.merge`]),
    );
    if (destination === null || mergeReference === null)
      return Object.freeze({
        status: "not_configured",
        reason: "publication_upstream_not_configured",
        destination: null,
        branch,
        revisionIdentity,
      });
    const prefix = "refs/heads/";
    if (
      !mergeReference.startsWith(prefix) ||
      mergeReference.length === prefix.length
    )
      return Object.freeze({
        status: "unknown",
        reason: "publication_target_observation_failed",
        destination: null,
        branch: null,
        revisionIdentity: null,
      });
    return Object.freeze({
      status: "available",
      reason: "publication_target_observed",
      destination,
      branch: mergeReference.slice(prefix.length),
      revisionIdentity,
    });
  };
}

/**
 * Canonicalな結果を生成する。
 *
 * @responsibility 全経路で再送・Forceなしを明示し、Effect発行と確認を分離する。
 * @trace ARCH-000009
 * @input status、reason、effect状態およびRevision Identityを受け取る。
 * @returns 不変fieldを含むChangePublicationResultを返す。
 * @precondition reasonは秘密値を含まない固定語彙である。
 * @postcondition automaticRetryIssuedとforcePublicationIssuedは常にfalseである。
 * @effect N/A: 値を構築するだけである。
 * @failure N/A: 入力値を決定論的に返す。
 * @invariant unknownをcompletedへ変換しない。
 * @boundary Adapter内部と公開結果の境界。
 * @security Process生出力を含めない。
 * @concurrency N/A: 同期的な値構築である。
 */
function result(
  status: ChangePublicationResult["status"],
  reason: string,
  effectIssued: boolean,
  effectConfirmed: boolean,
  revisionIdentity: string | null = null,
): ChangePublicationResult {
  return Object.freeze({
    status,
    reason,
    effectIssued,
    effectConfirmed,
    revisionIdentity,
    automaticRetryIssued: false,
    forcePublicationIssued: false,
  });
}

/**
 * Git Change Publication Adapterを構築する。
 *
 * @responsibility 操作ごとの固定Command、結果分類およびRemote反映再観測を所有する。
 * @trace ARCH-000009
 * @input runnerに試験差替可能な固定Command Runnerを受け取る。
 * @returns ChangePublicationAdapterを返す。
 * @precondition runnerは引数配列をshellへ再解釈しない。
 * @postcondition 一要求を自動再送せず、通常Push後はRemote Revisionを再観測する。
 * @effect index、Local commitまたはRemote branchを変更し得る。
 * @failure 起動不能はunknown、非0終了はblocked、Remote再観測不能はunknownとする。
 * @invariant Force optionを構築せず、確認Revisionと現在HEADが違えばEffect 0で拒否する。
 * @boundary Canonical Change PublicationとGit CLI／Remoteの境界。
 * @security 生出力とCredentialを公開結果へ含めない。
 * @concurrency Push直前のHEAD再確認で競合を拒否する。
 */
export function createGitChangePublicationAdapter(
  runner: ChangePublicationCommandRunner = runGit,
): ChangePublicationAdapter {
  return (repositoryRoot, request) => {
    if (request.operation === "prepare" || request.operation === "unprepare") {
      const args =
        request.operation === "prepare"
          ? ["add", "--", ...request.paths]
          : ["reset", "--quiet", "HEAD", "--", ...request.paths];
      const execution = runner(repositoryRoot, args);
      if (execution.error !== undefined)
        return result("unknown", "repository_effect_unknown", true, false);
      return execution.status === 0
        ? result("completed", `${request.operation}_completed`, true, true)
        : result("blocked", `${request.operation}_rejected`, true, false);
    }
    if (request.operation === "create_revision") {
      const execution = runner(repositoryRoot, [
        "commit",
        "--quiet",
        "--message",
        request.message,
      ]);
      if (execution.error !== undefined)
        return result("unknown", "revision_creation_unknown", true, false);
      if (execution.status !== 0)
        return result("blocked", "revision_creation_rejected", true, false);
      const identity = revisionFrom(
        runner(repositoryRoot, ["rev-parse", "HEAD"]),
      );
      return identity === null
        ? result("unknown", "revision_identity_unknown", true, false)
        : result("completed", "revision_created", true, true, identity);
    }
    const current = revisionFrom(runner(repositoryRoot, ["rev-parse", "HEAD"]));
    if (current === null || current !== request.revisionIdentity)
      return result("blocked", "publication_revision_changed", false, false);
    const publication = runner(repositoryRoot, [
      "push",
      "--porcelain",
      request.destination,
      `${request.revisionIdentity}:refs/heads/${request.branch}`,
    ]);
    if (publication.error !== undefined)
      return result(
        "unknown",
        "publication_result_unknown",
        true,
        false,
        current,
      );
    if (publication.status !== 0)
      return result("blocked", "publication_rejected", true, false, current);
    const remote = remoteRevisionFrom(
      runner(repositoryRoot, [
        "ls-remote",
        request.destination,
        `refs/heads/${request.branch}`,
      ]),
    );
    return remote === current
      ? result("completed", "publication_confirmed", true, true, current)
      : result(
          "unknown",
          "publication_observation_unknown",
          true,
          false,
          current,
        );
  };
}

/**
 * 本番Git Change Publication Adapterを公開する。
 *
 * @responsibility 固定Process Runnerを使う標準Adapter Instanceを全Consumerへ一意に提供する。
 * @trace ARCH-000009
 * @input N/A: Module初期化時に固定Runnerで生成する。
 * @returns ChangePublicationAdapterとして呼び出される関数値を公開する。
 * @precondition Git CLIが実行環境で利用可能である。
 * @postcondition 全呼出しがcreateGitChangePublicationAdapterの契約に従う。
 * @effect 呼出し時にRepositoryまたは確認済みRemoteへEffectを発行し得る。
 * @failure 起動・Git・Remote失敗をAdapterの結果分類で返す。
 * @invariant 自動再送とForce公開を行わない。
 * @boundary Version Control公開入口とGit具象Adapterの境界。
 * @security shellとCredential保存を使用しない。
 * @concurrency 同じRepositoryの競合をGit結果として保持する。
 */
export const gitChangePublicationAdapter = createGitChangePublicationAdapter();

/**
 * 本番Git公開先観測Adapterを公開する。
 *
 * @responsibility 固定Process Runnerで現在の確認可能な公開先Snapshotを全Consumerへ一意に提供する。
 * @trace ARCH-000009
 * @input N/A: Module初期化時に固定Runnerで生成する。
 * @returns ChangePublicationTargetObservationAdapterとして呼び出される関数値を公開する。
 * @precondition Git CLIが実行環境で利用可能である。
 * @postcondition 全呼出しがcreateGitChangePublicationTargetObservationAdapterの契約に従う。
 * @effect RepositoryとRemoteを変更しない読取り観測だけを行う。
 * @failure 観測失敗と上流未設定をCanonical状態で返す。
 * @invariant 推測したRemote、BranchまたはRevisionを返さない。
 * @boundary Version Control公開入口とGit具象観測Adapterの境界。
 * @security Remote URLとCredentialを公開しない。
 * @concurrency 観測Snapshot内の不整合をunknownへ閉じる。
 */
export const gitChangePublicationTargetObservationAdapter =
  createGitChangePublicationTargetObservationAdapter();
