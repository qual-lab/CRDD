/**
 * Repository別AI設定の検査と決定的な選定を所有する。
 * @responsibility 閉形式・参照整合性と明示指定→分類上書き→既定値の順序を検査する。
 * @trace ARCH-000004
 * @boundary Repository設定とAI Adapterの技術対応検査。
 * @effect N/A: 値のSnapshotとHash計算だけ。
 * @security 認証・権限・外部送信・保存・実行を開始しない。
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import { resolveAiModelSelection } from "../../../ai-adapter/src/index.ts";
import type {
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionRole,
  AiSelectionSnapshot,
  ExecutionSelection,
  TaskExecutionSelections,
} from "./types.ts";
import { inspectTaskExecutionSelections } from "./validation.ts";

const ROLES = Object.freeze([
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
  "advice",
] as const);
const WORK_TYPE_ID = /^[a-z0-9][a-z0-9._-]*$/u;

/**
 * 任意分類の辞書を実行可能Propertyなしに取得する。
 * @responsibility Proxy判定を先に行い、通常のdata propertyだけを既存Snapshotへ渡す。
 * @trace ARCH-000004
 * @input candidate: 未信頼辞書。
 * @returns 不変の浅いSnapshot又はnull。
 * @precondition 個々の値は呼出し元で別途検証する。
 * @postcondition Getter・Proxyのhookを実行しない。
 * @effect N/A: 局所取得だけ。
 * @failure Symbol・特殊prototype・accessorは拒否する。
 * @invariant 件数や表示名文字数による独自の製品制限を加えない。
 * @boundary 任意キーを持つ設定値と閉形式検査。
 * @security Objectの継承Propertyを設定値として扱わない。
 * @concurrency N/A: 同期処理で共有可変状態なし。
 */
function snapshotEntries(
  candidate: unknown,
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      utilTypes.isProxy(candidate) ||
      Array.isArray(candidate)
    )
      return null;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(candidate);
    if (keys.some((key) => typeof key !== "string")) return null;
    return snapshotPlainRecord(candidate, new Set(keys as string[]));
  } catch {
    return null;
  }
}

/**
 * 設定値を役割が必要とする技術用途へ照合する。
 * @responsibility 業務上の担当を既存advice／task計画の用途へ対応付ける。
 * @trace ARCH-000004
 * @input candidate: 設定値、role: 検証済み役割。
 * @returns 対応する不変選択値又はnull。
 * @precondition roleは固定五役割の一つ。
 * @postcondition Model・Effortを補完又は昇格しない。
 * @effect N/A: 純粋な技術検査だけ。
 * @failure 用途又はEffort不対応はnull。
 * @invariant 役割からTool・Filesystem権限を作らない。
 * @boundary Repository希望と技術カタログ。
 * @security ログイン状態や外部送信同意を推定しない。
 * @concurrency N/A: 不変値を同期参照する。
 */
function inspectChoice(
  candidate: unknown,
  role: AiSelectionRole,
): AiSelectionChoice | null {
  const choice = snapshotPlainRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (!choice) return null;
  const result = resolveAiModelSelection({
    provider: choice.provider,
    modelIdentifier: choice.model,
    reasoningEffort: choice.effort,
    purpose:
      role === "executor" || role === "independent_reviewer"
        ? "task"
        : "advice",
  });
  return result.status === "resolved"
    ? Object.freeze({
        provider: result.value.provider,
        model: result.value.modelIdentifier,
        effort: result.value.reasoningEffort,
      })
    : null;
}

/**
 * RepositoryのAI選択設定を検査し内容Identityへ固定する。
 * @responsibility 五役割・任意分類・上書きの参照と技術対応を一括検証する。
 * @trace ARCH-000004
 * @input candidate: 新形式設定の未信頼値。
 * @returns validの不変設定又はblockedの固定理由。
 * @precondition Filesystem読取りのbyte上限とRoot検査は保存Ownerが所有する。
 * @postcondition 辞書順を正規化し、同じ意味の設定から同じIdentityを導く。
 * @effect N/A: 値検査とHash計算だけ。
 * @failure 欠落・未知field・未知役割／分類・参照不整合・技術不対応を拒否する。
 * @invariant 一部分が正しいだけで設定全体を受理しない。
 * @boundary Repository設定とTask選定。
 * @security 設定値からAuthorityや実行を生成しない。
 * @concurrency N/A: 元入力を変更しない同期処理。
 */
