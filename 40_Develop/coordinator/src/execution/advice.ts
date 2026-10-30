/**
 * 読取り助言の受付・送信同意・Provider配送・結果受理を所有する。
 *
 * @responsibility Contextと固定選定を今回の一回送信へ結合し、元結果・cleanup・回復参照を保持する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import {
  inspectExecutionSelection,
  type ExecutionSelection,
} from "../../../domain-model/src/index.ts";
import { hashExecutionSelection } from "../../../domain-model/src/index.ts";
import { parseAdviceResult as normalizeAdviceResult } from "../../../ai-adapter/src/index.ts";

import {
  type ProviderAdviceExecutionPlan,
  type AdviceTaskPacket,
  prepareAdviceTask,
  prepareProviderAdvicePlan,
  issueRuntimeOwnedProviderAdvicePacket,
  revokeRuntimeOwnedProviderAdvicePacket,
} from "./preparation.ts";
import {
  type VerifiedRepositoryRoot,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

import {
  type DockerNetworkPolicy,
  parseDockerNetworkPolicy,
} from "../../../docker-isolation/src/index.ts";
import { readRepositoryNetworkPolicies } from "../decision/external-send-policy.ts";
import { createFilesystemRepositoryObservationPort } from "../../../domain-model/src/index.ts";
import { resolveRecoveryReference } from "../../../executor/src/index.ts";
import type { AdviceResultItem } from "../../../ai-adapter/src/index.ts";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  observeHostRecoveryCleanup,
  prepareRuntimeOwnedDockerHostCleanup,
  finalizeRuntimeOwnedDockerRecovery,
  abandonRuntimeOwnedDockerRecovery,
  recordRuntimeOwnedDockerHostCleanupReceipt,
} from "./recovery.ts";
import {
  recoverOwnedOperationDirectories,
  cleanupOwnedOperationDirectoriesAsync,
  verifyOwnedOperationCleanupOutcome,
  abandonOwnedHostOperationGenerationLock,
  classifyOwnedCoordinatorOperationCreationFailure,
  classifyOwnedOperationDirectoryCreationFailure,
  activateOwnedHostOperationGenerationLock,
  confirmOwnedHostOperationGenerationLockReadiness,
  observeOwnedHostOperationGenerationLoss,
  createRuntimeOwnedCoordinatorOperation,
  bindRuntimeOwnedRepositoryOperation,
} from "./operation.ts";
import {
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
  issueRuntimeOwnedProviderHomeMountGrant,
  consumeRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
  issueRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "./authority.ts";
import {
  startRuntimeOwnedDockerProcessController,
  cancelRuntimeOwnedDockerProcessController,
} from "./provider-executor.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "./process-safety-state.ts";

/**
 * 読取り助言Provider ExecutorのRuntime接続境界で使用するProviderAdviceRuntimeResultの構造を固定する。
 *
 * @responsibility 読取り助言Provider ExecutorのRuntime接続境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdviceRuntimeResult = Readonly<
  | {
      status: "completed";
      reason: null;
      adviceJson: string;
      providerEffectIssued: true;
      cleanupConfirmed: true;
    }
  | {
      status: "blocked";
      reason: string;
      adviceJson: null;
      providerEffectIssued: boolean;
      cleanupConfirmed: boolean;
    }
>;

/**
 * 読取り助言Provider ExecutorのRuntime接続境界で使用するProviderAdviceRuntimeの構造を固定する。
 *
 * @responsibility 読取り助言Provider ExecutorのRuntime接続境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdviceRuntime = (
  executionPlan: ProviderAdviceExecutionPlan,
  cancellationSignal: AbortSignal,
) => Promise<ProviderAdviceRuntimeResult>;

const PROJECT_CONTEXT_REFERENCE = "PROJECT_CONTEXT.md";

/**
 * 認可済みRepositoryの助言依頼を共通Provider実行へ一度だけ渡す。
 * @responsibility 投影・固定選定・送信同意・計画・結果と元Host／Docker参照を一つの利用側入口へ結合する。
 * @trace ARCH-000015
 * @input 検証済みRoot、完全ExecutionSelectionを含む今回の要求、取消と既存の実行観測。
 * @returns 非公開Provider本文を除いた結果、cleanup状態、元Host／Docker回復参照。
 * @precondition 上位が主体・Repository・今回操作の認可を済ませている。
 * @postcondition 助言用途で一回だけ実行し、編集・Reviewer・自動再送を追加しない。
 * @effect 既存のContext読取りと、同意成立後のProvider実行・取消・回収。
 * @failure 不明な実行・回収を成功やEffect 0へ補完しない。
 * @invariant 入力の固定選定、通信Hash、一回送信と非共有条件を保持する。
 * @boundary 公開Task利用側とProvider実行・Context投影の組立て。
 * @security 生出力・秘密値・Host Pathを公開しない。
 * @concurrency 一要求ごとの閉包で結果を捕捉し、既存の排他と一回消費に従う。
 */
export async function runRepositoryAdvice(
  root: VerifiedRepositoryRoot,
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
  const response = await executeAdviceRequest(root, dispatch, request, signal);
  const observed = runtimeResult as ProviderAdviceRuntimeResult | null;
  const failure = classifyProviderAdviceHostFailure(observed);
  return Object.freeze({
    result: response,
    cleanupConfirmed:
      observed?.cleanupConfirmed ?? response.status !== "unknown",
    hostRecoveryId: failure?.hostRecoveryId ?? null,
    dockerRecoveryId: failure?.dockerRecoveryId ?? null,
  });
}

/**
 * 検証済み読取り助言Task Packetを外部送信境界へ渡すPortを表す。
 *
 * @responsibility Task Packet消費後のAuthority確認、Provider実行、結果正規化およびcleanupを下位Adapterへ委譲する。
 * @trace ARCH-000015
 * @shape Task Packet、採用設定Identity、完全選定およびcancellationSignalを受け、Coordinator AI結果を返す非同期関数である。
 * @invariant Packet生成成功だけでは外部送信Authorityを持たない。
 * @boundary Coordinator Task準備と外部送信Adapterの境界。
 * @security AdapterはPacketのtaskHash、固定選定および許可済み参照を読み替えない。
 * @compatibility Workbench Advice Task Contract revision 2へ適合する。
 */
