/**
 * 実HTTPとBrowser応答検査を接続し、同じ要求の相関を維持する。
 * @packageDocumentation
 * @responsibility 実HTTPとBrowser応答検査を接続し、同じ要求の相関を維持する。
 * @trace ERB-IT-021
 * @level IT
 * @boundary Workbench HTTPとBrowser契約の検証接続。製品入口には接続しない。
 */
import assert from "node:assert/strict";
import type {
  AiRequestCommand,
  AiRequests,
  AiRequestSnapshot,
} from "../../src/app.ts";
import {
  requestInChild,
  type VerificationHttpTiming,
} from "./ai-verification-http.ts";
import { parseUnambiguousJsonDocument } from "../../src/transport/parse-json.ts";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const nullableString = (value: unknown) =>
  value === null || typeof value === "string";

/** 表示全体ではなく、依頼・観測・取消が利用するHTTPの値を検証する。 @trace ERB-IT-021 */
export function readVerificationView(value: unknown): Readonly<{
  actionToken: string;
  aiRequest: Readonly<{
    configured: boolean;
    notice: string | null;
    additionalHosts: readonly string[] | null;
    snapshot: AiRequestSnapshot | null;
  }>;
}> {
  const fail = () => {
    throw new Error("workbench_verification_model_invalid");
  };
  if (
    !record(value) ||
    value.contract !== "crdd/workbench/view/v1" ||
    value.view !== "main" ||
    typeof value.actionToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(value.actionToken) ||
    !record(value.aiRequest)
  )
    return fail();
  const { configured, notice, additionalHosts, snapshot } = value.aiRequest;
  if (
    typeof configured !== "boolean" ||
    (notice !== null && typeof notice !== "string") ||
    (additionalHosts !== null &&
      (!strings(additionalHosts) ||
        additionalHosts.length > 32 ||
        additionalHosts.some((host) => host.length > 253)))
  )
    return fail();
  if (snapshot !== null) {
    const items = (value: unknown) =>
      Array.isArray(value) &&
      value.every(
        (item) =>
          record(item) &&
          typeof item.text === "string" &&
          strings(item.references),
      );
    if (
      !record(snapshot) ||
      typeof snapshot.requestId !== "string" ||
      !snapshot.requestId ||
      (snapshot.mode !== null &&
        snapshot.mode !== "read_only_advice" &&
        snapshot.mode !== "workspace_edit") ||
      typeof snapshot.status !== "string" ||
      ![
        "accepted",
        "running",
        "completed",
        "blocked",
        "cancelled",
        "unknown",
      ].includes(snapshot.status) ||
      !nullableString(snapshot.reason) ||
      typeof snapshot.resultAvailable !== "boolean" ||
      snapshot.candidate !== null ||
      !items(snapshot.facts) ||
      !items(snapshot.sharedAnalysis) ||
      !items(snapshot.additionalInferences) ||
      !items(snapshot.nextOptions) ||
      (snapshot.cleanupConfirmed !== undefined &&
        typeof snapshot.cleanupConfirmed !== "boolean") ||
      (snapshot.recoveryIds !== undefined && !strings(snapshot.recoveryIds)) ||
      (snapshot.secondaryFailures !== undefined &&
        !strings(snapshot.secondaryFailures)) ||
      ![
        "taskId",
        "attemptId",
        "operationId",
        "executionStatus",
        "primaryFailure",
      ].every(
        (key) => snapshot[key] === undefined || nullableString(snapshot[key]),
      )
    )
      return fail();
    const selection = snapshot.executionSelection;
    if (
      selection !== null &&
      (!record(selection) ||
        (selection.provider !== "codex" && selection.provider !== "claude") ||
        typeof selection.modelIdentifier !== "string" ||
        !selection.modelIdentifier ||
        !nullableString(selection.workType) ||
        typeof selection.reasoningEffort !== "string" ||
        !["low", "medium", "high", "xhigh", "max"].includes(
          selection.reasoningEffort,
        ))
    )
      return fail();
    const workspace = snapshot.workspaceResult;
    if (
      workspace !== undefined &&
      workspace !== null &&
      (!record(workspace) ||
        Object.keys(workspace).sort().join(",") !==
          "canonicalRepositoryChanged,changeAttribution,changedPaths,workspaceDeletionIssued,workspaceId" ||
        !nullableString(workspace.workspaceId) ||
        (workspace.changedPaths !== null && !strings(workspace.changedPaths)) ||
        (workspace.canonicalRepositoryChanged !== null &&
          typeof workspace.canonicalRepositoryChanged !== "boolean") ||
        workspace.changeAttribution !== "unattributed" ||
        workspace.workspaceDeletionIssued !== false)
    )
      return fail();
  }
  return {
    actionToken: value.actionToken,
    aiRequest: {
      configured,
      notice,
      additionalHosts,
      snapshot: snapshot as AiRequestSnapshot | null,
    },
  };
}

