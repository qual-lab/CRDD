/**
 * repository-operation-runtimeに属する責務をまとめる。
 *
 * @responsibility Bindingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000009
 */
import fs from "node:fs";
import path from "node:path";
import { observeFixedRevisionIdentity } from "../../../version-control/src/fixed-revision.ts";
import {
  gitFixedRevisionIdentityAdapter,
  gitRepositoryFormatAdapter,
  gitRepositoryRevisionAdapter,
} from "../../../version-control/src/git/fixed-revision-adapter.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import {
  inspectRepositoryFormat,
  observeRepositoryRevision,
} from "../../../version-control/src/repository-revision.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { isSupportedCrddRuntimeGitObjectId } from "./release-identity-grammar.ts";

export const REPOSITORY_OPERATION_RUNTIME_CONTRACT =
  "crdd-coordinator/repository-operation-runtime";
export const REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION = 2;

/**
 * repository-operation-runtimeで使用するBindingの値契約を定義する。
 *
 * @responsibility BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape Bindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Bindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: Bindingの宣言は外部境界を開かない。
 * @security BindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Bindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Binding = Readonly<{
  managementCapability: object;
  operationId: string;
  repositoryRoot: string;
  repositoryKind: string;
  logicalRepositoryIdentity: string;
  repositoryInstanceIdentity: string;
  revision: string;
}>;

const bindings = new WeakMap<object, Binding>();
const capabilities = new WeakMap<object, Binding>();

/**
 * repository-operation-runtimeを観測する。
 *
 * @responsibility repository-operation-runtimeの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: string
 * @returns observeの計算結果を返す。
 * @precondition 「repositoryRoot: string」がobserveの入力契約を満たす。
 * @postcondition observeの責務を完了した結果だけを返す。
 * @effect N/A: observeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeはProcess内の同一Subsystemで完結する。
 * @security observeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeは共有非同期状態を持たない同期処理である。
 */
function observe(repositoryRoot: string) {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("repository_root_invalid");
  const observed = observeRepositoryRevision(
    verified.capability,
    gitRepositoryRevisionAdapter,
  );
  if (!observed) throw new Error("repository_revision_invalid");
  return Object.freeze({
    repositoryKind: observed.repositoryForm,
    logicalRepositoryIdentity: observed.repositoryIdentity,
    repositoryInstanceIdentity: observed.repositoryInstanceIdentity,
    revision: observed.revisionIdentity,
  });
}

