/**
 * Repository別AI選択と一回の選定結果の値モデルを所有する。
 * @responsibility 設定の型と、現在Catalogに依存しない保存選定の閉形式検査を所有する。
 * @trace ARCH-000004
 * @boundary Repository設定とCoordinatorの実行準備。
 * @effect N/A: 型宣言と同期的な値検査だけ。
 * @security 役割・分類から実行Authorityを発行しない。
 */
import { types as utilTypes } from "node:util";
import { createHash } from "node:crypto";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import type {
  AiModelSelection,
  AiProvider,
  AiReasoningEffort,
} from "../../../ai-adapter/src/index.ts";

/**
 * v0.22の固定した五つの作業上の役割。
 * @responsibility アクセス管理のロールとは異なるAIの担当を表す。
 * @trace ARCH-000004
 * @shape 五つのliteralの和。
 * @invariant ユーザー定義の作業分類を役割へ昇格しない。
 * @boundary Repository設定とTask計画。
 * @security 権限・認証・Tool許可ではない。
 * @compatibility 新形式の固定集合。
 */
export type AiSelectionRole =
  | "coordinator"
  | "executor"
  | "independent_reviewer"
  | "result_integration"
  | "advice";

/**
 * Repositoryが希望する一つのModelとEffort。
 * @responsibility 技術カタログを参照する値だけを保持する。
 * @trace ARCH-000004
 * @shape Provider、Model識別子、Effort。
 * @invariant 既定値やfallbackを内部に持たない。
 * @boundary 設定と技術検査。
 * @security CLI引数・Path・Secretを持たない。
 * @compatibility 新設定JSONの選択値。
 */
export type AiSelectionChoice = Readonly<{
  provider: AiProvider;
  model: string;
  effort: AiReasoningEffort;
}>;

/**
 * 明示選択の三項目を独立した値へ固定する。
 * @responsibility 公開入力の構造検査を現在Catalogによる用途検査から分離する。
 * @trace ARCH-000004
 * @input candidate: 未信頼のProvider・Model・Effort。
 * @returns 不変の三項目、又はnull。
 * @precondition 技術対応は新規選定時に別途検査する。
 * @postcondition 既定値・fallback・Authorityを作らない。
 * @effect N/A: 同期の値検査のみ。
 * @failure 欠落・過剰・Proxy・getter・不正文字列はnull。
 * @invariant 保存済み選定を現在Catalogで再解釈しない。
 * @boundary 公開Task／Objective入力と選定Owner。
 * @security CLI引数・Path・秘密値のfieldを受けない。
 * @concurrency 元入力の変更から分離する。
 */
export function inspectAiSelectionChoice(
  candidate: unknown,
): AiSelectionChoice | null {
  const value = snapshotPlainRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (
    !value ||
    (value.provider !== "codex" && value.provider !== "claude") ||
    typeof value.model !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.model) ||
    typeof value.effort !== "string" ||
    !["low", "medium", "high", "xhigh", "max"].includes(value.effort)
  )
    return null;
  return Object.freeze({
    provider: value.provider,
    model: value.model,
    effort: value.effort as AiReasoningEffort,
  });
}

/**
 * 五役割の既定値と任意分類・分類別上書きを保持する。
 * @responsibility Repositoryごとの希望を一つの設定正本へまとめる。
 * @trace ARCH-000004
 * @shape 固定契約、役割既定値、分類辞書、部分上書き辞書。
 * @invariant revisionはSchema版であり保存CAS世代ではない。
 * @boundary 設定保存と選定処理。
 * @security Authority・認証・外部送信同意を含めない。
 * @compatibility 旧Profile形式を含めない。
 */
export type AiSelectionConfig = Readonly<{
  contract: "crdd/ai-selection";
  revision: 1;
  roleDefaults: Readonly<Record<AiSelectionRole, AiSelectionChoice>>;
  workTypes: Readonly<Record<string, Readonly<{ label: string }>>>;
  overrides: Readonly<
    Partial<
      Record<AiSelectionRole, Readonly<Record<string, AiSelectionChoice>>>
    >
  >;
}>;