/**
 * 公開JSONからMain Viewだけを受理する。
 *
 * @responsibility 既存の結果parserを維持して公開モデルを検証する。
 * @trace ERB-IT-021
 * @input 検証済みloopback baseUrl。
 * @returns Main Viewのモデル。
 * @precondition Workbench Listenerが起動している。
 * @postcondition 別Viewを結果として返さない。
 * @effect 公開Read ModelへGETを一回発行する。
 * @failure 非200、不正JSONまたは不正モデルを拒否する。
 * @invariant 観測失敗を結果なしへ変換しない。
 * @boundary 公開Read Model→検証Oracle。
 * @security 取得本文はmemory内だけで扱う。
 * @concurrency N/A: 一要求の読取りに閉じる。
 * @stimulus 検証済みloopback baseUrl。
 * @observation Main Viewのモデル。
 * @oracle 観測失敗を結果なしへ変換しない。
 * @cleanup 別Viewを結果として返さない。
 */
export async function readMain(
  baseUrl: string,
  observe?: (timing: VerificationHttpTiming) => void,
) {
  const response = await requestInChild(
    baseUrl,
    "/api/workbench/view?route=%2F",
    undefined,
    observe,
  );
  assert.equal(response.status, 200, "workbench_verification_model_status");
  return readVerificationView(parseUnambiguousJsonDocument(response.body));
}

/**
 * 本番Applicationへの直呼出しを公開HTTP操作へ置き換える。
 *
 * @responsibility 同じrequestId、modeと固定選定を公開結果から照合する。
 * @trace ERB-IT-021
 * @input 起動済みWorkbenchのloopback URL。
 * @returns start／observe／cancelと候補確認・破棄の検証用接続部。採用操作は含めない。
 * @precondition CallerがListenerと本番Applicationの終了・回復を所有する。
 * @postcondition 内部Application、署名またはProviderへ直接アクセスしない。
 * @effect 操作Tokenを読み、明示された公開HTTP操作を発行する。
 * @failure POSTの観測失敗はoutcome unknownとして停止し、自動再送しない。
 * @invariant 303だけをAI完了と表示しない。Listener終了はProvider回収を意味しない。
 * @boundary 検証Runner→公開Workbench受付→注入された本番Application。
 * @security 送信確認を自動付与せず、PROJECT_CONTEXT.mdだけを正式入力にする。
 * @concurrency 一Sessionで一依頼ずつ実行するCaller契約。
 * @stimulus 起動済みWorkbenchのloopback URL。
 * @observation start／observe／cancelと候補確認・破棄の検証用接続部。採用操作は含めない。
 * @oracle 303だけをAI完了と表示しない。Listener終了はProvider回収を意味しない。
 * @cleanup 内部Application、署名またはProviderへ直接アクセスしない。
 */
