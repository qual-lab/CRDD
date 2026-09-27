/**
 * Version Controlの変更公開契約を定義する。
 *
 * @packageDocumentation
 * @responsibility 選択差分の準備、Revision作成および確認済み通常公開をGit非依存の操作へ分離する。
 * @trace ARCH-000009
 * @boundary Workbench等の利用側とVersion Control Adapterの外部Effect境界。
 * @effect 明示操作に応じてRepositoryの準備領域、Local RevisionまたはRemote Branchを変更し得る。
 * @security 任意Command、Force公開および未確認対象を受け付けない。
 */
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

/**
 * 変更公開で許可する操作入力を定義する。
 *
 * @responsibility 準備、解除、Revision作成および確認済み公開の入力を閉じた操作集合として所有する。
 * @trace ARCH-000009
 * @shape operationごとに必要なPath、Messageまたは公開対象Identityを固定する。
 * @invariant publish_revisionはhumanConfirmed trueを必須とする。
 * @boundary Workbench Application PortとVersion Control Portの入力境界。
 * @security Force指定、任意CommandおよびCredential fieldを持たない。
 * @compatibility 操作追加時はAdapter、利用側、Quality Local Itemおよび全Consumerを再評価する。
 */
export type ChangePublicationRequest =
  | Readonly<{ operation: "prepare"; paths: readonly string[] }>
  | Readonly<{ operation: "unprepare"; paths: readonly string[] }>
  | Readonly<{ operation: "create_revision"; message: string }>
  | Readonly<{
      operation: "publish_revision";
      destination: string;
      branch: string;
      revisionIdentity: string;
      humanConfirmed: true;
    }>;

/**
 * 変更公開の正規化結果を定義する。
 *
 * @responsibility 完了・拒否・観測不能、Effect発行・確認およびRevision Identityを同じ結果へ閉じる。
 * @trace ARCH-000009
 * @shape status、reason、Effect状態、Revision Identityおよび禁止Effect fieldを固定する。
 * @invariant blocked／unknownをcompletedへ畳まず、自動再送とForce公開は常にfalseである。
 * @boundary Version Control AdapterとWorkbench結果表示の出力境界。
 * @security 生Process出力、絶対PathおよびCredentialを含めない。
 * @compatibility field追加時は全結果ConsumerとRecovery表示を再評価する。
 */
export type ChangePublicationResult = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string;
  effectIssued: boolean;
  effectConfirmed: boolean;
  revisionIdentity: string | null;
  automaticRetryIssued: false;
  forcePublicationIssued: false;
}>;

/**
 * 通常公開先の現在観測を定義する。
 *
 * @responsibility 現在Branch、Revisionおよび設定済み上流参照を、人間が公開前に確認できる一つのSnapshotへ閉じる。
 * @trace ARCH-000009
 * @shape available、not_configured、unknownと、確認可能な公開先fieldを表す。
 * @invariant not_configured／unknownを推測した既定値へ変換しない。
 * @boundary Version Control観測とWorkbench公開確認表示の型境界。
 * @security Credential、Remote URLおよびRepository絶対Pathを含めない。
 * @compatibility field追加時はWorkbench表示と全Adapterを再評価する。
 */
export type ChangePublicationTargetObservation = Readonly<{
  status: "available" | "not_configured" | "unknown";
  reason:
    | "publication_target_observed"
    | "publication_upstream_not_configured"
    | "publication_target_observation_failed";
  destination: string | null;
  branch: string | null;
  revisionIdentity: string | null;
}>;

/**
 * 通常公開先を観測するAdapterを定義する。
 *
 * @responsibility 検証済みRepository Rootから現在の公開確認値だけを観測する差替境界を所有する。
 * @trace ARCH-000009
 * @shape Repository RootからChangePublicationTargetObservationを返す関数境界である。
 * @invariant Remote URLやCredentialを公開せず、観測不能を利用可能へ畳まない。
 * @boundary Version Control Portと具象Version Control観測の境界。
 * @security 公開名とRevision Identity以外のRemote設定を返さない。
 * @compatibility 代替Adapterも同じ状態分類を満たす。
 */
export type ChangePublicationTargetObservationAdapter = (
  repositoryRoot: string,
) => ChangePublicationTargetObservation;

/**
 * 差替可能な変更公開Adapterを定義する。
 *
 * @responsibility 検証済みRepository RootとCanonical操作を具象Version Controlへ接続する。
 * @trace ARCH-000009
 * @shape Repository RootとChangePublicationRequestからChangePublicationResultを返す関数境界である。
 * @invariant Canonical入力外の操作を追加せず結果契約を保持する。
 * @boundary Version Control Portと具象Version Control実装の境界。
 * @security 任意Commandまたは未確認Authorityを受け付けない。
 * @compatibility 代替Adapterも同じ結果分類と禁止Effectを満たす。
 */
export type ChangePublicationAdapter = (
  repositoryRoot: string,
  request: ChangePublicationRequest,
) => ChangePublicationResult;

