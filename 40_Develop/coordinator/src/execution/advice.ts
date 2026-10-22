/**
 * 読取り助言の受付・送信同意・Provider配送・結果受理を所有する。
 *
 * @responsibility ContextとProfileを今回の一回送信へ結合し、元結果・cleanup・回復参照を保持する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import { createFilesystemRepositoryObservationPort } from "../../../domain-model/src/index.ts";
import type {
  ProviderAdviceRuntime,
  ProviderAdviceRuntimeResult,
} from "./provider-types.ts";
import {
  createRuntimeOwnedProviderAdviceRuntime,
  classifyProviderAdviceHostFailure,
  type ProviderAdviceRuntimeDependencies,
} from "./provider-execution.ts";
import {
  resolveAiProfileById,
  type AiProfileCatalogStore,
  type AiProfileCatalogSnapshot,
  type ResolvedAiProfileIdentity,
  providerProfileSupportsExecution,
} from "../../../ai-adapter/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import type {
  CoordinatorAiRequestExecutor,
  CoordinatorAiRequestInput,
  CoordinatorAiRequestResult,
} from "./types.ts";
import { prepareAdviceTask, type AdviceTaskPacket } from "./task-packet.ts";
import { readRepositoryNetworkPolicies } from "../external-send/policy.ts";
import {
  type DockerNetworkPolicy,
  parseDockerNetworkPolicy,
} from "../../../docker-isolation/src/index.ts";
import { normalizeAdviceResult } from "./task-structured-result.ts";
import {
  prepareProviderAdvicePlan,
  type ProviderAdviceExecutionPlan,
} from "./provider-plan.ts";
const PROJECT_CONTEXT_REFERENCE = "PROJECT_CONTEXT.md";

/**
 * 認可済みRepositoryの助言依頼を共通Provider実行へ一度だけ渡す。
 * @responsibility 投影・Profile・送信同意・計画・結果と元Host参照を一つの利用側入口へ結合する。
 * @trace ARCH-000015
 * @input 検証済みRoot、Profile Store、今回の要求、取消と既存の実行観測。
 * @returns 非公開Provider本文を除いた結果、cleanup状態、元Host回復参照。
 * @precondition 上位が主体・Repository・今回操作の認可を済ませている。
 * @postcondition 助言用途で一回だけ実行し、編集・Reviewer・自動再送を追加しない。
 * @effect 既存のContext読取りと、同意成立後のProvider実行・取消・回収。
 * @failure 不明な実行・回収を成功やEffect 0へ補完しない。
 * @invariant 入力のProfile、通信Hash、一回送信と非共有条件を保持する。
 * @boundary 公開Task利用側とProvider実行・Context投影の組立て。
 * @security 生出力・秘密値・Host Pathを公開しない。
 * @concurrency 一要求ごとの閉包で結果を捕捉し、既存の排他と一回消費に従う。
 */
export async function runRepositoryAdvice(
  root: VerifiedRepositoryRoot,
  profiles: AiProfileCatalogStore,
  request: CoordinatorAiRequestInput,
  signal: AbortSignal,
  observation?: Pick<
    ProviderAdviceRuntimeDependencies,
    "recoveryCorrelationId" | "observeOperation" | "observeStarted"
  >,
) {
  let runtimeResult: ProviderAdviceRuntimeResult | null = null;
  const runtime = createRuntimeOwnedProviderAdviceRuntime(root, observation);
  const execute: ProviderAdviceRuntime = async (plan, cancellation) => {
    runtimeResult = await runtime(plan, cancellation);
    return runtimeResult;
  };
  const adapter: AdviceProviderAdapter = (input, cancellation) =>
    executeAdviceProviderInput(execute, input, cancellation);
  const consumedGrants = new WeakSet<object>();
  const dispatch: AdviceDispatch = (input, cancellation) =>
    dispatchAdviceRequest(adapter, consumedGrants, input, cancellation);
  const response = await executeAdviceRequest(
    root,
    profiles,
    dispatch,
    request,
    signal,
  );
  const observed = runtimeResult as ProviderAdviceRuntimeResult | null;
  return Object.freeze({
    result: response,
    cleanupConfirmed:
      observed?.cleanupConfirmed ?? response.status !== "unknown",
    hostRecoveryId:
      classifyProviderAdviceHostFailure(observed)?.hostRecoveryId ?? null,
  });
}

/**
 * 検証済み読取り助言Task Packetを外部送信境界へ渡すPortを表す。
 *
 * @responsibility Task Packet消費後のAuthority確認、Provider実行、結果正規化およびcleanupを下位Adapterへ委譲する。
 * @trace ARCH-000015
 * @shape Task Packet、採用Catalog改訂、exact ProfileおよびcancellationSignalを受け、Coordinator AI結果を返す非同期関数である。
 * @invariant Packet生成成功だけでは外部送信Authorityを持たない。
 * @boundary Coordinator Task準備と外部送信Adapterの境界。
 * @security AdapterはPacketのtaskHash、Profileおよび許可済み参照を読み替えない。
 * @compatibility Workbench Advice Task Contract revision 1へ適合する。
 */
export type AdviceDispatchInput = Readonly<{
  networkPolicy: DockerNetworkPolicy;
  taskPacket: AdviceTaskPacket;
  catalogRevision: number;
  profile: ResolvedAiProfileIdentity;
  externalSendConfirmed: boolean;
}>;

