/**
 * Topic／MeetingのHTTP操作入力を既存Domainへ変換する。
 * @responsibility 閉Form検査と要求専用の操作配送だけを所有する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary Workbench FormとDomain操作。
 * @security Root解決・認可・資格保持はHTTP Callerが所有する。
 */
import {
  parseTopicMarkdown,
  parseMeetingMarkdown,
  type TopicMeetingAccess,
  type ProjectOperationRecordKind,
  type TopicMeetingDocument,
  type TopicMeetingRelation,
  type TopicMeetingWriteResult,
  type MeetingOutcomeCommandResult,
  type TopicPromotionCommandResult,
} from "../../../../domain-model/src/index.ts";

/**
 * Topic／Meetingの保存・昇格・Outcome処置が返す既存結果。
 * @responsibility 操作結果と保存済みRelationを表示への縮小前に保持する。
 * @trace ARCH-000006
 * @shape 通常保存または昇格・Outcome処置の結果とrelationPaths。
 * @invariant 元のstatus・reason・recordを変更せず、表示結果を処置完了の代替にしない。
 * @boundary Domain操作結果とWorkbenchの要求・表示処理。
 * @security 資格・Root・保存Authorityを含めない。
 * @compatibility 既存Domain操作結果の合成型であり、新しい通信・保存Schemaではない。
 */
export type TopicMeetingActionResult =
  | TopicMeetingWriteResult
  | ((MeetingOutcomeCommandResult | TopicPromotionCommandResult) & {
      relationPaths: readonly string[];
    });

/**
 * Topic／Meeting本文とRelationを表示へ渡す同期Reader契約。
 * @responsibility 認可済みDomain操作の読取り形だけを共有する。
 * @trace ARCH-000006
 * @shape 種別とIDを受ける本文・Relationの二読取り。
 * @invariant 資格・Root・通信・保存を所有しない。
 * @boundary Domainの読取りとWorkbench表示。
 * @security Callerの現在認可済み操作だけを構成し、Rootや資格を公開しない。
 * @compatibility 現行Domain結果のみ。旧MCP搬送を含めない。
 */
export type WorkbenchTopicMeetingDocumentReader = Readonly<{
  getDocument(
    kind: ProjectOperationRecordKind,
    id: string,
  ): TopicMeetingDocument | null;
  relations(
    kind: ProjectOperationRecordKind,
    id: string,
  ): readonly TopicMeetingRelation[];
}>;

/**
 * 内容操作Formを操作別の閉集合として検査する。
 * @responsibility scalar重複と未知fieldを認可・配送前に拒否する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 搬送済みForm。
 * @returns N/A: 不正入力は固定例外。
 * @precondition Originと容量はHTTP入口で確認済み。
 * @postcondition createへIDや改訂を要求せず既存操作条件を保持する。
 * @effect N/A: 入力解析だけ。
 * @failure 契約外Formを拒否する。
 * @invariant 認可・保存・公開成立を生成しない。
 * @boundary HTTP Formと既存Domain操作。
 * @security 任意Root・Path・commandを受理しない。
 * @concurrency N/A: 同期検査。
 */
