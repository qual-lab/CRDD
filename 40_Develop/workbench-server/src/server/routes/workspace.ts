/**
 * Workspace操作のWorkbench HTTP入口。
 *
 * @packageDocumentation
 * @responsibility 閉じたFormと現在Repository認可を確認し、Coordinatorの既存Workspace操作へ一回だけ委譲する。
 * @trace ARCH-000012
 * @trace ARCH-000017
 * @boundary Browser HTTP・Access Management・CoordinatorのWorkspace操作。
 * @effect 明示されたWorkspace操作だけを既存Ownerへ配送する。
 * @security Root・資格・任意実行引数をBrowserから受けず、配送後の結果不明と処置前拒否を区別する。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import { resolveRepositoryAccess } from "../../../../access-management/src/index.ts";
import {
  createFilesystemRepositoryObservationPort,
  inspectRepositoryManifest,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
  type FilesystemStoreRoot,
} from "../../../../domain-model/src/index.ts";
import {
  executeWorkspaceCommand,
  inspectWorkspaceCommand,
} from "../../../../coordinator/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../../../version-control/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

/**
 * 検査済み前段からWorkspaceの明示操作を処理する。
 * @responsibility Form検査、fresh認可、配送、公開前再確認を同じ要求へ結合する。
 * @trace ARCH-000012
 * @trace ARCH-000017
 * @input 当該要求・応答・Signal、URL、期待Origin・Action Token、検証済みRepository Root、当該要求の管理資格。
 * @returns 応答または取消後の既存Owner終了まで待つPromise。
 * @precondition 公開Origin・Header資格・共有操作経路の前段検査を完了している。
 * @postcondition 許可された一操作だけを配送し、現在認可と取消を確認した結果だけを公開する。
 * @effect 既存Coordinatorを通してWorkspace・Candidate・Git処置が発生し得る。
 * @failure 配送前拒否は400、配送後の結果未確認は503。取消・切断済み応答は公開しない。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、同じ操作を再送しない。
 * @boundary HTTP受付から既存Workspace Ownerと現在Repository認可へ接続する。
 * @security 当該Repositoryの現在development認可、Root同一性、manifestを処置前と公開前に確認する。
 * @concurrency 要求専用Signalを使用し、同期処理後にも通信通知を処理して取消を再確認する。
 */
export async function handleWorkspaceAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  repositoryRoot,
  localAccessRoot,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  repositoryRoot: string;
  localAccessRoot: FilesystemStoreRoot | undefined;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    if (
      !origin ||
      requestUrl.search !== "" ||
      incoming.headers.host !== new URL(origin).host ||
      incoming.headers.origin !== origin
    )
      throw new Error("workspace_input_invalid");
    const form = await readActionForm(incoming);
    const keys = ["actionToken", "repositoryId", "command"];
    if (
      [...form.keys()].some((key) => !keys.includes(key)) ||
      keys.some((key) => form.getAll(key).length !== 1) ||
      form.get("actionToken") !== actionToken
    )
      throw new Error("workspace_input_invalid");
    const repositoryId = form.get("repositoryId");
    if (
      !repositoryId ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId)
    )
      throw new Error("workspace_input_invalid");
    const command = inspectWorkspaceCommand(
      JSON.parse(form.get("command") ?? "null"),
    );
    if (!command) throw new Error("workspace_input_invalid");
    await yieldToTransport(0);
    if (requestSignal.aborted || response.destroyed) return;
    let ownerRoot = repositoryRoot;
    let projectId: string;
    let authorize: () => boolean;
    if (localAccessRoot !== undefined) {
      const administration = credentialAdministration;
      if (!administration) throw new Error("workspace_access_unavailable");
      const initial = resolveRepositoryAccess(
        administration.root,
        administration.token,
        repositoryId,
        "development",
      );
      if (initial.status !== "completed")
        throw new Error("workspace_access_unavailable");
      const resolved = resolveVerifiedRepositoryRoot(initial.access.root);
      if (resolved === null) throw new Error("workspace_access_unavailable");
      ownerRoot = resolved;
      projectId = initial.access.manifest.projectId;
      authorize = () => {
        const fresh = resolveRepositoryAccess(
          administration.root,
          administration.token,
          repositoryId,
          "development",
        );
        return (
          !requestSignal.aborted &&
          fresh.status === "completed" &&
          fresh.access.revision === initial.access.revision &&
          fresh.access.bindingId === initial.access.bindingId &&
          JSON.stringify(fresh.access.manifest) ===
            JSON.stringify(initial.access.manifest) &&
          resolveVerifiedRepositoryRoot(initial.access.root) === ownerRoot &&
          resolveVerifiedRepositoryRoot(fresh.access.root) === ownerRoot
        );
      };
    } else {
      const verified = verifyRepositoryRoot(ownerRoot);
      if (verified.status !== "completed")
        throw new Error("workspace_access_unavailable");
      const observer = createFilesystemRepositoryObservationPort(
        verified.capability,
        1_048_576,
      );
      const file = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
      if (file.status !== "resolved")
        throw new Error("workspace_access_unavailable");
      const source = file.source;
      const manifest = inspectRepositoryManifest(JSON.parse(source));
      if (!manifest || manifest.repositoryId !== repositoryId)
        throw new Error("workspace_access_unavailable");
      projectId = manifest.projectId;
      authorize = () => {
        const fresh = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
        return (
          !requestSignal.aborted &&
          resolveVerifiedRepositoryRoot(verified.capability) === ownerRoot &&
          fresh.status === "resolved" &&
          fresh.source === source
        );
      };
    }
    dispatched = true;
    const result = executeWorkspaceCommand(
      ownerRoot,
      projectId,
      command,
      authorize,
      requestSignal,
    );
    const body = JSON.stringify(result);
    await yieldToTransport(0);
    if (requestSignal.aborted || response.destroyed) return;
    if (!authorize()) throw new Error("workspace_result_unavailable");
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
          ? "workspace_outcome_unconfirmed\n"
          : "workspace_request_rejected\n",
      );
    }
  }
}