/**
 * Repository助言受付境界で使用するAdviceDispatchの構造を固定する。
 *
 * @responsibility Repository助言受付境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceDispatch = (
  input: AdviceDispatchInput,
  cancellationSignal: AbortSignal,
) => Promise<CoordinatorAiRequestResult>;

/**
 * 固定Contextの読取り助言だけを単発実行Ownerへ提供する。
 * @responsibility 既存の投影・Profile・送信契約を再利用しRequest台帳を作らない。
 * @trace ARCH-000015
 * @input 検証済みRoot、Profile Store、助言配送。
 * @returns 終了・cleanupまで待つ一回のExecutor。
 * @precondition 上位が受付と取消を所有する。
 * @postcondition 固定Contextとexact Profile以外へ送信しない。
 * @effect 固定Context読取りと注入した配送。
 * @failure 観測・取消・Profile不成立は停止。
 * @invariant 変更実行・Candidate生成を行わない。
 * @boundary 単発Ownerと助言Runtime。
 * @security 本文を保存しない。
 * @concurrency 呼出しごとのSignalだけを利用する。
 */
export function createRepositoryAdviceExecutor(
  repositoryRootCapability: VerifiedRepositoryRoot,
  profileCatalogStore: AiProfileCatalogStore,
  dispatchReadOnlyAdvice: AdviceDispatch,
): CoordinatorAiRequestExecutor {
  return (request, signal) =>
    executeAdviceRequest(
      repositoryRootCapability,
      profileCatalogStore,
      dispatchReadOnlyAdvice,
      request,
      signal,
    );
}

/**
 * 固定Context・Profile・同意を照合して一回の助言要求を処理する。
 * @responsibility 既存の投影・Profile・送信契約を再利用しRequest台帳を作らない。
 * @trace ARCH-000015
 * @input 検証済みRoot、Profile Store、配送関数、要求と取消Signal。
 * @returns Promiseで公開助言結果を返す。
 * @precondition 上位が受付と取消を所有する。
 * @postcondition 固定Contextとexact Profile以外へ送信しない。
 * @effect 固定Context読取りと注入した配送。
 * @failure 観測・取消・Profile不成立は停止。
 * @invariant 変更実行・Candidate生成を行わない。
 * @boundary 単発Ownerと助言Runtime。
 * @security 本文を保存しない。
 * @concurrency 呼出しごとのSignalだけを利用する。
 */
async function executeAdviceRequest(
  repositoryRootCapability: VerifiedRepositoryRoot,
  profileCatalogStore: AiProfileCatalogStore,
  dispatchReadOnlyAdvice: AdviceDispatch,
  request: CoordinatorAiRequestInput,
  cancellationSignal: AbortSignal,
): Promise<CoordinatorAiRequestResult> {
  const packet = await prepareRepositoryAdvicePacket(
    repositoryRootCapability,
    request,
    cancellationSignal,
  );
  if (packet === null)
    return adviceRequestRejected(
      "coordinator_ai_advice_projection_unavailable",
    );
  if (cancellationSignal.aborted)
    return adviceRequestRejected("coordinator_ai_request_cancelled");
  let catalogSnapshot: AiProfileCatalogSnapshot;
  try {
    const read = profileCatalogStore.snapshot();
    if (read.status !== "read")
      return adviceRequestRejected(
        "coordinator_ai_profile_snapshot_unavailable",
      );
    catalogSnapshot = read.value;
  } catch {
    return adviceRequestRejected("coordinator_ai_profile_snapshot_unavailable");
  }
  const profile = resolveAiProfileById(
    catalogSnapshot.catalog,
    packet.profileId,
  ).value;
  if (profile === null || !profile.selectionRoles.includes("coordinator"))
    return adviceRequestRejected(
      "coordinator_ai_profile_not_available_for_advice",
    );
  if (cancellationSignal.aborted)
    return adviceRequestRejected("coordinator_ai_request_cancelled");
  const network = readRepositoryNetworkPolicies(repositoryRootCapability);
  if (
    network.status !== "ready" ||
    network.policies[profile.provider].policyHash !==
      request.expectedNetworkPolicyHash
  )
    return adviceRequestRejected("coordinator_ai_network_policy_changed");
  if (cancellationSignal.aborted)
    return adviceRequestRejected("coordinator_ai_request_cancelled");
  return dispatchReadOnlyAdvice(
    Object.freeze({
      networkPolicy: network.policies[profile.provider],
      taskPacket: packet,
      catalogRevision: catalogSnapshot.revision,
      profile,
      externalSendConfirmed: request.externalSendConfirmed,
    }),
    cancellationSignal,
  );
}