/**
 * Repository相対Pathの選択集合を検証する。
 *
 * @responsibility 空集合、重複、Root逸脱および制御文字を公開Effect前に拒否する。
 * @trace ARCH-000009
 * @input pathsに利用者が選択したRepository相対Pathを受け取る。
 * @returns 検証済みの重複しないPath集合を返す。
 * @precondition pathsは外部入力であり未検証である。
 * @postcondition 返却Pathは非空でRoot相対かつ重複しない。
 * @effect N/A: 入力値だけを検証する。
 * @failure 不正集合をchange_publication_paths_invalidで拒否する。
 * @invariant Pathを暗黙追加または正規化しない。
 * @boundary 利用者選択とRepository Effectの境界。
 * @security Root外Path、option形式および制御文字を拒否する。
 * @concurrency N/A: 同期的な値検証である。
 */
function validatePaths(paths: readonly string[]): readonly string[] {
  if (
    paths.length === 0 ||
    new Set(paths).size !== paths.length ||
    paths.some(
      (entry) =>
        entry.length === 0 ||
        entry.startsWith("-") ||
        entry.startsWith("/") ||
        entry.includes("\\") ||
        /[\u0000-\u001f\u007f]/u.test(entry) ||
        entry
          .split("/")
          .some((part) => part === "" || part === "." || part === ".."),
    )
  )
    throw new Error("change_publication_paths_invalid");
  return Object.freeze([...paths]);
}

/**
 * 変更公開要求を検証済みRepositoryへ発行する。
 *
 * @responsibility 操作別入力、Human Authorityおよび検証済みRootを確認して最小Adapterへ一回だけ委譲する。
 * @trace ARCH-000009
 * @input capability、操作要求および差替可能Adapterを受け取る。
 * @returns Effect発行、確認、Revisionおよび結果状態を分離した結果を返す。
 * @precondition capabilityはRepository Locationが発行した値である。
 * @postcondition Adapter呼出しは一要求につき最大一回である。
 * @effect 操作に応じて準備領域、Local RevisionまたはRemote Branchを変更し得る。
 * @failure Root、入力またはAuthority不正はAdapter呼出し前に拒否する。
 * @invariant blocked／unknownをcompletedへ変換せず、自動再送とForce公開を行わない。
 * @boundary Application Port→Version Control Port→具象Adapterの境界。
 * @security publish_revisionは確認済みdestination、branch、revisionIdentityだけを受け付ける。
 * @concurrency 同じRepositoryへの同時変更を直列化せず、競合結果をAdapterから保持する。
 */
export function executeChangePublication(
  capability: VerifiedRepositoryRoot,
  request: ChangePublicationRequest,
  adapter: ChangePublicationAdapter,
): ChangePublicationResult {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("verified_repository_root_required");
  let validated: ChangePublicationRequest;
  if (request.operation === "prepare" || request.operation === "unprepare") {
    validated = Object.freeze({
      operation: request.operation,
      paths: validatePaths(request.paths),
    });
  } else if (request.operation === "create_revision") {
    if (
      request.message.trim().length === 0 ||
      request.message.length > 4_096 ||
      /[\u0000\u007f]/u.test(request.message)
    )
      throw new Error("change_publication_message_invalid");
    validated = Object.freeze({
      operation: "create_revision",
      message: request.message,
    });
  } else {
    if (
      request.humanConfirmed !== true ||
      [request.destination, request.branch, request.revisionIdentity].some(
        (entry) =>
          entry.length === 0 ||
          entry.startsWith("-") ||
          /[\u0000-\u0020\u007f]/u.test(entry),
      )
    )
      throw new Error("change_publication_target_invalid");
    validated = Object.freeze({ ...request });
  }
  const result = adapter(repositoryRoot, validated);
  if (result.automaticRetryIssued || result.forcePublicationIssued)
    throw new Error("change_publication_adapter_contract_violated");
  return result;
}

/**
 * 検証済みRepositoryの通常公開先を観測する。
 *
 * @responsibility Repository Capabilityを解決し、現在のBranch、Revisionおよび上流参照の観測を一回だけ委譲する。
 * @trace ARCH-000009
 * @input capabilityと差替可能な公開先観測Adapterを受け取る。
 * @returns 公開前にHuman確認へ使えるChangePublicationTargetObservationを返す。
 * @precondition capabilityはRepository Locationが発行した値である。
 * @postcondition Adapter呼出しは一回以下で、観測結果を推測補完しない。
 * @effect RepositoryとRemoteを変更しない読取り観測だけを行う。
 * @failure Root不正はAdapter呼出し前に拒否し、観測失敗はunknown結果として保持する。
 * @invariant not_configured／unknownをoriginや現在Branchの推測値へ変換しない。
 * @boundary Application Port→Version Control観測Port→具象Adapterの境界。
 * @security Remote URL、Credentialおよび絶対Pathを公開しない。
 * @concurrency 一回の観測内で得た値だけをSnapshotとして返す。
 */
export function observeChangePublicationTarget(
  capability: VerifiedRepositoryRoot,
  adapter: ChangePublicationTargetObservationAdapter,
): ChangePublicationTargetObservation {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("verified_repository_root_required");
  return adapter(repositoryRoot);
}
