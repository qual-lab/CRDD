/**
 * CROS Portfolio ProjectionのBearer HTTP Transport。
 *
 * @packageDocumentation
 * @responsibility Requestごとに現在Credentialを検証し、許可RepositoryだけからPortfolio Projectionを返す。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @boundary Remote ClientとCROS FederationのHTTP境界。
 * @effect loopback Listenerを開始・終了し、Repository内容は変更しない。
 * @security Bearer Tokenを保存・応答・log出力せず、認証失敗ではCredentialの存在を開示しない。
 */
import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";

import {
  validateAiProfileCatalog,
  type AiProfileCatalog,
  type AiProfileCatalogAdministration,
  type AiProfileCatalogMutation,
  type AiProfileCatalogMutationResult,
  type AiProfileCatalogSnapshot,
  type AiProfileDefinition,
} from "../../../ai-adapter/src/index.ts";
import { inspectOrchestratorProjection } from "../../../orchestrator/src/index.ts";
import type { CrosExposureSnapshot } from "../access/types.ts";
import type {
  CrosRemoteRuntimeActivityObservation,
  CrosRemoteRuntimeEventProjection,
  CrosRuntimeActivityReader,
} from "../activity/types.ts";

import {
  authenticateConnectionCredential,
  type ConnectionCredentialRegistry,
} from "../access/credential.ts";
import {
  createPortfolioProjection,
  type PortfolioProjection,
  resolveAuthorizedRepositories,
} from "../federation/project.ts";
import { createCrosSession } from "../access/session-context.ts";

const HOST = "127.0.0.1";
const PORTFOLIO_PATH = "/v1/portfolio";
const AI_PROFILES_PATH = "/v1/ai-profiles";
const RUNTIME_ACTIVITY_PATH =
  /^\/v1\/projects\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})\/runtime-activity$/u;
const HEALTH_PATH = "/.well-known/cros-health";

/**
 * CROS Remote Transportの認証・公開境界で使用するCrosRemoteTransportHandleの構造を固定する。
 *
 * @responsibility CROS Remote Transportの認証・公開境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000005
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CrosRemoteTransportHandle = Readonly<{
  baseUrl: string;
  close(): Promise<void>;
}>;

/**
 * Bearer認証付きのCROS Portfolio HTTP入口を開始する。
 *
 * @responsibility Credential RegistryとExposure Snapshotを別revisionとして検証し、許可済みProjectionだけを配信する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input registry、Exposure Snapshot Readerおよび任意Portを受け取る。
 * @returns loopback URLと冪等closeを持つHandleを返す。
 * @precondition Snapshot ReaderはExposureとRepositoryを同じ観測単位で返す。
 * @postcondition 成功時だけloopback Listenerが存在し、close後は全所有Connectionが終了する。
 * @effect Listenerを開始し、GETごとにRegistryとProjection Sourceを読取る。
 * @failure Bind、認証、Snapshot取得またはFederation失敗を秘密値なしのHTTP結果へ閉じる。
 * @invariant Credential Registry revisionとExposure Registry revisionを同一視しない。
 * @boundary Bearer HTTP→Credential Verifier→Workspace Exposure→Portfolio Projection。
 * @security 平文HTTPはloopbackに限定し、外部公開にはTLS終端または安全なTunnelを別途要求する。
 * @concurrency Requestごとに一つのCredential Snapshotと一つのExposure Snapshotを使用する。
 */
