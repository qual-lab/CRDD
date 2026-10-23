/**
 * Workbenchの起動構成と本番HTTP接続。
 *
 * @packageDocumentation
 * @responsibility 検証済み起動構成から表示・操作のOwnerとHTTP受付を接続し、終了を所有する。
 * @trace ARCH-000005
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000009
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @trace ARCH-000015
 * @trace ARCH-000017
 * @boundary 公開起動APIとloopback HTTP・既存専門Ownerの構成境界。
 * @effect localhost Listenerを開始・終了し、承認済みBrand Assetを読取る。
 * @security 外部Bind、任意Filesystem参照、Force Pushおよび未確認公開を許可せず、Credential管理は検証済み管理Contextの注入時だけ許可する。
 */

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import {
  resolveConnectionAuthentication,
  resolveRepositoryAccess,
} from "../../../access-management/src/index.ts";
import {
  type FilesystemStoreRoot,
  type PortfolioProjection,
  createMeetingOperations,
  createTopicOperations,
} from "../../../domain-model/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  createRepositoryWorkbenchActivityReader,
  type WorkbenchActivityReader,
} from "./activity/observe.ts";
import { readWorkbenchAiSelectionSurface } from "./ai-selection/projection.ts";
import type { WorkbenchAiRequests } from "./ai-request/types.ts";
import { inspectWorkbenchPublicOrigin } from "./connection/configuration.ts";
import type { CredentialAdministration } from "./credential/administration.ts";
import { readWorkbenchProjectSurface } from "./project/surface.ts";
import { setResponseHeaders } from "./security.ts";
import type {
  WorkbenchPresentationState,
  WorkbenchConnectionState,
} from "./presentation/types.ts";
import { createWorkbenchHttpServer } from "./http.ts";
import { createWorkbenchApplication } from "./app.ts";
import {
  handleCredentialAction,
  handleLocalConnectionAction,
} from "./connection.ts";
import { handleManagementRequest } from "./routes/management.ts";
import { handleAiRequestAction, handleSharedAiRequest } from "./routes/ai.ts";
import { handleAiSelection } from "./routes/ai-selection.ts";
import { handleRepositoryAction } from "./routes/repository.ts";
import { handleRecordAction } from "./routes/record.ts";
import { handleRepositoryView } from "./routes/repository-view.ts";
import { handleSharedView } from "./routes/shared-view.ts";
import { handleWorkspaceAction } from "./routes/workspace.ts";
import { readWorkbenchArtifactSelection } from "./presentation/project.ts";

const HOST = "127.0.0.1";
const CONTRACT = "crdd/workbench/v1";
const HEALTH_PATH = "/.well-known/crdd-workbench-health";

export type WorkbenchStartRequest = Readonly<{
  workingDirectory: string;
  publicOrigin?: string;
  port?: number;
  portfolio?: PortfolioProjection;
  credentialAdministration?: CredentialAdministration;
  localAccessRoot?: FilesystemStoreRoot;
  aiRequests?: WorkbenchAiRequests;
  sharedAiRequestsFactory?: (
    root: VerifiedRepositoryRoot,
    projectId: string,
    principalId: string,
    authorize: () => boolean,
  ) => WorkbenchAiRequests;
  activityReader?: WorkbenchActivityReader;
}>;

export type WorkbenchHandle = Readonly<{
  contract: typeof CONTRACT;
  baseUrl: string;
  publicUrl: string;
  healthUrl: string;
  close: () => Promise<void>;
}>;

