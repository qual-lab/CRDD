/**
 * Workbench AI依頼を依頼種別ごとの実行境界へ接続する。
 *
 * @packageDocumentation
 * @responsibility 読取り助言と変更候補を分離し、現在Process内の依頼状態、観測および取消を所有する。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @boundary Workbench Application PortとCoordinatorの依頼種別別実行Adapterの境界。
 * @effect 注入された実行Adapterだけが外部Effectを発行し得る。本Moduleは依頼状態と取消Signalだけを変更する。
 * @security Promptと結果を永続化またはlog出力せず、依頼種別とProfile IDを暗黙に読み替えない。
 */
import { randomUUID } from "node:crypto";

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestModeの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestMode = "read_only_advice" | "change_candidate";

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestInputの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestInput = Readonly<{
  mode: CoordinatorAiRequestMode;
  profileId: string;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  externalSendConfirmed: boolean;
}>;

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiResultItemの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestResultの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
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
  facts: readonly CoordinatorAiResultItem[];
  sharedAnalysis: readonly CoordinatorAiResultItem[];
  additionalInferences: readonly CoordinatorAiResultItem[];
  nextOptions: readonly CoordinatorAiResultItem[];
  candidate: Readonly<{
    candidateId: string;
    disposition: "untrusted_not_adopted";
  }> | null;
}>;

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestSnapshotの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestSnapshot = Readonly<{
  requestId: string;
  mode: CoordinatorAiRequestMode | null;
  profileId: string | null;
  status:
    | "accepted"
    | "running"
    | "completed"
    | "blocked"
    | "cancelled"
    | "unknown";
  reason: string | null;
  facts: readonly CoordinatorAiResultItem[];
  sharedAnalysis: readonly CoordinatorAiResultItem[];
  additionalInferences: readonly CoordinatorAiResultItem[];
  nextOptions: readonly CoordinatorAiResultItem[];
  candidate: Readonly<{
    candidateId: string;
    disposition: "untrusted_not_adopted";
  }> | null;
}>;

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestExecutorの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
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

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するMutableRequestの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type MutableRequest = {
  readonly requestId: string;
  readonly request: CoordinatorAiRequestInput;
  readonly controller: AbortController;
  snapshot: CoordinatorAiRequestSnapshot;
};

const PROFILE_ID = /^PROFILE-\d{6,}$/u;
const REQUEST_KEYS = new Set([
  "mode",
  "profileId",
  "prompt",
  "contextReferences",
  "allowedPaths",
  "externalSendConfirmed",
]);
const RESULT_KEYS = new Set([
  "status",
  "reason",
  "facts",
  "sharedAnalysis",
  "additionalInferences",
  "nextOptions",
  "candidate",
]);
const CANDIDATE_KEYS = new Set(["candidateId", "disposition"]);
const RESULT_ITEM_KEYS = new Set(["text", "references"]);

/**
 * Coordinatorの現在Process限定AI依頼Applicationを生成する。
 *
 * @responsibility 依頼種別を対応Executorへ一度だけ配送し、開始、観測、取消を同じRequest IDへ結合する。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @input dependencies: 読取り助言Executorと変更候補Executor。
 * @returns Workbench互換のstart、observe、cancel Application。
 * @precondition 各Executorは自身のAuthority、外部送信、結果相関およびcleanupを所有する。
 * @postcondition 読取り助言を変更候補Executorへ、変更候補を読取りExecutorへ配送しない。
 * @effect 依頼ごとにAbortControllerとProcess内Snapshotを生成し、注入Executorを最大一回開始する。
 * @failure 不正入力、未知IdentityまたはExecutor失敗を成功へ畳まず理由付き結果にする。
 * @invariant Profile ID、依頼種別およびRequest IDを開始後に変更しない。
 * @boundary Workbench入力とCoordinator実行Adapterの境界。
 * @security Prompt、Contextおよび結果をProcess外へ保存せず、Snapshotを列挙するAPIを提供しない。
 * @concurrency 一依頼一AbortControllerとし、取消後の遅延完了でcancelledを上書きしない。
 */