export async function startCrosRemoteTransport(input: {
  registry: ConnectionCredentialRegistry;
  readExposureSnapshot(): CrosExposureSnapshot;
  aiProfileAdministration?: AiProfileCatalogAdministration;
  runtimeActivityReader?: CrosRuntimeActivityReader;
  port?: number;
}): Promise<CrosRemoteTransportHandle> {
  const port = input.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("cros_remote_transport_port_invalid");
  const connections = new Set<Socket>();
  const server = createServer((request, response) => {
    void (async () => {
      setHeaders(response);
      const method = request.method ?? "";
      const requestPath = request.url?.split("?", 1)[0] ?? "";
      if (method !== "GET" && method !== "HEAD" && method !== "POST") {
        response.statusCode = 405;
        response.setHeader("Allow", "GET, HEAD, POST");
        response.end(method === "HEAD" ? undefined : "method_not_allowed\n");
        return;
      }
      if (requestPath === HEALTH_PATH) {
        if (method === "POST") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET, HEAD");
          response.end("method_not_allowed\n");
          return;
        }
        sendJson(response, method, 200, {
          contract: "cros/remote-transport/v1",
          status: "ready",
          host: HOST,
        });
        return;
      }
      const runtimeActivityMatch = RUNTIME_ACTIVITY_PATH.exec(requestPath);
      if (
        requestPath !== PORTFOLIO_PATH &&
        requestPath !== AI_PROFILES_PATH &&
        runtimeActivityMatch === null
      ) {
        response.statusCode = 404;
        response.end(method === "HEAD" ? undefined : "not_found\n");
        return;
      }
      const authorization = request.headers.authorization ?? "";
      const token = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length)
        : "";
      const authentication = authenticateConnectionCredential(
        input.registry,
        token,
      );
      if (authentication.status !== "available") {
        response.setHeader("WWW-Authenticate", 'Bearer realm="cros"');
        sendJson(response, method, 401, {
          contract: "cros/remote-transport/v1",
          status: "blocked",
          reason: "cros_remote_authentication_required",
        });
        return;
      }
      if (requestPath === AI_PROFILES_PATH) {
        if (
          input.aiProfileAdministration === undefined ||
          !authentication.access.systemAdmin
        ) {
          sendJson(response, method, 403, {
            contract: "cros/remote-transport/v1",
            status: "blocked",
            reason: "cros_system_administration_required",
          });
          return;
        }
        if (method === "GET" || method === "HEAD") {
          sendJson(response, method, 200, {
            contract: "cros/remote-transport/v1",
            status: "available",
            snapshot: input.aiProfileAdministration.snapshot(),
          });
          return;
        }
        const mutation = await readAiProfileMutation(request);
        const result = input.aiProfileAdministration.execute(mutation);
        sendJson(response, method, 200, {
          contract: "cros/remote-transport/v1",
          status: result.status,
          reason: result.reason,
          snapshot: result.snapshot,
        });
        return;
      }
      if (runtimeActivityMatch !== null) {
        if (method === "POST") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET, HEAD");
          response.end("method_not_allowed\n");
          return;
        }
        const snapshot = input.readExposureSnapshot();
        if (!snapshot.revision)
          throw new Error("cros_exposure_snapshot_revision_invalid");
        const session = createCrosSession(
          randomBytes(16).toString("hex"),
          {
            credentialId: authentication.access.credentialId,
            workspaceIds: authentication.access.workspaceIds,
            systemAdmin: authentication.access.systemAdmin,
            revoked: false,
          },
          snapshot.revision,
        );
        if (session === null)
          throw new Error("cros_remote_session_creation_failed");
        const projectId = runtimeActivityMatch[1] ?? "";
        const repositories = resolveAuthorizedRepositories(
          session,
          snapshot.exposures,
          snapshot.repositories,
        ).filter((repository) => repository.projectId === projectId);
        if (repositories.length === 0) {
          sendJson(response, method, 404, {
            contract: "cros/remote-transport/v1",
            status: "blocked",
            reason: "cros_runtime_activity_unavailable",
          });
          return;
        }
        if (input.runtimeActivityReader === undefined) {
          sendJson(response, method, 503, {
            contract: "cros/remote-transport/v1",
            status: "blocked",
            reason: "cros_runtime_activity_reader_unavailable",
          });
          return;
        }
        const requestUrl = new URL(
          request.url ?? requestPath,
          `http://${HOST}`,
        );
        const cursor = requestUrl.searchParams.get("cursor");
        const limitText = requestUrl.searchParams.get("limit");
        const limit = limitText === null ? 20 : Number(limitText);
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
          sendJson(response, method, 400, {
            contract: "cros/remote-transport/v1",
            status: "blocked",
            reason: "cros_runtime_activity_page_invalid",
          });
          return;
        }
        const observation = await input.runtimeActivityReader.read({
          projectId,
          repositories,
          ...(cursor === null ? {} : { cursor }),
          limit,
        });
        if (!inspectRemoteRuntimeActivityObservation(observation))
          throw new Error("cros_runtime_activity_observation_invalid");
        sendJson(response, method, 200, {
          contract: "cros/remote-transport/v1",
          status: "available",
          observation,
        });
        return;
      }
      if (method === "POST") {
        response.statusCode = 405;
        response.setHeader("Allow", "GET, HEAD");
        response.end("method_not_allowed\n");
        return;
      }
      const snapshot = input.readExposureSnapshot();
      if (!snapshot.revision)
        throw new Error("cros_exposure_snapshot_revision_invalid");
      const session = createCrosSession(
        randomBytes(16).toString("hex"),
        {
          credentialId: authentication.access.credentialId,
          workspaceIds: authentication.access.workspaceIds,
          systemAdmin: authentication.access.systemAdmin,
          revoked: false,
        },
        snapshot.revision,
      );
      if (session === null)
        throw new Error("cros_remote_session_creation_failed");
      const portfolio = createPortfolioProjection(
        resolveAuthorizedRepositories(
          session,
          snapshot.exposures,
          snapshot.repositories,
        ),
      );
      sendJson(response, method, 200, {
        contract: "cros/remote-transport/v1",
        status: "available",
        portfolio,
      });
    })().catch(() => {
      if (!response.headersSent) setHeaders(response);
      response.statusCode = 503;
      response.end("cros_remote_transport_unavailable\n");
    });
  });
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });
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
    throw new Error("cros_remote_transport_address_invalid");
  }
  let closed = false;
  return Object.freeze({
    baseUrl: `http://${HOST}:${address.port}`,
    close: async () => {
      if (closed) return;
      closed = true;
      for (const socket of connections) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  });
}