/**
 * Repository Object Format 候補を観測する。
 *
 * @responsibility Repository Object Format 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: unknown
 * @returns inspectRepositoryObjectFormatCandidateの計算結果を返す。
 * @precondition 「repositoryRoot: unknown」がinspectRepositoryObjectFormatCandidateの入力契約を満たす。
 * @postcondition inspectRepositoryObjectFormatCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectRepositoryObjectFormatCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectRepositoryObjectFormatCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRepositoryObjectFormatCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryObjectFormatCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectRepositoryObjectFormatCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRepositoryObjectFormatCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryObjectFormatCandidate(
  repositoryRoot: unknown,
) {
  try {
    if (
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    const format = inspectRepositoryFormat(
      repositoryRoot,
      gitRepositoryFormatAdapter,
    );
    if (!format) return null;
    return Object.freeze({
      status: "candidate" as const,
      objectFormat: format.objectFormat,
      runtimeSupported: format.objectFormat === "sha1",
      revisionReported: false,
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * Repository Revision 候補を観測する。
 *
 * @responsibility Repository Revision 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: unknown
 * @returns inspectRepositoryRevisionCandidateの計算結果を返す。
 * @precondition 「repositoryRoot: unknown」がinspectRepositoryRevisionCandidateの入力契約を満たす。
 * @postcondition inspectRepositoryRevisionCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectRepositoryRevisionCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectRepositoryRevisionCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRepositoryRevisionCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryRevisionCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectRepositoryRevisionCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRepositoryRevisionCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryRevisionCandidate(repositoryRoot: unknown) {
  try {
    if (
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    const verified = verifyRepositoryRoot(repositoryRoot);
    if (verified.status !== "completed") return null;
    const identity = observeFixedRevisionIdentity(
      verified.capability,
      gitFixedRevisionIdentityAdapter,
    );
    return identity
      ? Object.freeze({
          status: "candidate" as const,
          commit: identity.revisionIdentity,
          tree: identity.snapshotIdentity,
          repositoryKind: identity.repositoryForm,
          externalGitCliUsed: false,
          repositoryPathReported: false,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * Read-only identity and HEAD/tree observation for bounded admission.
 *
 * @responsibility Repository Identity 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: unknown
 * @returns inspectRepositoryIdentityCandidateの計算結果を返す。
 * @precondition 「repositoryRoot: unknown」がinspectRepositoryIdentityCandidateの入力契約を満たす。
 * @postcondition inspectRepositoryIdentityCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectRepositoryIdentityCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectRepositoryIdentityCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRepositoryIdentityCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryIdentityCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectRepositoryIdentityCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRepositoryIdentityCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryIdentityCandidate(repositoryRoot: unknown) {
  try {
    if (typeof repositoryRoot !== "string") return null;
    const before = observe(repositoryRoot);
    const revision = inspectRepositoryRevisionCandidate(repositoryRoot);
    const after = observe(repositoryRoot);
    if (
      !revision ||
      revision.commit !== before.revision ||
      JSON.stringify(before) !== JSON.stringify(after)
    )
      return null;
    return Object.freeze({ ...before, ...revision });
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Repository OperationをIdentityへ結合する。
 *
 * @responsibility Runtime 所有 Repository Operationの結合条件、相関Identity、不一致の拒否境界を所有する。
 * @trace ARCH-000009
 * @input managementCapability: unknown、repositoryRoot: unknown
 * @returns bindRuntimeOwnedRepositoryOperationの計算結果を返す。
 * @precondition 「managementCapability: unknown、repositoryRoot: unknown」がbindRuntimeOwnedRepositoryOperationの入力契約を満たす。
 * @postcondition bindRuntimeOwnedRepositoryOperationの責務を完了した結果だけを返す。
 * @effect bindRuntimeOwnedRepositoryOperationはFilesystemの読取りまたは書込みを実行する。
 * @failure bindRuntimeOwnedRepositoryOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant bindRuntimeOwnedRepositoryOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security bindRuntimeOwnedRepositoryOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: bindRuntimeOwnedRepositoryOperationは共有非同期状態を持たない同期処理である。
 */
