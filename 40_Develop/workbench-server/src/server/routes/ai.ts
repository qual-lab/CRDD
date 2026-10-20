/**
 * AI依頼・Profile管理のHTTP受付。
 * @packageDocumentation
 * @responsibility 単体と共有の既存AI Owner・Profile Ownerへ要求を渡し、認可・表示・結果搬送を維持する。
 * @trace ARCH-000015
 * @trace ARCH-000012
 * @boundary WorkbenchのHTTP受付と既存専門Owner。
 * @effect 明示されたAI依頼・観測・取消・Profile保存を既存Ownerへ委譲する。
 * @security 要求前段の資格と現在認可を使用し、新しい保存状態・再送・回復処理を追加しない。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import { evaluateAiProfileManagementPermission } from "../../../../access-management/src/index.ts";
import {
  type AiModelTier,
  type AiProfileCatalogAdministration,
  type AiProfileCatalogMutation,
  type AiProfileCatalogSnapshot,
  type AiProfileDefinition,
  type AiReasoningEffort,
  type AiSelectionRole,
  validateAiProfileCatalog,
  validateAiProfileMutationResult,
} from "../../../../ai-adapter/src/index.ts";
import type { FilesystemStoreRoot } from "../../../../domain-model/src/index.ts";
import { createWorkbenchAiProfileSurface } from "../ai-profile/projection.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchAiRequests,
} from "../ai-request/types.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import type { WorkbenchPresentationState } from "../presentation/types.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

/**
 * Browser FormをAI Profile限定Mutationへ変換する。
 *
 * @responsibility 固定Role、Tier、Reasoningと登録済みAdapter／Modelだけを管理Commandへ採用する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input form: 上限確認済みForm、snapshot: 操作対象Ownerの現在Catalog Snapshot。
 * @returns 作成、更新または確認付き削除のMutation。
 * @precondition CSRF相当Tokenは呼出し側で照合済みである。
 * @postcondition 作成・更新Profileは現在CatalogのAdapter／Model組だけを参照する。
 * @effect N/A: Form値の検証と構造化だけを行う。
 * @failure 未知操作、未登録値、空のRole／Tierまたは不正RevisionをErrorで拒否する。
 * @invariant FormからAdapter、Credential、Pathまたは任意実行引数を生成しない。
 * @boundary Workbench Browser FormとAI Profile管理Applicationの境界。
 * @security 未定義fieldをCandidateへ含めず、秘密値を扱わない。
 * @concurrency 表示時のexpectedRevisionをMutationへ保持する。
 */