/**
 * Remote Runtime Activity観測の閉じた構造を検証する。
 *
 * @responsibility Application ReaderまたはHTTP Responseの未信頼値を公開契約へ入る前に検証する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @input valueに観測候補を受け取る。
 * @returns 契約へ適合する場合trueを返す。
 * @precondition valueを信頼済み型と仮定しない。
 * @postcondition Property、状態相関、Event上限およびContinuationを検査する。
 * @effect N/A: 値を観測するだけである。
 * @failure 不正値はfalseで拒否する。
 * @invariant observedとprojectionの相関を崩さない。
 * @boundary Runtime Activity Reader／HTTP JSONとCROS公開契約の境界。
 * @security 余剰Propertyを受理して秘密値を透過しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectRemoteRuntimeActivityObservation(
  value: unknown,
): value is CrosRemoteRuntimeActivityObservation {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !==
    JSON.stringify(
      [
        "state",
        "reason",
        "projection",
        "eventState",
        "eventReason",
        "events",
        "eventContinuation",
      ].sort(),
    )
  )
    return false;
  if (
    !["observed", "absent", "unknown"].includes(String(record.state)) ||
    typeof record.reason !== "string" ||
    record.reason.length === 0 ||
    !["observed", "unknown"].includes(String(record.eventState)) ||
    typeof record.eventReason !== "string" ||
    record.eventReason.length === 0 ||
    !Array.isArray(record.events) ||
    record.events.length > 50 ||
    (record.eventContinuation !== null &&
      typeof record.eventContinuation !== "string")
  )
    return false;
  const projection = inspectOrchestratorProjection(record.projection);
  if ((record.state === "observed") !== (projection !== null)) return false;
  if (record.eventState === "unknown" && record.events.length !== 0)
    return false;
  return record.events.every(inspectRemoteRuntimeEventProjection);
}

/**
 * Remote Runtime Event要約を検証する。
 *
 * @responsibility Event要約のProperty、Identity、時刻、状態および真偽値を閉じたSchemaで検査する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @input valueにEvent要約候補を受け取る。
 * @returns 契約へ適合する場合trueを返す。
 * @precondition valueを信頼済みObjectと仮定しない。
 * @postcondition 余剰Propertyのない安全なEvent要約だけを受理する。
 * @effect N/A: 値を観測するだけである。
 * @failure 不正値はfalseで拒否する。
 * @invariant Event時刻と結果を補正しない。
 * @boundary Remote JSONとCROS Event投影の境界。
 * @security 任意Objectまたは生Provider情報を透過しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectRemoteRuntimeEventProjection(
  value: unknown,
): value is CrosRemoteRuntimeEventProjection {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  const expectedKeys = [
    "eventId",
    "occurredAt",
    "objectiveId",
    "taskId",
    "attemptId",
    "status",
    "reason",
    "cleanupConfirmed",
    "manualRecoveryRequired",
  ].sort();
  return (
    JSON.stringify(Object.keys(record).sort()) ===
      JSON.stringify(expectedKeys) &&
    typeof record.eventId === "string" &&
    /^execution-[0-9a-f]{64}$/u.test(record.eventId) &&
    typeof record.occurredAt === "string" &&
    Number.isFinite(Date.parse(record.occurredAt)) &&
    ["objectiveId", "taskId", "attemptId"].every(
      (key) =>
        typeof record[key] === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(record[key] as string),
    ) &&
    ["completed", "blocked", "cancelled", "unknown"].includes(
      String(record.status),
    ) &&
    typeof record.reason === "string" &&
    record.reason.length > 0 &&
    typeof record.cleanupConfirmed === "boolean" &&
    typeof record.manualRecoveryRequired === "boolean"
  );
}

/**
 * Remote管理Requestから閉じたAI Profile Mutationを読取る。
 *
 * @responsibility Body上限、JSON構造、操作別Propertyおよび削除確認をEffect前に検証する。
 * @trace ARCH-000010
 * @trace ARCH-000013
 * @input request: 認証済みsystemAdminのHTTP Request。
 * @returns Profile限定管理Applicationへ渡すMutation。
 * @precondition AuthorizationとsystemAdminは呼出し側で確認済みである。
 * @postcondition 許可した操作とPropertyだけを持つMutationを返す。
 * @effect Request Bodyを最大16KiB読取る。
 * @failure 上限超過、不正JSON、未知Propertyまたは不正型を例外で拒否する。
 * @invariant Adapter、Credential、Pathまたは任意実行引数の操作を生成しない。
 * @boundary Remote JSONとAI Profile管理Applicationの境界。
 * @security 未知Propertyを無視せず、秘密値を応答へ追加しない。
 * @concurrency RequestごとのBodyだけを読取る。
 */
