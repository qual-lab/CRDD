/**
 * Workbenchの公開HTTP受付を実Provider検証へ接続する。
 *
 * @packageDocumentation
 * @responsibility 検証が内部Applicationを直接呼ばず、公開FormとRead Modelを通ることを保証する。
 * @trace ARCH-000015
 * @boundary 検証Runner→loopback Workbench HTTP。
 * @effect 明示されたHTTP要求だけを発行する。
 * @security Token、Prompt、結果本文を出力せず、自動再送とredirect追従を禁止する。
 */
import assert from "node:assert/strict";
import type {
  WorkbenchAiRequests,
  WorkbenchAiRequestCommand,
  WorkbenchCandidateActions,
} from "../src/ai-request/types.ts";
import { inspectWorkbenchClientModel } from "../src/browser/client-model.ts";

/**
 * 固定Workbench Routeの応答を受信中の上限付きで取得する。
 *
 * @responsibility 応答の無制限蓄積、redirect追従と暗黙再送を防ぐ。
 * @trace ARCH-000015
 * @input baseUrl、固定Routeと任意Form。
 * @returns Status、Locationと上限内本文。
 * @precondition 呼出し元がloopback URLを検証済み。
 * @postcondition 受信Readerと期限Timerを解放する。
 * @effect GETまたはPOSTを一回だけ発行する。
 * @failure 15秒超過、1MiB超過またはTransport失敗を送出する。
 * @invariant POST失敗を未実行と推定しない。
 * @boundary 検証Runnerと公開HTTP Transport。
 * @security 本文、Tokenおよび例外本文をlogへ出さない。
 * @concurrency 各要求が独立したAbortControllerを所有する。
 */
async function requestBounded(
  baseUrl: string,
  route: string,
  form?: URLSearchParams,
) {
  const controller = new AbortController();
  let headersReceived = false;
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(new URL(route, baseUrl), {
      method: form === undefined ? "GET" : "POST",
      ...(form === undefined ? {} : { body: form }),
      redirect: "manual",
      signal: controller.signal,
    });
    headersReceived = true;
    const reader = response.body?.getReader();
    if (reader === undefined)
      throw new Error("workbench_verification_body_missing");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    let failureClass: "body_limit" | "read_failed" | null = null;
    let ended = false;
    let cleanupConfirmed = false;
    try {
      for (;;) {
        const item = await reader.read();
        if (item.done) {
          ended = true;
          break;
        }
        bytes += item.value.byteLength;
        if (bytes > 1024 * 1024) {
          failureClass = "body_limit";
          throw new Error("workbench_verification_body_limit");
        }
        chunks.push(item.value);
      }
    } catch {
      failureClass ??= "read_failed";
    } finally {
      cleanupConfirmed = ended;
      let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (!ended) {
          controller.abort();
          cleanupConfirmed = await Promise.race([
            reader.cancel().then(
              () => true,
              () => false,
            ),
            new Promise<boolean>((resolve) => {
              cleanupTimer = setTimeout(() => resolve(false), 1000);
            }),
          ]);
        }
      } finally {
        if (cleanupTimer !== undefined) clearTimeout(cleanupTimer);
        try {
          reader.releaseLock();
        } catch {
          cleanupConfirmed = false;
        }
      }
    }
    if (!cleanupConfirmed)
      throw new Error("workbench_verification_reader_cleanup_unknown", {
        cause: Object.freeze({ failureClass }),
      });
    if (failureClass !== null)
      throw new Error("workbench_verification_response_incomplete", {
        cause: Object.freeze({ failureClass }),
      });
    return {
      status: response.status,
      location: response.headers.get("location"),
      body: Buffer.concat(chunks).toString("utf8"),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("workbench_verification_")
    )
      throw error;
    throw new Error("workbench_verification_transport_failed", {
      cause: Object.freeze({
        failureClass: headersReceived ? "read_failed" : "headers_unobserved",
        timedOut: controller.signal.aborted,
      }),
    });
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

/**
 * 公開JSONからMain Viewだけを受理する。
 *
 * @responsibility 既存の結果parserを維持して公開モデルを検証する。
 * @trace ARCH-000015
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
 */
async function readMain(baseUrl: string) {
  const response = await requestBounded(
    baseUrl,
    "/api/workbench-view?route=%2F",
  );
  assert.equal(response.status, 200, "workbench_verification_model_status");
  const model = inspectWorkbenchClientModel(JSON.parse(response.body));
  if (model.view !== "main")
    throw new Error("workbench_verification_main_required");
  return model;
}

/**
 * 本番Applicationへの直呼出しを公開HTTP操作へ置き換える。
 *
 * @responsibility 同じrequestId、modeとprofileIdを公開結果から照合する。
 * @trace ARCH-000015
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
 */
export async function createWorkbenchAiVerificationHttpClient(
  baseUrl: string,
): Promise<
  WorkbenchAiRequests & Pick<WorkbenchCandidateActions, "review" | "discard">
