/**
 * Repository単体Workbenchの変更候補確認・採用・破棄を実構成する。
 *
 * @packageDocumentation
 * @responsibility Candidate Storeの安全な確認投影と、Orchestratorによる明示採用、確認付き破棄を分離して提供する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @boundary Workbench、Coordinator Candidate Store、OrchestratorおよびCanonical Repositoryの境界。
 * @effect 確認はEffect 0。明示採用はOrchestrator経由でRepositoryを変更し、確認付き破棄は候補Storeを変更する。
 * @security Candidate IDをAuthorityとして扱わず、検証済みRepository Rootと現在操作の明示確認を必須にする。
 */
import { createHash } from "node:crypto";

import {
  adoptOrchestratorExistingCandidate,
  type OrchestratorCandidateAdoptionResult,
} from "../../../orchestrator/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository/location.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "../candidate/bundle-store.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "../../../orchestrator/src/candidate/integration-adapter.ts";
import {
  createCurrentOrchestratorPersistencePorts as createOrchestratorPersistencePorts,
  createOrchestratorSnapshotIntegrationRecordPort as createOrchestratorIntegrationRecordAdapter,
  maintainOrchestratorSnapshot,
} from "../../../orchestrator/src/index.ts";
import {
  createOrchestratorWindowsPlatformAdapter,
  observeOrchestratorPlatformFamily,
} from "../../../orchestrator/src/platform/windows-adapter.ts";

const CANDIDATE_ID = /^candidate\.[0-9a-f]{64}\.[0-9a-f]{64}$/u;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * Workbenchへ公開する変更候補の安全な確認投影を定義する。
 *
 * @responsibility 候補内容を公開せず、Identity、分類、期限、基準Revision、Hashおよび変更Pathだけを示す。
 * @trace ARCH-000015
 * @shape 候補Identityと採用判断に必要なMetadataを持つ。
 * @invariant Entry内容、Host Path、秘密値および採用Authorityを含めない。
 * @boundary Candidate StoreとWorkbench表示Modelの境界。
 * @security changedPathsはRepository相対Pathであり読取りAuthorityではない。
 * @compatibility Workbenchは全Propertyを表示前にApplication結果のstatusで囲う。
 */
export type WorkbenchCandidateReview = Readonly<{
  candidateId: string;
  informationClassification: "public" | "internal" | "confidential";
  expiresAtMs: number;
  baseRevision: string;
  candidateHash: string;
  patchHash: string;
  changedPaths: readonly string[];
}>;

/**
 * Workbench変更候補Applicationの確認結果を定義する。
 *
 * @responsibility 利用可能候補と観測不能・不在を明示的に区別する。
 * @trace ARCH-000015
 * @shape 状態、理由および任意の安全な確認投影を持つ。
 * @invariant availableだけがcandidateを持つ。
 * @boundary Coordinator ApplicationとWorkbenchの境界。
 * @security 下位StoreのPathや生内容を公開しない。
 * @compatibility statusとcandidateの相関を維持する。
 */
export type WorkbenchCandidateReviewResult = Readonly<{
  status: "available" | "blocked";
  reason: string;
  candidate: WorkbenchCandidateReview | null;
}>;

/**
 * Workbench変更候補Applicationの操作結果を定義する。
 *
 * @responsibility 採用・破棄の完了、Effect状態、回復要否およびReceiptを同じSchemaで返す。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @shape 操作、状態、理由、Candidate／Receipt Identity、Effect・cleanup・回復情報を持つ。
 * @invariant completedは対象操作のEffectが確定し、blockedを成功へ畳まない。
 * @boundary Coordinator ApplicationとWorkbenchの境界。
 * @security Capability、Host Path、候補内容および秘密値を含めない。
 * @compatibility Workbenchはoperationごとの完了表示を分ける。
 */
export type WorkbenchCandidateActionResult = Readonly<{
  operation: "adopt" | "discard";
  status: "completed" | "blocked";
  reason: string;
  candidateId: string | null;
  receiptId: string | null;
  effectIssued: boolean;
  effectStateUnknown: boolean;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  recoveryIds: readonly string[];
}>;