async function readAiProfileMutation(
  request: IncomingMessage,
): Promise<AiProfileCatalogMutation> {
  if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json")
    throw new Error("cros_ai_profile_content_type_invalid");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 16 * 1_024) throw new Error("cros_ai_profile_body_too_large");
    chunks.push(buffer);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("cros_ai_profile_mutation_invalid");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    record.operation === "delete" &&
    JSON.stringify(keys) ===
      JSON.stringify(
        ["confirmed", "expectedRevision", "operation", "profileId"].sort(),
      ) &&
    Number.isInteger(record.expectedRevision) &&
    typeof record.profileId === "string" &&
    typeof record.confirmed === "boolean"
  )
    return Object.freeze({
      operation: "delete",
      expectedRevision: record.expectedRevision as number,
      profileId: record.profileId,
      confirmed: record.confirmed,
    });
  if (
    (record.operation === "create" || record.operation === "update") &&
    JSON.stringify(keys) ===
      JSON.stringify(["expectedRevision", "operation", "profile"].sort()) &&
    Number.isInteger(record.expectedRevision) &&
    typeof record.profile === "object" &&
    record.profile !== null
  )
    return Object.freeze({
      operation: record.operation,
      expectedRevision: record.expectedRevision as number,
      profile: record.profile as AiProfileDefinition,
    });
  throw new Error("cros_ai_profile_mutation_invalid");
}

