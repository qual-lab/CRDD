/**
 * Workbenchの通常管理HTTP入口。
 *
 * @packageDocumentation
 * @responsibility 管理一覧と保存の閉入力を検査し、既存Access Management接続へ要求単位で委譲する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary HTTP要求とWorkbenchの直接管理接続。
 * @effect 管理操作は既存Ownerを通してユーザー・ロール・Repository公開設定を変更し得る。
 * @security 生鍵の発行・提示は所有せず、固定JSONと有界な非秘密管理結果だけを返す。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import type { CredentialAdministration } from "../credential/administration.ts";
import type { ManagementView } from "../../shared/management/validation.ts";
import {
  executeWorkbenchManagement,
  readWorkbenchManagement,
} from "../management/operations.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

/**
 * 当該要求の管理一覧または保存を処理する。
 * @responsibility Origin・Query・Formを確認し、Owner結果の搬送と切断時の終了待機を行う。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input HTTP要求・応答、既に解釈済みのURLと期待Origin、Action Token、当該要求の資格Context。
 * @returns 管理処理と監視解除を終えるPromise。
 * @precondition 公開Origin・Header資格・共有操作経路の前段検査を完了している。
 * @postcondition 許可された管理操作の非秘密結果だけを返し、取消・切断済み要求へ結果を公開しない。
 * @effect 既存管理Ownerへの読取りまたは明示保存を一回発行する。
 * @failure 入力拒否400と内部接続失敗503を固定結果へ変換し、容量超過を通常結果へ丸めない。
 * @invariant 管理Roleを内容アクセスや資格発行のAuthorityへ転用しない。
 * @boundary Browser HTTPから既存管理操作とAM公開APIへの直接接続。
 * @security Host・Origin・閉じたview・Action Tokenを確認し、自由な例外本文・Root・生鍵を公開しない。
 * @concurrency 要求専用取消をOwnerへ渡し、そのPromise終了を待ってから監視を解除する。
 */
export async function handleManagementRequest({
  incoming,
  response,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  const method = incoming.method ?? "";
  const controller = new AbortController();
  const abort = () => controller.abort();
  const responseClosed = () => {
    if (!response.writableFinished) abort();
  };
  incoming.once("aborted", abort);
  response.once("close", responseClosed);
  const pending = (async () => {
    try {
      if (
        !origin ||
        incoming.headers.host !== new URL(origin).host ||
        (incoming.headers.origin !== undefined &&
          incoming.headers.origin !== origin)
      )
        throw new Error("workbench_management_input_invalid");
      const connection = credentialAdministration;
      setResponseHeaders(response);
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader(
        "x-crdd-management-mode",
        connection === undefined ? "none" : "local",
      );
      let result: unknown;
      if (method === "GET") {
        const view = requestUrl.searchParams.get("view");
        if (
          !view ||
          !["current", "users", "roles", "repositories", "exposure"].includes(
            view,
          ) ||
          [...requestUrl.searchParams.keys()].some((key) => key !== "view") ||
          requestUrl.searchParams.getAll("view").length !== 1
        )
          throw new Error("workbench_management_input_invalid");
        if (controller.signal.aborted || incoming.aborted || response.destroyed)
          return;
        result =
          connection === undefined
            ? {
                status: "unavailable",
                reason: "management_not_configured",
              }
            : await readWorkbenchManagement(
                connection,
                view as ManagementView,
                controller.signal,
              );
      } else {
        if (
          !connection ||
          incoming.headers["content-type"]?.split(";")[0]?.trim() !==
            "application/x-www-form-urlencoded"
        )
          throw new Error("workbench_management_input_invalid");
        const form = await readActionForm(incoming);
        if (form.get("actionToken") !== actionToken)
          throw new Error("workbench_management_input_invalid");
        if (controller.signal.aborted || incoming.aborted || response.destroyed)
          return;
        result = await executeWorkbenchManagement(
          connection,
          form,
          controller.signal,
        );
      }
      await yieldToTransport(0);
      if (controller.signal.aborted || response.destroyed) return;
      let body = JSON.stringify(result);
      if (Buffer.byteLength(body, "utf8") > 16777216)
        body = JSON.stringify({
          status: "unavailable",
          reason: "management_response_too_large",
        });
      response.end(body);
    } catch (error) {
      if (
        !response.headersSent &&
        !response.destroyed &&
        !controller.signal.aborted
      ) {
        setResponseHeaders(response);
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.statusCode =
          error instanceof Error &&
          error.message === "workbench_management_input_invalid"
            ? 400
            : 503;
        response.end(
          JSON.stringify({
            status: "unavailable",
            reason: "management_transport_unavailable",
          }),
        );
      }
    }
  })();
  try {
    await pending;
  } finally {
    incoming.removeListener("aborted", abort);
    response.removeListener("close", responseClosed);
  }
}