/**
 * 内容Identityとともに検証されたRepository設定。
 * @responsibility 書式差でなく意味が一致する設定を同じHashへ固定する。
 * @trace ARCH-000004
 * @shape 不変設定と正規化本文SHA-256。
 * @invariant 元入力の後発変更を含めない。
 * @boundary 設定読取り・CAS・Task選定。
 * @security Hashは認可又は署名ではない。
 * @compatibility 旧Profile改訂と同じ値へ読み替えない。
 */
export type AiSelectionSnapshot = Readonly<{
  config: AiSelectionConfig;
  identity: string;
}>;

/**
 * 今回選ばれた技術構成と選定元。
 * @responsibility 具体構成・設定Identity・役割・分類を一つの不変結果へ固定する。
 * @trace ARCH-000004
 * @shape 技術選定と選定元の直和。
 * @invariant aliasを解決後の具体版へ変えず、進行中設定を再解釈しない。
 * @boundary 選定と実行・耐久記録。
 * @security 選定結果は実行Authorityではない。
 * @compatibility 新方式の実行入力である。
 */
export type ExecutionSelection = AiModelSelection &
  Readonly<{
    catalogIdentity: string;
    configIdentity: string;
    role: AiSelectionRole;
    workType: string | null;
    source: "explicit" | "work_type_override" | "role_default";
  }>;

/**
 * 一つのTaskが使う編集担当と独立レビュー担当の固定選定。
 * @responsibility 複数stageが同じ受付時設定を共有する相関を所有する。
 * @trace ARCH-000004
 * @shape executorとreviewerの完全な選定値。
 * @invariant 設定・Catalog・作業分類が同じ組だけを受理する。
 * @boundary Objective・Task・Operationの値搬送と保存。
 * @security 同じProviderでも実行Contextの独立性は実行Ownerが別に保証する。
 * @compatibility 旧Profileや再選定を含めない。
 */
export type TaskExecutionSelections = Readonly<{
  executor: ExecutionSelection;
  reviewer: ExecutionSelection;
}>;

/**
 * 保存済みの役割別選定を現在設定で解き直さず検査する。
 * @responsibility stage間で選定組を混ぜない閉形式codecを所有する。
 * @trace ARCH-000004
 * @input candidate: 未信頼の二役割選定。
 * @returns 独立した不変値、不正時null。
 * @precondition 実行可否と認可は別のOwnerが確認する。
 * @postcondition 元のModel・alias・分類・選定元を維持する。
 * @effect N/A: 局所値検査だけ。
 * @failure 不足・過剰・Proxy・accessor・相関不正はnull。
 * @invariant 現在Catalog・設定Store・I/Oを参照しない。
 * @boundary 保存codecと実行Owner。
 * @security 選定の復元を実行許可にしない。
 * @concurrency 同期処理で元入力へ書き込まない。
 */
export function inspectTaskExecutionSelections(
  candidate: unknown,
): TaskExecutionSelections | null {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    utilTypes.isProxy(candidate)
  )
    return null;
  const prototype = Object.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  if (Reflect.ownKeys(descriptors).length !== 2) return null;
  const values = ["executor", "reviewer"].map((key) => {
    const descriptor = descriptors[key];
    return descriptor && "value" in descriptor && descriptor.enumerable
      ? inspectExecutionSelection(descriptor.value)
      : null;
  });
  const [executor, reviewer] = values;
  if (
    !executor ||
    !reviewer ||
    executor.role !== "executor" ||
    reviewer.role !== "independent_reviewer" ||
    reviewer.source === "explicit" ||
    executor.configIdentity !== reviewer.configIdentity ||
    executor.catalogIdentity !== reviewer.catalogIdentity ||
    executor.workType !== reviewer.workType
  )
    return null;
  return Object.freeze({ executor, reviewer });
}

