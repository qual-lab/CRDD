/**
 * 編集・レビューの内容Schemaと検査済み所見を所有する。
 * @packageDocumentation
 * @responsibility Provider搬送・実行・再試行許可を扱わず、内容の閉形式を検査する。
 * @trace ARCH-000015
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../plain-data/snapshot.ts";
/**
 * 内容検査を通ったレビュー所見を表す。
 * @responsibility 内容の利用側へ本文と検査済み相関を渡す。
 * @trace ARCH-000015
 * @shape 重要度・Path・分類・受入条件番号・本文とHash。
 * @invariant 通常結果へ本文を載せない。
 * @boundary Domain内容検査と、認可を確認する利用側。
 * @security 未信頼本文は同意・秘密検査を迂回する許可ではない。
 * @compatibility 移管前の所見検査条件を維持する。
 */
export type TaskReviewFinding = Readonly<{
  severity: "critical" | "high" | "medium" | "low" | "info";
  path: string;
  category:
    | "acceptance_criterion_not_met"
    | "implementation_defect"
    | "verification_defect"
    | "security_or_authority_defect";
  criterionNumber: number;
  message: string;
  messageSha256: string;
}>;

/**
 * 閉じた内容Objectのキー集合を確認する。
 * @responsibility Task内容の固定条件を検査する。
 * @trace ARCH-000015
 * @input 検査済みplain Objectと許可Key。
 * @returns 適合する場合だけtrue。
 * @precondition 入力の動的Propertyは呼出し境界で拒否済み。
 * @postcondition 入力を変更しない。
 * @effect N/A: 値検査だけ。
 * @failure キー数又は存在差はfalse。
 * @invariant 内容の正しさや実行許可を推測しない。
 * @boundary Domainの内容検査内部。
 * @security 秘密不存在の証明ではない。
 * @concurrency N/A: 共有状態なし。
 */
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length && keys.every((key) => actual.includes(key))
  );
}
/**
 * 内容として扱える有限文字列を確認する。
 * @responsibility Task内容の固定条件を検査する。
 * @trace ARCH-000015
 * @input 未検査値と固定byte上限。
 * @returns 適合する場合だけtrue。
 * @precondition 入力の動的Propertyは呼出し境界で拒否済み。
 * @postcondition 入力を変更しない。
 * @effect N/A: 値検査だけ。
 * @failure 空・NUL・周辺空白・容量超過はfalse。
 * @invariant 内容の正しさや実行許可を推測しない。
 * @boundary Domainの内容検査内部。
 * @security 秘密不存在の証明ではない。
 * @concurrency N/A: 共有状態なし。
 */
function validString(value: unknown, maximumBytes: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}
const MAXIMUM_SUMMARY_BYTES = 8_192;

const MAXIMUM_PATHS = 1_000;

const MAXIMUM_FINDINGS = 64;

const MAXIMUM_FINDING_MESSAGE_BYTES = 4_096;

const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

const FINDING_CATEGORIES = new Set([
  "acceptance_criterion_not_met",
  "implementation_defect",
  "verification_defect",
  "security_or_authority_defect",
]);

/**
 * 記録かを判定する。
 *
 * @responsibility 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisRecordの入力契約を満たす。
 * @postcondition isRecordの責務を完了した結果だけを返す。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecordは独自の失敗分岐を所有しない。
 * @invariant isRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecordはProcess内の同一Subsystemで完結する。
 * @security isRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !utilTypes.isProxy(value) &&
    !Array.isArray(value)
  );
}

/**
 * Pathが有効か判定する。
 *
 * @responsibility Pathの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns validPathの計算結果を返す。
 * @precondition 「value: unknown」がvalidPathの入力契約を満たす。
 * @postcondition validPathの責務を完了した結果だけを返す。
 * @effect N/A: validPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validPathは独自の失敗分岐を所有しない。
 * @invariant validPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validPathはProcess内の同一Subsystemで完結する。
 * @security validPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validPathは共有非同期状態を持たない同期処理である。
 */
function validPath(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1_024 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value
      .split("/")
      .every(
        (segment) => segment.length > 0 && segment !== "." && segment !== "..",
      )
  );
}