/**
 * 検証済みRepositoryから固定Project Context Task Packetを生成する。
 *
 * @responsibility Root再検証、固定参照、通常File、内容HashおよびTask Packet検査を一つの読取り境界へ閉じる。
 * @trace ARCH-000015
 * @trace ARCH-000009
 * @input repositoryRootCapability、request、cancellationSignal。
 * @returns 検証済みTask Packet。不正、取消または観測不能時はnull。
 * @precondition requestはCoordinator Mode Routerの入力検査を通過している。
 * @postcondition Task Packetの投影は現在読取ったPROJECT_CONTEXT.md一件だけである。
 * @effect PROJECT_CONTEXT.mdのMetadata、real pathおよび本文を読取る。
 * @failure File欠落、Link、Root越境、参照不一致またはTask検証失敗はnullへ畳む。
 * @invariant File内容をlog、例外または公開失敗結果へ含めない。
 * @boundary 検証済みRepository Filesystemと外部送信前Task Packetの境界。
 * @security Project Context以外のPathを解決せず、Linkを辿らない。
 * @concurrency 読取り前後の取消を確認し、取消後にDispatchへ進まない。
 */
async function prepareRepositoryAdvicePacket(
  repositoryRootCapability: VerifiedRepositoryRoot,
  request: CoordinatorAiRequestInput,
  cancellationSignal: AbortSignal,
): Promise<AdviceTaskPacket | null> {
  if (
    cancellationSignal.aborted ||
    request.mode !== "read_only_advice" ||
    request.contextReferences.length !== 1 ||
    request.contextReferences[0] !== PROJECT_CONTEXT_REFERENCE
  )
    return null;
  const repositoryRoot = resolveVerifiedRepositoryRoot(
    repositoryRootCapability,
  );
  if (repositoryRoot === null) return null;
  try {
    if (cancellationSignal.aborted) return null;
    const observed = createFilesystemRepositoryObservationPort(
      repositoryRootCapability,
      65_536,
    ).observeFile(PROJECT_CONTEXT_REFERENCE);
    if (observed.status !== "resolved") return null;
    const content = observed.source;
    if (cancellationSignal.aborted) return null;
    const prepared = prepareAdviceTask({
      profileId: request.profileId,
      prompt: request.prompt,
      projection: [
        {
          reference: PROJECT_CONTEXT_REFERENCE,
          content,
          sha256: await fileContentSha256(content),
        },
      ],
    });
    return prepared.status === "prepared" ? prepared.taskPacket : null;
  } catch {
    return null;
  }
}

/**
 * 読取り内容のSHA-256をTask Packet互換形式で生成する。
 *
 * @responsibility Node標準Web CryptoでUTF-8本文のSHA-256を決定論的に生成する。
 * @trace ARCH-000015
 * @input content: PROJECT_CONTEXT.mdの読取り本文。
 * @returns 64文字の小文字16進SHA-256を返す。
 * @precondition contentは通常FileからUTF-8として読取済みである。
 * @postcondition Task Packet側の内容Hash検査と一致する。
 * @effect N/A: 局所計算だけを行う。
 * @failure Web Crypto失敗は呼出し側が投影観測不能へ畳む。
 * @invariant UTF-8以外の符号化へ変換しない。
 * @boundary N/A: Process内で完結する。
 * @security Hashを本文不存在または秘密情報不存在の証明として扱わない。
 * @concurrency Promise完了後だけTask Packet生成へ進む。
 */
async function fileContentSha256(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(hash).toString("hex");
}

/**
 * Repository AI Compositionの拒否結果を生成する。
 *
 * @responsibility 理由と空結果区分を閉じたCoordinator結果へ変換する。
 * @trace ARCH-000015
 * @input reason: 固定された公開理由。
 * @returns adviceRequestRejected Coordinator AI結果を返す。
 * @precondition reasonはPromptまたはFilesystem情報を含まない。
 * @postcondition 全結果区分を空にし、事実や推論を捏造しない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant raw内容、Host Pathおよび秘密値を公開しない。
 * @boundary Coordinator内部の失敗結果境界。
 * @security 入力内容を結果へ複製しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function adviceRequestRejected(reason: string): CoordinatorAiRequestResult {
  return result("blocked", reason);
}

export const PROVIDER_ADVICE_DISPATCH_RUNTIME_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-dispatch-runtime";
export const PROVIDER_ADVICE_DISPATCH_RUNTIME_CONTRACT_REVISION = 1;

/**
 * 読取り助言のProvider配送・取消境界で使用するAdviceProviderInputの構造を固定する。
 *
 * @responsibility 読取り助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceProviderInput = Readonly<{
  networkPolicy: DockerNetworkPolicy;
  taskPacket: AdviceTaskPacket;
  catalogRevision: number;
  profile: ResolvedAiProfileIdentity;
}>;

/**
 * 読取り助言のProvider配送・取消境界で使用するAdviceProviderOutcomeの構造を固定する。
 *
 * @responsibility 読取り助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceProviderOutcome = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string | null;
  rawOutput: string | null;
  providerEffectIssued: boolean;
  cleanupConfirmed: boolean;
}>;

/**
 * 読取り助言のProvider配送・取消境界で使用するAdviceProviderAdapterの構造を固定する。
 *
 * @responsibility 読取り助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceProviderAdapter = (
  input: AdviceProviderInput,
  cancellationSignal: AbortSignal,
) => Promise<AdviceProviderOutcome>;

/**
 * 読取り助言のProvider配送・取消境界で使用するSendGrantの構造を固定する。
 *
 * @responsibility 読取り助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type SendGrant = Readonly<{
  networkPolicyHash: string;
  taskHash: string;
  catalogRevision: number;
  profileId: string;
  provider: ResolvedAiProfileIdentity["provider"];
}>;

/**
 * 読取り助言の専用Dispatchを生成する。
 *
 * @responsibility 一回の明示確認をTask・Catalog・Profileへ結合し、消費後だけProvider Adapterへ渡す。
 * @trace ARCH-000015
 * @input Provider固有の固定実行境界。
 * @returns 助言受付へ注入できるDispatch。
 * @precondition Adapterは任意Path・任意引数を受けず、Effectとcleanupを別々に観測して返す。
 * @postcondition completedは、Provider Effect、cleanupおよび根拠参照付き結果の全条件が確認できた場合だけ返る。
 * @effect 明示確認済みのTaskごとにAdapterを最大一回呼ぶ。
 * @failure 確認欠落、Identity不整合、取消、Adapter例外、cleanup不明または結果不正を成功へ畳まない。
 * @invariant 一つのSend Grantを二回消費せず、失敗後に自動再送しない。
 * @boundary Coordinatorと外部Provider Adapterの境界。
 * @security 生出力、Prompt、投影本文、CredentialおよびHost Pathを公開結果へ含めない。
 * @concurrency Dispatch呼出しごとに独立Grantを発行し、同期的に一回消費してから非同期Effectへ進む。
 */