> {
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
  const initial = await readMain(baseUrl);
  const token = initial.actionToken;
  const accepted = new Map<string, WorkbenchAiRequestCommand>();
  return Object.freeze<
    WorkbenchAiRequests & Pick<WorkbenchCandidateActions, "review" | "discard">
  >({
    review: async (candidateId) => {
      const model = await readMain(baseUrl);
      assert.equal(
        model.aiRequest.snapshot?.candidate?.candidateId,
        candidateId,
      );
      const review = model.aiRequest.candidateReview;
      if (review === null)
        throw new Error("workbench_verification_candidate_review_missing");
      if (review.candidate !== null)
        assert.equal(review.candidate.candidateId, candidateId);
      return review;
    },
    discard: async (candidateId, confirmed) => {
      const before = await readMain(baseUrl);
      assert.equal(
        before.aiRequest.snapshot?.candidate?.candidateId,
        candidateId,
      );
      try {
        const response = await requestBounded(
          baseUrl,
          "/candidate/action",
          new URLSearchParams({
            actionToken: token,
            operation: "discard",
            candidateId,
            confirmed: confirmed ? "true" : "false",
          }),
        );
        assert.equal(response.status, 303);
        assert.equal(response.location, "/#ai-request");
        const model = await readMain(baseUrl);
        assert.equal(
          model.aiRequest.snapshot?.candidate?.candidateId,
          candidateId,
        );
        const action = model.aiRequest.candidateAction;
        if (action === null)
          throw new Error("workbench_verification_candidate_action_missing");
        assert.equal(action.operation, "discard");
        assert.equal(action.candidateId, candidateId);
        assert.notDeepEqual(action, before.aiRequest.candidateAction);
        return action;
      } catch {
        throw new Error("workbench_candidate_http_discard_outcome_unknown", {
          cause: Object.freeze({ candidateId }),
        });
      }
    },
    start: async (request) => {
      if (
        request.contextReferences.length !== 1 ||
        request.contextReferences[0] !== "PROJECT_CONTEXT.md"
      )
        throw new Error("workbench_verification_context_mismatch");
      const previous = (await readMain(baseUrl)).aiRequest.snapshot?.requestId;
      try {
        const response = await requestBounded(
          baseUrl,
          "/ai-request/action",
          new URLSearchParams({
            actionToken: token,
            operation: "start",
            mode: request.mode,
            profileId: request.profileId,
            prompt: request.prompt,
            allowedPaths: request.allowedPaths.join("\n"),
            externalSendConfirmed: request.externalSendConfirmed ? "yes" : "no",
          }),
        );
        if (response.status === 400 && !request.externalSendConfirmed)
          return {
            status: "blocked",
            requestId: null,
            reason: "workbench_ai_http_request_rejected",
          };
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
        const snapshot = (await readMain(baseUrl)).aiRequest.snapshot;
        if (snapshot === null || snapshot.requestId === previous)
          throw new Error("workbench_ai_http_start_identity_unknown");
        assert.equal(snapshot.mode, request.mode);
        assert.equal(snapshot.profileId, request.profileId);
        accepted.set(snapshot.requestId, request);
        return {
          status: "accepted",
          requestId: snapshot.requestId,
          reason: null,
        };
      } catch (error) {
        const observed = await readMain(baseUrl).catch(() => null);
        const snapshot = observed?.aiRequest.snapshot;
        const requestId =
          snapshot != null &&
          snapshot.requestId !== previous &&
          snapshot.mode === request.mode &&
          snapshot.profileId === request.profileId
            ? snapshot.requestId
            : null;
        if (requestId !== null) accepted.set(requestId, request);
        throw new Error("workbench_ai_http_start_outcome_unknown", {
          cause: Object.freeze({
            requestId,
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
      const snapshot = (await readMain(baseUrl)).aiRequest.snapshot;
      if (snapshot === null)
        throw new Error("workbench_verification_snapshot_missing");
      assert.equal(snapshot.requestId, requestId);
      assert.equal(snapshot.mode, command.mode);
      assert.equal(snapshot.profileId, command.profileId);
      return snapshot;
    },
    cancel: async (requestId) => {
      const command = accepted.get(requestId);
      if (command === undefined)
        throw new Error("workbench_verification_request_unknown");
      const response = await requestBounded(
        baseUrl,
        "/ai-request/action",
        new URLSearchParams({
          actionToken: token,
          operation: "cancel",
          requestId,
        }),
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
      const snapshot = (await readMain(baseUrl)).aiRequest.snapshot;
      if (snapshot === null)
        throw new Error("workbench_verification_snapshot_missing");
      assert.equal(snapshot.requestId, requestId);
      assert.equal(snapshot.mode, command.mode);
      assert.equal(snapshot.profileId, command.profileId);
      return snapshot;
    },
  });
}