function createAiProfileMutation(
  form: URLSearchParams,
  snapshot: AiProfileCatalogSnapshot,
): AiProfileCatalogMutation {
  const operation = form.get("operation");
  const allowed = new Set(
    operation === "delete"
      ? [
          "actionToken",
          "operation",
          "expectedRevision",
          "profileId",
          "confirmed",
        ]
      : [
          "actionToken",
          "operation",
          "expectedRevision",
          "profileId",
          "adapterModel",
          "family",
          "selectionRole",
          "modelTier",
          "defaultReasoningEffort",
          "compatibilityReason",
        ],
  );
  for (const key of form.keys())
    if (
      !allowed.has(key) ||
      (key !== "selectionRole" &&
        key !== "modelTier" &&
        form.getAll(key).length !== 1)
    )
      throw new Error("workbench_ai_profile_field_invalid");
  if (
    form.getAll("operation").length !== 1 ||
    form.getAll("expectedRevision").length !== 1 ||
    !/^(0|[1-9][0-9]*)$/u.test(form.get("expectedRevision") ?? "")
  )
    throw new Error("workbench_ai_profile_revision_invalid");
  const expectedRevision = Number(form.get("expectedRevision"));
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error("workbench_ai_profile_revision_invalid");
  const profileId = form.get("profileId") ?? "";
  if (operation === "delete")
    return Object.freeze({
      operation,
      expectedRevision,
      profileId,
      confirmed: form.get("confirmed") === "true",
    });
  if (operation !== "create" && operation !== "update")
    throw new Error("workbench_ai_profile_operation_invalid");

  const adapterModel = form.get("adapterModel")?.split("|") ?? [];
  if (adapterModel.length !== 2)
    throw new Error("workbench_ai_profile_adapter_model_invalid");
  const adapterId = adapterModel[0];
  const exactModelId = adapterModel[1];
  if (adapterId === undefined || exactModelId === undefined)
    throw new Error("workbench_ai_profile_adapter_model_invalid");
  const adapter = snapshot.catalog.adapters.find(
    (candidate) => candidate.adapterId === adapterId,
  );
  if (adapter === undefined || !adapter.allowedModelIds.includes(exactModelId))
    throw new Error("workbench_ai_profile_adapter_model_invalid");
  const roleValues = form.getAll("selectionRole");
  const tierValues = form.getAll("modelTier");
  const allowedRoles = new Set<AiSelectionRole>([
    "coordinator",
    "executor",
    "independent_reviewer",
    "result_integration",
  ]);
  const allowedTiers = new Set<AiModelTier>(["preferred", "upper_allowed"]);
  const selectionRoles = roleValues.filter((value): value is AiSelectionRole =>
    allowedRoles.has(value as AiSelectionRole),
  );
  const modelTiers = tierValues.filter((value): value is AiModelTier =>
    allowedTiers.has(value as AiModelTier),
  );
  if (
    selectionRoles.length === 0 ||
    selectionRoles.length !== roleValues.length ||
    modelTiers.length === 0 ||
    modelTiers.length !== tierValues.length
  )
    throw new Error("workbench_ai_profile_scope_invalid");
  const effort = form.get("defaultReasoningEffort") ?? "";
  if (!adapter.allowedReasoningEfforts.includes(effort as AiReasoningEffort))
    throw new Error("workbench_ai_profile_reasoning_invalid");
  const compatibilityReason = (form.get("compatibilityReason") ?? "").trim();
  const profile: AiProfileDefinition = Object.freeze({
    profileId,
    adapterId,
    family: form.get("family") ?? "",
    exactModelId,
    selectionRoles: Object.freeze(selectionRoles),
    modelTiers: Object.freeze(modelTiers),
    speedMode: "normal",
    billingMode: "subscription_oauth",
    defaultReasoningEffort: effort as AiReasoningEffort,
    compatibilityReason:
      compatibilityReason.length === 0 ? null : compatibilityReason,
  });
  return Object.freeze({ operation, expectedRevision, profile });
}

