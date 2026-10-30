/**
 * AI依頼のHTTP受付。
 * @packageDocumentation
 * @responsibility 単体と共有の既存AI Ownerへ要求を渡し、認可・表示・結果搬送を維持する。
 * @trace ARCH-000015
 * @trace ARCH-000012
 * @boundary WorkbenchのHTTP受付と既存専門Owner。
 * @effect 明示されたAI依頼・観測・取消を既存Ownerへ委譲する。
 * @security 要求前段の資格と現在認可を使用し、新しい保存状態・再送・回復処理を追加しない。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { inspectAiSelectionChoice } from "../../../../domain-model/src/index.ts";
import { parseUnambiguousJsonDocument } from "../../../../domain-model/src/index.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchAiRequests,
} from "../ai-request/types.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import type { WorkbenchPresentationState } from "../presentation/types.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

/**
 * 共有接続のAI依頼・観測・取消を処理する。
 * @responsibility 現在認可した資格とRepositoryへ結合した既存Sessionへ一回だけ配送する。
 * @trace ARCH-000015
 * @trace ARCH-000012
 * @input 当該HTTP要求・応答、URL・Origin・Action Token、当該資格、既存Session解決関数。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、既存Sessionの解決で共有操作の現在認可を確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存AI Ownerへ明示操作を渡し、既存Sessionの表示IDを更新する。
 * @failure 配送前400／配送後503を維持し、結果不明を再送しない。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleSharedAiRequest({
  incoming,
  response,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
  sharedAiSession,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
  sharedAiSession: (
    connection: CredentialAdministration | undefined,
    repositoryId: string,
    create: boolean,
  ) => { owner: WorkbenchAiRequests; currentId: string | null } | null;
}>): Promise<void> {
  let dispatched = false;
  try {
    if (
      !origin ||
      incoming.headers.origin !== origin ||
      incoming.headers.host !== new URL(origin).host ||
      requestUrl.search !== ""
    )
      throw new Error("workbench_ai_request_input_invalid");
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken || !credentialAdministration)
      throw new Error("workbench_ai_request_access_unavailable");
    const operation = form.get("operation");
    const repositoryId = form.get("repositoryId") ?? "";
    const session = sharedAiSession(
      credentialAdministration,
      repositoryId,
      operation === "start" ||
        operation === "observe" ||
        operation === "cancel",
    );
    if (!session) throw new Error("workbench_ai_request_access_unavailable");
    let result:
      | Awaited<ReturnType<WorkbenchAiRequests["start"]>>
      | WorkbenchAiRequestSnapshot;
    if (operation === "start") {
      if (form.has("profileId"))
        throw new Error("workbench_ai_request_input_invalid");
      const mode = form.get("mode");
      const explicit = form.get("choice");
      const choice = explicit
        ? inspectAiSelectionChoice(parseUnambiguousJsonDocument(explicit))
        : null;
      if (explicit && !choice)
        throw new Error("workbench_ai_request_choice_invalid");
      if (!/^[a-f0-9]{64}$/u.test(form.get("expectedNetworkPolicyHash") ?? ""))
        throw new Error("workbench_ai_network_policy_confirmation_required");
      if (mode !== "read_only_advice" && mode !== "workspace_edit")
        throw new Error("workbench_ai_request_mode_invalid");
      dispatched = true;
      result = await session.owner.start({
        mode,
        workType: form.get("workType")?.trim() || null,
        ...(choice ? { choice } : {}),
        prompt: form.get("prompt") ?? "",
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: (form.get("allowedPaths") ?? "")
          .split(/\r?\n/u)
          .map((p) => p.trim())
          .filter(Boolean),
        externalSendConfirmed: form.get("externalSendConfirmed") === "yes",
        expectedNetworkPolicyHash: String(
          form.get("expectedNetworkPolicyHash") ?? "",
        ),
        workspaceId: form.get("workspaceId")?.trim() || null,
      });
      if (result.status === "accepted") session.currentId = result.requestId;
    } else if (operation === "cancel" || operation === "observe") {
      const requestId = form.get("requestId") ?? "";
      const previous = await session.owner.observe(requestId);
      if (
        previous.mode === null ||
        previous.reason === "orchestrator_task_not_available"
      )
        throw new Error("workbench_ai_request_identity_invalid");
      dispatched = true;
      result =
        operation === "cancel"
          ? await session.owner.cancel(requestId)
          : previous;
      if (session.currentId === null) session.currentId = requestId;
    } else throw new Error("workbench_ai_request_operation_invalid");
    if (!sharedAiSession(credentialAdministration, repositoryId, false))
      throw new Error("workbench_ai_request_access_unavailable");
    setResponseHeaders(response);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(result));
  } catch {
    setResponseHeaders(response);
    response.statusCode = dispatched ? 503 : 400;
    response.end(
      dispatched ? "ai_request_outcome_unconfirmed\n" : "ai_request_rejected\n",
    );
  }
  return;
}

/**
 * 単体接続のAI依頼・観測・取消を処理する。
 * @responsibility 既存入力検査と依頼ID照合、単体表示の更新順を維持する。
 * @trace ARCH-000015
 * @trace ARCH-000012
 * @input 当該HTTP要求・応答、Action Token、単体AI Ownerと単体表示状態。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みである。単体依頼の入力とOwner照合は本処理が行う。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存AI Ownerへ明示操作を一回渡し、非永続の表示値を更新する。
 * @failure 既存400固定拒否を維持し、Owner例外からrollbackを推定しない。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleAiRequestAction({
  incoming,
  response,
  actionToken,
  aiRequests,
  presentation,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  actionToken: string;
  aiRequests: WorkbenchAiRequests | undefined;
  presentation: Pick<
    WorkbenchPresentationState,
    "currentAiRequestId" | "aiRequestSnapshot" | "aiRequestNotice"
  >;
}>): Promise<void> {
  try {
    if (aiRequests === undefined)
      throw new Error("workbench_ai_request_application_unavailable");
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    const operation = form.get("operation");
    if (operation === "start") {
      if (form.has("profileId"))
        throw new Error("workbench_ai_request_input_invalid");
      const mode = form.get("mode");
      const explicit = form.get("choice");
      const choice = explicit
        ? inspectAiSelectionChoice(parseUnambiguousJsonDocument(explicit))
        : null;
      if (explicit && !choice)
        throw new Error("workbench_ai_request_choice_invalid");
      const workType = form.get("workType")?.trim() || null;
      const prompt = (form.get("prompt") ?? "").trim();
      const allowedPaths = (form.get("allowedPaths") ?? "")
        .split(/\r?\n/u)
        .map((value) => value.trim().replaceAll("\\", "/"))
        .filter((value) => value.length > 0);
      const externalSendConfirmed = form.get("externalSendConfirmed") === "yes";
      if (!/^[a-f0-9]{64}$/u.test(form.get("expectedNetworkPolicyHash") ?? ""))
        throw new Error("workbench_ai_network_policy_confirmation_required");
      if (mode !== "read_only_advice" && mode !== "workspace_edit")
        throw new Error("workbench_ai_request_mode_invalid");
      if (prompt.length === 0 || prompt.length > 16_000)
        throw new Error("workbench_ai_request_prompt_invalid");
      if (
        allowedPaths.length > 64 ||
        new Set(allowedPaths).size !== allowedPaths.length ||
        allowedPaths.some(
          (value) =>
            value.length > 512 ||
            value.startsWith("/") ||
            /^[A-Za-z]:/u.test(value) ||
            value.split("/").includes(".."),
        ) ||
        (mode === "read_only_advice" && allowedPaths.length !== 0) ||
        (mode === "workspace_edit" && allowedPaths.length === 0)
      )
        throw new Error("workbench_ai_request_allowed_paths_invalid");
      if (!externalSendConfirmed)
        throw new Error("workbench_ai_external_send_confirmation_required");
      const result = await aiRequests.start(
        Object.freeze({
          mode,
          workType,
          ...(choice ? { choice } : {}),
          prompt,
          contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
          allowedPaths: Object.freeze(allowedPaths),
          externalSendConfirmed,
          expectedNetworkPolicyHash: String(
            form.get("expectedNetworkPolicyHash") ?? "",
          ),
          workspaceId: form.get("workspaceId")?.trim() || null,
        }),
      );
      if (result.status === "accepted" && result.requestId !== null) {
        presentation.currentAiRequestId = result.requestId;
        presentation.aiRequestSnapshot = Object.freeze({
          requestId: result.requestId,
          mode,
          executionSelection: null,
          status: "accepted",
          reason: result.reason,
          facts: Object.freeze([]),
          sharedAnalysis: Object.freeze([]),
          additionalInferences: Object.freeze([]),
          nextOptions: Object.freeze([]),
          candidate: null,
        });
        presentation.aiRequestNotice = "AI依頼を受け付けました。";
      } else {
        presentation.aiRequestNotice = `AI依頼を開始できませんでした: ${result.reason ?? "blocked"}`;
      }
    } else if (operation === "cancel" || operation === "observe") {
      const requestId = form.get("requestId") ?? "";
      const previous = await aiRequests.observe(requestId);
      if (
        previous.mode === null ||
        previous.reason === "orchestrator_task_not_available"
      )
        throw new Error("workbench_ai_request_identity_invalid");
      presentation.aiRequestSnapshot =
        operation === "cancel" ? await aiRequests.cancel(requestId) : previous;
      if (presentation.currentAiRequestId === null)
        presentation.currentAiRequestId = requestId;
      presentation.aiRequestNotice =
        operation === "cancel"
          ? "取消結果を取得しました。"
          : "保存済み依頼を確認しました。";
    } else {
      throw new Error("workbench_ai_request_operation_invalid");
    }
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader("Location", "/#ai-request");
    response.end();
  } catch {
    setResponseHeaders(response);
    response.statusCode = 400;
    response.end("ai_request_action_rejected\n");
  }
  return;
}
