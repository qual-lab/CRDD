/**
 * 既存の変更候補をCanonical Repositoryへ採用するApplication境界。
 *
 * @packageDocumentation
 * @responsibility 候補生成とは分離した明示Authority、排他Lease、現在Revision再観測、採用Receiptおよび回復結果を所有する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @boundary Project Runtime Applicationと候補・Lease・耐久記録Portの境界。
 * @effect 明示Authorityがあり全事前条件が成立した場合だけ候補採用と耐久記録を発行する。
 * @concurrency Canonical Adoption Leaseを一件だけ取得し、全終了経路で解放を試みる。
 * @security Candidate IDをAuthorityとして扱わず、明示されたProject・Path・候補Identityだけを利用する。
 */
import type {
  ProjectRuntimeCandidateAdoptionReceipt,
  ProjectRuntimeCandidatePort,
} from "../ports/candidate-port.ts";
import type { ProjectRuntimeIntegrationRecordPort } from "../ports/integration-record-port.ts";
import type { ProjectRuntimeLeasePort } from "../ports/lease-port.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";
import {
  normalizeRepositoryRelativePath,
  repositoryPathWithin,
} from "../boundary/repository-relative-path.ts";

export const PROJECT_RUNTIME_CANDIDATE_ADOPTION_CONTRACT =
  "crdd/project-runtime/candidate-adoption/v1" as const;

/**
 * 採用対象となる既存候補の閉じたIdentityを定義する。
 *
 * @responsibility Candidate Storeの内容全体ではなく、採用時に再照合するIdentityと変更Pathだけを保持する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @shape Candidate ID、内容Hash、基準Revisionおよび変更Pathの閉集合を持つ。
 * @invariant 候補内容そのものや採用Authorityを含めない。
 * @boundary 候補Store投影とProject Runtime Applicationの境界。
 * @security Candidate IDは参照IdentityでありAuthorityではない。
 * @compatibility 利用側は宣言済みPropertyだけへ依存する。
 */
export type ProjectRuntimeExistingCandidate = Readonly<{
  candidateId: string;
  candidateHash: string;
  baseRevision: string;
  changedPaths: readonly string[];
}>;

/**
 * 既存候補採用Applicationの入力を定義する。
 *
 * @responsibility Project、候補、許可Pathおよび一回の明示採用Authorityを同じ要求へ結合する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @shape 採用対象Project、候補、許可Pathおよび明示確認を持つ。
 * @invariant 候補生成時の外部送信確認を採用Authorityへ流用しない。
 * @boundary Workbench等の利用側とProject Runtime Applicationの境界。
 * @security adoptionAuthorizedは現在操作に限るbooleanであり再利用可能Capabilityではない。
 * @compatibility 利用側は全Propertyを明示する。
 */
export type ProjectRuntimeCandidateAdoptionInput = Readonly<{
  projectId: string;
  candidate: ProjectRuntimeExistingCandidate;
  allowedPaths: readonly string[];
  adoptionAuthorized: boolean;
}>;

/**
 * 既存候補採用Applicationの依存Portを定義する。
 *
 * @responsibility 候補の現在観測・採用、Leaseおよび耐久記録だけをApplicationへ供給する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @shape Candidate Portの採用部分、Lease Port、Integration Record Portを持つ。
 * @invariant 候補生成PortやQueue／State Portを要求しない。
 * @boundary Project Runtime Applicationと外部Adapterの境界。
 * @security Authority生成をPortへ委譲せず、入力Authorityを縮小して使用する。
 * @compatibility 既存Project Runtime Portの部分Contractへ依存する。
 */
export type ProjectRuntimeCandidateAdoptionDependencies = Readonly<{
  candidate: Pick<
    ProjectRuntimeCandidatePort,
    "observeCanonicalRepository" | "observeLeaseOwner" | "adoptCandidate"
  >;
  lease: ProjectRuntimeLeasePort;
  records: ProjectRuntimeIntegrationRecordPort;
}>;