export function validateAiSelectionConfig(
  candidate: unknown,
): AiSelectionConfigResult {
  const blocked = Object.freeze({
    status: "blocked" as const,
    value: null,
    reason: "ai_selection_config_invalid" as const,
  });
  const record = snapshotPlainRecord(
    candidate,
    new Set(["contract", "revision", "roleDefaults", "workTypes", "overrides"]),
  );
  if (record?.contract !== "crdd/ai-selection" || record.revision !== 1)
    return blocked;
  const defaults = snapshotPlainRecord(record.roleDefaults, new Set(ROLES));
  const workTypes = snapshotEntries(record.workTypes);
  const overrides = snapshotEntries(record.overrides);
  if (
    !defaults ||
    !workTypes ||
    !overrides ||
    Object.keys(overrides).some(
      (role) => !ROLES.some((value) => value === role),
    )
  )
    return blocked;
  const checkedDefaults: [AiSelectionRole, AiSelectionChoice][] = [];
  for (const role of ROLES) {
    const choice = inspectChoice(defaults[role], role);
    if (!choice) return blocked;
    checkedDefaults.push([role, choice]);
  }
  const checkedWorkTypes: [string, Readonly<{ label: string }>][] = [];
  for (const id of Object.keys(workTypes).sort()) {
    if (!WORK_TYPE_ID.test(id)) return blocked;
    const value = snapshotPlainRecord(workTypes[id], new Set(["label"]));
    if (
      !value ||
      typeof value.label !== "string" ||
      !value.label.trim() ||
      /[\u0000-\u001f\u007f]/u.test(value.label)
    )
      return blocked;
    checkedWorkTypes.push([id, Object.freeze({ label: value.label })]);
  }
  const checkedOverrides: [
    AiSelectionRole,
    Readonly<Record<string, AiSelectionChoice>>,
  ][] = [];
  for (const role of ROLES) {
    if (!Object.hasOwn(overrides, role)) continue;
    const values = snapshotEntries(overrides[role]);
    if (!values) return blocked;
    const choices: [string, AiSelectionChoice][] = [];
    for (const id of Object.keys(values).sort()) {
      if (!Object.hasOwn(workTypes, id)) return blocked;
      const choice = inspectChoice(values[id], role);
      if (!choice) return blocked;
      choices.push([id, choice]);
    }
    checkedOverrides.push([role, Object.freeze(Object.fromEntries(choices))]);
  }
  const config: AiSelectionConfig = Object.freeze({
    contract: "crdd/ai-selection",
    revision: 1,
    roleDefaults: Object.freeze(
      Object.fromEntries(checkedDefaults),
    ) as AiSelectionConfig["roleDefaults"],
    workTypes: Object.freeze(Object.fromEntries(checkedWorkTypes)),
    overrides: Object.freeze(Object.fromEntries(checkedOverrides)),
  });
  return Object.freeze({
    status: "valid",
    reason: null,
    value: Object.freeze({
      config,
      identity: createHash("sha256")
        .update(JSON.stringify(config), "utf8")
        .digest("hex"),
    }),
  });
}

/**
 * 明示指定、分類上書き、役割既定値の順で今回の構成を固定する。
 * @responsibility 有効設定全体と要求を検査し、選定元と技術Identityを結合する。
 * @trace ARCH-000004
 * @input candidateConfig: 新形式設定、candidateRequest: role・workType・明示choice。
 * @returns resolvedの固定選定又はblockedの固定理由。
 * @precondition workType省略をnullとして明示し、choiceは省略可能。
 * @postcondition 要求が未知分類なら明示指定があっても拒否する。
 * @effect N/A: 値選定だけ。
 * @failure 不正設定・要求・非対応選択を補完せず拒否する。
 * @invariant 設定変更で既に返した値を書き換えない。
 * @boundary 設定と実行準備。
 * @security 実行・外部送信・Git・認可を開始しない。
 * @concurrency N/A: 同期の不変値処理。
 */
export function resolveExecutionSelection(
  candidateConfig: unknown,
  candidateRequest: unknown,
): ExecutionSelectionResult {
  const checked = validateAiSelectionConfig(candidateConfig);
  if (checked.status !== "valid")
    return Object.freeze({
      status: "blocked",
      value: null,
      reason: checked.reason,
    });
  const request =
    snapshotPlainRecord(
      candidateRequest,
      new Set(["role", "workType", "choice"]),
    ) ?? snapshotPlainRecord(candidateRequest, new Set(["role", "workType"]));
  if (
    !request ||
    !ROLES.some((role) => role === request.role) ||
    (request.workType !== null &&
      (typeof request.workType !== "string" ||
        !Object.hasOwn(checked.value.config.workTypes, request.workType)))
  )
    return Object.freeze({
      status: "blocked",
      value: null,
      reason: "ai_selection_request_invalid",
    });
  const role = request.role as AiSelectionRole;
  const workType = request.workType as string | null;
  const roleOverrides = Object.hasOwn(checked.value.config.overrides, role)
    ? checked.value.config.overrides[role]
    : undefined;
  const override =
    workType !== null && roleOverrides && Object.hasOwn(roleOverrides, workType)
      ? roleOverrides[workType]
      : undefined;
  const explicit = Object.hasOwn(request, "choice");
  const selected = inspectChoice(
    explicit
      ? request.choice
      : (override ?? checked.value.config.roleDefaults[role]),
    role,
  );
  if (!selected)
    return Object.freeze({
      status: "blocked",
      value: null,
      reason: "ai_selection_choice_unsupported",
    });
  const technical = resolveAiModelSelection({
    provider: selected.provider,
    modelIdentifier: selected.model,
    reasoningEffort: selected.effort,
    purpose:
      role === "executor" || role === "independent_reviewer"
        ? "task"
        : "advice",
  });
  if (technical.status !== "resolved")
    return Object.freeze({
      status: "blocked",
      value: null,
      reason: "ai_selection_choice_unsupported",
    });
  return Object.freeze({
    status: "resolved",
    reason: null,
    value: Object.freeze({
      ...technical.value,
      configIdentity: checked.value.identity,
      role,
      workType,
      source: explicit
        ? "explicit"
        : override
          ? "work_type_override"
          : "role_default",
    }),
  });
}