/**
 * Remote CROSから許可済みPortfolio Projectionを取得する。
 *
 * @responsibility Workbench等のConsumerへBearer認証済みPortfolioだけを返す。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input baseUrl、Bearer Tokenおよび任意AbortSignalを受け取る。
 * @returns 検証済みPortfolio Projectionを返す。
 * @precondition 外部HostではHTTPSを使用し、HTTPはloopback URLだけに限定する。
 * @postcondition Tokenを返値、Error文または永続状態へ含めない。
 * @effect HTTP GETを一回発行する。
 * @failure 不正URL、非TLS外部URL、非200、契約不一致または不正Portfolioを例外で拒否する。
 * @invariant Response外のProject、RepositoryまたはWorkspaceを補完しない。
 * @boundary Workbench／MCP Consumer→Remote CROS HTTP。
 * @security Authorization Header以外へTokenを複製せず、redirectを拒否する。
 * @concurrency 呼出しごとに独立したRequestを一回だけ発行する。
 */
export async function readRemotePortfolio(
  baseUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<PortfolioProjection> {
  const url = new URL(PORTFOLIO_PATH, requireSafeBaseUrl(baseUrl));
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    redirect: "error",
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) throw new Error("cros_remote_portfolio_unavailable");
  const value: unknown = await response.json();
  if (!isPortfolioResponse(value))
    throw new Error("cros_remote_portfolio_contract_invalid");
  return Object.freeze({
    projects: Object.freeze(value.portfolio.projects),
    retainedAsSourceOfTruth: false,
  });
}

/**
 * Remote CROSから許可済みOrchestrator Activityを取得する。
 *
 * @responsibility Workbench等のConsumerへBearer認証済みの現在状態とEvent Pageだけを返す。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @input baseUrl、Bearer Token、Project ID、任意Cursor／limit／AbortSignalを受け取る。
 * @returns 検証済みCrosRemoteRuntimeActivityObservationを返す。
 * @precondition 外部HostではHTTPSを使用し、HTTPはloopback URLだけに限定する。
 * @postcondition Token、Grant外RepositoryまたはPathを返値とErrorへ含めない。
 * @effect HTTP GETを一回発行する。
 * @failure 非200、契約不一致、不正Project IDまたは不正観測を例外で拒否する。
 * @invariant Response外のRuntime状態やEventを補完しない。
 * @boundary Workbench Consumer→Remote CROS Runtime Activity HTTP。
 * @security TokenをAuthorization Header以外へ複製せずredirectを拒否する。
 * @concurrency 呼出しごとに一つの現在Snapshot Pageだけを取得する。
 */