export function createAdviceDispatch(
  providerAdapter: AdviceProviderAdapter,
): AdviceDispatch {
  const consumedGrants = new WeakSet<object>();

  return (input, signal) =>
    dispatchAdviceRequest(providerAdapter, consumedGrants, input, signal);
}

/**
 * 同意を一回消費し助言入力をProvider実行へ配送する。
 *
 * @responsibility 一回の明示確認をTask・Catalog・Profileへ結合し、消費後だけProvider Adapterへ渡す。
 * @trace ARCH-000015
 * @input Provider Adapter、消費済みGrant集合、配送入力と取消Signal。
 * @returns Promiseで検査済み助言結果を返す。
 * @precondition Adapterは任意Path・任意引数を受けず、Effectとcleanupを別々に観測して返す。
 * @postcondition completedは、Provider Effect、cleanupおよび根拠参照付き結果の全条件が確認できた場合だけ返る。
 * @effect 明示確認済みのTaskごとにAdapterを最大一回呼ぶ。
 * @failure 確認欠落、Identity不整合、取消、Adapter例外、cleanup不明または結果不正を成功へ畳まない。
 * @invariant 一つのSend Grantを二回消費せず、失敗後に自動再送しない。
 * @boundary Coordinatorと外部Provider Adapterの境界。
 * @security 生出力、Prompt、投影本文、CredentialおよびHost Pathを公開結果へ含めない。
 * @concurrency Dispatch呼出しごとに独立Grantを発行し、同期的に一回消費してから非同期Effectへ進む。
 */
async function dispatchAdviceRequest(
  providerAdapter: AdviceProviderAdapter,
  consumedGrants: WeakSet<object>,
  input: AdviceDispatchInput,
  cancellationSignal: AbortSignal,
): Promise<CoordinatorAiRequestResult> {
  if (!isValidDispatchInput(input))
    return adviceDispatchRejected("workbench_ai_advice_dispatch_input_invalid");
  if (!input.externalSendConfirmed)
    return adviceDispatchRejected(
      "workbench_ai_external_send_confirmation_required",
    );
  if (cancellationSignal.aborted)
    return adviceDispatchRejected("coordinator_ai_request_cancelled");

  const grant = issueGrant(input);
  if (!consumeGrant(grant, input, consumedGrants))
    return adviceDispatchRejected(
      "workbench_ai_external_send_authority_invalid",
    );

  let outcome: AdviceProviderOutcome;
  try {
    outcome = await providerAdapter(
      Object.freeze({
        networkPolicy: input.networkPolicy,
        taskPacket: input.taskPacket,
        catalogRevision: input.catalogRevision,
        profile: input.profile,
      }),
      cancellationSignal,
    );
  } catch {
    return unknown("workbench_ai_provider_effect_state_unknown");
  }

  if (!isValidProviderOutcome(outcome))
    return unknown("workbench_ai_provider_outcome_invalid");
  if (cancellationSignal.aborted && outcome.providerEffectIssued)
    return unknown("workbench_ai_provider_effect_after_cancellation_unknown");
  if (!outcome.cleanupConfirmed)
    return unknown("workbench_ai_provider_cleanup_unknown");
  if (outcome.status !== "completed") {
    return outcome.status === "unknown"
      ? unknown(outcome.reason ?? "workbench_ai_provider_state_unknown")
      : adviceDispatchRejected(
          outcome.reason ?? "workbench_ai_provider_blocked",
        );
  }
  if (!outcome.providerEffectIssued || outcome.rawOutput === null)
    return unknown("workbench_ai_provider_completion_unconfirmed");

  const normalized = normalizeAdviceResult(
    outcome.rawOutput,
    input.taskPacket.allowedReferences,
  );
  if (normalized.status !== "confirmed" || normalized.normalizedResult === null)
    return adviceDispatchRejected(normalized.reason);
  return Object.freeze({
    status: "completed" as const,
    reason: null,
    facts: normalized.normalizedResult.facts,
    sharedAnalysis: normalized.normalizedResult.sharedAnalysis,
    additionalInferences: normalized.normalizedResult.additionalInferences,
    nextOptions: normalized.normalizedResult.nextOptions,
    candidate: null,
  });
}