export function createCoordinatorWorkbenchAiRequestApplication(
  dependencies: Readonly<{
    startReadOnlyAdvice: CoordinatorAiRequestExecutor;
    startChangeCandidate: CoordinatorAiRequestExecutor;
  }>,
) {
  const requests = new Map<string, MutableRequest>();

  return Object.freeze({
    /**
     * Workbench AI依頼の開始・観測・取消境界におけるstartの処理境界を固定する。
     *
     * @responsibility Workbench AI依頼の開始・観測・取消境界に必要な入力処理、失敗分類および結果生成を所有する。
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
    async start(rawRequest: unknown) {
      const request = inspectRequest(rawRequest);
      if (request === null)
        return Object.freeze({
          status: "blocked" as const,
          requestId: null,
          reason: "coordinator_ai_request_invalid",
        });

      const requestId = `ai-request.${randomUUID()}`;
      const controller = new AbortController();
      const record: MutableRequest = {
        requestId,
        request,
        controller,
        snapshot: snapshot(requestId, request, "accepted", null),
      };
      requests.set(requestId, record);
      record.snapshot = snapshot(requestId, request, "running", null);
      const executor =
        request.mode === "read_only_advice"
          ? dependencies.startReadOnlyAdvice
          : dependencies.startChangeCandidate;
      void settle(record, executor);
      return Object.freeze({
        status: "accepted" as const,
        requestId,
        reason: null,
      });
    },

    /**
     * Workbench AI依頼の開始・観測・取消境界におけるobserveの処理境界を固定する。
     *
     * @responsibility Workbench AI依頼の開始・観測・取消境界に必要な入力処理、失敗分類および結果生成を所有する。
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

    async observe(requestId: string) {
      const record = requests.get(requestId);
      return record?.snapshot ?? unknownSnapshot(requestId);
    },

    /**
     * Workbench AI依頼の開始・観測・取消境界におけるcancelの処理境界を固定する。
     *
     * @responsibility Workbench AI依頼の開始・観測・取消境界に必要な入力処理、失敗分類および結果生成を所有する。
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

    async cancel(requestId: string) {
      const record = requests.get(requestId);
      if (record === undefined) return unknownSnapshot(requestId);
      if (
        record.snapshot.status === "accepted" ||
        record.snapshot.status === "running"
      ) {
        record.controller.abort();
        record.snapshot = snapshot(
          requestId,
          record.request,
          "cancelled",
          "coordinator_ai_request_cancelled",
        );
      }
      return record.snapshot;
    },
  });
}

/**
 * 依頼を選択済みExecutorで完了させる。
 *
 * @responsibility Executor結果を同じRequest IDの公開Snapshotへ安全に収束させる。
 * @trace ARCH-000015
 * @input record: 現在依頼、executor: 選択済み実行境界。
 * @returns N/A: recordのSnapshotへ結果を反映する。
 * @precondition recordはMapへ登録済みで、executorは依頼種別に対応する。
 * @postcondition completed、blocked、unknown、cancelledのいずれかを保持する。
 * @effect 注入Executorを一回呼び、Process内Snapshotを更新する。
 * @failure 例外は`coordinator_ai_request_execution_failed`としてblockedへ変換する。
 * @invariant cancelledになった依頼を遅延結果で上書きしない。
 * @boundary Coordinator Applicationと依頼種別別Executorの境界。
 * @security 例外本文、生Provider出力またはPromptを公開結果へ含めない。
 * @concurrency Executor完了と取消の競合ではcancelledを優先する。
 */
async function settle(
  record: MutableRequest,
  executor: CoordinatorAiRequestExecutor,
): Promise<void> {
  try {
    const rawResult = await executor(record.request, record.controller.signal);
    if (record.snapshot.status === "cancelled") return;
    const result = inspectResult(rawResult);
    if (result === null) {
      record.snapshot = snapshot(
        record.requestId,
        record.request,
        "blocked",
        "coordinator_ai_request_result_invalid",
      );
      return;
    }
    record.snapshot = Object.freeze({
      requestId: record.requestId,
      mode: record.request.mode,
      profileId: record.request.profileId,
      status: result.status,
      reason: result.reason,
      facts: snapshotItems(result.facts),
      sharedAnalysis: snapshotItems(result.sharedAnalysis),
      additionalInferences: snapshotItems(result.additionalInferences),
      nextOptions: snapshotItems(result.nextOptions),
      candidate:
        result.candidate === null
          ? null
          : Object.freeze({ ...result.candidate }),
    });
  } catch {
    if (record.snapshot.status === "cancelled") return;
    record.snapshot = snapshot(
      record.requestId,
      record.request,
      "blocked",
      "coordinator_ai_request_execution_failed",
    );
  }
}

/**
 * Executorの未知結果を根拠参照付きの閉じた公開結果へ変換する。
 *
 * @responsibility 結果区分、本文および一件以上の根拠参照を公開Snapshotの手前で検証する。
 * @trace ARCH-000015
 * @input value: 依頼種別別Executorが返した未知結果。
 * @returns 検証済み結果。不正時はnull。
 * @precondition Executorの型宣言だけを実行時の保証とみなさない。
 * @postcondition 余分なKey、空本文、根拠なし項目および過大結果を拒否する。
 * @effect N/A: 入力検証と値の複製だけを行う。
 * @failure 不正結果を部分的に表示せずnullを返す。
 * @invariant 事実、共有分析、追加推論および次の選択肢を別区分のまま保持する。
 * @boundary 依頼種別別ExecutorとCoordinator公開結果の境界。
 * @security 生Provider Objectを公開せず、参照を読取りAuthorityとして解釈しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectResult(value: unknown): CoordinatorAiRequestResult | null {
  if (!isPlainExactRecord(value, RESULT_KEYS)) return null;
  if (
    (value.status !== "completed" &&
      value.status !== "blocked" &&
      value.status !== "unknown") ||
    (value.reason !== null &&
      (typeof value.reason !== "string" ||
        value.reason.length === 0 ||
        value.reason.length > 512))
  )
    return null;

  const facts = inspectResultItems(value.facts);
  const sharedAnalysis = inspectResultItems(value.sharedAnalysis);
  const additionalInferences = inspectResultItems(value.additionalInferences);
  const nextOptions = inspectResultItems(value.nextOptions);
  const candidate = inspectCandidate(value.candidate);
  if (
    facts === null ||
    sharedAnalysis === null ||
    additionalInferences === null ||
    nextOptions === null ||
    candidate === undefined
  )
    return null;

  return Object.freeze({
    status: value.status,
    reason: value.reason,
    facts,
    sharedAnalysis,
    additionalInferences,
    nextOptions,
    candidate,
  });
}

/**
 * Workbench AI依頼の開始・観測・取消境界におけるinspectCandidateの処理境界を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界に必要な入力処理、失敗分類および結果生成を所有する。
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

function inspectCandidate(
  value: unknown,
): CoordinatorAiRequestResult["candidate"] | undefined {
  if (value === null) return null;
  if (!isPlainExactRecord(value, CANDIDATE_KEYS)) return undefined;
  if (
    typeof value.candidateId !== "string" ||
    !/^candidate\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(value.candidateId) ||
    value.disposition !== "untrusted_not_adopted"
  )
    return undefined;
  return Object.freeze({
    candidateId: value.candidateId,
    disposition: value.disposition,
  });
}

/**
 * 一つの結果区分を根拠参照付き項目へ変換する。
 *
 * @responsibility 各本文と根拠参照の組を検証し、重複参照を拒否する。
 * @trace ARCH-000015
 * @input value: 未知の結果項目配列。
 * @returns 固定された結果項目配列。不正時はnull。
 * @precondition 配列要素を信頼済みObjectと仮定しない。
 * @postcondition 各項目は非空本文と一件以上の非空参照を持つ。
 * @effect N/A: 入力検証と値の複製だけを行う。
 * @failure 項目数、文字数、Keyまたは参照が契約外ならnullを返す。
 * @invariant 本文と根拠参照の対応および入力順を変えない。
 * @boundary 未知Executor出力とCoordinator結果Modelの境界。
 * @security 参照文字列をPathとして解決せず値としてだけ保持する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectResultItems(
  value: unknown,
): readonly CoordinatorAiResultItem[] | null {
  if (!Array.isArray(value) || value.length > 64) return null;
  const inspectedItems: CoordinatorAiResultItem[] = [];
  for (const item of value) {
    if (!isPlainExactRecord(item, RESULT_ITEM_KEYS)) return null;
    if (
      typeof item.text !== "string" ||
      item.text.trim().length === 0 ||
      item.text.length > 8_192 ||
      !Array.isArray(item.references) ||
      item.references.length === 0 ||
      item.references.length > 16 ||
      item.references.some(
        (reference) =>
          typeof reference !== "string" ||
          reference.trim().length === 0 ||
          reference.length > 512,
      ) ||
      new Set(item.references).size !== item.references.length
    )
      return null;
    inspectedItems.push(
      Object.freeze({
        text: item.text,
        references: Object.freeze([...item.references] as string[]),
      }),
    );
  }
  return Object.freeze(inspectedItems);
}

/**
 * 外部入力を閉じたAI依頼へ変換する。
 *
 * @responsibility 許可Key、依頼種別、Profile ID、PromptおよびContext参照を検証する。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @input value: Workbenchから受けた未知入力。
 * @returns 正規化済み依頼。不正時はnull。
 * @precondition valueを信頼済みObjectと仮定しない。
 * @postcondition 余分なKey、空Prompt、不正Profileおよび不正Contextを拒否する。
 * @effect N/A: 入力検証だけを行う。
 * @failure 不正値を補完せずnullを返す。
 * @invariant 入力文字列の意味を変更しない。
 * @boundary 未信頼Workbench入力とCoordinator Applicationの境界。
 * @security Prototypeを含む入力をPlain Recordとして再解釈しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectRequest(value: unknown): CoordinatorAiRequestInput | null {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype)
    return null;
  if (
    Object.keys(value).length !== REQUEST_KEYS.size ||
    Object.keys(value).some((key) => !REQUEST_KEYS.has(key))
  )
    return null;
  if (
    (value.mode !== "read_only_advice" && value.mode !== "change_candidate") ||
    typeof value.profileId !== "string" ||
    !PROFILE_ID.test(value.profileId) ||
    typeof value.prompt !== "string" ||
    value.prompt.trim().length === 0 ||
    value.prompt.length > 16_000 ||
    !Array.isArray(value.contextReferences) ||
    value.contextReferences.length > 64 ||
    value.contextReferences.some(
      (item) =>
        typeof item !== "string" || item.length === 0 || item.length > 512,
    ) ||
    !Array.isArray(value.allowedPaths) ||
    value.allowedPaths.length > 64 ||
    value.allowedPaths.some(
      (item) =>
        typeof item !== "string" ||
        item.length === 0 ||
        item.length > 512 ||
        item.startsWith("/") ||
        /^[A-Za-z]:/u.test(item) ||
        item.split(/[\\/]/u).includes(".."),
    ) ||
    new Set(value.allowedPaths).size !== value.allowedPaths.length ||
    (value.mode === "read_only_advice" && value.allowedPaths.length !== 0) ||
    (value.mode === "change_candidate" && value.allowedPaths.length === 0) ||
    typeof value.externalSendConfirmed !== "boolean"
  )
    return null;
  return Object.freeze({
    mode: value.mode,
    profileId: value.profileId,
    prompt: value.prompt,
    contextReferences: Object.freeze([...value.contextReferences] as string[]),
    allowedPaths: Object.freeze([...value.allowedPaths] as string[]),
    externalSendConfirmed: value.externalSendConfirmed,
  });
}

/**
 * AI結果項目を所有Snapshotへ変換する。
 *
 * @responsibility 本文と根拠参照の組を共有可変参照から分離する。
 * @trace ARCH-000015
 * @input items: Executorが返した結果項目。
 * @returns 固定された結果項目配列。
 * @precondition Executorは閉じた結果Schemaへ適合する。
 * @postcondition 各本文と参照配列を複製し凍結する。
 * @effect N/A: 値の複製だけを行う。
 * @failure N/A: Schema検証はExecutor AdapterがEffect前後の境界で所有する。
 * @invariant 本文と根拠参照の対応を変えない。
 * @boundary 依頼種別別Executor結果とCoordinator公開Snapshotの境界。
 * @security 生Provider Objectへの参照を公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function snapshotItems(
  items: readonly CoordinatorAiResultItem[],
): readonly CoordinatorAiResultItem[] {
  return Object.freeze(
    items.map((item) =>
      Object.freeze({
        text: item.text,
        references: Object.freeze([...item.references]),
      }),
    ),
  );
}

/**
 * 空の依頼Snapshotを生成する。
 *
 * @responsibility 状態と不変Identityを持つ情報非開示Snapshotを一貫して構築する。
 * @trace ARCH-000015
 * @input requestId、request、status、reason。
 * @returns 空の意味区分を持つ固定Snapshot。
 * @precondition statusは実Lifecycleで観測した値である。
 * @postcondition 結果配列を共有可変参照として公開しない。
 * @effect N/A: Object構築だけを行う。
 * @failure N/A: 閉じた引数だけを変換する。
 * @invariant modeとprofileIdをrequestから保持する。
 * @boundary N/A: Coordinator内の値変換である。
 * @security PromptとContext参照をSnapshotへ含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function snapshot(
  requestId: string,
  request: CoordinatorAiRequestInput,
  status: CoordinatorAiRequestSnapshot["status"],
  reason: string | null,
): CoordinatorAiRequestSnapshot {
  return Object.freeze({
    requestId,
    mode: request.mode,
    profileId: request.profileId,
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
 * 未知Request IDの非開示Snapshotを返す。
 *
 * @responsibility 未知Identityを他依頼の存在や内容を開示せず返す。
 * @trace ARCH-000015
 * @input requestId: 呼出し側が提示したIdentity。
 * @returns unknown状態の固定Snapshot。
 * @precondition requestIdを既知と仮定しない。
 * @postcondition 登録済み依頼のProfile、Modeまたは結果を含めない。
 * @effect N/A: Object構築だけを行う。
 * @failure N/A: 未知を不存在や成功へ畳まない。
 * @invariant 入力requestIdだけを相関値として保持する。
 * @boundary 未知Identityと公開観測結果の境界。
 * @security 別依頼の存在と内容を開示しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function unknownSnapshot(requestId: string): CoordinatorAiRequestSnapshot {
  return Object.freeze({
    requestId,
    mode: null,
    profileId: null,
    status: "unknown",
    reason: "coordinator_ai_request_not_found",
    facts: Object.freeze([]),
    sharedAnalysis: Object.freeze([]),
    additionalInferences: Object.freeze([]),
    nextOptions: Object.freeze([]),
    candidate: null,
  });
}

/**
 * 未知値がRecordかを判定する。
 *
 * @responsibility nullとArrayを除外してProperty検査可能な入力だけを返す。
 * @trace ARCH-000015
 * @input value: 未知入力。
 * @returns Recordならtrue。
 * @precondition valueの型を仮定しない。
 * @postcondition true時だけRecord propertyへ安全に到達できる。
 * @effect N/A: 型判定だけを行う。
 * @failure N/A: 判定不能をfalseにする。
 * @invariant 入力を変更しない。
 * @boundary 未知入力とTypeScript Recordの境界。
 * @security Getterを評価せず外形だけを判定する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 未知値が余分なKeyを持たないPlain Recordかを判定する。
 *
 * @responsibility 外部境界の閉じたSchemaを共通判定する。
 * @trace ARCH-000015
 * @input value: 未知入力、keys: 許可する全Key。
 * @returns Plain RecordかつKey集合が完全一致するときtrue。
 * @precondition Getter等を持つ任意Prototypeを信頼しない。
 * @postcondition true時は許可Keyだけを持つPlain Recordである。
 * @effect N/A: 外形検査だけを行う。
 * @failure 判定不能をfalseにする。
 * @invariant 入力を変更しない。
 * @boundary 未知入力と閉じた結果Schemaの境界。
 * @security 独自Prototypeと余分なPropertyを拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function isPlainExactRecord(
  value: unknown,
  keys: ReadonlySet<string>,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === keys.size &&
    Object.keys(value).every((key) => keys.has(key))
  );
}