/**
 * Workbenchのlocalhost Production Shellを開始する。
 *
 * @responsibility 固定表示Route、公式ロゴ、Token付きRepository操作および任意構成のCredential管理だけを127.0.0.1へ公開し、ListenerとConnectionの終了を所有する。
 * @trace ARCH-000012
 * @input requestにRepository内の作業Directoryと任意Portを受け取る。
 * @returns 起動URL、Health URLおよび冪等な終了操作を持つHandleを返す。
 * @precondition workingDirectoryから検証済みRepository Rootを一意に解決できる。
 * @postcondition 成功時はloopback Listenerが一つ存在し、close後は所有Connectionを含めて終了する。
 * @effect localhost Listenerを開始し、公式Logo Assetを読取り、明示操作時だけ当該Repositoryを変更し得る。
 * @failure Root不正、Asset欠落、Bind失敗または観測不能時はErrorとし、未所有資源を残さない。
 * @invariant 任意Path、Directory一覧、Force Push、暗黙再送および未検証ContextからのCredential管理を提供しない。
 * @boundary BrowserとWorkbench Serverの直接境界。
 * @security hostは127.0.0.1固定であり、書込みRouteは起動ごとのTokenと固定Form Schemaを要求する。
 * @concurrency 複数Requestは独立処理し、closeが全所有Connectionを終了する。
 */