/**
 * 既存候補採用結果を定義する。
 *
 * @responsibility Effectの未発行・確定・不明、回復要否およびReceiptを同じ結果で表す。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @shape Contract、状態、理由、候補・Receipt Identity、Effect・cleanup・回復情報を持つ。
 * @invariant completedはReceiptとsettled Effectを持ち、blockedを成功へ畳まない。
 * @boundary Project Runtime Applicationと利用側の公開結果境界。
 * @security Host Path、候補内容、秘密値およびLease Capabilityを公開しない。
 * @compatibility 利用側はcontractとstatusを先に検証する。
 */
export type ProjectRuntimeCandidateAdoptionResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_CANDIDATE_ADOPTION_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  projectId: string;
  candidateId: string | null;
  receiptId: string | null;
  effectIssued: boolean;
  effectStateUnknown: boolean;
  retryAllowed: boolean;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  recoveryIds: readonly string[];
}>;

/**
 * 安定Identityの形式を判定する。
 *
 * @responsibility Project、CandidateおよびReceipt Identityの字句境界を所有する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input value: 未信頼値、maximum: 最大文字数。
 * @returns 許可形式ならtrueを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition 先頭英数字と限定文字だけを受理する。
 * @effect N/A: 入力の判定だけを行う。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant 入力を変更しない。
 * @boundary 未信頼値とApplication内Identityの境界。
 * @security 制御文字、Path区切りおよび空値を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function validId(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Git Revision形式を判定する。
 *
 * @responsibility 採用基準Revisionの固定長Hash境界を所有する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input value: 未信頼値、allowEmpty: 空配列を許可するか。
 * @returns 40〜64桁の小文字hexならtrueを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition 許可形式だけをtrueにする。
 * @effect N/A: 入力の判定だけを行う。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant 入力を変更しない。
 * @boundary 未信頼値とRevision Identityの境界。
 * @security 任意RefやCommand断片を受理しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * SHA-256 Hash形式を判定する。
 *
 * @responsibility Candidate内容Hashの字句境界を所有する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input value: 未信頼値。
 * @returns 64桁の小文字hexならtrueを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition 許可形式だけをtrueにする。
 * @effect N/A: 入力の判定だけを行う。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant 入力を変更しない。
 * @boundary 未信頼値と内容Hashの境界。
 * @security 任意TextをIdentityとして受理しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

/**
 * Repository相対Pathの閉配列を検証する。
 *
 * @responsibility Path配列の件数、重複およびRepository相対形式を所有する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input value: 未信頼値。
 * @returns 検証済みの凍結Path配列、またはnullを返す。
 * @precondition N/A: 任意値を受け付け、allowEmpty省略時はfalseとする。
 * @postcondition 0または1〜1024件の一意なRepository相対Pathだけを返す。
 * @effect N/A: Snapshotと判定だけを行う。
 * @failure N/A: 不正値はnullへ閉じる。
 * @invariant 入力配列を参照共有しない。
 * @boundary 未信頼配列と採用Scopeの境界。
 * @security 絶対Path、親遡及および重複Pathを拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectPaths(
  value: unknown,
  isEmptyAllowed = false,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, 1024);
  if (
    snapshot.status !== "ok" ||
    (!isEmptyAllowed && snapshot.value.length === 0)
  )
    return null;
  const paths: string[] = [];
  for (const entry of snapshot.value) {
    const normalized = normalizeRepositoryRelativePath(entry);
    if (normalized === null || paths.includes(normalized)) return null;
    paths.push(normalized);
  }
  return Object.freeze(paths);
}

/**
 * 採用候補を検証する。
 *
 * @responsibility Candidate Store投影から採用に必要な最小Identityを閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input raw: 未信頼候補。
 * @returns 検証済み候補、またはnullを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition exact key、Identity、Hash、RevisionおよびPathが成立した候補だけを返す。
 * @effect N/A: 値のSnapshotと検証だけを行う。
 * @failure N/A: 契約外値はnullへ閉じる。
 * @invariant 追加Propertyを採用判断へ持ち込まない。
 * @boundary Candidate Store投影とProject Runtime Applicationの境界。
 * @security 候補内容や外部Authorityを読み込まない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function inspectProjectRuntimeExistingCandidate(
  raw: unknown,
): ProjectRuntimeExistingCandidate | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "candidateId",
      "candidateHash",
      "baseRevision",
      "changedPaths",
    ] as const),
  );
  const changedPaths = inspectPaths(value?.changedPaths);
  return value &&
    validId(value.candidateId) &&
    validHash(value.candidateHash) &&
    validRevision(value.baseRevision) &&
    changedPaths
    ? Object.freeze({
        candidateId: value.candidateId,
        candidateHash: value.candidateHash,
        baseRevision: value.baseRevision,
        changedPaths,
      })
    : null;
}

/**
 * Candidate Portの停止結果を検証する。
 *
 * @responsibility 下位境界のEffect・cleanup・回復情報を欠落させず縮約する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input raw: 未信頼Port結果。
 * @returns 検証済み停止情報、またはnullを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition exact keyと型が成立するblocked結果だけを返す。
 * @effect N/A: 値のSnapshotと検証だけを行う。
 * @failure N/A: 契約外値はnullへ閉じる。
 * @invariant effectStateUnknownをfalseへ推測しない。
 * @boundary Candidate AdapterとProject Runtime Applicationの境界。
 * @security Recovery参照以外の下位情報を公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectBlocked(raw: unknown) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "reason",
      "effectIssued",
      "effectStateUnknown",
      "cleanupConfirmed",
      "retryAllowed",
      "recoveryReference",
    ] as const),
  );
  if (
    value?.status !== "blocked" ||
    typeof value.reason !== "string" ||
    typeof value.effectIssued !== "boolean" ||
    typeof value.effectStateUnknown !== "boolean" ||
    typeof value.cleanupConfirmed !== "boolean" ||
    typeof value.retryAllowed !== "boolean" ||
    (value.recoveryReference !== null &&
      typeof value.recoveryReference !== "string")
  )
    return null;
  return Object.freeze({
    reason: value.reason,
    effectIssued: value.effectIssued,
    effectStateUnknown: value.effectStateUnknown,
    cleanupConfirmed: value.cleanupConfirmed,
    retryAllowed: value.retryAllowed,
    recoveryReference: value.recoveryReference as string | null,
  });
}

/**
 * Canonical Repository観測結果を検証する。
 *
 * @responsibility 現在Revision、変更対象のdirty状態および観測Pathを閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input raw: 未信頼観測結果。
 * @returns 検証済み観測、またはnullを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition exact keyとRevision・Path契約が成立した値だけを返す。
 * @effect N/A: 値のSnapshotと検証だけを行う。
 * @failure N/A: 契約外値はnullへ閉じる。
 * @invariant dirtyを空Pathから推測しない。
 * @boundary Repository AdapterとProject Runtime Applicationの境界。
 * @security Host Pathや未許可Pathを公開結果へ持ち込まない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectRepository(raw: unknown) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "repositoryRevision",
      "dirty",
      "observedPaths",
    ] as const),
  );
  const observedPaths = inspectPaths(value?.observedPaths ?? [], true);
  if (
    value?.status !== "observed" ||
    !validRevision(value.repositoryRevision) ||
    typeof value.dirty !== "boolean" ||
    observedPaths === null
  )
    return null;
  return Object.freeze({
    repositoryRevision: value.repositoryRevision,
    dirty: value.dirty,
    observedPaths,
  });
}

/**
 * 採用Receiptを検証する。
 *
 * @responsibility 採用前後Revision、変更Path、cleanupおよびReceipt Identityを閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input raw: 未信頼採用結果。
 * @returns 検証済みReceipt、またはnullを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition completed、exact keyおよび全Identityが成立したReceiptだけを返す。
 * @effect N/A: 値のSnapshotと検証だけを行う。
 * @failure N/A: 契約外値はnullへ閉じる。
 * @invariant cleanup未確認の結果をReceiptとして採用しない。
 * @boundary Candidate AdapterとProject Runtime Applicationの境界。
 * @security Host Pathや候補内容を公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectReceipt(
  raw: unknown,
): ProjectRuntimeCandidateAdoptionReceipt | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "receiptId",
      "beforeRevision",
      "afterRevision",
      "changedPaths",
      "cleanupConfirmed",
    ] as const),
  );
  const changedPaths = inspectPaths(value?.changedPaths);
  return value?.status === "completed" &&
    validId(value.receiptId) &&
    validRevision(value.beforeRevision) &&
    validRevision(value.afterRevision) &&
    value.cleanupConfirmed === true &&
    changedPaths
    ? Object.freeze({
        status: "completed",
        receiptId: value.receiptId,
        beforeRevision: value.beforeRevision,
        afterRevision: value.afterRevision,
        changedPaths,
        cleanupConfirmed: true,
      })
    : null;
}

/**
 * 採用Applicationの公開結果を構築する。
 *
 * @responsibility 全結果分岐を一つの固定Schemaへ収束する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input input: 採用入力、status: 状態、reason: 理由、options: Effect・回復情報。
 * @returns 凍結した採用結果を返す。
 * @precondition reasonは内部固定語彙である。
 * @postcondition 全Fieldを省略せず返す。
 * @effect N/A: 値の構築だけを行う。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant recoveryIdsを参照共有しない。
 * @boundary Application内部結果と公開結果の境界。
 * @security 候補内容、Host Path、秘密値およびCapabilityを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function result(
  input: ProjectRuntimeCandidateAdoptionInput,
  status: "completed" | "blocked",
  reason: string,
  options: Readonly<{
    receiptId?: string | null;
    effectIssued?: boolean;
    effectStateUnknown?: boolean;
    retryAllowed?: boolean;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    recoveryIds?: readonly string[];
  }> = {},
): ProjectRuntimeCandidateAdoptionResult {
  return Object.freeze({
    contract: PROJECT_RUNTIME_CANDIDATE_ADOPTION_CONTRACT,
    status,
    reason,
    projectId: input.projectId,
    candidateId: validId(input.candidate?.candidateId)
      ? input.candidate.candidateId
      : null,
    receiptId: options.receiptId ?? null,
    effectIssued: options.effectIssued ?? false,
    effectStateUnknown: options.effectStateUnknown ?? false,
    retryAllowed: options.retryAllowed ?? false,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
  });
}

/**
 * 既存変更候補を明示Authorityの下でCanonical Repositoryへ採用する。
 *
 * @responsibility Effect 0の事前検証、旧Lease所有者処置、排他Lease、現在Revision・Scope再観測、採用、耐久Receiptおよび解放を一つのLifecycleで所有する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 * @input dependencies: 候補・Lease・記録Port、input: Project・候補・許可Path・明示Authority。
 * @returns Effect状態とReceiptまたは停止理由を持つ採用結果を返す。
 * @precondition 候補はStoreから読み直したIdentity、allowedPathsは人間が現在確認した範囲である。
 * @postcondition completed時は採用Receiptが耐久記録されLease解放済みであり、blocked時は不明Effectを明示する。
 * @effect 全事前条件成立時だけCanonical Repository変更と耐久記録を発行する。
 * @failure 観測不能、競合、Revision／Scope不一致、採用失敗、記録失敗またはLease解放失敗をblockedへ閉じる。
 * @invariant Candidate IDだけでは採用せず、候補生成時の外部送信確認を採用Authorityへ流用しない。
 * @boundary Workbench等の利用側、Project Runtime、Candidate Adapter、Filesystem Leaseの横断境界。
 * @security 明示されたProject・候補・Path以外へAuthorityを拡張しない。
 * @concurrency Canonical Adoption Leaseを取得し、finallyで解放を試みる。
 */
