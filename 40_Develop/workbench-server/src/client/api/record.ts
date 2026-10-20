/**
 * Topic／Meetingの送信内容と非秘密結果を表示前に照合する。
 * @responsibility 既存Domain結果をBrowserの明示操作へ結合する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 同Originの要求・結果。認可と保存はServer Ownerが担当する。
 * @security 資格・物理Root・本文を結果へ追加しない。
 */
import type { WorkbenchTopicMeetingResultView } from "../../shared/view/types.ts";

/**
 * 削除済みDetailから一覧への一回遷移をRouterへ渡す。
 * @responsibility 非秘密の確定結果だけを同じRepositoryの一覧へ引き継ぐ。
 * @trace ARCH-000012
 * @shape 目的URL・Repository ID・検査済み結果から遷移完了を返すcallback。
 * @invariant 作業Modelや資格をHistoryへ保存しない。
 * @boundary Record操作の完了とRouter取得の所有権移譲。
 * @security callbackは認可・保存操作を発行しない。
 * @compatibility Package内部の画面接続だけで使う。
 */
export type ReplaceDeletedRecord = (
  target: URL,
  repositoryId: string | null,
  result: WorkbenchTopicMeetingResultView,
) => Promise<void>;

/**
 * 既存Formの未選択booleanを一件の明示値へ変換する。
 * @responsibility checkbox未選択を欠測や暗黙確認にしない。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 送信対象FormData、現在Repository IDとAction Token。
 * @returns 同じ操作の閉じたForm搬送値。
 * @precondition 既存Formの明示submitから呼ばれる。
 * @postcondition 別Repository・Token・重複値を拒否し、確認をtrueへ補完しない。
 * @effect N/A: メモリ内変換のみ。
 * @failure File、重複field、相関差は固定例外。
 * @invariant Serverの認可・Domain入力検査を代替しない。
 * @boundary Browser Formと同Origin POST。
 * @security 接続資格を本文へ含めない。
 * @concurrency N/A: 一回の同期変換。
 */
export function createTopicMeetingActionBody(
  data: FormData,
  repositoryId: string,
  actionToken: string,
): URLSearchParams {
  const form = new URLSearchParams();
  for (const [key, value] of data) {
    if (typeof value !== "string" || form.has(key))
      throw new Error("workbench_record_form_invalid");
    form.append(key, value);
  }
  if (
    form.get("repositoryId") !== repositoryId ||
    form.get("actionToken") !== actionToken
  )
    throw new Error("workbench_record_form_invalid");
  const operation = form.get("operation");
  const boolean =
    operation === "treat-outcome"
      ? "closeMeeting"
      : operation === "delete"
        ? "confirmed"
        : null;
  if (boolean !== null) {
    if (!form.has(boolean)) form.set(boolean, "false");
    else if (!["true", "false"].includes(form.get(boolean) ?? ""))
      throw new Error("workbench_record_form_invalid");
  }
  return form;
}

/**
 * 送信操作と専用POST結果の五fieldを照合する。
 * @responsibility 別種別・別操作・矛盾したEffect・余剰情報を成功表示しない。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 送信済みFormと未知JSON。
 * @returns 検査済みの要求専用表示結果。
 * @precondition 同じ要求のHTTP成功をCallerが確認済み。
 * @postcondition 未確認を未保存へ丸めず、正規completed／blockedだけを返す。
 * @effect N/A: 値照合のみ。
 * @failure 外形・理由・種別・Effect相関の不正は固定例外。
 * @invariant 結果はRecord Identityを含まず、別要求の保存証明には使わない。
 * @boundary Domain結果のHTTP投影とBrowser通知。
 * @security Root・資格・本文等の余剰fieldを拒否する。
 * @concurrency 同じ送信Formと要求世代のCallerだけが採用する。
 */
export function inspectTopicMeetingActionResult(
  form: URLSearchParams,
  value: unknown,
): WorkbenchTopicMeetingResultView &
  Readonly<{ filesystemEffectCount: 0 | 1 }> {
  const invalid = "workbench_record_response_invalid";
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "filesystemEffectCount,reason,recordKind,relationPaths,status"
  )
    throw new Error(invalid);
  const result = value as Record<string, unknown>;
  const kind = form.get("kind"),
    operation = form.get("operation");
  if (
    !["topic", "meeting"].includes(kind ?? "") ||
    !form.get("repositoryId") ||
    !["create", "update", "delete", "promote-topic", "treat-outcome"].includes(
      operation ?? "",
    ) ||
    (operation === "promote-topic" && kind !== "topic") ||
    (operation === "treat-outcome" && kind !== "meeting") ||
    (result.recordKind !== null && result.recordKind !== kind) ||
    !Array.isArray(result.relationPaths) ||
    !result.relationPaths.every((path) => typeof path === "string")
  )
    throw new Error(invalid);
  const success =
    operation === "create"
      ? "record_created"
      : operation === "update"
        ? "record_updated"
        : operation === "delete"
          ? "record_deleted"
          : operation === "promote-topic"
            ? "topic_promoted"
            : "meeting_outcome_treated";
  if (result.status === "completed") {
    if (
      result.reason !== success ||
      result.filesystemEffectCount !== 1 ||
      result.recordKind !== kind ||
      (operation === "delete" && form.get("confirmed") !== "true")
    )
      throw new Error(invalid);
  } else if (result.status === "blocked") {
    const reasons =
      operation === "create"
        ? ["record_already_exists", "record_revision_conflict"]
        : operation === "update"
          ? [
              "record_not_found",
              "record_revision_conflict",
              "record_identity_changed",
            ]
          : operation === "delete"
            ? [
                "record_not_found",
                "record_revision_conflict",
                "record_delete_confirmation_required",
                "record_delete_reason_invalid",
                "record_relations_require_resolution",
              ]
            : operation === "promote-topic"
              ? [
                  "record_not_found",
                  "record_revision_conflict",
                  "topic_promotion_target_not_found",
                  "topic_promotion_invalid",
                ]
              : [
                  "record_not_found",
                  "record_revision_conflict",
                  "meeting_outcome_target_invalid",
                  "meeting_outcome_target_not_found",
                  "meeting_outcome_target_project_mismatch",
                  "meeting_outcome_invalid",
                ];
    if (
      result.filesystemEffectCount !== 0 ||
      !reasons.includes(String(result.reason))
    )
      throw new Error(invalid);
  } else throw new Error(invalid);
  if (
    operation !== "delete" ||
    result.reason !== "record_relations_require_resolution"
  ) {
    if (result.relationPaths.length !== 0) throw new Error(invalid);
  }
  return value as WorkbenchTopicMeetingResultView &
    Readonly<{ filesystemEffectCount: 0 | 1 }>;
}