/**
 * 保存された選定を現在Catalogで解き直さず独立値へ取り出す。
 * @responsibility 選定の十項目と相関だけを閉じて検査する。
 * @trace ARCH-000004
 * @input candidate: 保存済み又は搬送された未信頼選定。
 * @returns 不変な選定値、又はnull。
 * @precondition 新規実行の技術可否は別の技術Catalog検査を通す。
 * @postcondition alias・選定元・当時の内容Identityをそのまま保持する。
 * @effect N/A: 同期的な値検査と独立Objectの構築だけ。
 * @failure 不足・過剰・実行Property・相関不正はnull。
 * @invariant 復元成功は現在の実行許可や利用可能性を意味しない。
 * @boundary 保存選定とTask／Packetの値搬送。
 * @security Proxy・Getterを実行せず、Authorityを生成しない。
 * @concurrency 一度捕捉したdata descriptorの値だけを使用する。
 */
export function inspectExecutionSelection(
  candidate: unknown,
): ExecutionSelection | null {
  try {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      utilTypes.isProxy(candidate)
    )
      return null;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    const keys = [
      "provider",
      "modelIdentifier",
      "identifierKind",
      "reasoningEffort",
      "purpose",
      "catalogIdentity",
      "configIdentity",
      "role",
      "workType",
      "source",
    ] as const;
    const actual = Reflect.ownKeys(descriptors);
    if (
      actual.length !== keys.length ||
      actual.some(
        (key) =>
          typeof key !== "string" || !keys.some((expected) => expected === key),
      )
    )
      return null;
    const value: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.enumerable !== true ||
        Object.hasOwn(descriptor, "get") ||
        Object.hasOwn(descriptor, "set")
      )
        return null;
      value[key] = descriptor.value;
    }
    if (
      (value.provider !== "codex" && value.provider !== "claude") ||
      typeof value.modelIdentifier !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.modelIdentifier) ||
      (value.identifierKind !== "exact" && value.identifierKind !== "alias") ||
      typeof value.reasoningEffort !== "string" ||
      !["low", "medium", "high", "xhigh", "max"].includes(
        value.reasoningEffort,
      ) ||
      (value.purpose !== "advice" && value.purpose !== "task") ||
      typeof value.catalogIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.catalogIdentity) ||
      typeof value.configIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.configIdentity) ||
      typeof value.role !== "string" ||
      ![
        "coordinator",
        "executor",
        "independent_reviewer",
        "result_integration",
        "advice",
      ].includes(value.role) ||
      !(
        value.workType === null ||
        (typeof value.workType === "string" &&
          /^[a-z0-9][a-z0-9._-]*$/u.test(value.workType))
      ) ||
      typeof value.source !== "string" ||
      !["explicit", "work_type_override", "role_default"].includes(
        value.source,
      ) ||
      (value.source === "work_type_override" && value.workType === null) ||
      value.purpose !==
        (["executor", "independent_reviewer"].includes(value.role)
          ? "task"
          : "advice")
    )
      return null;
    return Object.freeze({ ...value }) as ExecutionSelection;
  } catch {
    return null;
  }
}

/**
 * 完全な選定値の非Authority Identityを導く。
 * @responsibility Providerだけでなく選定元・当時の構成まで同じ相関へ含める。
 * @trace ARCH-000004
 * @input candidate: 十項目の選定候補。
 * @returns 正規化した選定のSHA-256、不正時null。
 * @precondition Hash自体で実行を許可しない。
 * @postcondition alias種別・設定Identity・役割・分類の差は別Hashになる。
 * @effect N/A: 局所検査と決定論的Hashだけ。
 * @failure 閉形式を満たさない値はnull。
 * @invariant 現在Catalogや設定を読まない。
 * @boundary Packet・Grant・保存選定の値相関。
 * @security Hashを資格や操作Capabilityにしない。
 * @concurrency 元値から独立したSnapshotだけをHash化する。
 */
export function hashExecutionSelection(candidate: unknown): string | null {
  const value = inspectExecutionSelection(candidate);
  return value
    ? createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")
    : null;
}