export type AdviceDispatchInput = Readonly<{
  networkPolicy: DockerNetworkPolicy;
  taskPacket: AdviceTaskPacket;
  executionSelection: ExecutionSelection;
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
 * @responsibility 既存の投影・固定選定・送信契約を再利用しRequest台帳を作らない。
 * @trace ARCH-000015
 * @input 検証済みRootと固定選定を受ける助言配送。
 * @returns 終了・cleanupまで待つ一回のExecutor。
 * @precondition 上位が受付と取消を所有する。
 * @postcondition 固定Contextと完全選定以外へ送信しない。
 * @effect 固定Context読取りと注入した配送。
 * @failure 観測・取消・固定選定不成立は停止。
 * @invariant 変更実行・Candidate生成を行わない。
 * @boundary 単発Ownerと助言Runtime。
 * @security 本文を保存しない。
 * @concurrency 呼出しごとのSignalだけを利用する。
 */
export function createRepositoryAdviceExecutor(
  repositoryRootCapability: VerifiedRepositoryRoot,
  dispatchReadOnlyAdvice: AdviceDispatch,
): CoordinatorAiRequestExecutor {
  return (request, signal) =>
    executeAdviceRequest(
      repositoryRootCapability,
      dispatchReadOnlyAdvice,
      request,
      signal,
    );
}

/**
 * 固定Context・固定選定・同意を照合して一回の助言要求を処理する。
 * @responsibility 既存の投影・固定選定・送信契約を再利用しRequest台帳を作らない。
 * @trace ARCH-000015
 * @input 検証済みRoot、配送関数、完全ExecutionSelectionを含む要求と取消Signal。
 * @returns Promiseで公開助言結果を返す。
 * @precondition 上位が受付と取消を所有する。
 * @postcondition 固定Contextと完全選定以外へ送信しない。
 * @effect 固定Context読取りと注入した配送。
 * @failure 観測・取消・固定選定不成立は停止。
 * @invariant 変更実行・Candidate生成を行わない。
 * @boundary 単発Ownerと助言Runtime。
 * @security 本文を保存しない。
 * @concurrency 呼出しごとのSignalだけを利用する。
 */
async function executeAdviceRequest(
  repositoryRootCapability: VerifiedRepositoryRoot,
  dispatchReadOnlyAdvice: AdviceDispatch,
  request: CoordinatorAiRequestInput,
  cancellationSignal: AbortSignal,
): Promise<CoordinatorAiRequestResult> {
  const selection = inspectExecutionSelection(request.executionSelection);
  if (selection?.role !== "advice")
    return createAdviceRejectedResult(
      "coordinator_ai_selection_not_available_for_advice",
    );
  const packet = await prepareRepositoryAdvicePacket(
    repositoryRootCapability,
    request,
    cancellationSignal,
  );
  if (packet === null)
    return createAdviceRejectedResult(
      "coordinator_ai_advice_projection_unavailable",
    );
  if (cancellationSignal.aborted)
    return createAdviceRejectedResult("coordinator_ai_request_cancelled");
  if (cancellationSignal.aborted)
    return createAdviceRejectedResult("coordinator_ai_request_cancelled");
  const network = readRepositoryNetworkPolicies(repositoryRootCapability);
  if (
    network.status !== "ready" ||
    network.policies[selection.provider].policyHash !==
      request.expectedNetworkPolicyHash
  )
    return createAdviceRejectedResult("coordinator_ai_network_policy_changed");
  if (cancellationSignal.aborted)
    return createAdviceRejectedResult("coordinator_ai_request_cancelled");
  return dispatchReadOnlyAdvice(
    Object.freeze({
      networkPolicy: network.policies[selection.provider],
      taskPacket: packet,
      executionSelection: selection,
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
      executionSelection: request.executionSelection,
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
 * Request／Dispatchの拒否結果を共通形式で生成する。
 *
 * @responsibility Request／Dispatchの拒否理由と空結果区分を同じCoordinator結果へ変換する。
 * @trace ARCH-000015
 * @input reason: 固定された公開理由。
 * @returns blocked状態で内容区分が空のCoordinator AI結果。
 * @precondition reasonはPromptまたはFilesystem情報を含まない。
 * @postcondition 全結果区分を空にし、事実や推論を捏造しない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant raw内容、Host Pathおよび秘密値を公開しない。
 * @boundary Coordinator内部の失敗結果境界。
 * @security 入力内容を結果へ複製しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function createAdviceRejectedResult(
  reason: string,
): CoordinatorAiRequestResult {
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
  executionSelection: ExecutionSelection;
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
  selectionHash: string;
  provider: "codex" | "claude";
}>;

/**
 * 読取り助言の専用Dispatchを生成する。
 *
 * @responsibility 一回の明示確認をTask・固定選定Hashへ結合し、消費後だけProvider Adapterへ渡す。
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
 * @responsibility 一回の明示確認をTask・固定選定Hashへ結合し、消費後だけProvider Adapterへ渡す。
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
    return createAdviceRejectedResult(
      "workbench_ai_advice_dispatch_input_invalid",
    );
  if (!input.externalSendConfirmed)
    return createAdviceRejectedResult(
      "workbench_ai_external_send_confirmation_required",
    );
  if (cancellationSignal.aborted)
    return createAdviceRejectedResult("coordinator_ai_request_cancelled");

  const grant = issueGrant(input);
  if (!consumeGrant(grant, input, consumedGrants))
    return createAdviceRejectedResult(
      "workbench_ai_external_send_authority_invalid",
    );

  let outcome: AdviceProviderOutcome;
  try {
    outcome = await providerAdapter(
      Object.freeze({
        networkPolicy: input.networkPolicy,
        taskPacket: input.taskPacket,
        executionSelection: input.executionSelection,
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
      : createAdviceRejectedResult(
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
    return createAdviceRejectedResult(normalized.reason);
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
      "selectionHash",
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
 * @responsibility Task、設定Identity、固定選定、Providerおよび通信設定Hashを一つのAuthority Scopeへ固定する。
 * @trace ARCH-000015
 * @input input: 検証済み助言Dispatch入力。
 * @returns 一回消費専用のSend Grant。
 * @precondition Dispatch入口で入力妥当性と明示確認が成立している。
 * @postcondition Grantは入力と同じTask、設定Identity、固定選定、Providerおよび通信設定Hashだけを表す。
 * @effect N/A: 外部Effectを発行せずメモリ上の固定値を生成する。
 * @failure N/A: 入力検証済みの値を写像するだけである。
 * @invariant Prompt本文、Credentialおよび投影本文をGrantへ含めない。
 * @boundary 検証済み依頼と一回送信Authorityの境界。
 * @security Authorityを別Taskまたは別固定選定へ転用できる情報へ広げない。
 * @concurrency 呼出しごとに独立した新しいObject Identityを返す。
 */
function issueGrant(input: AdviceDispatchInput): SendGrant {
  return Object.freeze({
    networkPolicyHash: input.networkPolicy.policyHash,
    taskHash: input.taskPacket.taskHash,
    selectionHash: hashExecutionSelection(input.executionSelection) as string,
    provider: input.executionSelection.provider,
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
 * @security Task、設定Identity、固定選定、Providerの全項目を照合する。
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
    grant.selectionHash !== hashExecutionSelection(input.executionSelection) ||
    grant.provider !== input.executionSelection.provider
  )
    return false;
  consumedGrants.add(grant);
  return true;
}

/**
 * 助言Dispatch入力のIdentity整合を検査する。
 *
 * @responsibility 設定Identity、Taskと固定選定対応、選択RoleおよびProvider許容値を検査する。
 * @trace ARCH-000015
 * @input input: 助言Dispatch入力。
 * @returns 固定契約を満たす場合だけtrue。
 * @precondition N/A: unknownな外部入力ではなく型付き境界入力を受ける。
 * @postcondition trueでも外部送信Authorityの成立は主張しない。
 * @effect N/A: 読取りだけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant 固定選定名称や表示値ではなく安定Identityを比較する。
 * @boundary Repository CompositionとCoordinator Dispatchの境界。
 * @security 許容ProviderをCodexとClaudeへ限定する。
 * @concurrency N/A: 共有状態を変更しない同期検査である。
 */
function isValidDispatchInput(input: AdviceDispatchInput): boolean {
  const network = parseDockerNetworkPolicy(input.networkPolicy);
  const fixed = inspectExecutionSelection(input.executionSelection);
  return (
    network !== null &&
    fixed !== null &&
    fixed.role === "advice" &&
    network.provider === fixed.provider &&
    hashExecutionSelection(input.taskPacket.executionSelection) ===
      hashExecutionSelection(fixed)
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
 * @invariant unknownをblockedまたはcompletedへ変換しない。
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
 * @responsibility blocked／unknownのPayloadを空の読取り専用配列へ固定する。
 * @trace ARCH-000015
 * @input status: 非完了状態、reason: 機械可読理由。
 * @returns 指定状態のCoordinator AI依頼結果。
 * @precondition statusはblockedまたはunknownで、reasonは空でない。
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

/**
 * 助言の固定選定を共通計画へ結合するAdapterを生成する。
 *
 * @responsibility 完全選定から計画を作り、単一Runtimeへの搬送前に非共有条件とProvider・Model・推論強度を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input 解決済みProvider計画を一度だけ実行するRuntime。
 * @returns 助言Dispatchへ注入できるProvider Adapter。
 * @precondition runtimeは固定配布物、Subscription認証、取消およびcleanup契約を所有する。
 * @postcondition 同じTask Identityと選択固定選定の計画でruntimeを最大一回呼び出す。
 * @effect 一依頼につき選択Provider Executorを最大一回呼び出す。
 * @failure 固定選定契約不整合はExecutor Effect前にadviceProviderRejectedで返す。
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
 * @responsibility 完全選定から計画を作り、単一Runtimeへの搬送前に非共有条件とProvider・Model・推論強度を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input 固定Runtime、固定選定とTaskを含む入力、取消Signal。
 * @returns PromiseでProvider結果・Effect・cleanup観測を返す。
 * @precondition runtimeは固定配布物、Subscription認証、取消およびcleanup契約を所有する。
 * @postcondition 同じTask Identityと選択固定選定の計画でruntimeを最大一回呼び出す。
 * @effect 一依頼につき選択Provider Executorを最大一回呼び出す。
 * @failure 固定選定契約不整合はExecutor Effect前にadviceProviderRejectedで返す。
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
  if (!executionSelectionIsValid(input))
    return Object.freeze({
      status: "blocked" as const,
      reason: "workbench_ai_provider_profile_invalid",
      rawOutput: null,
      providerEffectIssued: false,
      cleanupConfirmed: true,
    });
  const selection = input.executionSelection;
  const executionInput = Object.freeze({
    networkPolicy: input.networkPolicy,
    executionSelection: selection,
    provider: selection.provider,
    providerPrompt: input.taskPacket.providerPrompt,
    allowedReferences: input.taskPacket.allowedReferences,
    taskHash: input.taskPacket.taskHash,
    projectionHash: input.taskPacket.projectionHash,
    exactModelId: selection.modelIdentifier,
    reasoningEffort: selection.reasoningEffort,
    offering:
      selection.provider === "codex"
        ? ("chatgpt_subscription_oauth" as const)
        : ("claude_max" as const),
  });
  const prepared = prepareProviderAdvicePlan(executionInput);
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
 * 解決済み固定選定が一回送信Executorへ渡せる閉じた契約か判定する。
 *
 * @responsibility Taskと固定選定対応、Role、Model、推論強度およびOfferingの整合をEffect前に確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: 助言Provider入力。
 * @returns 固定選定実行条件をすべて満たす場合だけtrue。
 * @precondition DispatchがTaskと固定選定 Identityの基本一致を確認済みである。
 * @postcondition trueでもProvider Effect Authorityや認証成立は主張しない。
 * @effect N/A: 読取りだけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant 許可集合外のModelまたは推論強度をcoerceしない。
 * @boundary 解決済み固定選定とProvider固有Executorの境界。
 * @security coordinator RoleとSubscription Offering以外を送信対象へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期検査である。
 */
function executionSelectionIsValid(input: AdviceProviderInput) {
  const selection = inspectExecutionSelection(input.executionSelection);
  return (
    selection !== null &&
    selection.role === "advice" &&
    hashExecutionSelection(input.taskPacket.executionSelection) ===
      hashExecutionSelection(selection)
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
    plan.providerCommand.modelIdentifier === plan.exactModelId &&
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

export const PROVIDER_ADVICE_PRODUCTION_RUNTIME_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-production-runtime";

export const PROVIDER_ADVICE_PRODUCTION_RUNTIME_CONTRACT_REVISION = 1;

/**
 * 助言Runtimeの初回失敗に結合する非公開の回復情報を表す。
 *
 * @responsibility 清掃分類と取得済みexact参照を同じ初回結果に保持する。
 * @trace ARCH-000008
 * @shape 清掃確認、手動回復要否、Host参照および引渡し後だけ取得するDocker参照。
 * @invariant 清掃確認済みの場合は参照を回復対象として保持しない。
 * @boundary Coordinator内部の失敗分類境界。
 * @security 元参照を公開JSON、理由、Provider入力またはlogへ複製しない。
 * @compatibility 公開結果SchemaおよびRecovery Authorityを変更しない。
 */
type HostFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
  dockerRecoveryId?: string | null;
}>;

const hostFailures = new WeakMap<object, HostFailure>();

const initializationFailures = new WeakMap<Error, HostFailure>();

/**
 * 保存済みの助言Host参照を既存の正式回収へ戻す。
 * @responsibility 現在のOS一時親とexact参照だけを照合し、回収後の不存在を確認する。
 * @trace ARCH-000008
 * @input 作成時に所有者へ通知した非AuthorityのHost参照。
 * @returns 回収確認と固定理由。Pathは返さない。
 * @precondition 呼出側で旧Ownerの喪失とDocker側終了を照合済み。
 * @postcondition 不明を回収済みにしない。
 * @effect 同じHost領域への既存回収のみ。
 * @failure 参照、親、状態又は不存在が不明なら停止。
 * @invariant 別親探索、Provider要求、Docker再起動を行わない。
 * @boundary 単発Ownerと既存Host回収。
 * @security 参照だけで新Authorityを発行しない。
 * @concurrency 既存Host回復世代で非使用を再確認する。
 */
export function recoverProviderAdviceHostOperation(hostId: string) {
  try {
    const match = /^host\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\./u.exec(
      hostId,
    );
    if (!match?.[1])
      return {
        cleanupConfirmed: false,
        reason: "workbench_ai_advice_host_reference_invalid",
      };
    const hostRoot = path.join(fs.realpathSync.native(os.tmpdir()), match[1]);
    const before = observeHostRecoveryCleanup(hostId, hostRoot);
    if (before.root !== "absent" || before.marker !== "absent") {
      const recovered = recoverOwnedOperationDirectories(
        hostId,
        null,
        hostRoot,
      );
      if (recovered.status !== "recovered")
        return { cleanupConfirmed: false, reason: recovered.reason };
    }
    const after = observeHostRecoveryCleanup(hostId, hostRoot);
    return {
      cleanupConfirmed: after.root === "absent" && after.marker === "absent",
      reason: "workbench_ai_advice_host_cleanup_observed",
    };
  } catch {
    return {
      cleanupConfirmed: false,
      reason: "workbench_ai_advice_host_cleanup_unconfirmed",
    };
  }
}

/**
 * 同じ初回Runtime結果に保持されたHost／Docker失敗分類を内部で照会する。
 *
 * @responsibility 元の結果Objectに結合した分類だけを返す。
 * @trace ARCH-000008
 * @input result: 初回Runtime結果または未知の値。
 * @returns 保持済み分類、または結合がなければnull。
 * @precondition 呼出し元はCoordinator内部で結果Objectを保持している。
 * @postcondition copy、公開投影または別Processに元参照を復元しない。
 * @effect N/A: Process内WeakMapを読み取るだけである。
 * @failure 未登録の値をnullとし、Host資源不存在とは解釈しない。
 * @invariant 参照の照会から削除権限、非使用または回復成功を発行しない。
 * @boundary 非公開Runtime結果と内部失敗分類の境界。
 * @security 公開indexへexportせず、JSON列挙対象へ値を追加しない。
 * @concurrency 同じ結果への分類を返却後に変更しない。
 */
export function classifyProviderAdviceHostFailure(result: unknown) {
  return result !== null && typeof result === "object"
    ? (hostFailures.get(result) ?? null)
    : null;
}

/**
 * 読取り助言Runtime境界で使用するRuntimeRecordの構造を固定する。
 *
 * @responsibility 読取り助言Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type RuntimeRecord = Readonly<Record<string, unknown>>;

/**
 * 読取り助言Runtime境界で使用するOperationの構造を固定する。
 *
 * @responsibility 読取り助言Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */
type Operation = Readonly<{
  owned: object;
  mountCapability: object;
  managementCapability: object;
  operationId: string;
  hostRecoveryId: string;
  hostGenerationFailureDetected?: Promise<void>;
  hostGenerationLoss?: Promise<"cleanup_confirmed_failure" | "cleanup_unknown">;
  releaseHostGenerationDrain?: () => boolean;
}>;

/**
 * 読取り助言Runtime境界で使用するProviderAdviceRuntimeDependenciesの構造を固定する。
 *
 * @responsibility 読取り助言Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdviceRuntimeDependencies = Readonly<{
  recoveryCorrelationId?: string;
  observeOperation?: (
    operation: Readonly<{ operationId: string; hostRecoveryId: string }>,
  ) => Promise<boolean>;
  observeStarted?: () => Promise<boolean>;
  createOperation: () => Promise<Operation>;
  bindRepository: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string }> | null;
  observeProviderHome: typeof inspectRuntimeOwnedWindowsProviderHomeCandidate;
  issueMountGrant: typeof issueRuntimeOwnedProviderHomeMountGrant;
  consumeMountGrant: typeof consumeRuntimeOwnedProviderHomeMountGrant;
  revokeMountGrant: typeof revokeRuntimeOwnedProviderHomeMountGrant;
  issueSelection: typeof issueRuntimeOwnedDelegationSelectionGrant;
  revokeSelection: typeof revokeRuntimeOwnedDelegationSelectionGrant;
  issuePacket: typeof issueRuntimeOwnedProviderAdvicePacket;
  revokePacket: typeof revokeRuntimeOwnedProviderAdvicePacket;
  startProcess: typeof startRuntimeOwnedDockerProcessController;
  cancelProcess: typeof cancelRuntimeOwnedDockerProcessController;
  prepareDockerHostCleanup: typeof prepareRuntimeOwnedDockerHostCleanup;
  cleanupOperation: typeof cleanupOwnedOperationDirectoriesAsync;
  classifyOperationCleanup: typeof verifyOwnedOperationCleanupOutcome;
  recordDockerHostCleanupReceipt: (
    capability: unknown,
    completion: Readonly<{
      hostCleanupOutcome: unknown;
      dockerCompletion: unknown;
    }>,
  ) => boolean;
  finalizeDockerRecovery: typeof finalizeRuntimeOwnedDockerRecovery;
  abandonDockerRecovery: typeof abandonRuntimeOwnedDockerRecovery;
  abandonOperation: typeof abandonOwnedHostOperationGenerationLock;
  poisonAfterCleanupUnknown: () => void;
}>;

/**
 * 検証済みRepositoryへ閉じたProduction助言Runtimeを生成する。
 *
 * @responsibility 元Rootと現在の用途別許可を使い、署名資格とは独立して助言Lifecycleへ接続する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input repositoryRootCapability: 元Repositoryの検証済みRoot Capability。
 * @returns Provider Executorへ注入できるRuntime Port。
 * @precondition 検証済みRootは現在Repositoryに対応する。不正・失効したRootは別Rootへ補完しない。
 * @postcondition 各呼出しは独立Operationを所有し、completedはHost／Docker cleanup後だけ返る。
 * @effect 選択ProviderのDocker ProcessとRepository-local Runtime状態を操作する。
 * @failure Identity、取消、Process、回復またはcleanupの不成立をblockedへ閉じる。
 * @invariant 自動再送、Provider fallback、Repository Mountおよび生出力公開を行わず、Selection前に元Repository Identityへ結合する。
 * @boundary 読取り助言要求の組立てとProvider Runtimeの間。
 * @security Capability、Host Path、Credentialおよび生Provider出力を公開結果へ含めない。
 * @concurrency 呼出しごとに独立Operationを生成し、共有Authorityを使い回さない。
 */
export function createRuntimeOwnedProviderAdviceRuntime(
  repositoryRootCapability: VerifiedRepositoryRoot,
  observation?: Pick<
    ProviderAdviceRuntimeDependencies,
    "recoveryCorrelationId" | "observeOperation" | "observeStarted"
  >,
): ProviderAdviceRuntime {
  const repositoryRoot = resolveVerifiedRepositoryRoot(
    repositoryRootCapability,
  );
  if (repositoryRoot === null)
    return async (_executionPlan, cancellationSignal) =>
      blocked(
        cancellationSignal.aborted
          ? "workbench_ai_advice_cancelled_before_runtime_effect"
          : "workbench_ai_advice_repository_binding_unavailable",
        false,
        true,
      );
  const runtime = createProviderAdviceRuntime({
    ...createProductionDependencies(repositoryRoot),
    ...observation,
  });
  return runtime;
}

/**
 * 試験専用の依存注入候補を生成する。
 *
 * @responsibility 注入済み依存を使うRuntimeと非Authorityの試験候補を提供する。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input dependencies: 全外部境界を明示注入したRuntime依存。
 * @returns runtime関数と非Authorityの試験候補。
 * @precondition dependenciesは試験が所有し、Production Capabilityを含めない。
 * @postcondition Candidate自体はProduction Authorityを持たない。
 * @effect N/A: 候補生成時には外部Effectを発行しない。
 * @failure N/A: 実行時失敗は返却Runtimeの閉じた結果へ収束する。
 * @invariant 試験依存を本番構成へ混入させない。
 * @boundary Contract Testと読取り助言Runtime Coreの試験境界。
 * @security 実Credential、Host PathまたはProvider Homeを組み込まない。
 * @concurrency Runtime呼出しごとの依存Lifecycleは注入先が所有する。
 */
export function createIsolatedProviderAdviceRuntimeCandidate(
  dependencies: ProviderAdviceRuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    run: createProviderAdviceRuntime(dependencies),
  });
}

/**
 * 読取り助言Runtime境界におけるcreateProviderAdviceRuntimeの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
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

function createProviderAdviceRuntime(
  dependencies: ProviderAdviceRuntimeDependencies,
) {
  return async (
    plan: ProviderAdviceExecutionPlan,
    cancellationSignal: AbortSignal,
  ): Promise<ProviderAdviceRuntimeResult> => {
    if (cancellationSignal.aborted)
      return blocked(
        "workbench_ai_advice_cancelled_before_runtime_effect",
        false,
        true,
      );
    if (isRuntimeProcessEffectBlocked())
      return blocked(
        isRuntimeProcessPoisoned()
          ? "workbench_ai_advice_process_restart_required"
          : "workbench_ai_advice_runtime_cleanup_in_progress",
        false,
        true,
      );

    let operation: Operation | null = null;
    let mountControl: object | null = null;
    let selectionControl: object | null = null;
    let packetOwner: object | null = null;
    let processControl: object | null = null;
    let recoveryCapability: object | null = null;
    let dockerRecoveryId: string | null = null;
    let recoveryHandoffRejected = false;
    let recoveryFinalizationCapability: object | null = null;
    let selectionCleanupConfirmed = true;
    let providerEffectIssued = false;
    let isOperationCleaned = false;
    let hostGenerationFailed = false;
    let abortListener: (() => void) | null = null;

    try {
      operation = await dependencies.createOperation();
      if (cancellationSignal.aborted)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_cancelled_during_operation_creation",
        );

      const repositoryBinding = dependencies.bindRepository(
        operation.managementCapability,
      );
      if (
        !repositoryBinding ||
        repositoryBinding.operationId !== operation.operationId
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_repository_binding_unavailable",
        );

      const selectionInput = selectionRequest(plan, operation.operationId);
      if (
        dependencies.observeOperation &&
        !(await dependencies.observeOperation({
          operationId: operation.operationId,
          hostRecoveryId: operation.hostRecoveryId,
        }))
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_operation_save_unconfirmed",
        );
      const selection = dependencies.issueSelection(
        operation.managementCapability,
        selectionInput,
      ) as RuntimeRecord;
      selectionControl = objectValue(selection.controlCapability);
      let selectionUse = objectValue(selection.useCapability);
      if (
        !validSelection(
          selection,
          selectionControl,
          selectionUse,
          plan,
          operation.operationId,
        )
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_unavailable",
        );

      const observation = dependencies.observeProviderHome(
        plan.provider,
      ) as RuntimeRecord;
      const observationCapability = objectValue(
        observation.observationCapability,
      );
      if (
        observation.status !== "candidate" ||
        !observationCapability ||
        observation.provider !== plan.provider
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_provider_home_unavailable",
        );

      const mount = dependencies.issueMountGrant(
        operation.managementCapability,
        observationCapability,
      ) as RuntimeRecord;
      mountControl = objectValue(mount.controlCapability);
      const mountUse = objectValue(mount.useCapability);
      if (mount.status !== "issued" || !mountControl || !mountUse)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_grant_unavailable",
        );
      const mountObservation = dependencies.observeProviderHome(
        plan.provider,
      ) as RuntimeRecord;
      const mountObservationCapability = objectValue(
        mountObservation.observationCapability,
      );
      if (
        mountObservation.status !== "candidate" ||
        !mountObservationCapability ||
        mountObservation.provider !== plan.provider
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_reobservation_unavailable",
        );
      const consumedMount = dependencies.consumeMountGrant(
        mountUse,
        operation.managementCapability,
        mountObservationCapability,
      ) as RuntimeRecord;
      const mountAuthorization = objectValue(
        consumedMount.mountAuthorizationCapability,
      );
      if (consumedMount.status !== "consumed" || !mountAuthorization)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_authorization_unavailable",
        );

      const revokedSelection = dependencies.revokeSelection(
        selectionControl,
        operation.managementCapability,
      ) as RuntimeRecord;
      if (revokedSelection.status !== "revoked")
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_refresh_revoke_failed",
        );
      selectionControl = null;
      const refreshedSelection = dependencies.issueSelection(
        operation.managementCapability,
        selectionInput,
      ) as RuntimeRecord;
      const refreshedSelectionControl = objectValue(
        refreshedSelection.controlCapability,
      );
      const refreshedSelectionUse = objectValue(
        refreshedSelection.useCapability,
      );
      selectionControl = refreshedSelectionControl;
      if (
        !validSelection(
          refreshedSelection,
          refreshedSelectionControl,
          refreshedSelectionUse,
          plan,
          operation.operationId,
        )
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_refresh_unavailable",
        );
      selectionUse = refreshedSelectionUse;
      if (!sameSelection(selection, refreshedSelection))
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_refresh_mismatch",
        );
      const packet = dependencies.issuePacket({
        operationId: operation.operationId,
        executionSelection: plan.executionSelection,
        provider: plan.provider,
        taskHash: plan.taskHash,
        projectionHash: plan.projectionHash,
        providerPrompt: plan.providerPrompt,
        allowedReferences: plan.allowedReferences,
        providerCommand: plan.providerCommand,
      }) as RuntimeRecord;
      packetOwner = objectValue(packet.ownerCapability);
      const packetUse = objectValue(packet.useCapability);
      if (packet.status !== "issued" || !packetOwner || !packetUse)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_runtime_packet_unavailable",
        );

      const process = dependencies.startProcess(
        plan.provider,
        {
          purpose: "advice",
          managementCapability: operation.managementCapability,
          mountCapability: operation.mountCapability,
          mountAuthorizationCapability: mountAuthorization,
          selectionUseCapability: selectionUse,
          packetCapability: packetUse,
          packetOwnerCapability: packetOwner,
          recoveryCorrelationId: dependencies.recoveryCorrelationId,
          consumer: "workbench",
        },
        (capability: unknown, recoveryId: unknown) => {
          const owned = objectValue(capability);
          const exactId = resolveRecoveryReference(recoveryId);
          if (
            recoveryHandoffRejected ||
            recoveryCapability ||
            !owned ||
            !exactId
          ) {
            recoveryHandoffRejected = true;
            return false;
          }
          recoveryCapability = owned;
          dockerRecoveryId = exactId;
          return true;
        },
        undefined,
        dependencies.observeStarted,
      ) as RuntimeRecord;
      if (process.preparationFailed === true)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_provider_preparation_failed",
        );
      packetOwner = null;
      selectionControl = null;
      mountControl = null;
      processControl = objectValue(process.controlCapability);
      const completion = process.completion;
      providerEffectIssued = process.dockerEffectStarted === true;
      if (
        process.status !== "started" ||
        recoveryHandoffRejected ||
        !recoveryCapability ||
        !processControl ||
        !(completion instanceof Promise)
      )
        throw new AdviceRuntimeError(
          stringValue(process.reason) ??
            "workbench_ai_advice_process_start_failed",
        );

      abortListener = () => {
        if (processControl && operation)
          void dependencies.cancelProcess(
            processControl,
            operation.managementCapability,
          );
      };
      cancellationSignal.addEventListener("abort", abortListener, {
        once: true,
      });
      operation.hostGenerationFailureDetected?.then(() => {
        hostGenerationFailed = true;
        abortListener?.();
      });

      const result = (await completion) as RuntimeRecord;
      processControl = null;
      if (result.cleanupConfirmed !== true)
        throw new AdviceRuntimeError(
          stringValue(result.reason) ??
            "workbench_ai_advice_provider_cleanup_unconfirmed",
        );
      const providerCompletionReason = cancellationSignal.aborted
        ? "workbench_ai_advice_cancelled_after_provider_effect"
        : hostGenerationFailed
          ? "workbench_ai_advice_host_generation_lost"
          : result.status === "completed"
            ? null
            : (stringValue(result.reason) ??
              "workbench_ai_advice_provider_failed");
      recoveryFinalizationCapability = objectValue(
        result.recoveryFinalizationCapability,
      );
      if (
        !recoveryCapability ||
        !recoveryFinalizationCapability ||
        recoveryCapability !== recoveryFinalizationCapability
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_recovery_finalization_unavailable",
        );
      const normalized =
        providerCompletionReason === null
          ? recordValue(result.normalizedResult)
          : null;
      // 既存の上位配送形式への表示用変換。Provider Envelopeは再解析しない。
      const adviceJson =
        normalized?.status === "completed" && Array.isArray(normalized.facts)
          ? JSON.stringify({
              status: "completed",
              facts: normalized.facts,
              sharedAnalysis: normalized.sharedAnalysis,
              additionalInferences: normalized.additionalInferences,
              nextOptions: normalized.nextOptions,
            })
          : null;
      if (providerCompletionReason === null && !adviceJson)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_normalized_result_invalid",
        );

      if (
        !dependencies.prepareDockerHostCleanup(recoveryFinalizationCapability)
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_host_cleanup_intent_unconfirmed",
        );
      const hostCleanupOutcome = await dependencies.cleanupOperation(
        operation.owned,
      );
      const hostCleanup =
        dependencies.classifyOperationCleanup(hostCleanupOutcome);
      if (!hostCleanup)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_operation_cleanup_unconfirmed",
        );
      isOperationCleaned = true;
      if (
        !dependencies.recordDockerHostCleanupReceipt(
          recoveryFinalizationCapability,
          Object.freeze({ hostCleanupOutcome, dockerCompletion: result }),
        ) ||
        dependencies.finalizeDockerRecovery(recoveryFinalizationCapability)
          .status !== "completed"
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_docker_recovery_finalization_unconfirmed",
        );
      recoveryCapability = null;
      recoveryFinalizationCapability = null;
      dockerRecoveryId = null;
      operation.releaseHostGenerationDrain?.();
      if (hostCleanup === "protocol_failure_cleanup_confirmed")
        return blocked("workbench_ai_advice_host_generation_lost", true, true);
      if (providerCompletionReason !== null)
        return blocked(providerCompletionReason, true, true);
      if (adviceJson === null)
        return blocked(
          "workbench_ai_advice_normalized_result_invalid",
          true,
          true,
        );
      return Object.freeze({
        status: "completed" as const,
        reason: null,
        adviceJson,
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      });
    } catch (error) {
      if (processControl && operation) {
        try {
          await dependencies.cancelProcess(
            processControl,
            operation.managementCapability,
          );
        } catch {}
      }
      if (packetOwner) dependencies.revokePacket(packetOwner);
      if (selectionControl && operation) {
        try {
          const revokedSelection = dependencies.revokeSelection(
            selectionControl,
            operation.managementCapability,
          ) as RuntimeRecord;
          if (revokedSelection.status === "revoked") selectionControl = null;
          else selectionCleanupConfirmed = false;
        } catch {
          selectionCleanupConfirmed = false;
        }
      }
      if (mountControl && operation)
        dependencies.revokeMountGrant(
          mountControl,
          operation.managementCapability,
        );
      if (recoveryCapability)
        dependencies.abandonDockerRecovery(recoveryCapability);

      const initializationFailure =
        error instanceof AdviceRuntimeError
          ? (initializationFailures.get(error) ?? null)
          : classifyOwnedCoordinatorOperationCreationFailure(error);
      let cleanupConfirmed =
        isOperationCleaned ||
        (operation === null &&
          initializationFailure?.cleanupConfirmed === true);
      if (
        operation &&
        !isOperationCleaned &&
        !providerEffectIssued &&
        recoveryCapability === null
      ) {
        try {
          const cleanup = dependencies.classifyOperationCleanup(
            await dependencies.cleanupOperation(operation.owned),
          );
          cleanupConfirmed = cleanup !== null;
        } catch {
          cleanupConfirmed = false;
        }
      }
      cleanupConfirmed =
        cleanupConfirmed &&
        selectionCleanupConfirmed &&
        dockerRecoveryId === null;
      if (operation && !cleanupConfirmed) {
        try {
          await dependencies.abandonOperation(operation.managementCapability);
        } catch {}
      }
      if (!cleanupConfirmed) dependencies.poisonAfterCleanupUnknown();
      operation?.releaseHostGenerationDrain?.();
      const result = blocked(
        error instanceof AdviceRuntimeError
          ? error.reason
          : "workbench_ai_advice_runtime_failed_closed",
        providerEffectIssued,
        cleanupConfirmed,
      );
      hostFailures.set(
        result,
        Object.freeze({
          cleanupConfirmed,
          manualRecoveryRequired: !cleanupConfirmed,
          hostRecoveryId: cleanupConfirmed
            ? null
            : (operation?.hostRecoveryId ??
              initializationFailure?.hostRecoveryId ??
              null),
          dockerRecoveryId,
        }),
      );
      return result;
    } finally {
      if (abortListener)
        cancellationSignal.removeEventListener("abort", abortListener);
    }
  };
}

/**
 * 読取り助言Runtime境界で使用するAdviceRuntimeErrorのlifecycleを固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @construction 明示された入力からだけ生成する。
 * @lifecycle 生成元の処理範囲を越えてAuthorityまたは資源を保持しない。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

class AdviceRuntimeError extends Error {
  readonly reason: string;

  /**
   * 公開理由と私有Host分類を同じ初期化失敗へ結合する。
   *
   * @responsibility 下位で取得済みの分類を外側catchまで保持する。
   * @trace ARCH-000008
   * @input reason: 固定理由、hostFailure: 私有分類またはnull。
   * @returns 現在Process内の失敗Object。
   * @precondition 分類は所有Operation境界の観測結果である。
   * @postcondition 理由へ元参照を埋め込まない。
   * @effect N/A: Errorの局所値を初期化するだけである。
   * @failure N/A: 自身で追加の資源処置をしない。
   * @invariant 分類の保持から回復成功やAuthorityを発行しない。
   * @boundary 下位初期化と外側の失敗処理の境界。
   * @security Errorを公開結果として返さず、私有参照はJSON投影しない。
   * @concurrency 生成後に分類を置換しない。
   */
  constructor(reason: string, hostFailure: HostFailure | null = null) {
    super(reason);
    this.reason = reason;
    if (hostFailure !== null) initializationFailures.set(this, hostFailure);
  }
}

/**
 * 読取り助言Runtime境界におけるselectionRequestの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
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

function selectionRequest(
  plan: ProviderAdviceExecutionPlan,
  operationId: string,
) {
  return Object.freeze({
    operationId,
    taskAttempt: 0,
    executionSelection: plan.executionSelection,
  });
}

/**
 * 読取り助言のSelectionが固定実行計画と一致するか判定する。
 *
 * @responsibility Provider Effect前に固定選定、Model、推論強度およびCapabilityの完全性を検査する。
 * @trace ARCH-000010
 * @input selection: Selection結果、controlCapability: 制御Capability、useCapability: 利用Capability、plan: 固定実行計画
 * @returns 固定実行計画と完全一致する発行済みSelectionだけtrueを返す。
 * @precondition Selection結果はCoordinatorのSelection境界から返されている。
 * @postcondition trueでもProvider Effect Authorityを発行しない。
 * @effect N/A: 入力値の比較だけを行う。
 * @failure 不足、不一致または不正状態をfalseへ閉じる。
 * @invariant Repository／Workspace共有可否を変更しない。
 * @boundary 読取り助言LifecycleとSelection Grant境界。
 * @security Capability自体を公開結果へ含めない。
 * @concurrency N/A: 共有状態を持たない同期判定である。
 */
function validSelection(
  selection: RuntimeRecord,
  controlCapability: object | null,
  useCapability: object | null,
  plan: ProviderAdviceExecutionPlan,
  operationId: string,
) {
  return (
    selection.operationId === operationId &&
    selection.taskAttempt === 0 &&
    selection.selectionHash ===
      hashExecutionSelection(plan.executionSelection) &&
    selection.status === "issued" &&
    controlCapability !== null &&
    useCapability !== null &&
    selection.executorProvider === plan.provider &&
    hashExecutionSelection(selection.executionSelection) ===
      hashExecutionSelection(plan.executionSelection) &&
    selection.selectedModel === plan.exactModelId &&
    selection.selectedEffort === plan.reasoningEffort &&
    typeof selection.speedMode === "string" &&
    typeof selection.selectionNotice === "string"
  );
}

/**
 * Mount前後のSelectionが同じ意味を保持するか判定する。
 *
 * @responsibility 短命Selectionの再発行によってProvider、固定選定、Model、推論強度、速度または理由が変化しないことを保証する。
 * @trace ARCH-000010
 * @input initial: Mount前Selection、refreshed: Effect直前Selection
 * @returns 意味Propertyが完全一致する場合だけtrueを返す。
 * @precondition 両Selectionは同じOperationと入力から発行されている。
 * @postcondition Capability Object Identityは比較対象に含めない。
 * @effect N/A: 入力値の比較だけを行う。
 * @failure 意味差または不足Propertyをfalseへ閉じる。
 * @invariant Selectionの短命性と一回消費性を変更しない。
 * @boundary Mount前選定とProvider Effect直前選定の境界。
 * @security Selection理由以外の内部状態を公開しない。
 * @concurrency N/A: 共有状態を持たない同期判定である。
 */
function sameSelection(initial: RuntimeRecord, refreshed: RuntimeRecord) {
  return (
    initial.operationId === refreshed.operationId &&
    initial.taskAttempt === refreshed.taskAttempt &&
    initial.selectionHash === refreshed.selectionHash &&
    initial.executorProvider === refreshed.executorProvider &&
    hashExecutionSelection(initial.executionSelection) ===
      hashExecutionSelection(refreshed.executionSelection) &&
    initial.selectedModel === refreshed.selectedModel &&
    initial.selectedEffort === refreshed.selectedEffort &&
    initial.speedMode === refreshed.speedMode &&
    initial.selectionNotice === refreshed.selectionNotice
  );
}

/**
 * Operation作成と世代Lock準備を同じ初期化失敗境界へ閉じる。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input dependencies: 固定本番依存、または非Authorityの局所試験依存。
 * @returns 準備済みOperationと同じ世代の喪失観測。
 * @precondition 作成境界は取得済み参照と失敗分類を所有する。
 * @postcondition 初期化失敗は清掃分類と未解決のexact参照を同じErrorへ保持する。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

async function createProductionOperation(
  dependencies: OperationInitializationDependencies = productionOperationInitialization,
): Promise<Operation> {
  let operation: Operation;
  try {
    operation = dependencies.create();
  } catch (error) {
    const creation =
      classifyOwnedOperationDirectoryCreationFailure(error) ??
      classifyOwnedCoordinatorOperationCreationFailure(error);
    if (!creation?.cleanupConfirmed) dependencies.poison();
    throw new AdviceRuntimeError(
      creation?.cleanupConfirmed
        ? "workbench_ai_advice_operation_initialization_failed_cleanup_confirmed"
        : "workbench_ai_advice_operation_initialization_cleanup_unknown_process_restart_required",
      creation,
    );
  }
  try {
    const activation = await dependencies.activate(
      operation.managementCapability,
    );
    if (activation !== "activated") throw new Error("activation_failed");
    const readiness = await dependencies.confirmReadiness(
      operation.managementCapability,
    );
    if (readiness !== "ready") throw new Error("readiness_failed");
    const loss = dependencies.observeLoss(operation.managementCapability);
    return Object.freeze({
      ...operation,
      hostGenerationFailureDetected: loss.detected,
      hostGenerationLoss: loss.outcome,
      releaseHostGenerationDrain: loss.releaseDrain,
    });
  } catch {
    let cleanupConfirmed = false;
    try {
      cleanupConfirmed =
        dependencies.classifyCleanup(
          await dependencies.cleanup(operation.owned),
        ) !== null;
    } catch {}
    if (!cleanupConfirmed) dependencies.poison();
    throw new AdviceRuntimeError(
      cleanupConfirmed
        ? "workbench_ai_advice_host_generation_lock_unavailable_cleanup_confirmed"
        : "workbench_ai_advice_host_generation_lock_cleanup_unknown_process_restart_required",
      Object.freeze({
        cleanupConfirmed,
        manualRecoveryRequired: !cleanupConfirmed,
        hostRecoveryId: cleanupConfirmed ? null : operation.hostRecoveryId,
      }),
    );
  }
}

/**
 * Operation作成と世代Lock準備の固定依存を表す。
 *
 * @responsibility 本番と局所反証を同じ初期化処理へ接続する。
 * @trace ARCH-000008
 * @shape 作成、activation、readiness、喪失観測、清掃、清掃分類および停止の七依存。
 * @invariant 清掃分類に成功を捏造する既定値を持たない。
 * @boundary 助言RuntimeのOperation初期化境界。
 * @security 試験依存から本番Authorityを発行しない。
 * @compatibility 本番依存は既存のCoordinator所有Operationへ固定する。
 */
type OperationInitializationDependencies = Readonly<{
  create: () => Operation;
  activate: typeof activateOwnedHostOperationGenerationLock;
  confirmReadiness: typeof confirmOwnedHostOperationGenerationLockReadiness;
  observeLoss: typeof observeOwnedHostOperationGenerationLoss;
  cleanup: typeof cleanupOwnedOperationDirectoriesAsync;
  classifyCleanup: typeof verifyOwnedOperationCleanupOutcome;
  poison: () => void;
}>;

const productionOperationInitialization: OperationInitializationDependencies =
  Object.freeze({
    create: createRuntimeOwnedCoordinatorOperation,
    activate: activateOwnedHostOperationGenerationLock,
    confirmReadiness: confirmOwnedHostOperationGenerationLockReadiness,
    observeLoss: observeOwnedHostOperationGenerationLoss,
    cleanup: cleanupOwnedOperationDirectoriesAsync,
    classifyCleanup: verifyOwnedOperationCleanupOutcome,
    poison: poisonRuntimeProcessAfterCleanupUnknown,
  });

/**
 * 権限を持たないOperation初期化の局所反証候補を構成する。
 *
 * @responsibility 本番と同じ作成・世代Lock失敗分類を偽依存で実行する。
 * @trace ARCH-000008
 * @input dependencies: 局所試験用の閉じた依存。
 * @returns productionAuthority=falseと初期化関数。
 * @precondition 依存は本番のAuthorityまたは実資源を取得しない。
 * @postcondition 候補から署名Runtimeの権限を発行しない。
 * @effect 返されたcreate実行時だけ注入依存を呼ぶ。
 * @failure 本番と同じ私有失敗分類を保持してthrowする。
 * @invariant 本番の固定依存を変更しない。
 * @boundary Coordinator内部の局所反証境界。
 * @security 公開index、CLIまたはHTTPへ入口を追加しない。
 * @concurrency 候補生成時に依存集合を固定する。
 */
export function createIsolatedProviderOperationCandidate(
  dependencies: OperationInitializationDependencies,
) {
  const fixed = Object.freeze({ ...dependencies });
  return Object.freeze({
    productionAuthority: false as const,
    /**
     * 固定した偽依存で本番と同じ初期化処理を開始する。
     *
     * @responsibility 局所反証を別実装で代替せず同じ失敗境界へ接続する。
     * @trace ARCH-000008
     * @input N/A: 候補生成時の固定依存だけを用いる。
     * @returns 準備済み偽Operation、または私有分類付きの失敗。
     * @precondition 注入依存は本番権限を取得しない。
     * @postcondition 元の失敗分類と未解決参照を保持する。
     * @effect 注入された依存だけを呼ぶ。
     * @failure 本番と同じ初期化失敗をthrowする。
     * @invariant 本番依存を変更しない。
     * @boundary Coordinator内部の局所反証境界。
     * @security 公開入口や本番Authorityを提供しない。
     * @concurrency 実行ごとにOperationを局所保持する。
     */
    create: () => createProductionOperation(fixed),
  });
}

/**
 * 検証済みRepositoryへ閉じた読取り助言Production依存を構築する。
 *
 * @responsibility 読取り助言OperationのRepository結合とCoordinator実境界を同じ依存集合へ固定する。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @input repositoryRoot: 検証済みCapabilityから解決したRepository Root。
 * @returns Repository Scopeへ閉じたProduction Runtime依存を返す。
 * @precondition Root不成立はFactoryが依存構築前に拒否し、この関数へ渡さない。
 * @postcondition 検証したRootだけをOperationのRepository結合へ使用する。
 * @effect N/A: 依存関数を構成するだけで、OperationまたはFilesystem Effectをまだ発行しない。
 * @failure Repository結合不能は実行時に`workbench_ai_advice_repository_binding_unavailable`へ閉じる。
 * @invariant Repository／WorkspaceのProvider Mountを有効化しない。
 * @boundary 呼出し元が渡した検証済みRepository CapabilityとCoordinator Runtimeの境界。
 * @security Repository Pathを公開結果、Task PacketまたはProvider入力へ追加しない。
 * @concurrency 返却依存はOperationごとに独立したCapabilityへ結合される。
 */
function createProductionDependencies(
  repositoryRoot: string,
): ProviderAdviceRuntimeDependencies {
  return Object.freeze({
    createOperation: createProductionOperation,
    bindRepository: (managementCapability) =>
      bindRuntimeOwnedRepositoryOperation(managementCapability, repositoryRoot),
    observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
    issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
    consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
    revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
    issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
    revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
    issuePacket: issueRuntimeOwnedProviderAdvicePacket,
    revokePacket: revokeRuntimeOwnedProviderAdvicePacket,
    startProcess: startRuntimeOwnedDockerProcessController,
    cancelProcess: cancelRuntimeOwnedDockerProcessController,
    prepareDockerHostCleanup: prepareRuntimeOwnedDockerHostCleanup,
    cleanupOperation: cleanupOwnedOperationDirectoriesAsync,
    classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
    recordDockerHostCleanupReceipt: recordRuntimeOwnedDockerHostCleanupReceipt,
    finalizeDockerRecovery: finalizeRuntimeOwnedDockerRecovery,
    abandonDockerRecovery: abandonRuntimeOwnedDockerRecovery,
    abandonOperation: abandonOwnedHostOperationGenerationLock,
    poisonAfterCleanupUnknown: poisonRuntimeProcessAfterCleanupUnknown,
  });
}

/**
 * 読取り助言Runtime境界におけるobjectValueの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
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

function objectValue(value: unknown): object | null {
  return value !== null && typeof value === "object" ? value : null;
}

/**
 * 読取り助言Runtime境界におけるrecordValueの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
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

function recordValue(value: unknown): RuntimeRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RuntimeRecord)
    : null;
}

/**
 * 読取り助言Runtime境界におけるstringValueの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
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

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * 読取り助言Runtime境界におけるblockedの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
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

function blocked(
  reason: string,
  providerEffectIssued: boolean,
  cleanupConfirmed: boolean,
): ProviderAdviceRuntimeResult {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    adviceJson: null,
    providerEffectIssued,
    cleanupConfirmed,
  });
}

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestModeの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestMode = "read_only_advice";

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestInputの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestInput = Readonly<{
  mode: CoordinatorAiRequestMode;
  executionSelection: ExecutionSelection;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  externalSendConfirmed: boolean;
  expectedNetworkPolicyHash: string;
}>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestResultの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestResult = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string | null;
  facts: readonly AdviceResultItem[];
  sharedAnalysis: readonly AdviceResultItem[];
  additionalInferences: readonly AdviceResultItem[];
  nextOptions: readonly AdviceResultItem[];
  candidate: null;
}>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestExecutorの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestExecutor = (
  request: CoordinatorAiRequestInput,
  cancellationSignal: AbortSignal,
) => Promise<CoordinatorAiRequestResult>;