/**
 * 読取り助言Dispatchの公開契約を返す。
 *
 * @responsibility Authority、Effect、取消、cleanupおよび結果公開の固定条件を利用側へ示す。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns revision 1の固定契約。
 * @precondition N/A: 定数だけを参照する。
 * @postcondition Provider実装と試験が同じ完成条件を参照できる。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant 明示確認を永続同意または別TaskのAuthorityとして再利用しない。
 * @boundary 公開契約と利用側の境界。
 * @security 生入力、生出力およびCredentialを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function describeAdviceDispatchContract() {
  return Object.freeze({
    contract: PROVIDER_ADVICE_DISPATCH_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_ADVICE_DISPATCH_RUNTIME_CONTRACT_REVISION,
    authority: "explicit_single_request_confirmation",
    authorityScope: Object.freeze([
      "taskHash",
      "catalogRevision",
      "profileId",
      "provider",
      "networkPolicyHash",
    ]),
    maximumProviderExecutionsPerRequest: 1,
    automaticRetryAllowed: false,
    cleanupConfirmationRequired: true,
    rawProviderOutputReported: false,
  });
}

/**
 * 検証済み依頼から一回送信Grantを発行する。
 *
 * @responsibility Task、Catalog改訂、Profile、Providerおよび通信設定Hashを一つのAuthority Scopeへ固定する。
 * @trace ARCH-000015
 * @input input: 検証済み助言Dispatch入力。
 * @returns 一回消費専用のSend Grant。
 * @precondition Dispatch入口で入力妥当性と明示確認が成立している。
 * @postcondition Grantは入力と同じTask、Catalog改訂、Profile、Providerおよび通信設定Hashだけを表す。
 * @effect N/A: 外部Effectを発行せずメモリ上の固定値を生成する。
 * @failure N/A: 入力検証済みの値を写像するだけである。
 * @invariant Prompt本文、Credentialおよび投影本文をGrantへ含めない。
 * @boundary 検証済み依頼と一回送信Authorityの境界。
 * @security Authorityを別Taskまたは別Profileへ転用できる情報へ広げない。
 * @concurrency 呼出しごとに独立した新しいObject Identityを返す。
 */
function issueGrant(input: AdviceDispatchInput): SendGrant {
  return Object.freeze({
    networkPolicyHash: input.networkPolicy.policyHash,
    taskHash: input.taskPacket.taskHash,
    catalogRevision: input.catalogRevision,
    profileId: input.profile.profileId,
    provider: input.profile.provider,
  });
}

/**
 * 一回送信Grantを入力と照合して消費する。
 *
 * @responsibility 完全一致する未消費GrantだけをProvider Effect前に一回受理する。
 * @trace ARCH-000015
 * @input grant: 消費候補、input: 現在依頼、consumedGrants: 消費済み集合。
 * @returns 今回の消費が成立した場合だけtrue。
 * @precondition Grantと入力は同じDispatch呼出しで生成・保持される。
 * @postcondition trueの場合は同じObject Identityが消費済み集合へ記録される。
 * @effect メモリ上の消費済み集合へGrantを追加する。
 * @failure 消費済みまたはScope不一致をfalseで拒否する。
 * @invariant 同じGrant Objectを二回trueにしない。
 * @boundary Authority GrantとProvider Effect許可の境界。
 * @security Task、Catalog改訂、Profile、Providerの全項目を照合する。
 * @concurrency 同期処理として照合と記録を同じ呼出し内で完了する。
 */
function consumeGrant(
  grant: SendGrant,
  input: AdviceDispatchInput,
  consumedGrants: WeakSet<object>,
): boolean {
  if (
    consumedGrants.has(grant) ||
    grant.networkPolicyHash !== input.networkPolicy.policyHash ||
    grant.taskHash !== input.taskPacket.taskHash ||
    grant.catalogRevision !== input.catalogRevision ||
    grant.profileId !== input.profile.profileId ||
    grant.provider !== input.profile.provider
  )
    return false;
  consumedGrants.add(grant);
  return true;
}

/**
 * 助言Dispatch入力のIdentity整合を検査する。
 *
 * @responsibility Catalog改訂、Task/Profile対応、選択RoleおよびProvider許容値を検査する。
 * @trace ARCH-000015
 * @input input: 助言Dispatch入力。
 * @returns 固定契約を満たす場合だけtrue。
 * @precondition N/A: unknownな外部入力ではなく型付き境界入力を受ける。
 * @postcondition trueでも外部送信Authorityの成立は主張しない。
 * @effect N/A: 読取りだけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant Profile名称や表示値ではなく安定Identityを比較する。
 * @boundary Repository CompositionとCoordinator Dispatchの境界。
 * @security 許容ProviderをCodexとClaudeへ限定する。
 * @concurrency N/A: 共有状態を変更しない同期検査である。
 */