export function validateTopicMeetingActionForm(form: URLSearchParams): void {
  const kind = form.get("kind");
  const operation = form.get("operation");
  const specific =
    operation === "create"
      ? ["markdown"]
      : operation === "update"
        ? ["id", "expectedRevision", "markdown"]
        : operation === "delete"
          ? ["id", "expectedRevision", "confirmed"]
          : operation === "promote-topic" && kind === "topic"
            ? [
                "id",
                "expectedRevision",
                "changeId",
                "reason",
                "remainingResponsibility",
              ]
            : operation === "treat-outcome" && kind === "meeting"
              ? [
                  "id",
                  "expectedRevision",
                  "outcomeId",
                  "disposition",
                  "owner",
                  "reviewTrigger",
                  "targetKind",
                  "targetReference",
                  "treatment",
                  "completionCondition",
                  "result",
                  "closeMeeting",
                ]
              : null;
  const allowed = new Set([
    "kind",
    "operation",
    "repositoryId",
    "actionToken",
    ...(specific ?? []),
  ]);
  if (
    (kind !== "topic" && kind !== "meeting") ||
    specific === null ||
    [...allowed].some((key) => form.getAll(key).length !== 1) ||
    [...form.keys()].some(
      (key) => !allowed.has(key) || form.getAll(key).length !== 1,
    ) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
      form.get("repositoryId") ?? "",
    ) ||
    form.getAll("actionToken").length !== 1
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation === "delete" &&
    !["true", "false"].includes(form.get("confirmed") ?? "")
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation === "promote-topic" &&
    !/^CHG-\d{6}$/u.test(form.get("changeId") ?? "")
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation === "treat-outcome" &&
    (!/^OUT-\d{3,}$/u.test(form.get("outcomeId") ?? "") ||
      !["true", "false"].includes(form.get("closeMeeting") ?? "") ||
      !["completed", "transferred", "promoted", "rejected"].includes(
        form.get("disposition") ?? "",
      ) ||
      !["topic", "change", "owner", "none"].includes(
        form.get("targetKind") ?? "",
      ) ||
      (form.get("targetKind") === "topic" &&
        !/^TOPIC-\d{6}$/u.test(form.get("targetReference") ?? "")) ||
      (form.get("targetKind") === "change" &&
        !/^CHG-\d{6}$/u.test(form.get("targetReference") ?? "")))
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation !== "create" &&
    (!new RegExp(
      kind === "topic" ? "^TOPIC-\\d{6}$" : "^MTG-\\d{6}$",
      "u",
    ).test(form.get("id") ?? "") ||
      !/^[1-9]\d*$/u.test(form.get("expectedRevision") ?? "") ||
      !Number.isSafeInteger(Number(form.get("expectedRevision"))))
  )
    throw new Error("workbench_record_input_invalid");
  if (operation === "create" || operation === "update") {
    if (kind === "topic") parseTopicMarkdown(form.get("markdown") ?? "");
    else parseMeetingMarkdown(form.get("markdown") ?? "");
  }
}

/**
 * 検査済み操作を今回のDomain Ownerへ一回配送する。
 * @responsibility Transport入力だけを既存操作へ変換し結果意味を変更しない。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 今回認可済み操作と検査済みForm。
 * @returns 既存Domainの操作結果。
 * @precondition Form、AM集合、対象Identity、取消をCallerが確認済み。
 * @postcondition 別Rootへのfallbackや自動再送はない。
 * @effect 選択RepositoryのDomain操作一回。
 * @failure Owner例外はCallerへ伝播し未保存へ畳まない。
 * @invariant Domainの改訂・Relation・Close条件を再定義しない。
 * @boundary 要求専用Domain操作とHTTP Caller。
 * @security 資格をDomainへ渡さない。
 * @concurrency 同期Ownerの終了を待ち保存後取消でrollbackしない。
 */
export function executeTopicMeetingActionForm(
  access: TopicMeetingAccess,
  form: URLSearchParams,
) {
  const kind = form.get("kind") === "topic" ? "topic" : "meeting";
  const operation = form.get("operation");
  const id = form.get("id") ?? "";
  const expectedRevision = Number(form.get("expectedRevision"));
  if (operation === "create")
    return access[kind].create(form.get("markdown") ?? "");
  if (operation === "update")
    return access[kind].update({
      id,
      expectedRevision,
      markdown: form.get("markdown") ?? "",
    });
  if (operation === "delete")
    return access[kind].delete({
      id,
      expectedRevision,
      confirmed: form.get("confirmed") === "true",
      reason: "mistaken_registration",
    });
  if (operation === "promote-topic")
    return {
      ...access.topic.promoteTopic({
        topicId: id,
        expectedRevision,
        changeId: form.get("changeId") ?? "",
        reason: form.get("reason") ?? "",
        remainingResponsibility: form.get("remainingResponsibility") ?? "",
      }),
      relationPaths: [],
    };
  if (operation === "treat-outcome")
    return {
      ...access.meeting.treatMeetingOutcome({
        meetingId: id,
        expectedRevision,
        outcomeId: form.get("outcomeId") ?? "",
        disposition: form.get("disposition") as
          | "completed"
          | "transferred"
          | "promoted"
          | "rejected",
        owner: form.get("owner") ?? "",
        reviewTrigger: form.get("reviewTrigger") ?? "",
        target: {
          kind: form.get("targetKind") as "topic" | "change" | "owner" | "none",
          reference: form.get("targetReference") ?? "",
        },
        treatment: form.get("treatment") ?? "",
        completionCondition: form.get("completionCondition") ?? "",
        result: form.get("result") ?? "",
        closeMeeting: form.get("closeMeeting") === "true",
      }),
      relationPaths: [],
    };
  throw new Error("workbench_record_operation_invalid");
}
