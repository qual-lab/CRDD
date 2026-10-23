/**
 * Repository別AI設定の読取り・明示保存を同じHTTP境界へ接続する。
 * @responsibility 現在管理認可・Repository Binding・CAS・取消と公開前再確認を維持する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @boundary BrowserとCoordinator設定Owner。
 * @effect 明示POSTだけが対象Repository設定を保存する。
 * @security Host Catalog、Credential、Provider実行を扱わない。
 */
import { parseUnambiguousJsonDocument } from "../../../../ai-adapter/src/index.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import {
  evaluateAiProfileManagementPermission,
  resolveRepositoryAccess,
} from "../../../../access-management/src/index.ts";
import {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
  type AiSelectionReadResult,
  type AiSelectionSaveResult,
} from "../../../../coordinator/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../../version-control/src/index.ts";
import type { FilesystemStoreRoot } from "../../../../domain-model/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

/**
 * 一要求の選択Repositoryと管理権限を固定する。
 * @responsibility 待機後にも同じBindingと現在許可へ再照合する。
 * @trace ARCH-000012
 * @input Root、接続資格、表示Repository ID、要求Signal。
 * @returns 検証済みRootと再照合関数。
 * @precondition 共有資格は共通HTTP前段で検査済み。
 * @postcondition 共有起動Repositoryへの暗黙fallbackなし。
 * @effect AMとRepository境界の読取りだけ。
 * @failure 未選択・不明・権限不足は例外。
 * @invariant Scope変更後は保存も公開も拒否する。
 * @boundary 現在アクセスと設定処理。
 * @security PathをClient入力に持たせない。
 * @concurrency 認可関数を保存Ownerへ渡す。
 */
function resolveSelectionAccess(
  capability: VerifiedRepositoryRoot,
  accessRoot: FilesystemStoreRoot | undefined,
  administration: CredentialAdministration | undefined,
  repositoryId: string | null,
  signal: AbortSignal,
): Readonly<{ root: VerifiedRepositoryRoot; authorize: () => boolean }> {
  if (!accessRoot) {
    if (repositoryId !== null) throw new Error("ai_selection_input_invalid");
    const initial = resolveVerifiedRepositoryRoot(capability);
    if (!initial) throw new Error("ai_selection_access_unavailable");
    return {
      root: capability,
      authorize: () =>
        !signal.aborted &&
        resolveVerifiedRepositoryRoot(capability) === initial,
    };
  }
  if (
    !administration ||
    !repositoryId ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId)
  )
    throw new Error("ai_selection_access_unavailable");
  const permission = () =>
    evaluateAiProfileManagementPermission(
      administration.root,
      administration.token,
    ) === "allowed";
  if (!permission()) throw new Error("ai_selection_access_unavailable");
  const initial = resolveRepositoryAccess(
    administration.root,
    administration.token,
    repositoryId,
    "development",
  );
  if (initial.status !== "completed")
    throw new Error("ai_selection_access_unavailable");
  const initialPath = resolveVerifiedRepositoryRoot(initial.access.root);
  if (!initialPath) throw new Error("ai_selection_access_unavailable");
  return {
    root: initial.access.root,
    authorize: () => {
      if (signal.aborted || !permission()) return false;
      const fresh = resolveRepositoryAccess(
        administration.root,
        administration.token,
        repositoryId,
        "development",
      );
      return (
        fresh.status === "completed" &&
        fresh.access.revision === initial.access.revision &&
        fresh.access.bindingId === initial.access.bindingId &&
        JSON.stringify(fresh.access.manifest) ===
          JSON.stringify(initial.access.manifest) &&
        resolveVerifiedRepositoryRoot(initial.access.root) === initialPath &&
        resolveVerifiedRepositoryRoot(fresh.access.root) === initialPath
      );
    },
  };
}