function isValidDispatchInput(input: AdviceDispatchInput): boolean {
  const network = parseDockerNetworkPolicy(input.networkPolicy);
  return (
    network !== null &&
    network.provider === input.profile.provider &&
    Number.isSafeInteger(input.catalogRevision) &&
    input.catalogRevision >= 0 &&
    input.taskPacket.profileId === input.profile.profileId &&
    input.profile.selectionRoles.includes("coordinator") &&
    (input.profile.provider === "codex" || input.profile.provider === "claude")
  );
}

/**
 * Provider Adapter結果の構造を検査する。
 *
 * @responsibility Status、理由、出力、Effectおよびcleanup観測値の型を固定する。
 * @trace ARCH-000015
 * @input outcome: Provider Adapterから返された結果。
 * @returns 構造契約を満たす場合だけtrue。
 * @precondition Adapter呼出しが例外を返さず完了している。
 * @postcondition trueでも結果内容の正しさや完了条件は主張しない。
 * @effect N/A: 読取りだけを行う。
 * @failure 不正構造をfalseとして返す。
 * @invariant cleanupとProvider EffectをStatusから推測しない。
 * @boundary Provider Adapter結果とCoordinator受理判定の境界。
 * @security 生出力をログまたは例外へ複製しない。
 * @concurrency N/A: 共有状態を変更しない同期検査である。
 */
function isValidProviderOutcome(outcome: AdviceProviderOutcome): boolean {
  return (
    (outcome.status === "completed" ||
      outcome.status === "blocked" ||
      outcome.status === "unknown") &&
    (outcome.reason === null ||
      (typeof outcome.reason === "string" && outcome.reason.length > 0)) &&
    (outcome.rawOutput === null || typeof outcome.rawOutput === "string") &&
    typeof outcome.providerEffectIssued === "boolean" &&
    typeof outcome.cleanupConfirmed === "boolean"
  );
}

/**
 * Effectを成功扱いできない確定拒否結果を生成する。
 *
 * @responsibility adviceDispatchRejected結果の空Payload契約を一意に保つ。
 * @trace ARCH-000015
 * @input reason: 機械可読な拒否理由。
 * @returns adviceDispatchRejected状態のAI依頼結果。
 * @precondition reasonは空でない固定理由である。
 * @postcondition 結果は根拠なしの助言内容を含まない。
 * @effect N/A: 固定結果を生成するだけである。
 * @failure N/A: resultへ委譲するだけである。
 * @invariant adviceDispatchRejectedをcompletedへ変換しない。
 * @boundary Dispatch判定とApplication結果の境界。
 * @security 生入力、生出力およびCredentialを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function adviceDispatchRejected(reason: string): CoordinatorAiRequestResult {
  return result("blocked", reason);
}

/**
 * Effectまたはcleanupを確定できない結果を生成する。
 *
 * @responsibility 観測不能を拒否や成功へ畳まずunknownとして返す。
 * @trace ARCH-000015
 * @input reason: 機械可読な観測不能理由。
 * @returns unknown状態のAI依頼結果。
 * @precondition reasonは空でない固定理由である。
 * @postcondition 結果は根拠なしの助言内容を含まない。
 * @effect N/A: 固定結果を生成するだけである。
 * @failure N/A: resultへ委譲するだけである。
 * @invariant unknownをadviceDispatchRejectedまたはcompletedへ変換しない。
 * @boundary Dispatch観測とApplication結果の境界。
 * @security 生入力、生出力およびCredentialを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function unknown(reason: string): CoordinatorAiRequestResult {
  return result("unknown", reason);
}

/**
 * 非完了のAI依頼結果を共通形式で生成する。
 *
 * @responsibility adviceDispatchRejected/unknownのPayloadを空の読取り専用配列へ固定する。
 * @trace ARCH-000015
 * @input status: 非完了状態、reason: 機械可読理由。
 * @returns 指定状態のCoordinator AI依頼結果。
 * @precondition statusはadviceDispatchRejectedまたはunknownで、reasonは空でない。
 * @postcondition すべての内容区分は空で固定される。
 * @effect N/A: 固定結果を生成するだけである。
 * @failure N/A: 分岐や外部処理を持たない。
 * @invariant 未確認情報を事実、分析、推論または次候補として作らない。
 * @boundary 内部判定と公開Application結果の境界。
 * @security 生入力、生出力およびCredentialを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function result(
  status: "blocked" | "unknown",
  reason: string,
): CoordinatorAiRequestResult {
  return Object.freeze({
    status,
    reason,
    facts: Object.freeze([]),
    sharedAnalysis: Object.freeze([]),
    additionalInferences: Object.freeze([]),
    nextOptions: Object.freeze([]),
    candidate: null,
  });
}

export const PROVIDER_ADVICE_ADAPTER_CONTRACT =
  "crdd-coordinator/workbench-ai-provider-adapter";
export const PROVIDER_ADVICE_ADAPTER_CONTRACT_REVISION = 1;

/**
 * 助言のProfileを共通計画へ結合するAdapterを生成する。
 *
 * @responsibility exact Profileから計画を作り、単一Runtimeへの搬送前に非共有条件とProvider・Model・推論強度を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input 解決済みProvider計画を一度だけ実行するRuntime。
 * @returns 助言Dispatchへ注入できるProvider Adapter。
 * @precondition runtimeは固定配布物、Subscription認証、取消およびcleanup契約を所有する。
 * @postcondition 同じTask Identityと選択Profileの計画でruntimeを最大一回呼び出す。
 * @effect 一依頼につき選択Provider Executorを最大一回呼び出す。
 * @failure Profile契約不整合はExecutor Effect前にadviceProviderRejectedで返す。
 * @invariant Provider、Model、推論強度およびOfferingをfallbackで変更しない。
 * @boundary Provider非依存DispatchとProvider固有実行境界の間。
 * @security API Key、任意Command、任意PathおよびProvider生設定を入力へ含めない。
 * @concurrency 共有選択状態を持たず、呼出し入力だけでExecutorを決定する。
 */