export async function startWorkbench(
  request: WorkbenchStartRequest,
): Promise<WorkbenchHandle> {
  const configurationFields = new Set([
    "workingDirectory",
    "publicOrigin",
    "port",
    "portfolio",
    "credentialAdministration",
    "localAccessRoot",
    "aiRequests",
    "sharedAiRequestsFactory",
    "activityReader",
  ]);
  if (Object.keys(request).some((field) => !configurationFields.has(field)))
    throw new Error("workbench_configuration_invalid");
  const publicOrigin = inspectWorkbenchPublicOrigin(request.publicOrigin);
  if (publicOrigin && request.localAccessRoot === undefined)
    throw new Error("workbench_shared_access_required");
  const port = request.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("workbench_port_invalid");
  if (
    request.localAccessRoot !== undefined &&
    (request.credentialAdministration !== undefined ||
      request.portfolio !== undefined ||
      request.aiRequests !== undefined ||
      request.activityReader !== undefined)
  )
    throw new Error("workbench_local_cros_sources_conflicting");
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    request.workingDirectory,
  );
  const logoPath = path.join(
    repositoryRoot,
    "04_UI",
    "assets",
    "brand",
    "crdd-brand-icon-512x512.jpg",
  );
  const logo = await readFile(logoPath).catch(() => null);
  if (logo === null) throw new Error("workbench_official_logo_unavailable");
  const clientAsset = await readFile(
    path.join(
      import.meta.dirname,
      "..",
      "..",
      "dist",
      "client",
      "assets",
      "workbench-client.js",
    ),
  ).catch(() => null);
  if (clientAsset === null)
    throw new Error("workbench_client_asset_unavailable");
  const verification = verifyRepositoryRoot(repositoryRoot);
  if (verification.status !== "completed")
    throw new Error("workbench_repository_root_invalid");
  const initialProjectSurface =
    request.localAccessRoot === undefined
      ? await readWorkbenchProjectSurface(repositoryRoot)
      : undefined;
  const presentation: WorkbenchPresentationState = {
    runtimeActivityObservation: undefined,
    projectSurface: initialProjectSurface,
    aiSelection: readWorkbenchAiSelectionSurface(verification.capability),
    lastActionResult: null,
    topicMeetingResult: null,
    currentAiRequestId: null,
    aiRequestSnapshot: null,
    aiRequestNotice: null,
    aiSelectionManagementResult: null,
  };
  const aiRequests = request.aiRequests;
  const sharedAiSessions = new Map<
    string,
    { owner: WorkbenchAiRequests; currentId: string | null }
  >();
  /**
   * 現在認可した接続主体とRepositoryへ単発Ownerを結合する。
   * @responsibility 共有の表示IDをProcess全体の一変数へ混在させない。
   * @trace ARCH-000015
   * @input 現在の管理接続、Repository IDと新規構成の有無。
   * @returns 当該接続の既存Owner、又は未開示のnull。
   * @precondition TokenはHTTP要求から得た非永続値。
   * @postcondition 待機後もOwnerが現在認可を照合する。
   * @effect 初回明示開始だけ既存Task Ownerを構成する。
   * @failure 認可・Root・容量不明は拒否する。
   * @invariant 新保存先・Registry・MCP依存を追加しない。
   * @boundary AMと共有Workbenchの現在Session。
   * @security 資格・Root・Map Keyを応答へ返さない。
   * @concurrency 異なる資格とRepositoryの要求を分離する。
   */
  const sharedAiSession = (
    connection: CredentialAdministration | undefined,
    repositoryId: string,
    create: boolean,
  ) => {
    if (!connection || !request.sharedAiRequestsFactory) return null;
    const auth = resolveConnectionAuthentication(
      connection.root,
      connection.token,
    );
    const selected = resolveRepositoryAccess(
      connection.root,
      connection.token,
      repositoryId,
      "development",
    );
    if (auth.status !== "normal" || selected.status !== "completed")
      return null;
    const key = `${auth.snapshot.credentialId}:${repositoryId}`;
    const current = sharedAiSessions.get(key);
    if (current) return current;
    if (!create || sharedAiSessions.size >= 100) return null;
    const original = selected.access;
    const root = resolveVerifiedRepositoryRoot(original.root);
    const authorize = () => {
      const now = resolveConnectionAuthentication(
        connection.root,
        connection.token,
      );
      const access = resolveRepositoryAccess(
        connection.root,
        connection.token,
        repositoryId,
        "development",
      );
      return (
        now.status === "normal" &&
        now.snapshot.userId === auth.snapshot.userId &&
        now.snapshot.credentialId === auth.snapshot.credentialId &&
        access.status === "completed" &&
        access.access.bindingId === original.bindingId &&
        access.access.manifest.projectId === original.manifest.projectId &&
        resolveVerifiedRepositoryRoot(access.access.root) === root
      );
    };
    const session = {
      owner: request.sharedAiRequestsFactory(
        original.root,
        original.manifest.projectId,
        auth.snapshot.userId,
        authorize,
      ),
      currentId: null as string | null,
    };
    sharedAiSessions.set(key, session);
    return session;
  };
  const activityReader =
    request.activityReader ??
    (request.localAccessRoot === undefined &&
    presentation.projectSurface !== undefined
      ? createRepositoryWorkbenchActivityReader(
          repositoryRoot,
          presentation.projectSurface.context,
        )
      : undefined);
  const topicMeeting =
    request.localAccessRoot === undefined
      ? Object.freeze({
          topic: createTopicOperations(repositoryRoot),
          meeting: createMeetingOperations(repositoryRoot),
        })
      : undefined;
  const portfolio = request.portfolio;
  const connectionState: WorkbenchConnectionState =
    portfolio === undefined ? "repository" : "cros_available";
  const actionToken = randomBytes(32).toString("base64url");
  const transport = createWorkbenchHttpServer();
  const server = transport.server;
  /**
   * 個別Routeより先に既存の要求前段を実行する。
   * @responsibility Artifact入力・資格抽出・接続確認・通常認証・共有AI／GET・共有操作経路の順序を保持する。
   * @trace ARCH-000012
   * @input 当該要求・応答とHTTP Ownerの要求専用Signal。
   * @returns 個別処理へ継続する局所入力、または処理済みを表すundefined。
   * @precondition Applicationが公開Originと同じURL解釈を確認済みである。
   * @postcondition 処理済み要求を後続へ渡さず、別要求の資格・Rootを再利用しない。
   * @effect 当該要求の接続確認、認可観測、共有GET・明示共有AI操作が発生し得る。
   * @failure 現行の固定拒否または取消を維持し、未確認を成功へ補完しない。
   * @invariant 接続専用操作を通常認証の後ろへ移動しない。
   * @boundary Applicationの要求前段と個別Route。
   * @security Body・Owner操作の前に用途別入力と現在認可を確認する。
   * @concurrency 前段の待機も同じ要求Promiseに含め、共有GET等の結果公開前に取消・現在認可を再確認する。
   */
  const prepareRequest = async (
    incoming: IncomingMessage,
    response: ServerResponse,
    requestSignal: AbortSignal,
  ) => {
    const method = incoming.method ?? "";
    const requestUrl = new URL(incoming.url ?? "/", `http://${HOST}`);
    const requestPath = requestUrl.pathname;
    let artifactSelection: ReturnType<typeof readWorkbenchArtifactSelection> =
      null;
    if (
      requestPath === "/api/workbench-view" &&
      (method === "GET" || method === "HEAD")
    ) {
      try {
        artifactSelection = readWorkbenchArtifactSelection(
          requestUrl.searchParams,
          request.localAccessRoot !== undefined,
        );
      } catch {
        setResponseHeaders(response);
        response.statusCode = 400;
        response.end("artifact_input_invalid\n");
        return;
      }
    }
    if (
      request.localAccessRoot !== undefined &&
      requestPath === "/api/workbench-view" &&
      requestUrl.searchParams.getAll("repositoryId").length > 1
    ) {
      setResponseHeaders(response);
      response.statusCode = 403;
      response.end("local_repository_access_unavailable\n");
      return;
    }
    let credentialAdministration = request.credentialAdministration;
    let localConnectionNotice: string | null = null;
    if (request.localAccessRoot !== undefined) {
      const authorization = incoming.headers.authorization;
      const authorizationCount = incoming.rawHeaders.filter(
        (_, index) =>
          index % 2 === 0 &&
          incoming.rawHeaders[index]?.toLowerCase() === "authorization",
      ).length;
      credentialAdministration =
        authorizationCount === 1 &&
        typeof authorization === "string" &&
        /^Bearer [^\s]{1,4096}$/u.test(authorization)
          ? Object.freeze({
              root: request.localAccessRoot,
              token: authorization.slice(7),
            })
          : undefined;
      if (method === "POST" && requestPath === "/local-connection/action") {
        const address = server.address();
        await handleLocalConnectionAction({
          incoming,
          response,
          requestSignal,
          requestUrl,
          origin:
            publicOrigin?.origin ??
            (address && typeof address !== "string"
              ? `http://${HOST}:${address.port}`
              : null),
          actionToken,
          localAccessRoot: request.localAccessRoot,
        });
        return;
      }
      if (
        credentialAdministration !== undefined &&
        resolveConnectionAuthentication(
          credentialAdministration.root,
          credentialAdministration.token,
        ).status !== "normal"
      ) {
        credentialAdministration = undefined;
        localConnectionNotice =
          "現在の接続を確認できません。接続用の鍵を確認してください。";
      }
      if (method === "POST" && requestPath === "/ai-request/action") {
        const address = server.address();
        await handleSharedAiRequest({
          incoming,
          response,
          requestUrl,
          origin:
            publicOrigin?.origin ??
            (address && typeof address !== "string"
              ? `http://${HOST}:${address.port}`
              : null),
          actionToken,
          credentialAdministration,
          sharedAiSession,
        });
        return;
      }
      if (method === "GET" || method === "HEAD") {
        if (
          await handleSharedView({
            response,
            requestSignal,
            method,
            requestUrl,
            requestPath,
            artifactSelection,
            credentialAdministration,
            localConnectionNotice,
            actionToken,
            configuration: request,
            sharedAiSession,
            logo,
            clientAsset,
            contract: CONTRACT,
            host: HOST,
            healthPath: HEALTH_PATH,
          })
        )
          return;
      }
      const sharedActionRoute =
        (method === "POST" && requestPath === "/topic-meeting/action") ||
        (method === "POST" && requestPath === "/ai-selection/action") ||
        ((method === "GET" || method === "HEAD") &&
          requestPath === "/api/ai-selection") ||
        (method === "POST" && requestPath === "/repository/action") ||
        (method === "POST" && requestPath === "/workspace/action") ||
        (method === "GET" && requestPath === "/api/access-management") ||
        (method === "POST" &&
          (requestPath === "/access-management/action" ||
            requestPath === "/connection-credentials/action"));
      if (!sharedActionRoute) {
        setResponseHeaders(response);
        response.statusCode = 403;
        response.end("local_repository_access_unavailable\n");
        return;
      }
    }
    const address = server.address();
    if (
      (method === "GET" || method === "HEAD") &&
      requestPath === "/api/ai-selection"
    ) {
      await handleAiSelection({
        incoming,
        response,
        requestSignal,
        requestUrl,
        origin:
          publicOrigin?.origin ??
          (address && typeof address !== "string"
            ? `http://${HOST}:${address.port}`
            : null),
        actionToken,
        capability: verification.capability,
        localAccessRoot: request.localAccessRoot,
        credentialAdministration,
      });
      return;
    }
    return {
      incoming,
      response,
      requestSignal,
      method,
      requestUrl,
      requestPath,
      artifactSelection,
      credentialAdministration,
      actionToken,
      repositoryRoot,
      localAccessRoot: request.localAccessRoot,
      origin:
        publicOrigin?.origin ??
        (address && typeof address !== "string"
          ? `http://${HOST}:${address.port}`
          : null),
    };
  };
  /**
   * 個別操作へ継続する当該要求の入力。
   * @responsibility 前段で処理済みの要求と、個別Routeへ渡す入力を区別する。
   * @trace ARCH-000012
   * @shape 要求・応答・Signal、URLと入力選択、当該要求の資格・検証済みRoot・Action Token。
   * @invariant 要求終了後に保存せず、別要求の認可根拠へ転用しない。
   * @boundary 要求前段と個別HTTP操作。
   * @security Server内の一時値であり、Wire・Browser・Cacheへ公開しない。
   * @compatibility 既存Handler内の局所値をまとめるだけで、通信・保存契約を変更しない。
   */
  type PreparedRequest = NonNullable<
    Awaited<ReturnType<typeof prepareRequest>>
  >;
  /**
   * 既存の起動Ownerと当該要求を単体表示受付へ接続する。
   * @responsibility 起動済みの同じOwner・設定・表示状態を渡し、入力や状態を複製しない。
   * @trace ARCH-000012
   * @input 共通前段を終えた当該要求。
   * @returns 表示受付の終了を待つPromise。
   * @precondition HTTP Ownerが同じ要求の取消と終了を追跡している。
   * @postcondition 受付が既存表示値を同じ参照から読む。
   * @effect 既存表示受付を一回呼ぶ。
   * @failure 既存受付の例外を外側HTTP Ownerへ伝播する。
   * @invariant Owner・Session・設定を新設せず、Root公開APIを増やさない。
   * @boundary 起動Compositionと単体表示受付。
   * @security 資格・認可を新しい共有状態へ保存しない。
   * @concurrency 同じ要求Promiseで表示受付の終了を待つ。
   */
  const handleRepositoryViewRequest = (context: PreparedRequest) =>
    handleRepositoryView({
      ...context,
      capability: verification.capability,
      topicMeeting,
      portfolio,
      connectionState,
      presentation,
      aiRequests,
      activityReader,
      configuration: request,
      logo,
      clientAsset,
      contract: CONTRACT,
      host: HOST,
      healthPath: HEALTH_PATH,
    });
  /**
   * 表示・観測・通知消費と静的配信、未知入力の固定処置を実行する。
   * @responsibility 移管済み操作を二重実行せず、表示・観測・通知消費と固定拒否を維持する。
   * @trace ARCH-000012
   * @input 当該要求の前段を完了した入力Context。
   * @returns 表示・観測と応答の終了を待つPromise。
   * @precondition 接続専用操作・共有GET等で応答済みの場合は呼ばれない。
   * @postcondition 現行の表示・観測と未知Method／Pathの拒否を保持する。
   * @effect 表示用Readerと既存AI Ownerの観測、GET通知の消費、HTTP応答が発生し得る。
   * @failure 表示・観測の既存拒否を維持し、外側が予期しない例外を固定500へ変換する。
   * @invariant fallbackの存在をRoute移行完了とは表示しない。
   * @boundary Workbench受付と表示GET／HEAD・静的配信・固定拒否。
   * @security 前段の当該要求資格だけを使用し、起動Rootへ暗黙に権限を補完しない。
   * @concurrency 同じ要求SignalとOwner joinを継続し、遅延応答を現在の成功へ変換しない。
   */
  const handleFallback = async (context: PreparedRequest): Promise<void> => {
    const { response, method, requestPath } = context;
    if (method === "POST" && requestPath === "/candidate/action") {
      setResponseHeaders(response);
      response.statusCode = 410;
      response.end("legacy_bundle_candidate_route_removed\n");
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      setResponseHeaders(response);
      response.statusCode = 405;
      response.setHeader("Allow", "GET, HEAD");
      response.end(method === "HEAD" ? undefined : "method_not_allowed\n");
      return;
    }
    await handleRepositoryViewRequest(context);
  };
  /**
   * 共通前段と個別操作を一つのHTTP lifecycleへ接続する。
   * @responsibility 前段が応答済みなら終了し、継続時だけ選択したHandlerを一回呼ぶ。
   * @trace ARCH-000012
   * @input 当該要求の局所入力を処理する非同期Handler。
   * @returns HTTP Ownerの取消・joinに接続済みの要求Listener。
   * @precondition Handlerは操作処理の終了を同じPromiseで待つ。
   * @postcondition 前段と個別処理の待機を一回だけ追跡し、二重応答・二重配送を起こさない。
   * @effect 当該要求の前段と選択操作を実行するListenerを生成する。
   * @failure 前段・操作の拒否を維持し、予期しない例外はHTTP Ownerへ伝播する。
   * @invariant 前段の資格Contextを次要求や永続状態へ保持しない。
   * @boundary Express RouteとWorkbench要求前段・操作。
   * @security 現在認可を通らない個別操作の接続を作らない。
   * @concurrency 同じ要求Controller・Promiseを使い、取消後のOwner終了を待つ。
   */
  const bindRequest = (handler: (context: PreparedRequest) => Promise<void>) =>
    transport.handleRequest(async (incoming, response, requestSignal) => {
      const prepared = await prepareRequest(incoming, response, requestSignal);
      if (
        prepared !== undefined &&
        !requestSignal.aborted &&
        !response.destroyed
      ) {
        await handler(prepared);
      }
    });
  const app = createWorkbenchApplication(
    {
      workspace: bindRequest(handleWorkspaceAction),
      view: bindRequest(handleRepositoryViewRequest),
      aiSelection: bindRequest((context) =>
        handleAiSelection({
          ...context,
          capability: verification.capability,
        }),
      ),
      aiRequest: bindRequest((context) =>
        handleAiRequestAction({ ...context, aiRequests, presentation }),
      ),
      repository: bindRequest((context) =>
        handleRepositoryAction({
          ...context,
          capability: verification.capability,
          presentation,
        }),
      ),
      record: bindRequest((context) =>
        handleRecordAction({ ...context, topicMeeting, presentation }),
      ),
      management: bindRequest(handleManagementRequest),
      credentials: bindRequest(handleCredentialAction),
      fallback: bindRequest(handleFallback),
    },
    publicOrigin,
  );
  server.on("request", app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("workbench_address_unavailable");
  }
  const baseUrl = `http://${HOST}:${address.port}`;
  let closeOperation: Promise<void> | null = null;
  return Object.freeze({
    contract: CONTRACT,
    baseUrl,
    publicUrl: publicOrigin?.origin ?? baseUrl,
    healthUrl: `${baseUrl}${HEALTH_PATH}`,
    close: () => {
      if (closeOperation) return closeOperation;
      closeOperation = (async () => {
        let primaryFailure: unknown = null;
        try {
          await transport.close();
        } catch (error) {
          primaryFailure = error;
        }
        const ownersClosed = await Promise.allSettled([
          aiRequests?.close?.(),
          ...[...sharedAiSessions.values()].map((session) =>
            session.owner.close?.(),
          ),
        ]);
        sharedAiSessions.clear();
        if (primaryFailure !== null) throw primaryFailure;
        if (ownersClosed.some((result) => result.status === "rejected"))
          throw new Error("workbench_ai_close_unconfirmed");
      })();
      return closeOperation;
    },
  });
}