/**
 * 一回のTask受付に使う二役割を同じ設定から固定する。
 * @responsibility 明示指定は編集担当だけへ適用し、レビュー担当は同じ設定の役割選定を使う。
 * @trace ARCH-000004
 * @input candidateConfig: 一回読んだ設定、candidateRequest: workTypeと任意choice。
 * @returns 二役割の不変選定、又は固定拒否。
 * @precondition 呼出し元が設定を一回だけ読み、返却後は再選定しない。
 * @postcondition Provider違いでの自動fallbackを行わない。
 * @effect N/A: 純粋な選定だけ。
 * @failure 一方でも不正なら組全体を返さない。
 * @invariant 役割選定と実行Authority・認証・送信同意を分離する。
 * @boundary Repository設定とTask受付。
 * @security 実行・保存・外部送信を開始しない。
 * @concurrency 同期的に同じ不変設定Snapshotから導く。
 */
export function resolveTaskExecutionSelections(
  candidateConfig: unknown,
  candidateRequest: unknown,
): Readonly<
  | { status: "resolved"; value: TaskExecutionSelections; reason: null }
  | {
      status: "blocked";
      value: null;
      reason:
        | Exclude<ExecutionSelectionResult["reason"], null>
        | "ai_selection_pair_invalid";
    }
> {
  const request =
    snapshotPlainRecord(candidateRequest, new Set(["workType", "choice"])) ??
    snapshotPlainRecord(candidateRequest, new Set(["workType"]));
  if (!request)
    return Object.freeze({
      status: "blocked",
      value: null,
      reason: "ai_selection_request_invalid",
    });
  const checked = validateAiSelectionConfig(candidateConfig);
  if (checked.status !== "valid")
    return Object.freeze({
      status: "blocked",
      value: null,
      reason: checked.reason,
    });
  const executor = resolveExecutionSelection(checked.value.config, {
    role: "executor",
    workType: request.workType,
    ...(Object.hasOwn(request, "choice") ? { choice: request.choice } : {}),
  });
  if (executor.status !== "resolved") return executor;
  const reviewer = resolveExecutionSelection(checked.value.config, {
    role: "independent_reviewer",
    workType: request.workType,
  });
  if (reviewer.status !== "resolved") return reviewer;
  const value = inspectTaskExecutionSelections({
    executor: executor.value,
    reviewer: reviewer.value,
  });
  return value
    ? Object.freeze({ status: "resolved", value, reason: null })
    : Object.freeze({
        status: "blocked",
        value: null,
        reason: "ai_selection_pair_invalid",
      });
}

/**
 * 設定検査の成功値と固定拒否。
 * @responsibility 不正設定を空設定へ畳まない。
 * @trace ARCH-000004
 * @shape valid時だけSnapshotを持つ直和型。
 * @invariant 未設定と有効設定を同一視しない。
 * @boundary 設定Storeと検査。
 * @security 認証・実行許可なし。
 * @compatibility 新形式専用。
 */
export type AiSelectionConfigResult = Readonly<
  | { status: "valid"; value: AiSelectionSnapshot; reason: null }
  | { status: "blocked"; value: null; reason: "ai_selection_config_invalid" }
>;

/**
 * 今回の選定成功と固定拒否。
 * @responsibility 選定不能時に代替値を返さない。
 * @trace ARCH-000004
 * @shape resolved時だけ固定選定を持つ直和型。
 * @invariant 拒否を別Modelの成功へ変換しない。
 * @boundary 選定と実行準備。
 * @security 選定結果はAuthorityでない。
 * @compatibility 新形式専用。
 */
export type ExecutionSelectionResult = Readonly<
  | { status: "resolved"; value: ExecutionSelection; reason: null }
  | {
      status: "blocked";
      value: null;
      reason:
        | "ai_selection_config_invalid"
        | "ai_selection_request_invalid"
        | "ai_selection_choice_unsupported";
    }
>;