/**
 * provider-task-structured-resultで使用する結果 Mismatch Reasonの値契約を定義する。
 *
 * @responsibility 結果 Mismatch ReasonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ResultMismatchReasonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ResultMismatchReasonで宣言した値と責務の対応を維持する。
 * @boundary N/A: ResultMismatchReasonの宣言は外部境界を開かない。
 * @security ResultMismatchReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ResultMismatchReasonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ResultMismatchReason =
  | "provider_task_result_input_invalid"
  | "provider_task_executor_shape_invalid"
  | "provider_task_reviewer_shape_invalid"
  | "provider_task_reviewer_keys_invalid"
  | "provider_task_reviewer_decision_invalid"
  | "provider_task_reviewer_summary_invalid"
  | "provider_task_reviewer_findings_invalid"
  | "provider_task_reviewer_finding_invalid"
  | "provider_task_reviewer_decision_inconsistent";

/**
 * rejectedを決定する。
 *
 * @responsibility rejectedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input reason: ResultMismatchReason
 * @returns rejectedの計算結果を返す。
 * @precondition 「reason: ResultMismatchReason」がrejectedの入力契約を満たす。
 * @postcondition rejectedの責務を完了した結果だけを返す。
 * @effect N/A: rejectedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rejectedは独自の失敗分岐を所有しない。
 * @invariant rejectedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: rejectedはProcess内の同一Subsystemで完結する。
 * @security rejectedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rejectedは共有非同期状態を持たない同期処理である。
 */
function rejected(reason: ResultMismatchReason) {
  return Object.freeze({ normalizedResult: null, reason });
}

/**
 * executor 結果を決定する。
 *
 * @responsibility executor 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>
 * @returns executorResultの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がexecutorResultの入力契約を満たす。
 * @postcondition executorResultの責務を完了した結果だけを返す。
 * @effect N/A: executorResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: executorResultは独自の失敗分岐を所有しない。
 * @invariant executorResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executorResultはProcess内の同一Subsystemで完結する。
 * @security executorResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: executorResultは共有非同期状態を持たない同期処理である。
 */
function executorResult(value: Record<string, unknown>) {
  const paths = snapshotPlainArray(value.changedPaths, MAXIMUM_PATHS);
  const verification = snapshotPlainArray(value.verification, 32);
  value = {
    ...value,
    changedPaths: paths.status === "ok" ? paths.value : null,
    verification: verification.status === "ok" ? verification.value : null,
  };
  if (
    !exactKeys(value, ["status", "summary", "changedPaths", "verification"]) ||
    value.status !== "completed" ||
    !validString(value.summary, MAXIMUM_SUMMARY_BYTES) ||
    !Array.isArray(value.changedPaths) ||
    value.changedPaths.length > MAXIMUM_PATHS ||
    !value.changedPaths.every(validPath) ||
    new Set(value.changedPaths.map((item) => item.toUpperCase())).size !==
      value.changedPaths.length ||
    !Array.isArray(value.verification) ||
    value.verification.length > 32 ||
    !value.verification.every((item) => validString(item, 1_024))
  ) {
    return rejected("provider_task_executor_shape_invalid");
  }
  return Object.freeze({
    normalizedResult: Object.freeze({
      status: "completed" as const,
      changedPaths: Object.freeze([...(value.changedPaths as string[])]),
      verificationCount: value.verification.length,
    }),
    reason: null,
  });
}

/**
 * reviewer 結果を決定する。
 *
 * @responsibility reviewer 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>
 * @returns reviewerResultの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がreviewerResultの入力契約を満たす。
 * @postcondition reviewerResultの責務を完了した結果だけを返す。
 * @effect N/A: 検査済み所見と内容の値を返すだけである。
 * @failure N/A: reviewerResultは独自の失敗分岐を所有しない。
 * @invariant reviewerResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reviewerResultはProcess内の同一Subsystemで完結する。
 * @security reviewerResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reviewerResultは共有非同期状態を持たない同期処理である。
 */
