/**
 * Repository操作の単体・共有HTTP受付。
 * @packageDocumentation
 * @responsibility Git処置前の入力・認可と処置後の公開、既存の単体表示結果を接続する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary WorkbenchのHTTP受付と既存専門Owner。
 * @effect 明示されたGit操作と操作後の投影読取りを既存Ownerへ一回委譲する。
 * @security 要求前段の資格と現在認可を使用し、新しい保存状態・再送・回復処理を追加しない。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import {
  resolveRepositoryAccessCollection,
  sameAccessCollection,
} from "../../../../access-management/src/index.ts";
import type { FilesystemStoreRoot } from "../../../../domain-model/src/index.ts";
import {
  type VerifiedRepositoryRoot,
  executeChangePublication,
  gitChangePublicationAdapter,
  gitChangePublicationTargetObservationAdapter,
  observeChangePublicationTarget,
} from "../../../../version-control/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import { createStandaloneRepositoryActionRequest } from "../project/repository-action.ts";
import {
  validateRepositoryActionForm,
  inspectRepositoryActionResult,
} from "../../shared/repository/validation.ts";
import {
  readWorkbenchProjectSurface,
  type WorkbenchProjectSurface,
} from "../project/surface.ts";
import type { WorkbenchPresentationState } from "../presentation/types.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

/**
 * 操作後の再観測失敗を、完了済みEffectの失敗へ書き換えず表示用Snapshotへ反映する。
 *
 * @responsibility 直前SnapshotのProject Contextを保持し、Repository部分だけを観測不能へ落とす。
 * @trace ARCH-000012
 * @input surfaceに操作前の最後の完全なWorkbench Snapshotを受け取る。
 * @returns Repository観測だけをunknownにしたSnapshotを返す。
 * @precondition Change Publication結果は別途確定済みである。
 * @postcondition Project Context、TopicおよびMeetingを変更せず、RepositoryをCleanと表示しない。
 * @effect N/A: 不変View Modelを新しく構築するだけである。
 * @failure N/A: 固定fieldの変換だけを行う。
 * @invariant 完了済みEffectのstatusとreasonを変更しない。
 * @boundary Repository Effect結果と操作後Read Model再観測の境界。
 * @security 失敗したPathまたは内部Errorを表示Modelへ含めない。
 * @concurrency 最後に確定したSnapshotだけを基礎にする。
 */
function withUnknownRepositoryObservation(
  surface: WorkbenchProjectSurface,
): WorkbenchProjectSurface {
  return Object.freeze({
    ...surface,
    repository: Object.freeze({
      state: "unknown",
      changeSet: null,
      publicationTarget: null,
      reason: "observation_failed",
    }),
  });
}

/**
 * 当該要求のRepository操作を実行する。
 * @responsibility 共有のfresh認可と単体の現在Tree操作を区別し、公開前再確認と投影更新を維持する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 当該HTTP要求、応答、Signal、検査済みURLとOrigin、既存Ownerと必要な表示状態。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、共有操作の現在認可は本処理で確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect Git処置を既存Version Controlへ一回配送し、必要な表示投影を更新する。
 * @failure 共有は配送前400／配送後503、単体は既存400を維持する。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleRepositoryAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
  localAccessRoot,
  repositoryRoot,
  capability,
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
  capability: VerifiedRepositoryRoot;
  presentation: Pick<
    WorkbenchPresentationState,
    "projectSurface" | "lastActionResult"
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
        throw new Error("workbench_repository_input_invalid");
      const form = await readActionForm(incoming);
      const validated = validateRepositoryActionForm(form, actionToken, true);
      if (!credentialAdministration)
        throw new Error("workbench_repository_access_unavailable");
      await yieldToTransport(0);
      if (requestSignal.aborted || response.destroyed) return;
      const collection = resolveRepositoryAccessCollection(
        credentialAdministration.root,
        credentialAdministration.token,
      );
      if (collection.status !== "completed")
        throw new Error("workbench_repository_access_unavailable");
      const matches = collection.repositories.filter(
        (entry) => entry.repositoryId === validated.repositoryId,
      );
      if (matches.length !== 1)
        throw new Error("workbench_repository_access_unavailable");
      const selected = matches[0];
      if (!selected) throw new Error("workbench_repository_access_unavailable");
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
        throw new Error("workbench_repository_access_unavailable");
      if (validated.request.operation === "publish_revision") {
        const target = observeChangePublicationTarget(
          selected.root,
          gitChangePublicationTargetObservationAdapter,
        );
        if (
          target.status !== "available" ||
          target.destination !== validated.request.destination ||
          target.branch !== validated.request.branch ||
          target.revisionIdentity !== validated.request.revisionIdentity
        )
          throw new Error("workbench_repository_publication_target_changed");
      }
      dispatched = true;
      const result = inspectRepositoryActionResult(
        validated.request,
        executeChangePublication(
          selected.root,
          validated.request,
          gitChangePublicationAdapter,
        ),
      );
      const body = JSON.stringify(result);
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
        throw new Error("workbench_repository_publication_unavailable");
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
            ? "repository_action_outcome_unconfirmed\n"
            : "repository_action_rejected\n",
        );
      }
    }
    return;
  }
  if (presentation.projectSurface === undefined)
    throw new Error("workbench_repository_access_unavailable");
  try {
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    presentation.lastActionResult = executeChangePublication(
      capability,
      createStandaloneRepositoryActionRequest(form),
      gitChangePublicationAdapter,
    );
    try {
      presentation.projectSurface =
        await readWorkbenchProjectSurface(repositoryRoot);
    } catch {
      presentation.projectSurface = withUnknownRepositoryObservation(
        presentation.projectSurface,
      );
    }
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader("Location", "/#repository");
    response.end();
  } catch {
    setResponseHeaders(response);
    response.statusCode = 400;
    response.end("repository_action_rejected\n");
  }
  return;
}