export async function readRemoteRuntimeActivity(
  baseUrl: string,
  token: string,
  projectId: string,
  page: Readonly<{ cursor?: string; limit?: number }> = {},
  signal?: AbortSignal,
): Promise<CrosRemoteRuntimeActivityObservation> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(projectId))
    throw new Error("cros_remote_runtime_activity_project_id_invalid");
  const limit = page.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error("cros_remote_runtime_activity_limit_invalid");
  const url = new URL(
    `/v1/projects/${encodeURIComponent(projectId)}/runtime-activity`,
    requireSafeBaseUrl(baseUrl),
  );
  url.searchParams.set("limit", String(limit));
  if (page.cursor !== undefined) url.searchParams.set("cursor", page.cursor);
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    redirect: "error",
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) throw new Error("cros_remote_runtime_activity_unavailable");
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).contract !==
      "cros/remote-transport/v1" ||
    (value as Record<string, unknown>).status !== "available" ||
    !inspectRemoteRuntimeActivityObservation(
      (value as Record<string, unknown>).observation,
    )
  )
    throw new Error("cros_remote_runtime_activity_contract_invalid");
  return (
    value as Readonly<{ observation: CrosRemoteRuntimeActivityObservation }>
  ).observation;
}

/**
 * Remote CROSからsystemAdminに許可されたAI Profile Catalogを取得する。
 *
 * @responsibility Remote管理入口の未信頼Responseを閉じたCatalog Snapshotへ変換する。
 * @trace ARCH-000010
 * @trace ARCH-000013
 * @input baseUrl、Bearer Tokenおよび任意AbortSignalを受け取る。
 * @returns 検証済みCROS Owner Catalog Snapshotを返す。
 * @precondition 外部HostではHTTPSを使用し、HTTPはloopback URLだけに限定する。
 * @postcondition 非管理Credentialの403をCatalog不在へ変換しない。
 * @effect HTTP GETを一回発行する。
 * @failure 非200、契約不一致または不正Catalogを例外で拒否する。
 * @invariant Repository OwnerのCatalogを補完または混合しない。
 * @boundary Workbench管理Consumer→Remote CROS AI Profile管理HTTP。
 * @security TokenをAuthorization Header以外へ複製せずredirectを拒否する。
 * @concurrency 呼出しごとに独立した現在Snapshotを取得する。
 */