/**
 * 候補操作の停止結果を構築する。
 *
 * @responsibility Effect 0または観測不能の停止状態を固定Workbench Schemaへ収束する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @input operation、candidateId、reason、任意のEffect・回復情報。
 * @returns 凍結したblocked結果を返す。
 * @precondition reasonは固定語彙であり未信頼本文を含まない。
 * @postcondition 全Fieldを省略せず返す。
 * @effect N/A: 値の構築だけを行う。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant recoveryIdsを参照共有しない。
 * @boundary Coordinator内部結果とWorkbench公開結果の境界。
 * @security Candidate ID以外のStore内部情報を含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function blocked(
  operation: "adopt" | "discard",
  candidateId: string | null,
  reason: string,
  options: Readonly<{
    effectIssued?: boolean;
    effectStateUnknown?: boolean;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    recoveryIds?: readonly string[];
    receiptId?: string | null;
  }> = {},
): WorkbenchCandidateActionResult {
  return Object.freeze({
    operation,
    status: "blocked",
    reason,
    candidateId,
    receiptId: options.receiptId ?? null,
    effectIssued: options.effectIssued ?? false,
    effectStateUnknown: options.effectStateUnknown ?? false,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
  });
}

/**
 * Store読取り結果をWorkbenchの安全な候補確認投影へ変換する。
 *
 * @responsibility Candidate Bundleの完全性を再検証し、Entry内容を除外した判断Metadataだけを返す。
 * @trace ARCH-000015
 * @input candidateId: 要求Identity、value: Candidate Store読取り結果。
 * @returns availableな確認投影、またはblockedを返す。
 * @precondition Candidate Storeが自身のStable ReadとHash検証を完了している。
 * @postcondition Candidate ID、Bundle Identity、分類、期限および変更Pathが成立した場合だけavailableを返す。
 * @effect N/A: 値の検証と縮約だけを行う。
 * @failure 不在、期限切れ、破損またはSchema不一致をblockedへ閉じる。
 * @invariant Entry内容とHost Pathを結果へ複製しない。
 * @boundary Candidate Store結果とWorkbench確認投影の境界。
 * @security Pathは通常のRepository相対表記だけを受理する。
 * @concurrency N/A: 一回のStore Snapshotだけを処理する。
 */
function inspectReview(
  candidateId: string,
  value: ReturnType<typeof readRuntimeOwnedCandidateBundle>,
): WorkbenchCandidateReviewResult {
  if (
    value === null ||
    value.status !== "exported" ||
    value.candidateId !== candidateId ||
    !CANDIDATE_ID.test(value.candidateId) ||
    !Number.isSafeInteger(value.expiresAtMs) ||
    value.expiresAtMs <= Date.now() ||
    !["public", "internal", "confidential"].includes(
      value.informationClassification,
    ) ||
    value.bundle.schema !== "crdd-coordinator-candidate-bundle/v1" ||
    !REVISION.test(value.bundle.baseCommit) ||
    !HASH.test(value.bundle.contentManifestHash) ||
    !HASH.test(value.bundle.patchHash) ||
    !Array.isArray(value.bundle.changedPaths) ||
    value.bundle.changedPaths.length === 0 ||
    value.bundle.changedPaths.length > 1024 ||
    value.bundle.changedPaths.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.length === 0 ||
        entry.startsWith("/") ||
        entry.includes("\\") ||
        entry.split("/").some((segment) => segment === ".." || segment === ""),
    ) ||
    new Set(value.bundle.changedPaths).size !== value.bundle.changedPaths.length
  )
    return Object.freeze({
      status: "blocked",
      reason: "workbench_candidate_review_unavailable",
      candidate: null,
    });
  return Object.freeze({
    status: "available",
    reason: "workbench_candidate_review_available",
    candidate: Object.freeze({
      candidateId,
      informationClassification: value.informationClassification,
      expiresAtMs: value.expiresAtMs,
      baseRevision: value.bundle.baseCommit,
      candidateHash: value.bundle.contentManifestHash,
      patchHash: value.bundle.patchHash,
      changedPaths: Object.freeze([...value.bundle.changedPaths]),
    }),
  });
}