export async function createWorkbenchAiVerificationHttpClient(
  baseUrl: string,
  observe?: (timing: VerificationHttpTiming) => void,
): Promise<AiRequests> {
  const url = new URL(baseUrl);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new Error("workbench_verification_loopback_required");
  const initial = await readMain(baseUrl, observe);
  const token = initial.actionToken;
  const accepted = new Map<string, AiRequestCommand>();
  const pending = new Set<Promise<unknown>>();
  let closing = false;
  let cleanupUnconfirmed = false;
  const run = <T>(operation: () => Promise<T>): Promise<T> => {
    if (closing)
      return Promise.reject(new Error("workbench_verification_client_closed"));
    const promise = Promise.resolve().then(operation);
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      (error: unknown) => {
        if (
          error instanceof Error &&
          error.message ===
            "workbench_verification_client_process_cleanup_unknown"
        ) {
          cleanupUnconfirmed = true;
          closing = true;
        } else pending.delete(promise);
      },
    );
    return promise;
  };
  /**
   * readで検証用の要求・観測を搬送する。
   * @responsibility readで検証用の要求・観測を搬送する。
   * @trace ERB-IT-021
   * @precondition 呼出し元が同じ検証runの入力と終了処理を所有する。
   * @stimulus readで検証用の要求・観測を搬送する。
   * @observation 要求・診断の搬送結果と、取得・終了の観測値。
   * @oracle 入力の相関・欠測・失敗を保持し、搬送だけからTask成功を生成しない。
   * @cleanup 購読・子Process等の終了はこの関数又は呼出し元の明示的な終了処理で確認する。
   * @boundary 検証Tool内部の技術搬送。Provider実成功や処置許可は返さない。
   */
  const read = () => run(() => readMain(baseUrl, observe));
  return Object.freeze<AiRequests>({
    start: async (request) => {
      if (
        request.contextReferences.length !== 1 ||
        request.contextReferences[0] !== "PROJECT_CONTEXT.md"
      )
        throw new Error("workbench_verification_context_mismatch");
      try {
        const response = await run(() =>
          requestInChild(
            baseUrl,
            "/api/ai-request",
            new URLSearchParams({
              actionToken: token,
              operation: "start",
              requestId: request.requestId,
              mode: request.mode,
              workspaceId: request.workspaceId ?? "",
              workType: request.workType ?? "",
              choice: request.choice ? JSON.stringify(request.choice) : "",
              prompt: request.prompt,
              allowedPaths: request.allowedPaths.join("\n"),
            }),
            observe,
          ),
        );
        assert.equal(
          response.status,
          303,
          "workbench_verification_start_status",
        );
        assert.equal(
          response.location,
          "/#ai-request",
          "workbench_verification_start_location",
        );
        const snapshot = (await read()).aiRequest.snapshot;
        if (snapshot === null || snapshot.requestId !== request.requestId)
          throw new Error("workbench_ai_http_start_identity_unknown");
        assert.equal(snapshot.mode, request.mode);
        if (snapshot.executionSelection) {
          assert.equal(snapshot.executionSelection.workType, request.workType);
          if (request.choice) {
            assert.equal(
              snapshot.executionSelection.provider,
              request.choice.provider,
            );
            assert.equal(
              snapshot.executionSelection.modelIdentifier,
              request.choice.model,
            );
            assert.equal(
              snapshot.executionSelection.reasoningEffort,
              request.choice.effort,
            );
          }
        }
        accepted.set(snapshot.requestId, request);
        return {
          status: "accepted",
          requestId: snapshot.requestId,
          reason: null,
        };
      } catch (error) {
        const observed = await read().catch(() => null);
        const snapshot = observed?.aiRequest.snapshot;
        const requestId =
          snapshot != null &&
          snapshot.requestId === request.requestId &&
          snapshot.mode === request.mode &&
          (snapshot.executionSelection === null ||
            snapshot.executionSelection.workType === request.workType)
            ? snapshot.requestId
            : null;
        if (requestId !== null) accepted.set(requestId, request);
        throw new Error("workbench_ai_http_start_outcome_unknown", {
          cause: Object.freeze({
            requestId,
            clientCleanupConfirmed: !cleanupUnconfirmed,
            transportFailure:
              error instanceof Error &&
              error.message === "workbench_verification_reader_cleanup_unknown"
                ? "reader_cleanup_unknown"
                : "response_or_observation_failed",
            ...(error instanceof Error &&
            error.message.startsWith("workbench_verification_")
              ? { transportCause: error.cause }
              : {}),
          }),
        });
      }
    },
    observe: async (requestId) => {
      const command = accepted.get(requestId);
      if (command === undefined)
        throw new Error("workbench_verification_request_unknown");
      const snapshot = (await read()).aiRequest.snapshot;
      if (snapshot === null)
        throw new Error("workbench_verification_snapshot_missing");
      assert.equal(snapshot.requestId, requestId);
      assert.equal(snapshot.mode, command.mode);
      if (snapshot.executionSelection)
        assert.equal(snapshot.executionSelection.workType, command.workType);
      return snapshot;
    },
    cancel: async (requestId) => {
      const command = accepted.get(requestId);
      if (command === undefined)
        throw new Error("workbench_verification_request_unknown");
      const response = await run(() =>
        requestInChild(
          baseUrl,
          "/api/ai-request",
          new URLSearchParams({
            actionToken: token,
            operation: "cancel",
            requestId,
          }),
          observe,
        ),
      );
      assert.equal(
        response.status,
        303,
        "workbench_verification_cancel_status",
      );
      assert.equal(
        response.location,
        "/#ai-request",
        "workbench_verification_cancel_location",
      );
      const snapshot = (await read()).aiRequest.snapshot;
      if (snapshot === null)
        throw new Error("workbench_verification_snapshot_missing");
      assert.equal(snapshot.requestId, requestId);
      assert.equal(snapshot.mode, command.mode);
      if (snapshot.executionSelection)
        assert.equal(snapshot.executionSelection.workType, command.workType);
      return snapshot;
    },
    close: async () => {
      closing = true;
      await Promise.allSettled([...pending]);
      if (cleanupUnconfirmed)
        throw new Error(
          "workbench_verification_client_process_cleanup_unknown",
        );
    },
  });
}