export function bindRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
  repositoryRoot: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    if (bindings.has(managementCapability)) return null;
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const observation = observe(repositoryRoot);
    if (!isSupportedCrddRuntimeGitObjectId(observation.revision)) return null;
    const binding = Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      repositoryRoot: fs.realpathSync.native(repositoryRoot),
      ...observation,
    });
    const capability = Object.freeze({});
    bindings.set(managementCapability, binding);
    capabilities.set(capability, binding);
    return Object.freeze({
      operationId: binding.operationId,
      revision: binding.revision,
      repositoryBindingCapability: capability,
      repositoryBound: true as const,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * current Bindingを決定する。
 *
 * @responsibility current Bindingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000009
 * @input managementCapability: unknown
 * @returns currentBindingの計算結果を返す。
 * @precondition 「managementCapability: unknown」がcurrentBindingの入力契約を満たす。
 * @postcondition currentBindingの責務を完了した結果だけを返す。
 * @effect N/A: currentBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: currentBindingは独自の失敗分岐を所有しない。
 * @invariant currentBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: currentBindingはProcess内の同一Subsystemで完結する。
 * @security currentBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentBindingは共有非同期状態を持たない同期処理である。
 */
function currentBinding(managementCapability: unknown) {
  if (!managementCapability || typeof managementCapability !== "object")
    return null;
  const binding = bindings.get(managementCapability);
  if (!binding) return null;
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  if (operation.operationId !== binding.operationId) return null;
  const current = observe(binding.repositoryRoot);
  return current.repositoryKind === binding.repositoryKind &&
    current.logicalRepositoryIdentity === binding.logicalRepositoryIdentity &&
    current.repositoryInstanceIdentity === binding.repositoryInstanceIdentity &&
    current.revision === binding.revision
    ? binding
    : null;
}

/**
 * Runtime 所有 Repository Operationを検証する。
 *
 * @responsibility Runtime 所有 Repository Operationの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000009
 * @input managementCapability: unknown
 * @returns verifyRuntimeOwnedRepositoryOperationの計算結果を返す。
 * @precondition 「managementCapability: unknown」がverifyRuntimeOwnedRepositoryOperationの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedRepositoryOperationの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedRepositoryOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedRepositoryOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedRepositoryOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedRepositoryOperationはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedRepositoryOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedRepositoryOperationは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
) {
  try {
    const binding = currentBinding(managementCapability);
    return binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Repository Binding Capabilityを検証する。
 *
 * @responsibility Runtime 所有 Repository Binding Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000009
 * @input repositoryBindingCapability: unknown、managementCapability: unknown
 * @returns verifyRuntimeOwnedRepositoryBindingCapabilityの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown」がverifyRuntimeOwnedRepositoryBindingCapabilityの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedRepositoryBindingCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedRepositoryBindingCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedRepositoryBindingCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedRepositoryBindingCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedRepositoryBindingCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedRepositoryBindingCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedRepositoryBindingCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedRepositoryBindingCapability(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    return binding?.managementCapability === managementCapability &&
      currentBinding(managementCapability) === binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Repository Sourceを一時参照として取得する。
 *
 * @responsibility Runtime 所有 Repository Sourceの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000009
 * @input repositoryBindingCapability: unknown、managementCapability: unknown
 * @returns borrowRuntimeOwnedRepositorySourceの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown」がborrowRuntimeOwnedRepositorySourceの入力契約を満たす。
 * @postcondition borrowRuntimeOwnedRepositorySourceの責務を完了した結果だけを返す。
 * @effect N/A: borrowRuntimeOwnedRepositorySourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure borrowRuntimeOwnedRepositorySourceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant borrowRuntimeOwnedRepositorySourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowRuntimeOwnedRepositorySourceはProcess内の同一Subsystemで完結する。
 * @security borrowRuntimeOwnedRepositorySourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowRuntimeOwnedRepositorySourceは共有非同期状態を持たない同期処理である。
 */
export function borrowRuntimeOwnedRepositorySource(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    if (
      !binding ||
      binding.managementCapability !== managementCapability ||
      currentBinding(managementCapability) !== binding ||
      binding.revision.length !== 40
    ) {
      return null;
    }
    return Object.freeze({
      operationId: binding.operationId,
      repositoryRoot: binding.repositoryRoot,
      revision: binding.revision,
    });
  } catch {
    return null;
  }
}

/**
 * Repository Operation Runtime 契約の公開契約を記述する。
 *
 * @responsibility Repository Operation Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000009
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRepositoryOperationRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRepositoryOperationRuntimeContractの入力契約を満たす。
 * @postcondition describeRepositoryOperationRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRepositoryOperationRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRepositoryOperationRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeRepositoryOperationRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRepositoryOperationRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeRepositoryOperationRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRepositoryOperationRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeRepositoryOperationRuntimeContract() {
  return Object.freeze({
    contract: REPOSITORY_OPERATION_RUNTIME_CONTRACT,
    contractRevision: REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION,
    repositoryIdentity:
      "logical_common_git_metadata_plus_worktree_instance_filesystem_identity",
    revision: "exact_head_object_id_reobserved_before_effect_and_result",
    supportedRefs: Object.freeze([
      "loose_heads_tags",
      "packed_heads_tags",
      "detached_head",
    ]),
    pathReported: false,
    callerRevisionAccepted: false,
    internalSourceBorrow:
      "same_runtime_owned_binding_and_current_revision_only",
    runtimeSupportedObjectFormats: Object.freeze(["sha1"]),
    unsupportedObjectFormatResult: "fail_closed_before_operation_effect",
    providerEffectAllowed: false,
  });
}