/**
 * Orchestrator採用結果をWorkbench操作結果へ投影する。
 *
 * @responsibility Effect、cleanup、RecoveryおよびReceiptの意味を保ったままUI用Schemaへ変換する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @input value: Orchestrator採用結果。
 * @returns Workbench adopt結果を返す。
 * @precondition valueはOrchestrator公開Applicationから返された閉じた結果である。
 * @postcondition completed／blockedを変更せず全安全情報を保持する。
 * @effect N/A: 値の投影だけを行う。
 * @failure N/A: Orchestrator結果を再解釈しない。
 * @invariant Recovery Identityを変更しない。
 * @boundary OrchestratorとWorkbench Applicationの結果境界。
 * @security 下位CapabilityやHost Pathを追加しない。
 * @concurrency N/A: 一結果を同期変換する。
 */
function adoptionResult(
  value: OrchestratorCandidateAdoptionResult,
): WorkbenchCandidateActionResult {
  return Object.freeze({
    operation: "adopt",
    status: value.status,
    reason: value.reason,
    candidateId: value.candidateId,
    receiptId: value.receiptId,
    effectIssued: value.effectIssued,
    effectStateUnknown: value.effectStateUnknown,
    cleanupConfirmed: value.cleanupConfirmed,
    manualRecoveryRequired: value.manualRecoveryRequired,
    recoveryIds: Object.freeze([...value.recoveryIds]),
  });
}

/**
 * Repository単体Workbench向け変更候補Applicationを構築する。
 *
 * @responsibility 検証済みRootとProject IDへ候補確認、明示採用および確認付き破棄を結合する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @input repositoryRootCapability: Version Control発行Root、projectId: Project ContextのProject ID。
 * @returns review、adopt、discardを持つ候補操作を返す。利用側の契約へ構造的に適合する。
 * @precondition Root CapabilityとProject IDはRepository Project Contextを読取ったComposition Rootが供給する。
 * @postcondition 全操作でRootをCapabilityから再解決し、採用はOrchestrator Lease経由だけで行う。
 * @effect reviewはStore読取り、adoptはRepository採用と耐久記録、discardは候補Store削除を行い得る。
 * @failure Root、Project、候補、確認、Lease、Revision、Scope、Receiptまたはcleanup不成立をblockedへ閉じる。
 * @invariant 採用と破棄をCommitまたはPushへ拡張しない。
 * @boundary Workbench、Candidate Store、Orchestrator、Repository FilesystemのComposition境界。
 * @security Candidate ID、外部送信確認または表示済みMetadataを採用Authorityへ昇格しない。
 * @concurrency 採用ごとに専用AdapterとCanonical Adoption Leaseを使用する。
 */