/**
 * 現在設定の取得又は一回のCAS保存を処理する。
 * @responsibility 入力拒否・既知保存・不明な出版と取消を混同しない。
 * @trace ARCH-000012
 * @input 検査済み前段の要求・応答・Origin・Token・Root・現在資格。
 * @returns 応答又は取消後の保存Owner終了まで待つPromise。
 * @precondition 既存HTTP前段とBody上限を維持する。
 * @postcondition 公開前に現在認可を再確認する。
 * @effect GETは読取りのみ、POSTは設定Ownerへ一回だけ保存を委譲する。
 * @failure 処置前拒否400、配送後応答不明503。自動再送なし。
 * @invariant 設定欠測を既定Modelで補完しない。
 * @boundary Browser HTTPとRepository設定正本。
 * @security 秘密値・Path・任意CLIを受け取らない。
 * @concurrency 同じSignalと同期保存の終了を維持する。
 */
export async function handleAiSelection({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  capability,
  localAccessRoot,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  capability: VerifiedRepositoryRoot;
  localAccessRoot: FilesystemStoreRoot | undefined;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    const write = incoming.method === "POST";
    let form: URLSearchParams | null = null;
    if (write) {
      if (
        !origin ||
        incoming.headers.host !== new URL(origin).host ||
        incoming.headers.origin !== origin ||
        requestUrl.search !== "" ||
        incoming.headers["content-type"]?.split(";")[0]?.trim() !==
          "application/x-www-form-urlencoded"
      )
        throw new Error("ai_selection_input_invalid");
      // 1MiBのUTF-8 JSONとpercent encoding（最大3倍）・固定Form項目を収容する。
      form = await readActionForm(incoming, 3 * 1_024 * 1_024 + 16 * 1_024);
      const fields = [
        "actionToken",
        "repositoryId",
        "expectedIdentity",
        "config",
      ];
      if (
        [...form.keys()].some((key) => !fields.includes(key)) ||
        ["actionToken", "expectedIdentity", "config"].some(
          (key) => form?.getAll(key).length !== 1,
        ) ||
        form.getAll("repositoryId").length > 1 ||
        form.get("actionToken") !== actionToken
      )
        throw new Error("ai_selection_input_invalid");
    } else if (
      [...requestUrl.searchParams.keys()].some(
        (key) => key !== "repositoryId",
      ) ||
      requestUrl.searchParams.getAll("repositoryId").length > 1
    )
      throw new Error("ai_selection_input_invalid");
    await yieldToTransport(0);
    if (requestSignal.aborted || response.destroyed) return;
    const access = resolveSelectionAccess(
      capability,
      localAccessRoot,
      credentialAdministration,
      form?.get("repositoryId") ?? requestUrl.searchParams.get("repositoryId"),
      requestSignal,
    );
    if (!access.authorize()) throw new Error("ai_selection_access_unavailable");
    let result: AiSelectionReadResult | AiSelectionSaveResult;
    if (form) {
      const expectedIdentity = form.get("expectedIdentity") || null;
      if (
        expectedIdentity !== null &&
        !/^[a-f0-9]{64}$/u.test(expectedIdentity)
      )
        throw new Error("ai_selection_input_invalid");
      const config = parseUnambiguousJsonDocument(form.get("config") ?? "");
      if (config === null) throw new Error("ai_selection_input_invalid");
      dispatched = true;
      result = saveRepositoryAiSelection(
        access.root,
        { expectedIdentity, config },
        access.authorize,
      );
    } else result = readRepositoryAiSelection(access.root);
    const body = JSON.stringify(result);
    await yieldToTransport(0);
    if (requestSignal.aborted || response.destroyed) return;
    if (!access.authorize()) throw new Error("ai_selection_access_unavailable");
    setResponseHeaders(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Length", Buffer.byteLength(body));
    response.end(incoming.method === "HEAD" ? undefined : body);
  } catch {
    if (requestSignal.aborted || response.destroyed) return;
    setResponseHeaders(response);
    response.statusCode = dispatched
      ? 503
      : incoming.method === "POST"
        ? 400
        : 403;
    response.end(
      dispatched
        ? "ai_selection_outcome_unconfirmed\n"
        : "ai_selection_request_rejected\n",
    );
  }
}