export async function readRemoteAiProfileCatalog(
  baseUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<AiProfileCatalogSnapshot> {
  const value = await requestRemoteAiProfileAdministration(
    baseUrl,
    token,
    undefined,
    signal,
  );
  if (value.status !== "available")
    throw new Error("cros_remote_ai_profile_catalog_contract_invalid");
  return value.snapshot;
}

/**
 * Remote CROSのsystemAdmin管理境界へ閉じたAI Profile Mutationを送る。
 *
 * @responsibility Workbench等の管理操作をCROS Owner Catalogへ一度だけ搬送する。
 * @trace ARCH-000010
 * @trace ARCH-000013
 * @input baseUrl、Bearer Token、Profile限定Mutationおよび任意AbortSignalを受け取る。
 * @returns 検証済み管理結果と現在Snapshotを返す。
 * @precondition MutationはAI Runtimeの閉じた型契約から構築済みである。
 * @postcondition completedまたはrejectedを保持し、Remote結果を成功へ読み替えない。
 * @effect HTTP POSTを一回発行する。
 * @failure 非200、契約不一致または不正Snapshotを例外で拒否する。
 * @invariant Retryを自動発行せずRevision競合を利用側へ返す。
 * @boundary Workbench管理Consumer→Remote CROS AI Profile管理HTTP。
 * @security TokenをAuthorization Header以外へ複製せずredirectを拒否する。
 * @concurrency MutationのexpectedRevisionをRemote Ownerへそのまま渡す。
 */
export async function executeRemoteAiProfileMutation(
  baseUrl: string,
  token: string,
  mutation: AiProfileCatalogMutation,
  signal?: AbortSignal,
): Promise<AiProfileCatalogMutationResult> {
  const value = await requestRemoteAiProfileAdministration(
    baseUrl,
    token,
    mutation,
    signal,
  );
  if (value.status === "available")
    throw new Error("cros_remote_ai_profile_mutation_contract_invalid");
  return Object.freeze({
    status: value.status,
    reason: value.reason,
    snapshot: value.snapshot,
  });
}

/**
 * CROS Remote Transportの認証・公開境界で使用するRemoteAiProfileAdministrationResponseの構造を固定する。
 *
 * @responsibility CROS Remote Transportの認証・公開境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000005
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type RemoteAiProfileAdministrationResponse =
  | Readonly<{
      status: "available";
      snapshot: AiProfileCatalogSnapshot;
    }>
  | Readonly<{
      status: AiProfileCatalogMutationResult["status"];
      reason: AiProfileCatalogMutationResult["reason"];
      snapshot: AiProfileCatalogSnapshot;
    }>;

/**
 * Remote AI Profile管理Responseを共通Transport契約で検証する。
 *
 * @responsibility GETとPOSTの認証、送信およびResponse Schema検証を一箇所へ閉じる。
 * @trace ARCH-000010
 * @trace ARCH-000013
 * @input 接続情報、任意Mutationおよび任意AbortSignalを受け取る。
 * @returns availableまたは管理結果の検証済みResponseを返す。
 * @precondition mutation未指定はGET、指定時はPOSTとして扱う。
 * @postcondition CatalogはAI Runtime validatorを通過している。
 * @effect HTTP Requestを一回発行する。
 * @failure URL、HTTP、JSONまたはSchema不正を例外で拒否する。
 * @invariant 403を空Catalogへ変換しない。
 * @boundary Remote HTTP ResponseとCROS Client Modelの境界。
 * @security redirectを拒否しBearer TokenをBodyへ含めない。
 * @concurrency 自動Retryを行わない。
 */
async function requestRemoteAiProfileAdministration(
  baseUrl: string,
  token: string,
  mutation: AiProfileCatalogMutation | undefined,
  signal?: AbortSignal,
): Promise<RemoteAiProfileAdministrationResponse> {
  const url = new URL(AI_PROFILES_PATH, requireSafeBaseUrl(baseUrl));
  const response = await fetch(url, {
    method: mutation === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(mutation === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(mutation === undefined ? {} : { body: JSON.stringify(mutation) }),
    redirect: "error",
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok)
    throw new Error("cros_remote_ai_profile_administration_unavailable");
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("cros_remote_ai_profile_administration_contract_invalid");
  const record = value as Record<string, unknown>;
  if (
    record.contract !== "cros/remote-transport/v1" ||
    typeof record.snapshot !== "object" ||
    record.snapshot === null ||
    Array.isArray(record.snapshot)
  )
    throw new Error("cros_remote_ai_profile_administration_contract_invalid");
  const snapshotRecord = record.snapshot as Record<string, unknown>;
  const catalog = validateAiProfileCatalog(snapshotRecord.catalog);
  if (!Number.isInteger(snapshotRecord.revision) || catalog === null)
    throw new Error("cros_remote_ai_profile_administration_contract_invalid");
  const snapshot = Object.freeze({
    revision: snapshotRecord.revision as number,
    catalog: catalog as AiProfileCatalog,
  });
  if (record.status === "available")
    return Object.freeze({ status: "available", snapshot });
  const reasons = new Set<AiProfileCatalogMutationResult["reason"]>([
    "profile_created",
    "profile_updated",
    "profile_deleted",
    "profile_already_exists",
    "profile_not_found",
    "profile_delete_confirmation_required",
    "catalog_invalid",
    "revision_conflict",
  ]);
  if (
    (record.status !== "completed" && record.status !== "rejected") ||
    typeof record.reason !== "string" ||
    !reasons.has(record.reason as AiProfileCatalogMutationResult["reason"])
  )
    throw new Error("cros_remote_ai_profile_administration_contract_invalid");
  return Object.freeze({
    status: record.status,
    reason: record.reason as AiProfileCatalogMutationResult["reason"],
    snapshot,
  });
}

/**
 * Remote接続URLのTransport安全条件を検証する。
 *
 * @responsibility 外部平文HTTPへのBearer送信をEffect前に拒否する。
 * @trace ARCH-000013
 * @input baseUrlに利用者構成の接続先を受け取る。
 * @returns 正規化した末尾slash付きURLを返す。
 * @precondition N/A: 未信頼文字列を受け付ける。
 * @postcondition HTTPSまたはloopback HTTPだけを返す。
 * @effect N/A: URLを検証するだけである。
 * @failure Credentialを送信できないSchemeまたは外部HTTPを例外で拒否する。
 * @invariant URLへTokenを追加しない。
 * @boundary Connection設定とHTTP Client Effectの境界。
 * @security Bearer Tokenの平文Network送信を防ぐ。
 * @concurrency N/A: 共有状態を持たない。
 */
function requireSafeBaseUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);
  const isLoopback =
    url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback))
    throw new Error("cros_remote_transport_tls_required");
  url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  url.search = "";
  url.hash = "";
  return url;
}