function reviewerResult(value: Record<string, unknown>) {
  const snapshot = snapshotPlainArray(value.findings, MAXIMUM_FINDINGS);
  value = {
    ...value,
    findings: snapshot.status === "ok" ? snapshot.value : null,
  };
  if (!exactKeys(value, ["decision", "summary", "findings"]))
    return rejected("provider_task_reviewer_keys_invalid");
  if (value.decision !== "approved" && value.decision !== "changes_requested")
    return rejected("provider_task_reviewer_decision_invalid");
  if (!validString(value.summary, MAXIMUM_SUMMARY_BYTES))
    return rejected("provider_task_reviewer_summary_invalid");
  if (
    !Array.isArray(value.findings) ||
    value.findings.length > MAXIMUM_FINDINGS
  )
    return rejected("provider_task_reviewer_findings_invalid");
  const findings = value.findings.map((rawFinding) => {
    const finding = snapshotPlainRecord(
      rawFinding,
      new Set(["severity", "path", "category", "criterionNumber", "message"]),
    );
    if (
      !isRecord(finding) ||
      !exactKeys(finding, [
        "severity",
        "path",
        "category",
        "criterionNumber",
        "message",
      ]) ||
      typeof finding.severity !== "string" ||
      !SEVERITIES.has(finding.severity) ||
      !validPath(finding.path) ||
      typeof finding.category !== "string" ||
      !FINDING_CATEGORIES.has(finding.category) ||
      typeof finding.criterionNumber !== "number" ||
      !Number.isInteger(finding.criterionNumber) ||
      finding.criterionNumber < 1 ||
      finding.criterionNumber > 16 ||
      !validString(finding.message, MAXIMUM_FINDING_MESSAGE_BYTES)
    ) {
      return null;
    }
    return Object.freeze({
      severity: finding.severity as
        | "critical"
        | "high"
        | "medium"
        | "low"
        | "info",
      path: finding.path as string,
      category: finding.category as
        | "acceptance_criterion_not_met"
        | "implementation_defect"
        | "verification_defect"
        | "security_or_authority_defect",
      criterionNumber: finding.criterionNumber as number,
      message: finding.message as string,
      messageSha256: createHash("sha256")
        .update("crdd-review-finding-message-v1\0")
        .update(finding.message as string, "utf8")
        .digest("hex"),
    });
  });
  if (findings.some((finding) => finding === null))
    return rejected("provider_task_reviewer_finding_invalid");
  if (value.decision === "approved" && findings.length > 0)
    return rejected("provider_task_reviewer_decision_inconsistent");
  if (value.decision === "changes_requested" && findings.length === 0)
    return rejected("provider_task_reviewer_decision_inconsistent");
  return Object.freeze({
    reviewFindings: Object.freeze([...(findings as TaskReviewFinding[])]),
    normalizedResult: Object.freeze({
      decision: value.decision as "approved" | "changes_requested",
      findingCount: findings.length,
      findingDiagnostics: Object.freeze(
        (findings as NonNullable<(typeof findings)[number]>[]).map(
          ({ severity, path, category, criterionNumber, messageSha256 }) =>
            Object.freeze({
              severity,
              path,
              category,
              criterionNumber,
              messageSha256,
            }),
        ),
      ),
    }),
    reason: null,
  });
}

/**
 * 解析済みTask内容を役割別の正規値へ検査する。
 * @responsibility 編集内容・レビュー所見の閉形式と上限を所有する。
 * @trace ARCH-000015
 * @input value: Envelope解析済み値、role: executor又はreviewer。
 * @returns 検査済み内容と内部所見、又は内容なしの固定理由。
 * @precondition Envelopeの妥当性はAI Adapterが別途検査する。
 * @postcondition 生Envelopeや実行許可を生成しない。
 * @effect N/A: 値検査と非秘密Hash計算のみ。
 * @failure 不正field・Path・件数・decision相関は拒否する。
 * @invariant 所見本文は内部搬送用で、通常内容にはHash投影だけを返す。
 * @boundary DomainのTask内容と単段実行の接続。
 * @security getter・Proxyを評価せず、次試行Capabilityを発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectTaskResultContent(
  value: unknown,
  role: "executor" | "reviewer",
) {
  if (role !== "executor" && role !== "reviewer")
    return rejected("provider_task_result_input_invalid");
  if (!isRecord(value))
    return rejected(
      role === "executor"
        ? "provider_task_executor_shape_invalid"
        : "provider_task_reviewer_shape_invalid",
    );
  const record = snapshotPlainRecord(
    value,
    new Set(
      role === "executor"
        ? ["status", "summary", "changedPaths", "verification"]
        : ["decision", "summary", "findings"],
    ),
  );
  if (!record)
    return rejected(
      role === "executor"
        ? "provider_task_executor_shape_invalid"
        : "provider_task_reviewer_keys_invalid",
    );
  return role === "executor" ? executorResult(record) : reviewerResult(record);
}
