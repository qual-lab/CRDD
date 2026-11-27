/**
 * Topic／Meetingの送信内容と非秘密結果を表示前に照合する。
 * @responsibility 既存Domain結果をBrowserの明示操作へ結合する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 同Originの要求・結果。認可と保存はServer Ownerが担当する。
 * @security 資格・物理Root・本文を結果へ追加しない。
 */
import type { RecordActionView } from "./response.ts";
import { RESOURCE_ID, workbenchRequest } from "./path.ts";

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
  result: RecordActionView,
) => Promise<void>;

/**
 * 既存Formの未選択booleanを一件の明示値へ変換する。
 * @responsibility checkbox未選択を欠測や暗黙確認にしない。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 送信対象FormDataと現在Repository ID。
 * @returns 同じ操作の閉じたForm搬送値。
 * @precondition 既存Formの明示submitから呼ばれる。
 * @postcondition 別Repositoryと重複値を拒否し、確認をtrueへ補完しない。
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
): URLSearchParams {
  const form = new URLSearchParams();
  for (const [key, value] of data) {
    if (typeof value !== "string" || form.has(key))
      throw new Error("workbench_record_form_invalid");
    form.append(key, value);
  }
  if (form.get("repositoryId") !== repositoryId)
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

/** 画面から送る記録操作一件と、対応する成功ステータス。 @trace ARCH-000012 */
export interface RecordSubmission {
  readonly path: string;
  readonly method: "POST" | "PATCH" | "PUT" | "DELETE";
  readonly body: Readonly<Record<string, string | number | boolean | null>>;
  readonly success: 200 | 201;
}

/** 画面フォームを、リソースとHTTPメソッドが決まった一件のJSON要求にする。 @trace ARCH-000012 */
export function createRecordRequest(form: URLSearchParams): RecordSubmission {
  const invalid = "workbench_record_form_invalid";
  const repositoryId = form.get("repositoryId") ?? "";
  const kind = form.get("kind");
  const operation = form.get("operation");
  const id = form.get("id") ?? "";
  if (
    !RESOURCE_ID.test(repositoryId) ||
    (kind !== "topic" && kind !== "meeting")
  )
    throw new Error(invalid);
  if (operation === "create") {
    const markdown = form.get("markdown");
    if (markdown === null || form.has("id") || form.has("expectedRevision"))
      throw new Error(invalid);
    return {
      ...workbenchRequest(
        [
          "POST",
          kind === "topic"
            ? "/api/repositories/:repositoryId/topics"
            : "/api/repositories/:repositoryId/meetings",
        ],
        { repositoryId },
      ),
      body: { markdown },
      success: 201,
    } as const;
  }
  if (!(kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u).test(id))
    throw new Error(invalid);
  const revision = form.get("expectedRevision") ?? "";
  const expectedRevision = Number(revision);
  if (!/^[1-9]\d*$/u.test(revision) || !Number.isSafeInteger(expectedRevision))
    throw new Error(invalid);
  const item =
    kind === "topic"
      ? "/api/repositories/:repositoryId/topics/:topicId"
      : "/api/repositories/:repositoryId/meetings/:meetingId";
  const parameters = { repositoryId, topicId: id, meetingId: id };
  if (operation === "update" && form.has("markdown"))
    return {
      ...workbenchRequest(["PATCH", item], parameters),
      body: { expectedRevision, markdown: form.get("markdown") },
      success: 200,
    } as const;
  if (operation === "delete")
    return {
      ...workbenchRequest(["DELETE", item], parameters),
      body: {
        expectedRevision,
        confirmed: form.get("confirmed") === "true",
        reason: "mistaken_registration",
      },
      success: 200,
    } as const;
  if (operation === "promote-topic" && kind === "topic") {
    const changeId = form.get("changeId") ?? "";
    if (!/^CHG-\d{6}$/u.test(changeId)) throw new Error(invalid);
    return {
      ...workbenchRequest(
        ["POST", "/api/repositories/:repositoryId/topics/:topicId/promotion"],
        { repositoryId, topicId: id },
      ),
      body: {
        expectedRevision,
        changeId,
        reason: form.get("reason"),
        remainingResponsibility: form.get("remainingResponsibility"),
      },
      success: 200,
    } as const;
  }
  if (operation === "treat-outcome" && kind === "meeting") {
    const outcomeId = form.get("outcomeId") ?? "";
    if (!/^OUT-\d{3,}$/u.test(outcomeId)) throw new Error(invalid);
    const fields = [
      "disposition",
      "owner",
      "reviewTrigger",
      "targetKind",
      "targetReference",
      "treatment",
      "completionCondition",
      "result",
    ];
    return {
      ...workbenchRequest(
        [
          "PUT",
          "/api/repositories/:repositoryId/meetings/:meetingId/outcomes/:outcomeId/treatment",
        ],
        { repositoryId, meetingId: id, outcomeId },
      ),
      body: {
        expectedRevision,
        ...Object.fromEntries(fields.map((field) => [field, form.get(field)])),
        closeMeeting: form.get("closeMeeting") === "true",
      },
      success: 200,
    } as const;
  }
  throw new Error(invalid);
}

/** RESTの正式結果を照合し、画面に必要な項目だけへ投影する。 @trace ARCH-000012 */
export function inspectRecordResponse(
  form: URLSearchParams,
  value: unknown,
  status: number,
  success: number,
) {
  const invalid = "workbench_record_response_invalid";
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(invalid);
  const result = value as Record<string, unknown>;
  const operation = form.get("operation");
  const type = form.get("kind");
  const hasRelations =
    operation !== "promote-topic" && operation !== "treat-outcome";
  const expectedFields = hasRelations
    ? "filesystemEffectCount,reason,record,relationPaths,status"
    : "filesystemEffectCount,reason,record,status";
  if (
    Object.keys(result).sort().join(",") !== expectedFields ||
    (result.status === "completed" ? status !== success : status !== 409)
  )
    throw new Error(invalid);
  let recordKind: "topic" | "meeting" | null = null;
  if (result.record !== null) {
    if (
      !result.record ||
      typeof result.record !== "object" ||
      Array.isArray(result.record)
    )
      throw new Error(invalid);
    const record = result.record as Record<string, unknown>;
    if (type !== "topic" && type !== "meeting") throw new Error(invalid);
    const id = record[`${type}Id`];
    if (
      typeof id !== "string" ||
      !(type === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u).test(id) ||
      Object.hasOwn(record, type === "topic" ? "meetingId" : "topicId") ||
      (operation !== "create" && id !== form.get("id"))
    )
      throw new Error(invalid);
    recordKind = type;
  }
  return inspectTopicMeetingActionResult(form, {
    status: result.status,
    reason: result.reason,
    recordKind,
    relationPaths: hasRelations ? result.relationPaths : [],
    filesystemEffectCount: result.filesystemEffectCount,
  });
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
): RecordActionView & Readonly<{ filesystemEffectCount: 0 | 1 }> {
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
  return value as RecordActionView & Readonly<{ filesystemEffectCount: 0 | 1 }>;
}