export function createProviderAdviceAdapter(
  runtime: ProviderAdviceRuntime,
): AdviceProviderAdapter {
  return (input, signal) => executeAdviceProviderInput(runtime, input, signal);
}

/**
 * 助言入力からProvider計画を作りRuntimeを一度実行する。
 *
 * @responsibility exact Profileから計画を作り、単一Runtimeへの搬送前に非共有条件とProvider・Model・推論強度を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input 固定Runtime、ProfileとTaskを含む入力、取消Signal。
 * @returns PromiseでProvider結果・Effect・cleanup観測を返す。
 * @precondition runtimeは固定配布物、Subscription認証、取消およびcleanup契約を所有する。
 * @postcondition 同じTask Identityと選択Profileの計画でruntimeを最大一回呼び出す。
 * @effect 一依頼につき選択Provider Executorを最大一回呼び出す。
 * @failure Profile契約不整合はExecutor Effect前にadviceProviderRejectedで返す。
 * @invariant Provider、Model、推論強度およびOfferingをfallbackで変更しない。
 * @boundary Provider非依存DispatchとProvider固有実行境界の間。
 * @security API Key、任意Command、任意PathおよびProvider生設定を入力へ含めない。
 * @concurrency 共有選択状態を持たず、呼出し入力だけでExecutorを決定する。
 */
async function executeAdviceProviderInput(
  runtime: ProviderAdviceRuntime,
  input: AdviceProviderInput,
  cancellationSignal: AbortSignal,
): Promise<AdviceProviderOutcome> {
  if (!profileExecutionIsValid(input))
    return Object.freeze({
      status: "blocked" as const,
      reason: "workbench_ai_provider_profile_invalid",
      rawOutput: null,
      providerEffectIssued: false,
      cleanupConfirmed: true,
    });
  const executionInput = Object.freeze({
    networkPolicy: input.networkPolicy,
    catalogRevision: input.catalogRevision,
    provider: input.profile.provider,
    providerPrompt: input.taskPacket.providerPrompt,
    taskHash: input.taskPacket.taskHash,
    projectionHash: input.taskPacket.projectionHash,
    profileId: input.profile.profileId,
    exactModelId: input.profile.exactModelId,
    reasoningEffort: input.profile.defaultReasoningEffort,
    offering: input.profile.offering,
  });
  const prepared = prepareProviderAdvicePlan(executionInput, input.profile);
  if (prepared.status !== "prepared" || prepared.executionPlan === null)
    return Object.freeze({
      status: "blocked" as const,
      reason: "workbench_ai_advice_execution_plan_invalid",
      rawOutput: null,
      providerEffectIssued: false,
      cleanupConfirmed: true,
    });
  return executeAdvicePlan(runtime, prepared.executionPlan, cancellationSignal);
}

/**
 * Provider Adapterの公開契約を返す。
 *
 * @responsibility Provider選択、Profile伝播、fallback禁止およびExecutor責務を利用側へ示す。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns revision 1の固定契約。
 * @precondition N/A: 定数だけを参照する。
 * @postcondition 実装と試験が同じProvider選択条件を参照できる。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Profile外のProvider、Modelおよび推論強度を選ばない。
 * @boundary 公開契約と利用側の境界。
 * @security API Key fallbackと自動Provider切替を許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function describeProviderAdviceAdapterContract() {
  return Object.freeze({
    contract: PROVIDER_ADVICE_ADAPTER_CONTRACT,
    contractRevision: PROVIDER_ADVICE_ADAPTER_CONTRACT_REVISION,
    providers: Object.freeze(["codex", "claude"] as const),
    exactProfilePropagationRequired: true,
    automaticProviderFallbackAllowed: false,
    automaticModelFallbackAllowed: false,
    apiKeyFallbackAllowed: false,
    providerExecutorOwnsRuntimeLifecycle: true,
  });
}

/**
 * 解決済みProfileが一回送信Executorへ渡せる閉じた契約か判定する。
 *
 * @responsibility Task/Profile対応、Role、Model、推論強度およびOfferingの整合をEffect前に確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: 助言Provider入力。
 * @returns Profile実行条件をすべて満たす場合だけtrue。
 * @precondition DispatchがTaskとProfile Identityの基本一致を確認済みである。
 * @postcondition trueでもProvider Effect Authorityや認証成立は主張しない。
 * @effect N/A: 読取りだけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant 許可集合外のModelまたは推論強度をcoerceしない。
 * @boundary 解決済みProfileとProvider固有Executorの境界。
 * @security coordinator RoleとSubscription Offering以外を送信対象へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期検査である。
 */
