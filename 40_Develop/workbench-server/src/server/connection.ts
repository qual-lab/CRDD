/**
 * Workbenchの接続確認と一度だけの鍵応答のHTTP入口。
 *
 * @packageDocumentation
 * @responsibility 接続Formと鍵操作の搬送を分離し、既存AM Ownerの認証・確認保存・鍵出版へ接続する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary HTTP要求と資格管理の直接接続。
 * @effect 明示された接続確認保存または鍵操作を既存Ownerへ配送する。
 * @security Tokenを通常Model・URL・共有状態へ保存せず、鍵は専用応答だけに渡す。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  authenticateWorkbenchConnection,
  executeCredentialAdministrationAction,
  type CredentialAdministration,
} from "./credential/administration.ts";
import { readActionForm, setResponseHeaders } from "./security.ts";

/**
 * 通常認証より先に接続専用Formを検証する。
 * @responsibility 初回限定資格と通常接続の確認を既存AMへ渡し、非秘密の接続結果だけを返す。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 当該HTTP要求・応答・SignalとURL、期待Origin・Action Token、明示的に構成した管理Root。
 * @returns 接続確認処理または取消後に終了するPromise。
 * @precondition 公開Origin境界とHeaderの前段検査を完了し、通常認証へ進めていない。
 * @postcondition 成功応答は固定completedだけで、生鍵・本人・内容を含めない。
 * @effect 接続確認が必要な場合に既存AMの確認保存が発生する。
 * @failure 入力・認証・保存不成立を固定400で拒否し、取消・切断済み要求へ応答しない。
 * @invariant 切断は他Browserの資格失効ではなく、保存済み確認をrollbackしない。
 * @boundary Browser接続要求と既存AM認証・確認保存Owner。
 * @security 同Origin・閉Form・Action Tokenを検証し、資格を応答や永続Sessionへコピーしない。
 * @concurrency 当該要求のSignalで待機後の公開を拒否し、次要求はfresh認証する。
 */
export async function handleLocalConnectionAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  localAccessRoot,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  localAccessRoot: FilesystemStoreRoot;
}>): Promise<void> {
  try {
    if (
      !origin ||
      requestUrl.search !== "" ||
      incoming.headers.host !== new URL(origin).host ||
      incoming.headers.origin !== origin ||
      incoming.headers["content-type"]?.split(";")[0]?.trim() !==
        "application/x-www-form-urlencoded"
    )
      throw new Error("workbench_local_connection_input_invalid");
    const form = await readActionForm(incoming);
    if (form.get("operation") === "disconnect") {
      if (
        [...form.keys()].some(
          (key) => key !== "operation" && key !== "actionToken",
        ) ||
        form.getAll("operation").length !== 1 ||
        form.getAll("actionToken").length !== 1 ||
        form.get("actionToken") !== actionToken ||
        requestSignal.aborted
      )
        throw new Error("workbench_local_connection_input_invalid");
    } else {
      authenticateWorkbenchConnection(
        localAccessRoot,
        form,
        actionToken,
        requestSignal,
      );
    }
    if (requestSignal.aborted || response.destroyed) return;
    setResponseHeaders(response);
    const body = JSON.stringify({ status: "completed" });
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Length", Buffer.byteLength(body));
    response.end(body);
  } catch {
    if (!response.destroyed && !requestSignal.aborted) {
      setResponseHeaders(response);
      response.statusCode = 400;
      response.end("local_connection_rejected\n");
    }
  }
}

/**
 * 生鍵を返す管理操作を専用HTTP応答へ接続する。
 * @responsibility 鍵Formの入力検査と一度だけの応答搬送を既存資格Ownerへ委譲する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input HTTP要求・応答、期待OriginとAction Token、当該要求の管理資格。
 * @returns 鍵操作の終了と要求監視解除を待つPromise。
 * @precondition 公開Origin・通常認証・共有操作経路の前段検査を完了している。
 * @postcondition 操作結果の応答と提示の確認を既存Ownerが相関し、秘密を通常画面へ保存しない。
 * @effect 既存Ownerを通して鍵の発行・失効・交換と専用応答が発生し得る。
 * @failure 応答前の入力・接続不成立は固定400。応答開始後の失敗を新たな鍵発行で補わない。
 * @invariant 再表示・自動再送・暗黙再発行・独自の資格保存を行わない。
 * @boundary Browser専用鍵応答と既存Credential Administration。
 * @security Host・Origin・形式・Action Tokenを確認し、生鍵はこの専用応答だけに渡す。
 * @concurrency 当該操作の取消と実処理終了を分け、Owner Promiseをjoinしてから監視を解除する。
 */
export async function handleCredentialAction({
  incoming,
  response,
  origin,
  actionToken,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  try {
    if (credentialAdministration === undefined)
      throw new Error("workbench_credential_administration_unavailable");
    if (
      !origin ||
      incoming.headers.host !== new URL(origin).host ||
      (incoming.headers.origin !== undefined &&
        incoming.headers.origin !== origin) ||
      incoming.headers["content-type"]?.split(";")[0]?.trim() !==
        "application/x-www-form-urlencoded"
    )
      throw new Error("workbench_credential_origin_rejected");
    const form = await readActionForm(incoming);
    if (incoming.aborted || response.destroyed) return;
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    setResponseHeaders(response);
    const controller = new AbortController();
    const abort = () => controller.abort();
    incoming.once("aborted", abort);
    const responseClosed = () => {
      if (!response.writableFinished) abort();
    };
    response.once("close", responseClosed);
    const pending = executeCredentialAdministrationAction(
      credentialAdministration,
      form,
      response,
      controller.signal,
    );
    try {
      await pending;
    } finally {
      incoming.removeListener("aborted", abort);
      response.removeListener("close", responseClosed);
    }
  } catch {
    if (!response.headersSent && !response.destroyed) {
      setResponseHeaders(response);
      response.statusCode = 400;
      response.end("credential_action_rejected\n");
    }
  }
}
