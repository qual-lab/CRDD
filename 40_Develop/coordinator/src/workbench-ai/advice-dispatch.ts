/**
 * Workbench読取り助言の一回限り外部送信とProvider結果受理を所有する。
 *
 * @packageDocumentation
 * @responsibility 明示確認、Task・Profile完全性、一回消費、取消、Provider Effect、cleanupおよび結果正規化を同じ実行境界へ閉じる。
 * @trace ARCH-000015
 * @boundary Workbenchの検証済みTask Packetと外部Provider Adapterの境界。
 * @effect 明示確認済みの一依頼につきProvider Adapterを最大一回呼び出す。
 * @security Task Packet、Catalog改訂およびexact ProfileをAuthority Scopeへ固定し、生Provider出力を公開しない。
 */
import type { ResolvedAiProfileIdentity } from "../../../ai-adapter/src/catalog/types.ts";
import type {
  WorkbenchAiAdviceDispatch,
  WorkbenchAiAdviceDispatchInput,
} from "./repository-composition.ts";
import type { CoordinatorAiRequestResult } from "./request-lifecycle.ts";
import { normalizeWorkbenchAiAdviceResult } from "./advice-result.ts";
import type { WorkbenchAiAdviceTaskPacket } from "./advice-task.ts";

export const WORKBENCH_AI_ADVICE_DISPATCH_RUNTIME_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-dispatch-runtime";
export const WORKBENCH_AI_ADVICE_DISPATCH_RUNTIME_CONTRACT_REVISION = 1;

/**
 * Workbench助言のProvider配送・取消境界で使用するWorkbenchAiAdviceProviderInputの構造を固定する。
 *
 * @responsibility Workbench助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceProviderInput = Readonly<{
  taskPacket: WorkbenchAiAdviceTaskPacket;
  catalogRevision: number;
  profile: ResolvedAiProfileIdentity;
}>;

/**
 * Workbench助言のProvider配送・取消境界で使用するWorkbenchAiAdviceProviderOutcomeの構造を固定する。
 *
 * @responsibility Workbench助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceProviderOutcome = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string | null;
  rawOutput: string | null;
  providerEffectIssued: boolean;
  cleanupConfirmed: boolean;
}>;

/**
 * Workbench助言のProvider配送・取消境界で使用するWorkbenchAiAdviceProviderAdapterの構造を固定する。
 *
 * @responsibility Workbench助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceProviderAdapter = (
  input: WorkbenchAiAdviceProviderInput,
  cancellationSignal: AbortSignal,
) => Promise<WorkbenchAiAdviceProviderOutcome>;

/**
 * Workbench助言のProvider配送・取消境界で使用するSendGrantの構造を固定する。
 *
 * @responsibility Workbench助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type SendGrant = Readonly<{
  taskHash: string;
  catalogRevision: number;
  profileId: string;
  provider: ResolvedAiProfileIdentity["provider"];
}>;

/**
 * Workbench読取り助言の専用Dispatchを生成する。
 *
 * @responsibility 一回の明示確認をTask・Catalog・Profileへ結合し、消費後だけProvider Adapterへ渡す。
 * @trace ARCH-000015
 * @input providerAdapter: Provider固有の固定実行境界。
 * @returns Repository Workbench Compositionへ注入できるDispatch。
 * @precondition Adapterは任意Path・任意引数を受けず、Effectとcleanupを別々に観測して返す。
 * @postcondition completedは、Provider Effect、cleanupおよび根拠参照付き結果の全条件が確認できた場合だけ返る。
 * @effect 明示確認済みのTaskごとにAdapterを最大一回呼ぶ。
 * @failure 確認欠落、Identity不整合、取消、Adapter例外、cleanup不明または結果不正を成功へ畳まない。
 * @invariant 一つのSend Grantを二回消費せず、失敗後に自動再送しない。
 * @boundary Coordinatorと外部Provider Adapterの境界。
 * @security 生出力、Prompt、投影本文、CredentialおよびHost Pathを公開結果へ含めない。
 * @concurrency Dispatch呼出しごとに独立Grantを発行し、同期的に一回消費してから非同期Effectへ進む。
 */