function profileExecutionIsValid(input: AdviceProviderInput) {
  return (
    input.taskPacket.profileId === input.profile.profileId &&
    providerProfileSupportsExecution(input.profile, "coordinator")
  );
}
/**
 * 検証した助言計画を同じ単発Runtimeへ一度だけ渡す。
 *
 * @responsibility 検証済み計画だけをRuntimeへ渡し、cleanup後にRuntimeが抽出した共通助言JSONだけを受理する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input runtime: 用途固定の単発Runtime、executionPlan: exact助言計画、cancellationSignal: 元の取消Signal。
 * @returns Promise<AdviceProviderOutcome>として終了・Effect・cleanupの相関結果を返す。
 * @precondition runtimeはProcess、Network、取消およびcleanupを所有する。
 * @postcondition completed時はRuntimeが抽出済みの助言JSONだけをrawOutputへ格納する。
 * @effect Executor呼出しごとにruntimeを最大一回呼び出す。
 * @failure 事前取消、Plan不整合、Runtime拒否、cleanup未確認または出力不正をadviceProviderRejectedで返す。
 * @invariant Provider、Model、推論強度およびPromptを変更しない。
 * @boundary Provider非依存AdapterとProvider Runtime lifecycleの間。
 * @security Repository、Workspace、ToolまたはSessionを許す計画をEffect前に拒否し、生出力を公開しない。
 * @concurrency Runtime呼出しごとに受け取ったAbortSignalだけを使用し共有状態を持たない。
 */
async function executeAdvicePlan(
  runtime: ProviderAdviceRuntime,
  executionPlan: ProviderAdviceExecutionPlan,
  cancellationSignal: AbortSignal,
): Promise<AdviceProviderOutcome> {
  if (cancellationSignal.aborted)
    return adviceProviderRejected(
      "workbench_ai_advice_cancelled_before_provider_effect",
      false,
      true,
    );
  if (!safePlan(executionPlan))
    return adviceProviderRejected(
      "workbench_ai_advice_runtime_plan_invalid",
      false,
      true,
    );

  let result: ProviderAdviceRuntimeResult;
  try {
    result = await runtime(executionPlan, cancellationSignal);
  } catch {
    return adviceProviderRejected(
      "workbench_ai_advice_runtime_failed_closed",
      true,
      false,
    );
  }
  if (
    result.status !== "completed" ||
    result.adviceJson === null ||
    !result.providerEffectIssued ||
    !result.cleanupConfirmed
  )
    return adviceProviderRejected(
      result.reason ?? "workbench_ai_advice_runtime_incomplete",
      result.providerEffectIssued,
      result.cleanupConfirmed,
    );

  return Object.freeze({
    status: "completed" as const,
    reason: null,
    rawOutput: result.adviceJson,
    providerEffectIssued: true as const,
    cleanupConfirmed: true as const,
  });
}

/**
 * 実行計画が助言専用の非共有境界を維持するか判定する。
 *
 * @responsibility 外部Effect直前に上位計画とProvider CommandのIdentity・禁止条件を再照合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input plan: 読取り助言実行計画。
 * @returns Effect発行可能な閉じた計画の場合だけtrue。
 * @precondition planはProvider Adapterから渡されるが信頼済みと仮定しない。
 * @postcondition trueの場合はProvider、Model、推論強度、共有境界が一致する。
 * @effect N/A: 値比較だけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant boolean条件から新しいAuthorityを生成しない。
 * @boundary 検証済み計画と外部Effectの直前境界。
 * @security Repository、Workspace、Tool、SessionまたはFallbackを許す計画を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function safePlan(plan: ProviderAdviceExecutionPlan) {
  return (
    plan.mode === "workbench_advice" &&
    plan.providerCommand.provider === plan.provider &&
    plan.providerCommand.exactModelId === plan.exactModelId &&
    plan.providerCommand.reasoningEffort === plan.reasoningEffort &&
    plan.providerCommand.promptTransport === "stdin_only" &&
    plan.providerCommand.repositoryMounted === false &&
    plan.providerCommand.workspaceMountRequired === false &&
    plan.providerCommand.toolsAllowed === false &&
    plan.providerCommand.sessionPersistenceAllowed === false &&
    plan.repositoryMounted === false &&
    plan.workspaceMounted === false &&
    plan.toolsAllowed === false &&
    plan.sessionPersistenceAllowed === false &&
    plan.apiKeyFallbackAllowed === false &&
    plan.paidApiFallbackAllowed === false
  );
}

/**
 * Provider Executorの拒否結果を生成する。
 *
 * @responsibility Effect発行とcleanup状態を失わず、生出力なしの公開結果へ閉じる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input reason: 拒否理由、providerEffectIssued: Effect発行有無、cleanupConfirmed: cleanup確認結果。
 * @returns rawOutputを含まないadviceProviderRejected結果。
 * @precondition reasonは秘密値やProvider本文を含まない。
 * @postcondition rawOutputは常にnullである。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Effect発行済みを未発行へ畳まない。
 * @boundary 内部Runtime結果と公開Provider Outcomeの間。
 * @security 生Provider出力を返さない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function adviceProviderRejected(
  reason: string,
  providerEffectIssued: boolean,
  cleanupConfirmed: boolean,
): AdviceProviderOutcome {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rawOutput: null,
    providerEffectIssued,
    cleanupConfirmed,
  });
}
