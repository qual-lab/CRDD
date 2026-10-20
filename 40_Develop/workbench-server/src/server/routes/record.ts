/**
 * Topic・Meeting操作の単体・共有HTTP受付。
 * @packageDocumentation
 * @responsibility Recordの保存・昇格・Outcome処置と表示更新を既存Domainへ接続する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary WorkbenchのHTTP受付と既存専門Owner。
 * @effect 選択されたRecordの明示処置と既存投影再取得が発生し得る。
 * @security 要求前段の資格と現在認可を使用し、新しい保存状態・再送・回復処理を追加しない。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import {
  resolveRepositoryAccessCollection,
  sameAccessCollection,
} from "../../../../access-management/src/index.ts";
import {
  type FilesystemStoreRoot,
  type TopicMeetingAccess,
  parseTopicMarkdown,
  parseMeetingMarkdown,
} from "../../../../domain-model/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import { readWorkbenchProjectSurface } from "../project/surface.ts";
import { composeAuthorizedTopicMeeting } from "../topic-meeting/access-resolver.ts";
import {
  validateTopicMeetingActionForm,
  executeTopicMeetingActionForm,
} from "../topic-meeting/action.ts";
import { createTopicMeetingResultView } from "../presentation/record.ts";
import type { WorkbenchPresentationState } from "../presentation/types.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

/**
 * 当該要求のTopic・Meeting操作を実行する。
 * @responsibility 単体と共有の入力・Domain処置・投影更新・公開前照合を同じ順序で維持する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 当該HTTP要求、応答、Signal、検査済みURLとOrigin、既存Ownerと必要な表示状態。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、共有操作の現在認可は本処理で確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存Domainの保存・削除・昇格・Outcome処置と表示再取得を行う。
 * @failure 共有は配送前400／配送後503、単体は処置前400／処置後500を維持する。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleRecordAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
  localAccessRoot,
  repositoryRoot,
  topicMeeting,
  presentation,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
  localAccessRoot: FilesystemStoreRoot | undefined;
  repositoryRoot: string;
  topicMeeting: TopicMeetingAccess | undefined;
  presentation: Pick<
    WorkbenchPresentationState,
    "projectSurface" | "topicMeetingResult"
  >;
}>): Promise<void> {
  if (localAccessRoot !== undefined) {
    let dispatched = false;
    try {
      if (
        !origin ||
        requestUrl.search !== "" ||
        incoming.headers.host !== new URL(origin).host ||
        incoming.headers.origin !== origin ||
        incoming.headers["content-type"]?.split(";")[0]?.trim() !==
          "application/x-www-form-urlencoded"
      )
        throw new Error("workbench_record_input_invalid");
      const form = await readActionForm(incoming);
      validateTopicMeetingActionForm(form);
      if (form.get("actionToken") !== actionToken || !credentialAdministration)
        throw new Error("workbench_record_input_invalid");
      await yieldToTransport(0);
      if (requestSignal.aborted || response.destroyed) return;
      const collection = resolveRepositoryAccessCollection(
        credentialAdministration.root,
        credentialAdministration.token,
      );
      if (collection.status !== "completed")
        throw new Error("workbench_record_access_unavailable");
      const access = composeAuthorizedTopicMeeting(
        collection.repositories,
        form.get("repositoryId") ?? "",
        requestSignal,
      );
      if (!access || requestSignal.aborted)
        throw new Error("workbench_record_access_unavailable");
      dispatched = true;
      const result = executeTopicMeetingActionForm(access, form);
      const body = JSON.stringify({
        ...createTopicMeetingResultView(result),
        filesystemEffectCount: result.filesystemEffectCount,
      });
      await yieldToTransport(0);
      if (requestSignal.aborted || response.destroyed) return;
      if (
        !sameAccessCollection(
          collection,
          resolveRepositoryAccessCollection(
            credentialAdministration.root,
            credentialAdministration.token,
          ),
        )
      )
        throw new Error("workbench_record_publication_unavailable");
      setResponseHeaders(response);
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Content-Length", Buffer.byteLength(body));
      response.end(body);
    } catch {
      if (!requestSignal.aborted && !response.destroyed) {
        setResponseHeaders(response);
        response.statusCode = dispatched ? 503 : 400;
        response.end(
          dispatched
            ? "topic_meeting_action_outcome_unconfirmed\n"
            : "topic_meeting_action_rejected\n",
        );
      }
    }
    return;
  }
  let actionDispatched = false;
  try {
    if (presentation.projectSurface === undefined || topicMeeting === undefined)
      throw new Error("workbench_repository_access_unavailable");
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    const kind = form.get("kind");
    const operation = form.get("operation");
    if (kind !== "topic" && kind !== "meeting")
      throw new Error("workbench_record_kind_invalid");
    if (
      !["create", "update", "delete"].includes(operation ?? "") &&
      !(operation === "promote-topic" && kind === "topic") &&
      !(operation === "treat-outcome" && kind === "meeting")
    )
      throw new Error("workbench_record_operation_invalid");
    if (operation !== "create") {
      const revision = Number(form.get("expectedRevision"));
      if (
        !new RegExp(
          kind === "topic" ? "^TOPIC-\\d{6}$" : "^MTG-\\d{6}$",
          "u",
        ).test(form.get("id") ?? "") ||
        !Number.isSafeInteger(revision) ||
        revision < 1
      )
        throw new Error("workbench_record_input_invalid");
    }
    if (
      (operation === "promote-topic" &&
        !/^CHG-\d{6}$/u.test(form.get("changeId") ?? "")) ||
      (operation === "treat-outcome" &&
        ((form.get("targetKind") === "topic" &&
          !/^TOPIC-\d{6}$/u.test(form.get("targetReference") ?? "")) ||
          (form.get("targetKind") === "change" &&
            !/^CHG-\d{6}$/u.test(form.get("targetReference") ?? ""))))
    )
      throw new Error("workbench_record_reference_invalid");
    if (operation === "create" || operation === "update") {
      if (kind === "topic") parseTopicMarkdown(form.get("markdown") ?? "");
      else parseMeetingMarkdown(form.get("markdown") ?? "");
    }
    if (operation === "create") {
      actionDispatched = true;
      presentation.topicMeetingResult = topicMeeting[kind].create(
        form.get("markdown") ?? "",
      );
    } else if (operation === "update") {
      actionDispatched = true;
      presentation.topicMeetingResult = topicMeeting[kind].update({
        id: form.get("id") ?? "",
        expectedRevision: Number(form.get("expectedRevision")),
        markdown: form.get("markdown") ?? "",
      });
    } else if (operation === "delete") {
      actionDispatched = true;
      presentation.topicMeetingResult = topicMeeting[kind].delete({
        id: form.get("id") ?? "",
        expectedRevision: Number(form.get("expectedRevision")),
        confirmed: form.get("confirmed") === "true",
        reason: "mistaken_registration",
      });
    } else if (operation === "treat-outcome" && kind === "meeting") {
      actionDispatched = true;
      const outcome = topicMeeting.meeting.treatMeetingOutcome({
        meetingId: form.get("id") ?? "",
        expectedRevision: Number(form.get("expectedRevision")),
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
      });
      presentation.topicMeetingResult = Object.freeze({
        ...outcome,
        relationPaths: Object.freeze([]),
      });
    } else if (operation === "promote-topic" && kind === "topic") {
      actionDispatched = true;
      const promotion = topicMeeting.topic.promoteTopic({
        topicId: form.get("id") ?? "",
        expectedRevision: Number(form.get("expectedRevision")),
        changeId: form.get("changeId") ?? "",
        reason: form.get("reason") ?? "",
        remainingResponsibility: form.get("remainingResponsibility") ?? "",
      });
      presentation.topicMeetingResult = Object.freeze({
        ...promotion,
        relationPaths: Object.freeze([]),
      });
    } else {
      throw new Error("workbench_record_operation_invalid");
    }
    presentation.projectSurface =
      await readWorkbenchProjectSurface(repositoryRoot);
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader(
      "Location",
      `/${kind === "topic" ? "#topics" : "#meetings"}`,
    );
    response.end();
  } catch {
    setResponseHeaders(response);
    response.statusCode = actionDispatched ? 500 : 400;
    response.end(
      actionDispatched
        ? "topic_meeting_action_failed\n"
        : "topic_meeting_action_rejected\n",
    );
  }
  return;
}