/**
 * 当該要求のAI Profile保存を処理する。
 * @responsibility 単体表示更新と共有管理のfresh認可・公開前再確認を分ける。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @input 当該HTTP要求、応答、Signal、検査済みURLとOrigin、既存Ownerと必要な表示状態。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、共有操作の現在認可は本処理で確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存Catalog Ownerへ一回保存し、単体では直前結果の表示を更新する。
 * @failure 配送前400／配送後503と既存結果不明の文言を維持する。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleAiProfileAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
  localAccessRoot,
  crosProfileAdministration,
  aiProfileAdministration,
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
  crosProfileAdministration: AiProfileCatalogAdministration | undefined;
  aiProfileAdministration: AiProfileCatalogAdministration | undefined;
  presentation: Pick<
    WorkbenchPresentationState,
    "aiProfiles" | "aiProfileAdministrationResult"
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
        throw new Error("workbench_profile_input_invalid");
      const form = await readActionForm(incoming);
      if (
        form.getAll("actionToken").length !== 1 ||
        form.get("actionToken") !== actionToken
      )
        throw new Error("workbench_profile_input_invalid");
      await yieldToTransport(0);
      if (requestSignal.aborted || response.destroyed) return;
      if (
        !credentialAdministration ||
        !crosProfileAdministration ||
        evaluateAiProfileManagementPermission(
          credentialAdministration.root,
          credentialAdministration.token,
        ) !== "allowed"
      )
        throw new Error("workbench_profile_access_unavailable");
      const read = crosProfileAdministration.snapshot();
      if (read.status !== "read") throw new Error(read.error);
      const snapshot = read.value;
      const mutation = createAiProfileMutation(form, snapshot);
      dispatched = true;
      const raw = crosProfileAdministration.execute(mutation);
      const result = validateAiProfileMutationResult(mutation, raw).value;
      if (!result || result.status === "unknown")
        throw new Error("workbench_profile_result_invalid");
      const body = JSON.stringify(result);
      await yieldToTransport(0);
      if (requestSignal.aborted || response.destroyed) return;
      if (
        evaluateAiProfileManagementPermission(
          credentialAdministration.root,
          credentialAdministration.token,
        ) !== "allowed"
      )
        throw new Error("workbench_profile_access_unavailable");
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
            ? "ai_profile_action_outcome_unconfirmed\n"
            : "ai_profile_action_rejected\n",
        );
      }
    }
    return;
  }
  let profileDispatched = false;
  try {
    const administrationSnapshot = aiProfileAdministration?.snapshot().value;
    if (administrationSnapshot == null)
      throw new Error("workbench_ai_profile_administration_unavailable");
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    const mutation = createAiProfileMutation(form, administrationSnapshot);
    if (requestSignal.aborted) return;
    if (aiProfileAdministration === undefined)
      throw new Error("workbench_ai_profile_administration_unavailable");
    profileDispatched = true;
    const result = aiProfileAdministration.execute(mutation);
    if (result.status === "unknown") {
      presentation.aiProfileAdministrationResult = null;
      throw new Error(result.reason);
    }
    presentation.aiProfileAdministrationResult = result;
    presentation.aiProfiles = createWorkbenchAiProfileSurface(
      presentation.aiProfileAdministrationResult.snapshot.catalog,
    );
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader("Location", "/#ai-profile-administration");
    response.end();
  } catch {
    if (requestSignal.aborted || response.destroyed) return;
    setResponseHeaders(response);
    response.statusCode = profileDispatched ? 503 : 400;
    response.end(
      profileDispatched
        ? "ai_profile_action_outcome_unconfirmed\n変更結果を確認できません。未保存と判断せず、現在状態を再確認してください。自動再送は行いません。\n"
        : "ai_profile_action_rejected\n",
    );
  }
  return;
}

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
      const mode = form.get("mode");
      if (!/^[a-f0-9]{64}$/u.test(form.get("expectedNetworkPolicyHash") ?? ""))
        throw new Error("workbench_ai_network_policy_confirmation_required");
      if (mode !== "read_only_advice" && mode !== "workspace_edit")
        throw new Error("workbench_ai_request_mode_invalid");
      dispatched = true;
      result = await session.owner.start({
        mode,
        profileId: form.get("profileId") ?? "",
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
 * 共有管理用Profile Catalogを読み取る。
 * @responsibility Repository選択と独立した現在管理認可と応答前再確認を維持する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @input 当該HTTP要求・応答・Signal・URL、当該資格、共有Catalog Owner。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、共有Catalogの現在管理認可は本処理で確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存Catalog Snapshotを読み取り、有界な非秘密結果を返す。
 * @failure 認可・入力・Catalog不明は既存403で拒否する。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleSharedAiProfileRead({
  incoming,
  response,
  requestSignal,
  requestUrl,
  credentialAdministration,
  crosProfileAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  credentialAdministration: CredentialAdministration | undefined;
  crosProfileAdministration: AiProfileCatalogAdministration | undefined;
}>): Promise<void> {
  const method = incoming.method ?? "";
  try {
    if (
      requestUrl.search !== "" ||
      !credentialAdministration ||
      !crosProfileAdministration ||
      evaluateAiProfileManagementPermission(
        credentialAdministration.root,
        credentialAdministration.token,
      ) !== "allowed"
    )
      throw new Error("workbench_profile_access_unavailable");
    const read = crosProfileAdministration.snapshot();
    if (read.status !== "read") throw new Error(read.error);
    const snapshot = read.value;
    const catalog = validateAiProfileCatalog(snapshot.catalog).value;
    if (
      !catalog ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 0
    )
      throw new Error("workbench_profile_snapshot_invalid");
    const body = JSON.stringify({
      revision: snapshot.revision,
      catalog,
    });
    await yieldToTransport(0);
    if (requestSignal.aborted || response.destroyed) return;
    if (
      evaluateAiProfileManagementPermission(
        credentialAdministration.root,
        credentialAdministration.token,
      ) !== "allowed"
    )
      throw new Error("workbench_profile_access_unavailable");
    setResponseHeaders(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Length", Buffer.byteLength(body));
    response.end(method === "HEAD" ? undefined : body);
  } catch {
    if (!requestSignal.aborted && !response.destroyed) {
      setResponseHeaders(response);
      response.statusCode = 403;
      response.end("profile_access_unavailable\n");
    }
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
    | "aiProfiles"
    | "currentAiRequestId"
    | "aiRequestSnapshot"
    | "aiRequestNotice"
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
      const mode = form.get("mode");
      const profileId = form.get("profileId") ?? "";
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
      if (
        !presentation.aiProfiles.catalog.profiles.some(
          (profile) => profile.profileId === profileId,
        )
      )
        throw new Error("workbench_ai_request_profile_invalid");
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
          profileId,
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
          profileId,
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