export function createWorkbenchAiAdviceDispatchRuntime(
  providerAdapter: WorkbenchAiAdviceProviderAdapter,
): WorkbenchAiAdviceDispatch {
  const consumedGrants = new WeakSet<object>();

  return async (input, cancellationSignal) => {
    if (!isValidDispatchInput(input))
      return blocked("workbench_ai_advice_dispatch_input_invalid");
    if (!input.externalSendConfirmed)
      return blocked("workbench_ai_external_send_confirmation_required");
    if (cancellationSignal.aborted)
      return blocked("coordinator_ai_request_cancelled");

    const grant = issueGrant(input);
    if (!consumeGrant(grant, input, consumedGrants))
      return blocked("workbench_ai_external_send_authority_invalid");

    let outcome: WorkbenchAiAdviceProviderOutcome;
    try {
      outcome = await providerAdapter(
        Object.freeze({
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
        : blocked(outcome.reason ?? "workbench_ai_provider_blocked");
    }
    if (!outcome.providerEffectIssued || outcome.rawOutput === null)
      return unknown("workbench_ai_provider_completion_unconfirmed");

    const normalized = normalizeWorkbenchAiAdviceResult(
      outcome.rawOutput,
      input.taskPacket.allowedReferences,
    );
    if (
      normalized.status !== "confirmed" ||
      normalized.normalizedResult === null
    )
      return blocked(normalized.reason);
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      facts: normalized.normalizedResult.facts,
      sharedAnalysis: normalized.normalizedResult.sharedAnalysis,
      additionalInferences: normalized.normalizedResult.additionalInferences,
      nextOptions: normalized.normalizedResult.nextOptions,
      candidate: null,
    });
  };
}

/**
 * Workbench読取り助言Dispatchの公開契約を返す。
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
export function describeWorkbenchAiAdviceDispatchRuntimeContract() {
  return Object.freeze({
    contract: WORKBENCH_AI_ADVICE_DISPATCH_RUNTIME_CONTRACT,
    contractRevision: WORKBENCH_AI_ADVICE_DISPATCH_RUNTIME_CONTRACT_REVISION,
    authority: "explicit_single_request_confirmation",
    authorityScope: Object.freeze([
      "taskHash",
      "catalogRevision",
      "profileId",
      "provider",
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
 * @responsibility Task、Catalog改訂、ProfileおよびProviderを一つのAuthority Scopeへ固定する。
 * @trace ARCH-000015
 * @input input: 検証済みWorkbench AI Dispatch入力。
 * @returns 一回消費専用のSend Grant。
 * @precondition Dispatch入口で入力妥当性と明示確認が成立している。
 * @postcondition Grantは入力と同じTask、Catalog改訂、ProfileおよびProviderだけを表す。
 * @effect N/A: 外部Effectを発行せずメモリ上の固定値を生成する。
 * @failure N/A: 入力検証済みの値を写像するだけである。
 * @invariant Prompt本文、Credentialおよび投影本文をGrantへ含めない。
 * @boundary 検証済み依頼と一回送信Authorityの境界。
 * @security Authorityを別Taskまたは別Profileへ転用できる情報へ広げない。
 * @concurrency 呼出しごとに独立した新しいObject Identityを返す。
 */
function issueGrant(input: WorkbenchAiAdviceDispatchInput): SendGrant {
  return Object.freeze({
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
  input: WorkbenchAiAdviceDispatchInput,
  consumedGrants: WeakSet<object>,
): boolean {
  if (
    consumedGrants.has(grant) ||
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
 * Workbench AI Dispatch入力のIdentity整合を検査する。
 *
 * @responsibility Catalog改訂、Task/Profile対応、選択RoleおよびProvider許容値を検査する。
 * @trace ARCH-000015
 * @input input: Workbench AI Dispatch入力。
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
function isValidDispatchInput(input: WorkbenchAiAdviceDispatchInput): boolean {
  return (
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
function isValidProviderOutcome(
  outcome: WorkbenchAiAdviceProviderOutcome,
): boolean {
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
 * @responsibility blocked結果の空Payload契約を一意に保つ。
 * @trace ARCH-000015
 * @input reason: 機械可読な拒否理由。
 * @returns blocked状態のAI依頼結果。
 * @precondition reasonは空でない固定理由である。
 * @postcondition 結果は根拠なしの助言内容を含まない。
 * @effect N/A: 固定結果を生成するだけである。
 * @failure N/A: resultへ委譲するだけである。
 * @invariant blockedをcompletedへ変換しない。
 * @boundary Dispatch判定とApplication結果の境界。
 * @security 生入力、生出力およびCredentialを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function blocked(reason: string): CoordinatorAiRequestResult {
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
 * @responsibility blocked/unknownのPayloadを空の読取り専用配列へ固定する。
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