export function createRepositoryWorkbenchCandidateActions(
  repositoryRootCapability: VerifiedRepositoryRoot,
  projectId: string,
) {
  return Object.freeze({
    /**
     * Workbench変更候補の確認・採用・破棄境界におけるreviewの処理境界を固定する。
     *
     * @responsibility Workbench変更候補の確認・採用・破棄境界に必要な入力処理、失敗分類および結果生成を所有する。
     * @trace ARCH-000015
     * @input 宣言された引数だけを受け取る。
     * @returns 宣言された結果型を返す。
     * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
     * @postcondition 成功時だけ検証済みの結果を返す。
     * @effect 宣言または注入された依存以外へEffectを発行しない。
     * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
     * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
     * @boundary 呼出し元と本Moduleの局所責務境界。
     * @security 秘密値と未許可情報を出力またはlogへ追加しない。
     * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
     */
    async review(candidateId: string): Promise<WorkbenchCandidateReviewResult> {
      const repositoryRoot = resolveVerifiedRepositoryRoot(
        repositoryRootCapability,
      );
      if (
        repositoryRoot === null ||
        !STABLE_ID.test(projectId) ||
        !CANDIDATE_ID.test(candidateId)
      )
        return Object.freeze({
          status: "blocked" as const,
          reason: "workbench_candidate_review_unavailable",
          candidate: null,
        });
      return inspectReview(
        candidateId,
        readRuntimeOwnedCandidateBundle(candidateId),
      );
    },

    /**
     * Workbench変更候補の確認・採用・破棄境界におけるadoptの処理境界を固定する。
     *
     * @responsibility Workbench変更候補の確認・採用・破棄境界に必要な入力処理、失敗分類および結果生成を所有する。
     * @trace ARCH-000015
     * @input 宣言された引数だけを受け取る。
     * @returns 宣言された結果型を返す。
     * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
     * @postcondition 成功時だけ検証済みの結果を返す。
     * @effect 宣言または注入された依存以外へEffectを発行しない。
     * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
     * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
     * @boundary 呼出し元と本Moduleの局所責務境界。
     * @security 秘密値と未許可情報を出力またはlogへ追加しない。
     * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
     */

    async adopt(
      candidateId: string,
      confirmed: boolean,
    ): Promise<WorkbenchCandidateActionResult> {
      if (!confirmed)
        return blocked(
          "adopt",
          CANDIDATE_ID.test(candidateId) ? candidateId : null,
          "workbench_candidate_adoption_confirmation_required",
        );
      const repositoryRoot = resolveVerifiedRepositoryRoot(
        repositoryRootCapability,
      );
      if (
        repositoryRoot === null ||
        !STABLE_ID.test(projectId) ||
        !CANDIDATE_ID.test(candidateId)
      )
        return blocked(
          "adopt",
          null,
          "workbench_candidate_adoption_input_invalid",
        );
      const review = inspectReview(
        candidateId,
        readRuntimeOwnedCandidateBundle(candidateId),
      );
      if (review.status !== "available" || review.candidate === null)
        return blocked(
          "adopt",
          candidateId,
          "workbench_candidate_review_unavailable",
        );

      const adapter =
        createRuntimeOwnedProjectCandidateIntegrationAdapter(repositoryRoot);
      const bound = adapter.bindPublishedCandidate(candidateId);
      if (
        bound === null ||
        bound.candidateHash !== review.candidate.candidateHash ||
        bound.baseRevision !== review.candidate.baseRevision ||
        JSON.stringify(bound.changedPaths) !==
          JSON.stringify(review.candidate.changedPaths)
      )
        return blocked(
          "adopt",
          candidateId,
          "workbench_candidate_identity_changed",
        );

      const observedPlatform = observeOrchestratorPlatformFamily();
      const platform =
        observedPlatform.status === "observed" &&
        observedPlatform.platformFamily === "windows"
          ? createOrchestratorWindowsPlatformAdapter()
          : null;
      /**
       * Canonical Adoption Leaseの既存所有者を観測する。
       *
       * @responsibility Platform Adapterが提供する所有者観測をOrchestrator Lease Portへ限定して渡す。
       * @trace ARCH-000004
       * @trace ARCH-000015
       * @input owner: Process IDとGenerationを持つ既存Lease所有者。
       * @returns Platform観測結果、または観測不能結果を返す。
       * @precondition ownerはOrchestrator Lease Storeが返した閉じたIdentityである。
       * @postcondition Windows Platform Adapterが利用可能な場合だけ実観測を返す。
       * @effect N/A: Process状態の読取りだけを行う。
       * @failure Platformまたは操作が利用不能ならunknownへ閉じる。
       * @invariant 観測不能を不存在へ畳まない。
       * @boundary Orchestrator Lease PortとPlatform Access Adapterの境界。
       * @security Process観測結果から新しいAuthorityを生成しない。
       * @concurrency 同じowner Identityに対する一回の観測だけを返す。
       */
      const observeLeaseOwner = (
        owner: Readonly<{
          ownerProcessId: number;
          ownerGeneration: string;
        }>,
      ) => {
        const lockLease = platform?.operations.lock_lease as
          | Readonly<{ observeLeaseOwner: (value: typeof owner) => unknown }>
          | undefined;
        return (
          lockLease?.observeLeaseOwner(owner) ??
          Object.freeze({
            status: "unknown",
            ownerProcessId: owner.ownerProcessId,
            ownerGeneration: owner.ownerGeneration,
          })
        );
      };
      const repositoryBindingId = `binding-${createHash("sha256")
        .update(repositoryRoot)
        .digest("hex")
        .slice(0, 40)}`;
      const operationId = createHash("sha256")
        .update(candidateId)
        .digest("hex")
        .slice(0, 40);
      const persistence = createOrchestratorPersistencePorts(
        repositoryRoot,
        repositoryBindingId,
      );
      const adopted = await adoptOrchestratorExistingCandidate(
        Object.freeze({
          candidate: Object.freeze({ ...adapter, observeLeaseOwner }),
          lease: persistence.lease,
          records: createOrchestratorIntegrationRecordAdapter({
            workingDirectory: repositoryRoot,
            repositoryBindingId,
            projectId,
            milestoneId: "workbench-ai-change-candidate",
            queueId: `workbench-adoption-${operationId}`,
          }),
        }),
        Object.freeze({
          projectId,
          candidate: bound,
          allowedPaths: review.candidate.changedPaths,
          adoptionAuthorized: true,
        }),
      );
      if (
        adopted.status === "completed" ||
        (adopted.reason ===
          "orchestrator_adoption_revision_or_scope_mismatch" &&
          !adopted.effectIssued &&
          !adopted.effectStateUnknown &&
          adopted.cleanupConfirmed &&
          !adopted.manualRecoveryRequired &&
          adopted.recoveryIds.length === 0)
      ) {
        const maintained = maintainOrchestratorSnapshot(
          repositoryRoot,
          repositoryBindingId,
        );
        if (maintained.status !== "completed")
          return adoptionResult({
            ...adopted,
            status: "blocked",
            reason: maintained.reason,
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectStateUnknown: true,
          });
      }
      return adoptionResult(adopted);
    },

    /**
     * Workbench変更候補の確認・採用・破棄境界におけるdiscardの処理境界を固定する。
     *
     * @responsibility Workbench変更候補の確認・採用・破棄境界に必要な入力処理、失敗分類および結果生成を所有する。
     * @trace ARCH-000015
     * @input 宣言された引数だけを受け取る。
     * @returns 宣言された結果型を返す。
     * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
     * @postcondition 成功時だけ検証済みの結果を返す。
     * @effect 宣言または注入された依存以外へEffectを発行しない。
     * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
     * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
     * @boundary 呼出し元と本Moduleの局所責務境界。
     * @security 秘密値と未許可情報を出力またはlogへ追加しない。
     * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
     */

    async discard(
      candidateId: string,
      confirmed: boolean,
    ): Promise<WorkbenchCandidateActionResult> {
      if (!confirmed)
        return blocked(
          "discard",
          CANDIDATE_ID.test(candidateId) ? candidateId : null,
          "workbench_candidate_discard_confirmation_required",
        );
      if (
        resolveVerifiedRepositoryRoot(repositoryRootCapability) === null ||
        !STABLE_ID.test(projectId) ||
        !CANDIDATE_ID.test(candidateId)
      )
        return blocked(
          "discard",
          null,
          "workbench_candidate_discard_input_invalid",
        );
      const discarded = discardRuntimeOwnedCandidateBundle(candidateId);
      if (discarded.status === "discarded")
        return Object.freeze({
          operation: "discard" as const,
          status: "completed" as const,
          reason: "workbench_candidate_discarded",
          candidateId,
          receiptId: null,
          effectIssued: true,
          effectStateUnknown: false,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          recoveryIds: Object.freeze([]),
        });
      const detail = discarded as Readonly<{
        reason?: unknown;
        manualRecoveryRequired?: unknown;
        recoveryId?: unknown;
        storeRecoveryId?: unknown;
      }>;
      const recoveryIds = [detail.recoveryId, detail.storeRecoveryId].filter(
        (value): value is string => typeof value === "string",
      );
      return blocked(
        "discard",
        candidateId,
        typeof detail.reason === "string"
          ? detail.reason
          : "workbench_candidate_discard_unknown",
        {
          effectStateUnknown: detail.manualRecoveryRequired === true,
          cleanupConfirmed: detail.manualRecoveryRequired !== true,
          manualRecoveryRequired: detail.manualRecoveryRequired === true,
          recoveryIds,
        },
      );
    },
  });
}