export async function adoptProjectRuntimeExistingCandidate(
  dependencies: ProjectRuntimeCandidateAdoptionDependencies,
  input: ProjectRuntimeCandidateAdoptionInput,
): Promise<ProjectRuntimeCandidateAdoptionResult> {
  const candidate = inspectProjectRuntimeExistingCandidate(input.candidate);
  const allowedPaths = inspectPaths(input.allowedPaths);
  if (
    !validId(input.projectId) ||
    candidate === null ||
    allowedPaths === null ||
    candidate.changedPaths.some(
      (changedPath) => !repositoryPathWithin(changedPath, allowedPaths),
    )
  )
    return result(
      input,
      "blocked",
      "project_runtime_candidate_adoption_input_invalid",
    );
  if (!input.adoptionAuthorized)
    return result(
      input,
      "blocked",
      "project_runtime_candidate_adoption_authorization_required",
    );
  if (typeof dependencies.candidate.observeLeaseOwner !== "function")
    return result(
      input,
      "blocked",
      "project_runtime_lease_owner_observation_unavailable",
      { cleanupConfirmed: false, manualRecoveryRequired: true },
    );

  const prepared = dependencies.lease.reconcileAdoptionOwnerLoss(
    input.projectId,
    dependencies.candidate.observeLeaseOwner,
  );
  if (prepared.status !== "completed")
    return result(input, "blocked", prepared.reason, {
      cleanupConfirmed: !prepared.manualRecoveryRequired,
      manualRecoveryRequired: prepared.manualRecoveryRequired,
      recoveryIds:
        prepared.recoveryId === null
          ? Object.freeze([])
          : Object.freeze([prepared.recoveryId]),
    });

  const leaseResult = dependencies.lease.acquire(
    input.projectId,
    "canonical",
    "canonical-adoption",
  );
  if (leaseResult.status !== "completed")
    return result(input, "blocked", leaseResult.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: leaseResult.manualRecoveryRequired,
      recoveryIds:
        leaseResult.recoveryId === null
          ? Object.freeze([])
          : Object.freeze([leaseResult.recoveryId]),
    });

  const lease = leaseResult.value;
  let finalResult: ProjectRuntimeCandidateAdoptionResult | null = null;
  let isAdoptionAttempted = false;
  try {
    const rawObservation = dependencies.candidate.observeCanonicalRepository();
    const observationBlocked = inspectBlocked(rawObservation);
    const observed = inspectRepository(rawObservation);
    if (observationBlocked)
      finalResult = result(input, "blocked", observationBlocked.reason, {
        effectIssued: observationBlocked.effectIssued,
        effectStateUnknown: observationBlocked.effectStateUnknown,
        retryAllowed: observationBlocked.retryAllowed,
        cleanupConfirmed: observationBlocked.cleanupConfirmed,
        manualRecoveryRequired:
          observationBlocked.effectStateUnknown ||
          !observationBlocked.cleanupConfirmed,
        recoveryIds:
          observationBlocked.recoveryReference === null
            ? Object.freeze([])
            : Object.freeze([observationBlocked.recoveryReference]),
      });
    else if (
      !observed ||
      observed.repositoryRevision !== candidate.baseRevision ||
      observed.dirty ||
      observed.observedPaths.some(
        (observedPath) => !repositoryPathWithin(observedPath, allowedPaths),
      )
    )
      finalResult = result(
        input,
        "blocked",
        "project_runtime_adoption_revision_or_scope_mismatch",
      );
    else {
      let rawReceipt: unknown = null;
      try {
        isAdoptionAttempted = true;
        rawReceipt = await dependencies.candidate.adoptCandidate(candidate);
      } catch {
        rawReceipt = null;
      }
      const adoptionBlocked = inspectBlocked(rawReceipt);
      const receipt = inspectReceipt(rawReceipt);
      if (adoptionBlocked)
        finalResult = result(input, "blocked", adoptionBlocked.reason, {
          effectIssued: adoptionBlocked.effectIssued,
          effectStateUnknown: adoptionBlocked.effectStateUnknown,
          retryAllowed: adoptionBlocked.retryAllowed,
          cleanupConfirmed: adoptionBlocked.cleanupConfirmed,
          manualRecoveryRequired:
            adoptionBlocked.effectStateUnknown ||
            !adoptionBlocked.cleanupConfirmed,
          recoveryIds:
            adoptionBlocked.recoveryReference === null
              ? Object.freeze([])
              : Object.freeze([adoptionBlocked.recoveryReference]),
        });
      else if (
        !receipt ||
        receipt.beforeRevision !== candidate.baseRevision ||
        receipt.changedPaths.length !== candidate.changedPaths.length ||
        !receipt.changedPaths.every((value) =>
          candidate.changedPaths.includes(value),
        )
      )
        finalResult = result(
          input,
          "blocked",
          "project_runtime_adoption_receipt_invalid",
          {
            effectIssued: true,
            effectStateUnknown: true,
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
          },
        );
      else {
        const recorded = dependencies.records.write({
          kind: "adoption",
          identity: receipt.receiptId,
          value: receipt,
        });
        finalResult =
          recorded.status === "completed"
            ? result(input, "completed", "project_runtime_candidate_adopted", {
                receiptId: receipt.receiptId,
                effectIssued: true,
              })
            : result(
                input,
                "blocked",
                "project_runtime_adoption_record_unknown",
                {
                  receiptId: receipt.receiptId,
                  effectIssued: true,
                  effectStateUnknown: true,
                  cleanupConfirmed: false,
                  manualRecoveryRequired: true,
                },
              );
      }
    }
  } catch {
    finalResult = result(
      input,
      "blocked",
      "project_runtime_adoption_observation_unknown",
      {
        effectIssued: isAdoptionAttempted,
        effectStateUnknown: isAdoptionAttempted,
        cleanupConfirmed: false,
        manualRecoveryRequired: isAdoptionAttempted,
      },
    );
  } finally {
    const released = lease.release();
    if (released.status !== "completed")
      finalResult = result(
        input,
        "blocked",
        "project_runtime_adoption_lease_release_unknown",
        {
          effectIssued: finalResult?.effectIssued ?? false,
          effectStateUnknown: true,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        },
      );
  }
  if (
    !isAdoptionAttempted &&
    finalResult?.reason ===
      "project_runtime_adoption_revision_or_scope_mismatch" &&
    !finalResult.effectIssued &&
    !finalResult.effectStateUnknown &&
    finalResult.cleanupConfirmed &&
    !finalResult.manualRecoveryRequired &&
    finalResult.recoveryIds.length === 0
  ) {
    let rejectionRecorded = false;
    try {
      const recorded = dependencies.records.write({
        kind: "adoption",
        identity: lease.ownerGeneration,
        value: {
          status: "rejected",
          reason: finalResult.reason,
          ownerGeneration: lease.ownerGeneration,
          effectIssued: false,
          cleanupConfirmed: true,
        },
      });
      rejectionRecorded = recorded?.status === "completed";
    } catch {
      rejectionRecorded = false;
    }
    if (!rejectionRecorded)
      finalResult = result(
        input,
        "blocked",
        "project_runtime_adoption_rejection_record_unknown",
        {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        },
      );
  }
  return (
    finalResult ??
    result(input, "blocked", "project_runtime_adoption_observation_unknown", {
      effectStateUnknown: true,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    })
  );
}