/**
 * Remote Portfolio Responseが公開契約を満たすか判定する。
 *
 * @responsibility JSON値からPortfolio Projectionの最小構造だけを受理する。
 * @trace ARCH-000005
 * @input valueに未信頼のJSON値を受け取る。
 * @returns 契約を満たす場合だけtrueを返す型Guard。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition true時はprojects配列とfalseの正本保持Flagが存在する。
 * @effect N/A: 値を観測するだけである。
 * @failure N/A: 不正値をfalseへ閉じる。
 * @invariant 不足fieldを既定値で補完しない。
 * @boundary Remote JSONとPortfolio Projection型の境界。
 * @security Prototypeまたは関数を実行しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function isPortfolioResponse(value: unknown): value is Readonly<{
  contract: "cros/remote-transport/v1";
  status: "available";
  portfolio: PortfolioProjection;
}> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    record.contract !== "cros/remote-transport/v1" ||
    record.status !== "available" ||
    typeof record.portfolio !== "object" ||
    record.portfolio === null
  )
    return false;
  const portfolio = record.portfolio as Record<string, unknown>;
  return (
    Array.isArray(portfolio.projects) &&
    portfolio.retainedAsSourceOfTruth === false
  );
}

/**
 * CROS HTTP Responseへ共通Security Headerを設定する。
 *
 * @responsibility Credential結果とProjectionをCache、Frame、MIME推測から保護する。
 * @trace ARCH-000013
 * @input 未送信のServerResponseを受け取る。
 * @returns N/A: Responseを直接更新する。
 * @precondition Header送信前である。
 * @postcondition no-store、nosniff、deny frameが設定される。
 * @effect Response Headerを変更する。
 * @failure N/A: 同期Header設定だけを行う。
 * @invariant CredentialまたはHost Pathを追加しない。
 * @boundary CROS ServerとHTTP Clientの境界。
 * @security 認証済みProjectionの中間Cacheを禁止する。
 * @concurrency RequestごとのResponseだけを変更する。
 */
function setHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

/**
 * 構造化JSONを固定Header付きで送信する。
 *
 * @responsibility GETとHEADで同じStatus／Lengthを保ち、HEADではBodyを送らない。
 * @trace ARCH-000013
 * @input Response、Method、StatusおよびJSON化可能値を受け取る。
 * @returns N/A: Responseを完了する。
 * @precondition 共通Security Headerが設定済みである。
 * @postcondition Content-TypeとContent-Lengthを持つ完了Responseとなる。
 * @effect HTTP Responseを一回完了する。
 * @failure JSON化不能値は呼出し側の失敗処理へ送出する。
 * @invariant Tokenまたは内部Errorを自動追加しない。
 * @boundary CROS公開結果とHTTP Responseの境界。
 * @security 値をJSON以外の実行可能形式へ変換しない。
 * @concurrency Responseごとに一回だけ呼び出す。
 */
function sendJson(
  response: ServerResponse,
  method: string,
  status: number,
  value: unknown,
): void {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(method === "HEAD" ? undefined : body);
}
