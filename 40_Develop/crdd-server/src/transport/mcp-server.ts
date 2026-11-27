/**
 * MCPの公開入口と要求別の公式SDK Serverを構成する。
 * @responsibility 定義とOwnerの対応、現在の一覧、元入力と取消の搬送を所有する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary 専門Package依存と公式SDKのProtocol受付。
 * @security 認可をcacheせず、要求別Serverを再利用しない。
 */

import { setTimeout } from "node:timers/promises";
import {
  type AuthInfo,
  type CallToolResult,
  fromJsonSchema,
  McpServer,
  ProtocolError,
  type ServerContext,
  type ToolAnnotations,
} from "@modelcontextprotocol/server";
import {
  type AccountAccessPrincipal,
  type FilesystemStoreRoot,
  readCurrentAccess,
  readManagementState,
} from "@qual-lab/crdd-access-management";
import type { ExecutionActivityObservation } from "@qual-lab/crdd-coordinator";
import {
  type PortfolioProjection,
  type ProjectOperationRecordKind,
  readTopicMeetingList,
  recordListQueryConstraints,
  type TopicMeetingAccess,
} from "@qual-lab/crdd-document-model";
import {
  createGitHostLinkedAccessSession,
  type GitHostLinkedAccessSession,
  resolveGitHostLinkedDevelopmentAccess,
} from "../service/access.ts";
import { readServerTransportConfiguration } from "../service/configuration.ts";
import type { DefinitionAccess } from "../service/execution.ts";
import {
  type CoordinatorExecutionConfiguration,
  type CoordinatorExecutionDependencies,
  type DecisionAction,
  decisionRequestSchema,
  definitionReadFields,
  definitionWriteFields,
  executeCoordinatorOperation,
  executeDefinitionOperation,
  executionDecisionTools,
  executionDefinitionResources,
  type ObjectiveRuns,
  objectiveCancellationSchema,
  objectiveRequestSchema,
  readRepositoryExecutionActivity,
  resolveGitHostLinkedDefinitionAccess,
} from "../service/execution.ts";
import { RESOURCE_ID } from "../service/identity.ts";
import {
  type ProjectContextTarget,
  summarizeProjectPortfolio,
  readGitHostLinkedProjectPortfolio,
} from "../service/project-context.ts";
import {
  createGitHostLinkedRecords,
  executeRecordWrite,
  type RecordActionName,
  type RecordOperations,
  readRecordWrite,
} from "../service/topic.ts";
import {
  isWorkspaceRead,
  prepareWorkspaceOperation,
  workspaceInputSchema,
} from "../service/workspace-request.ts";
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  protocolComplete,
  protocolError,
} from "./mcp-protocol.ts";
import type {
  McpGrantAccess,
  McpServerFactory,
  McpTokenVerifier,
} from "./mcp-types.ts";
import {
  type JsonRpcId,
  type McpResponse,
  objectiveRunTools,
  readMcpAccountSubject,
} from "./mcp-types.ts";

/**
 * Toolの専門Owner依存を構成する。
 * @responsibility 起動構成で許可された専門機能だけを要求処理へ渡す。
 * @trace ARCH-000012
 * @shape 専門機能ごとの任意依存。
 * @boundary 起動構成と要求別Server。
 * @security Credentialの存在から内容閲覧権を推定しない。
 * @compatibility 専門Ownerの契約を直接利用する。
 */
export type McpServerDependencies = Readonly<{
  verifiedSubject?: string;
  coordinator?: McpCoordinatorConfiguration;
  workspace?: WorkspaceAccessResolver;
  projectContext?: McpProjectContextDependencies;
  executionActivity?: ExecutionActivityReader;
  accessManagement?: McpAccessManagementContext;
  topicMeeting?:
    | TopicMeetingAccess
    | ((signal: AbortSignal) => RecordOperations);
  topicMeetingRepositoryResolver?: TopicMeetingAccessResolver;
  recordOperations?: (
    repositoryId: string,
    signal: AbortSignal,
  ) => RecordOperations;
  runtimeDefinition?: RuntimeContentAccessResolver;
}>;

/** SDK登録で一度受理したTool呼出し。 @trace ARCH-000012 */
type McpToolCall = Readonly<{
  id: JsonRpcId;
  name: string;
  arguments: unknown;
}>;

/**
 * 専門Ownerを公式SDKへ接続する要求別Factoryを作る。
 * @responsibility Protocolのmethod受付をSDKへ委譲し、Toolの固定構成だけを結合する。
 * @trace ARCH-000012
 * @input 各専門Ownerの依存。
 * @returns 要求ごとにSDK Serverを生成するFactory。
 * @precondition 依存は現在認可を評価するOwnerへ接続されている。
 * @postcondition 入力不正ではOwnerを呼ばず、開始済みPromiseを観測先へ渡す。
 * @effect 選択ToolのOwnerだけが既存契約に従いEffectを発行する。
 * @failure 閉入力・未構成Tool・構成故障・Owner故障をProtocol errorへ分離する。
 * @invariant 一覧とCallの名前は同じ定義集合から得る。永続Registryを作らない。
 * @boundary 現在認証の構成と公式SDK登録。
 * @security SDKのSchema検査を通った入力だけをOwnerへ渡し、未知field拒否を維持する。
 * @concurrency HTTPとstdio内部接続の一要求ごとに新規生成する。
 */
export function createMcpServerFactory(
  dependencies: McpServerDependencies,
): McpServerFactory {
  const {
    workspace,
    coordinator,
    projectContext,
    accessManagement,
    executionActivity,
    topicMeeting,
    topicMeetingRepositoryResolver,
    recordOperations,
    runtimeDefinition,
    verifiedSubject,
  } = dependencies;
  return {
    async createServer(request, signal, observe) {
      const isDiscovery = request.method === "server/discover";
      const isList = request.method === "tools/list";
      if (signal.aborted) throw new ProtocolError(-32800, "Request cancelled");
      const toolName =
        request.method === "tools/call" ? request.params.name : null;
      const server = new McpServer(
        { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        {
          capabilities: { tools: { listChanged: false } },
          cacheHints: {
            "server/discover": { ttlMs: 0, cacheScope: "private" },
            "tools/list": { ttlMs: 0, cacheScope: "private" },
          },
        },
      );
      if (isDiscovery) return server.server;
      const sharedExecution =
        coordinator && "scope" in coordinator && coordinator.scope === "shared";
      const bindings: {
        definitions: readonly McpToolDefinition[];
        invoke: (
          call: McpToolCall,
          signal: AbortSignal,
        ) => Promise<McpResponse>;
      }[] = [];
      if (runtimeDefinition)
        bindings.push({
          definitions: mcpToolCatalog.executionDefinition,
          invoke: (call, current) =>
            dispatchExecutionDefinitionTool(call, runtimeDefinition, current),
        });
      if (workspace)
        bindings.push({
          definitions: mcpToolCatalog.workspace,
          invoke: (call, current) =>
            dispatchWorkspaceTool(call, workspace, current),
        });
      if (coordinator)
        bindings.push({
          definitions:
            mcpToolCatalog.execution[sharedExecution ? "shared" : "single"][
              "scope" in coordinator && coordinator.objectiveRuns !== undefined
                ? "cancellable"
                : "standard"
            ],
          invoke: (call, current) =>
            dispatchExecutionTool(call, coordinator, current),
        });
      if (projectContext)
        bindings.push({
          definitions:
            mcpToolCatalog.project[
              projectContext.requireRepository ? "shared" : "single"
            ],
          invoke: (call, current) =>
            dispatchProjectTool(call, projectContext, current),
        });
      if (
        accessManagement &&
        (isList ||
          toolName === MCP_CURRENT_ACCESS_TOOL ||
          (typeof toolName === "string" &&
            Object.hasOwn(managementReads, toolName)))
      ) {
        let definitions: ReturnType<typeof listMcpAccessTools>;
        try {
          definitions =
            toolName === MCP_CURRENT_ACCESS_TOOL
              ? mcpToolCatalog.access.self
              : listMcpAccessTools(accessManagement);
        } catch {
          throw new ProtocolError(-32603, "Access management unavailable");
        }
        bindings.push({
          definitions,
          invoke: (call, current) =>
            dispatchAccessTool(call, accessManagement, current),
        });
      }
      if (executionActivity)
        bindings.push({
          definitions: mcpToolCatalog.activity,
          invoke: (call, current) =>
            dispatchActivityTool(call, executionActivity, current),
        });
      if (recordOperations || topicMeetingRepositoryResolver || topicMeeting)
        bindings.push({
          definitions:
            mcpToolCatalog.records[
              recordOperations || topicMeetingRepositoryResolver
                ? "required"
                : "implicit"
            ],
          invoke: (call, current) =>
            recordOperations || topicMeetingRepositoryResolver
              ? dispatchRoutedTopicMeetingCall(
                  call,
                  topicMeetingRepositoryResolver,
                  current,
                  recordOperations,
                )
              : dispatchTopicMeetingCall(
                  call,
                  typeof topicMeeting === "function"
                    ? () => null
                    : (topicMeeting as TopicMeetingAccess),
                  current,
                  typeof topicMeeting === "function"
                    ? topicMeeting(current)
                    : undefined,
                ),
        });
      const isCall = request.method === "tools/call";
      let registered = false;
      for (const { definitions, invoke } of bindings) {
        for (const definition of definitions) {
          if (isCall && definition.name !== toolName) continue;
          registered = true;
          server.registerTool<
            ReturnType<typeof fromJsonSchema>,
            ReturnType<typeof fromJsonSchema>
          >(
            definition.name,
            {
              ...(definition.title !== undefined && {
                title: definition.title,
              }),
              description: definition.description,
              ...(definition.annotations && {
                annotations: definition.annotations,
              }),
              inputSchema: mcpInputSchema(definition.inputSchema),
            },
            (args: unknown, context: ServerContext) => {
              const combined = AbortSignal.any([signal, context.mcpReq.signal]);
              const pending = Promise.resolve().then(() => {
                if (combined.aborted)
                  return protocolError(request.id, -32800, "Request cancelled");
                if (
                  verifiedSubject !== undefined &&
                  context.http?.authInfo?.extra?.subject !== verifiedSubject
                )
                  return protocolError(
                    request.id,
                    -32603,
                    "Authentication unavailable",
                  );
                return invoke(
                  { id: request.id, name: definition.name, arguments: args },
                  combined,
                );
              });
              observe?.(pending, context.mcpReq.signal);
              return pending.then(
                (result) =>
                  result.result
                    ? (result.result as CallToolResult)
                    : mcpToolFailure(result.error?.code),
                () => mcpToolFailure(),
              );
            },
          );
        }
      }
      // 固定SDKは未登録名を反射するため、公開可能な定義がないときだけ
      // 固定応答を使う。存在確認のためだけに別の走査はしない。
      if (isCall && !registered)
        throw new ProtocolError(-32602, "Tool unavailable");
      if (
        request.method === "tools/call" &&
        typeof request.params.arguments === "object" &&
        request.params.arguments !== null &&
        Object.hasOwn(request.params.arguments, "__proto__")
      )
        throw new ProtocolError(-32602, "Invalid params");
      return server.server;
    },
  };
}

type McpToolDefinition = Readonly<{
  name: string;
  title?: string;
  description: string;
  annotations?: ToolAnnotations;
  inputSchema: object;
}>;

const mcpInputSchemas = new WeakMap<
  McpToolDefinition["inputSchema"],
  ReturnType<typeof fromJsonSchema>
>();
const INVALID_TOOL_ARGUMENTS = "Invalid arguments";
const TOOL_EXECUTION_FAILED = "Tool execution failed";

/** 固定の公開スキーマをSDKに一度だけ登録できる形にする。 */
function mcpInputSchema(
  definition: McpToolDefinition["inputSchema"],
): ReturnType<typeof fromJsonSchema> {
  const cached = mcpInputSchemas.get(definition);
  if (cached) return cached;
  const standard = fromJsonSchema(
    definition as Parameters<typeof fromJsonSchema>[0],
  )["~standard"];
  const schema = {
    "~standard": {
      ...standard,
      async validate(input: unknown) {
        let checked: Awaited<ReturnType<typeof standard.validate>>;
        try {
          checked = await standard.validate(input);
        } catch {
          throw new Error(TOOL_EXECUTION_FAILED);
        }
        // 固定SDKは検査詳細をTool応答へ転載する。公開スキーマと検査結果は
        // 変えず、失敗だけをSDKの同じToolエラー経路へ固定文言で渡す。
        if (checked.issues?.length) throw new Error(INVALID_TOOL_ARGUMENTS);
        return checked;
      },
    },
  };
  mcpInputSchemas.set(definition, schema);
  return schema;
}

function mcpToolFailure(code?: number): CallToolResult {
  const text =
    code === -32800
      ? "Request cancelled"
      : code === -32602
        ? INVALID_TOOL_ARGUMENTS
        : code === -32601
          ? "Tool unavailable"
          : TOOL_EXECUTION_FAILED;
  return { isError: true, content: [{ type: "text", text }] };
}

type McpGitHostLinkedAccess = Readonly<
  Pick<McpGrantAccess, "readGrantHostReference"> & {
    readGitHost: import("../service/git-host.ts").ReadGitHost;
    repositoryScope: import("../service/repository-scope.ts").RepositoryScope;
    read: (
      host: string,
      reference: string,
      binding: { userId: string; bindingId: string },
    ) => string | null;
    open?: (
      host: string,
      reference: string,
      binding: { userId: string; bindingId: string },
    ) =>
      | import("../service/access.ts").GitHostLinkedExecutionClientAccess
      | null;
  }
>;

function readMcpPrincipal(
  subject: string,
  expiresAt: number,
): AccountAccessPrincipal | null {
  const binding = readMcpAccountSubject(subject);
  return binding && Number.isSafeInteger(expiresAt) && expiresAt > Date.now()
    ? Object.freeze({ kind: "account", ...binding, expiresAt })
    : null;
}

function readSdkMcpPrincipal(auth: AuthInfo | undefined) {
  const subject = auth?.extra?.subject;
  if (typeof subject !== "string" || typeof auth?.expiresAt !== "number")
    return null;
  const principal = readMcpPrincipal(subject, auth.expiresAt * 1_000);
  return principal && { token: auth.token, subject, principal };
}

function configureMcpAccount(
  root: FilesystemStoreRoot,
  verify: McpTokenVerifier,
  token: string,
  subject: string,
  principal: AccountAccessPrincipal,
  isCurrent: () => boolean,
  hostAccess?: McpGitHostLinkedAccess,
  objectiveRuns?: ObjectiveRuns,
) {
  const observeClient: NonNullable<
    GitHostLinkedAccessSession["observeClient"]
  > = async (currentSignal) => {
    const current = await verify(token, currentSignal);
    return current.status === "completed"
      ? current.subject === subject && current.expiresAt > Date.now()
        ? "current"
        : "revoked"
      : current.status === "rejected"
        ? "revoked"
        : "unavailable";
  };
  return createSharedMcpSource(
    root,
    principal,
    isCurrent,
    createGitHostLinkedAccessSession({
      principal,
      isCurrent,
      readGitHost: (host) => hostAccess?.readGitHost(host),
      repositoryScope: hostAccess?.repositoryScope ?? (() => false),
      readReference: (host) =>
        hostAccess?.readGrantHostReference(token, subject, host),
      readToken: (host, reference) =>
        hostAccess?.read(host, reference, principal) ?? null,
      observeClient,
      ...(hostAccess?.open && {
        open: (host, reference) =>
          hostAccess.open?.(host, reference, principal) ?? null,
      }),
    }),
    objectiveRuns,
    observeClient,
    subject,
  );
}

/** 認証済みのSDK要求からのみ、共有MCPの要求別構成を作る。 @trace ARCH-000012 */
export function createOAuthMcpAccess(
  root: FilesystemStoreRoot,
  verify: McpTokenVerifier,
  hasCurrentToken: McpGrantAccess["hasCurrentToken"],
  hostAccess?: McpGitHostLinkedAccess,
  objectiveRuns?: ObjectiveRuns,
) {
  const factory: McpServerFactory = {
    async createServer(request, signal, observe, authInfo) {
      if (signal.aborted) throw new ProtocolError(-32800, "Request cancelled");
      const current = readSdkMcpPrincipal(authInfo);
      if (!current)
        throw new ProtocolError(-32603, "Authentication unavailable");
      const isCurrent = () =>
        current.principal.expiresAt > Date.now() &&
        hasCurrentToken(current.token, current.subject);
      if (!isCurrent())
        throw new ProtocolError(-32603, "Authentication unavailable");
      return configureMcpAccount(
        root,
        verify,
        current.token,
        current.subject,
        current.principal,
        isCurrent,
        hostAccess,
        objectiveRuns,
      ).createServer(request, signal, observe);
    },
  };
  return {
    admit(auth: AuthInfo) {
      const current = readSdkMcpPrincipal(auth);
      return (
        current !== null &&
        readCurrentAccess(root, current.principal).status === "completed"
      );
    },
    factory,
  };
}

/** 検証済みOAuth主体で共有MCPの操作を構成する。 @trace ARCH-000012 */
function createSharedMcpSource(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  isCurrent: () => boolean,
  hosted: GitHostLinkedAccessSession,
  objectiveRuns?: ObjectiveRuns,
  observeClient?: GitHostLinkedAccessSession["observeClient"],
  verifiedSubject?: string,
): McpServerFactory {
  return {
    async createServer(request, signal, observe) {
      return createMcpServerFactory({
        ...(verifiedSubject && { verifiedSubject }),
        accessManagement: { root, principal, isCurrent },
        recordOperations: (repositoryId, current) =>
          createGitHostLinkedRecords(root, hosted, repositoryId, current),
        coordinator: {
          scope: "shared",
          ...(objectiveRuns && { objectiveRuns }),
          ...(observeClient && { observeClient }),
          credentials: { root, hosted },
        },
        runtimeDefinition: (repositoryId, currentSignal, write) =>
          resolveGitHostLinkedDefinitionAccess(
            root,
            hosted,
            repositoryId,
            write,
            currentSignal,
          ),
        workspace: (repositoryId, write, current) =>
          resolveGitHostLinkedDevelopmentAccess(
            root,
            hosted,
            repositoryId,
            write,
            current,
          ),
        executionActivity: {
          /**
           * 現在許可された同Projectの実保存活動を読む。
           * @responsibility 各Callの現在認可を活動Ownerへ最小入力で接続する。
           * @trace ARCH-000005
           * @trace ARCH-000012
           * @trace ARCH-000013
           * @input Projectとページ要求。
           * @returns 同Projectの観測、許可対象がない場合だけnull。
           * @precondition 入力検査と開始前取消確認が完了している。
           * @postcondition 許可対象全件を渡し、部分集合へ後退しない。
           * @effect 現在認可、Root観測、実保存読取り。書込みは行わない。
           * @failure 集合・Root不明は固定例外、Owner故障はAdapterが非開示にする。
           * @invariant 各Callで再認可し、認証を観測型の正しさで代替しない。
           * @boundary AM現在集合からCoordinator活動Owner。
           * @security Token・AM Binding・RoleをOwnerや応答へ渡さない。
           * @concurrency 開始したReaderを待ち、Adapterが取消後の公開を止める。
           */
          read: async ({ repositoryId, ...query }) => {
            if (signal.aborted) throw new Error("runtime_activity_unavailable");
            if (repositoryId !== undefined)
              return readRepositoryExecutionActivity(
                repositoryId,
                query,
                {
                  scope: "shared",
                  credentials: { root, hosted },
                },
                signal,
                query.projectId,
              );
            // 共有OAuthの対象は単一のGitホスト連携登録に限定する。
            // ID省略によって旧認可の集合へ戻さない。
            return null;
          },
        },
        /**
         * 現在許可対象の操作と同ProjectのRelation集合を構成する。
         * @responsibility 未許可対象・異Project探索・部分集合への後退を防ぐ。
         * @trace ARCH-000006
         * @trace ARCH-000013
         * @input 完全Schema検査後の明示Repository ID。
         * @returns 指定対象のDomain操作、非許可時はnull。
         * @precondition 通常認証済みで、入力検査と開始前取消確認が完了している。
         * @postcondition 同Project全対象を検証し、書込み先は指定Repositoryだけに固定する。
         * @effect 現在AM集合とRootを観測し、Domain操作を構成する。構成時の保存はない。
         * @failure 集合・Root・構成不明は固定例外で全体停止する。
         * @invariant 各Tool Callで再認可し、他要求へ操作や集合を共有しない。
         * @boundary AM現在認可→Version Control Root→Domain操作／Relation。
         * @security Bearer、Root、Bindingを公開結果へ渡さない。
         * @concurrency 同期構成後に既存Adapterが取消を再確認する。保存開始後のrollbackは保証しない。
         */
        projectContext: {
          requireRepository: true,
          /**
           * 内容Callの現在認可と実本文を一つのPortfolioへ閉じる。
           * @responsibility 非許可読取りを防ぎ、文書未確認・競合を認可済みSourceへ限定して表示する。
           * @trace ARCH-000005
           * @trace ARCH-000013
           * @input N/A: 当該要求のBearerと取消Signalだけを使用する。
           * @returns Domainが集約した非秘密Portfolio。
           * @precondition 通常Header認証が完了し、Tool入力は既存Adapterが検査済み。
           * @postcondition 認可・実体・全集合の再確認が成功した場合だけ、不完全性を保持した結果を返す。
           * @effect 現在許可集合の再取得と各固定本文の同期読取り。
           * @failure 取消・集合不明・Root不成立・公開前集合差は全体拒否。本文不成立はSourceの未確認・競合。
           * @invariant SourceはProject・Repository・読取り状態・本文版・解析Contextの5項目だけ。非completeは本文・版なし。
           * @boundary AM現在認可→Domain本文／集約→既存MCP Adapter。
           * @security Token・技術的Root・下位例外を結果へ透過しない。
           * @concurrency cacheせず呼出し毎に現在認可する。同期I/Oの中断保証はしない。
           */
          readPortfolio: (target, current = signal) =>
            readGitHostLinkedProjectPortfolio(root, hosted, current, target),
        },
      }).createServer(request, signal, observe);
    },
  };
}

/** 共有MCP HTTPの起動に使う既存の非秘密設定を一回読む。 @trace ARCH-000012 */
export function readMcpServerConfiguration(workingDirectory: string) {
  return readServerTransportConfiguration(workingDirectory, "mcp");
}

/**
 * adapterで使用するMcp Coordinator Dependenciesの値契約を定義する。
 *
 * @responsibility Mcp Coordinator DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpCoordinatorDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpCoordinatorDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpCoordinatorDependenciesの宣言は外部境界を開かない。
 * @security N/A: McpCoordinatorDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpCoordinatorDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpCoordinatorDependencies = CoordinatorExecutionDependencies;
type McpCoordinatorConfiguration = CoordinatorExecutionConfiguration;

/**
 * Mcp Coordinator Requestを処理する。
 *
 * @responsibility Mcp Coordinator Requestの受付条件、処理結果、失敗時の戻り境界を所有する。
 * @trace ARCH-000012
 * @input rawRequest: unknown、dependencies: McpCoordinatorDependencies、signal: AbortSignal
 * @returns Promise<McpResponse>を返す。
 * @precondition 「rawRequest: unknown、dependencies: McpCoordinatorDependencies、signal: AbortSignal」がhandleMcpCoordinatorRequestの入力契約を満たす。
 * @postcondition handleMcpCoordinatorRequestの責務を完了した結果だけを返す。
 * @effect 選択された実行系ToolでだけCoordinatorを読み、認証後に既存の操作へ委譲する。
 * @failure handleMcpCoordinatorRequestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant handleMcpCoordinatorRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: handleMcpCoordinatorRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency handleMcpCoordinatorRequestは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function dispatchExecutionTool(
  params: McpToolCall,
  dependencies: McpCoordinatorConfiguration,
  signal: AbortSignal,
): Promise<McpResponse> {
  const shared = "scope" in dependencies && dependencies.scope === "shared";
  const objectiveAction =
    params.name === MCP_START_OBJECTIVE_TOOL
      ? "start"
      : params.name === MCP_RESUME_OBJECTIVE_TOOL
        ? "resume"
        : undefined;
  const decisionAction = decisionToolActions.find(
    (action) => executionDecisionTools[action] === params.name,
  );
  const operation =
    objectiveAction !== undefined
      ? "objective"
      : decisionAction !== undefined
        ? "decision"
        : params.name === MCP_CANCEL_OBJECTIVE_TOOL
          ? "cancel"
          : "state";
  const outcome = await executeCoordinatorOperation(
    operation,
    params.arguments,
    dependencies,
    signal,
    objectiveAction ?? decisionAction,
  );
  if (outcome.kind === "invalid")
    return protocolError(params.id, -32602, "Invalid params");
  if (outcome.kind === "cancelled")
    return protocolError(params.id, -32800, "Request cancelled");
  if (outcome.kind === "unavailable")
    return protocolError(params.id, -32603, "Coordinator unavailable");
  if (outcome.kind === "publication_denied")
    return protocolError(params.id, -32603, "Coordinator target unavailable");
  if (outcome.kind === "cancellation_requested")
    return protocolComplete(params.id, {
      content: [
        {
          type: "text",
          text: "実行に取消を要求しました。終了・回収の完了は実行状態を確認してください。",
        },
      ],
      structuredContent: { status: "cancellation_requested" },
    });
  const denied = outcome.kind === "access_denied";
  const result =
    outcome.kind === "result"
      ? outcome.value
      : denied
        ? {
            status: "blocked",
            reason: shared
              ? "mcp_execution_access_unavailable"
              : "mcp_client_not_authenticated",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            effectState: "no_effect",
          }
        : {
            status: "blocked",
            reason: "mcp_coordinator_result_invalid",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          };
  const isError = result.status !== "completed";
  return protocolComplete(params.id, {
    content: [
      {
        type: "text",
        text: denied
          ? shared
            ? "実行対象を確認できないため、処理を開始していません。"
            : "利用者を確認できないため、処理を開始していません。"
          : isError
            ? "処理は完了していません。構造化された理由を確認してください。"
            : "処理が完了しました。",
      },
    ],
    structuredContent: result,
    isError,
  });
}

const MCP_START_OBJECTIVE_TOOL = objectiveRunTools.start;
const MCP_RESUME_OBJECTIVE_TOOL = objectiveRunTools.resume;
const MCP_CANCEL_OBJECTIVE_TOOL = objectiveRunTools.cancel;
const decisionToolActions = Object.keys(
  executionDecisionTools,
) as DecisionAction[];
const MCP_COORDINATOR_STATE_TOOL = objectiveRunTools.state;

const stateQueryKeys = new Set([
  "requestId",
  "projectId",
  "repositoryRevision",
] as const);

/**
 * toolを決定する。
 *
 * @responsibility toolの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000012
 * @input name: string、title: string、description: string、properties: object、requiredItems: readonly string[]
 * @returns toolの計算結果を返す。
 * @precondition 「name: string、title: string、description: string、properties: object、requiredItems: readonly string[]」がtoolの入力契約を満たす。
 * @postcondition toolの責務を完了した結果だけを返す。
 * @effect N/A: toolは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: toolは独自の失敗分岐を所有しない。
 * @invariant toolは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: toolはProcess内の同一Subsystemで完結する。
 * @security N/A: toolはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: toolは共有非同期状態を持たない同期処理である。
 */
function tool(
  name: string,
  title: string,
  description: string,
  properties: object,
  requiredItems: readonly string[],
) {
  return Object.freeze({
    name,
    title,
    description,
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze([...requiredItems]),
      properties: Object.freeze(properties),
    }),
  });
}

/**
 * Objective起動・判断提出・実行状態照会のMCP定義を組み立てる。
 * @responsibility 起動形態に応じてRepository指定を含め、実行操作の受付Schemaを公開する。
 * @trace ARCH-000012
 * @boundary MCPのツール一覧。定義の生成時に実行・認可は行わない。
 */
function getExecutionToolDefinitions(
  requireRepositoryId = false,
  includeCancel = false,
) {
  const objective = objectiveRequestSchema();
  const id = objective.properties.requestId;
  const rev = objective.properties.repositoryRevision;
  const targetFields = requireRepositoryId ? { repositoryId: id } : {};
  const cancellation = objectiveCancellationSchema();
  return Object.freeze([
    ...(["start", "resume"] as const).map((action) =>
      tool(
        action === "start"
          ? MCP_START_OBJECTIVE_TOOL
          : MCP_RESUME_OBJECTIVE_TOOL,
        action === "start" ? "CRDD Objectiveを開始" : "CRDD Objectiveを再開",
        action === "start"
          ? "検証済みProjectへObjectiveを登録し、Coordinatorで実行します。"
          : "既存の実行IDと元の要求を照合し、再開条件を満たした場合だけ再開します。",
        { ...targetFields, ...objective.properties },
        [...Object.keys(targetFields), ...objective.required],
      ),
    ),
    ...decisionToolActions.map((action) => {
      const schema = decisionRequestSchema(action);
      const labels = {
        request: "判断を要求",
        answer: "判断に回答",
        apply: "判断を適用",
        close: "判断を閉鎖",
      } as const;
      return tool(
        executionDecisionTools[action],
        `CRDDの${labels[action]}`,
        action === "answer"
          ? "登録された判断に回答します。回答だけではAIを再実行しません。"
          : `対象の実行について${labels[action]}します。`,
        { ...targetFields, ...schema.properties },
        [...Object.keys(targetFields), ...schema.required],
      );
    }),
    ...(includeCancel
      ? [
          tool(
            MCP_CANCEL_OBJECTIVE_TOOL,
            "CRDD Objectiveの取消を要求",
            "実行状態から取得した今回の起動識別子で取消を要求します。終了を保証しません。",
            { ...targetFields, ...cancellation.properties },
            [...Object.keys(targetFields), ...cancellation.required],
          ),
        ]
      : []),
    tool(
      MCP_COORDINATOR_STATE_TOOL,
      "CRDDのTask実行状態を取得",
      "Taskの実行状態を、Project Contextとは別の読取り専用投影として取得します。",
      {
        ...targetFields,
        requestId: id,
        projectId: id,
        repositoryRevision: rev,
        queueId: id,
      },
      [...Object.keys(targetFields), ...stateQueryKeys],
    ),
  ]);
}

/**
 * 当該RepositoryのCore操作を現在認可へ結ぶ。
 * @responsibility Host構成からだけRootと主体を渡す。
 * @trace ARCH-000013
 * @shape Repository IDと要求Signalからサーバーが認可した定義操作又はnull。
 * @invariant 要求間cache、JSONからのContext復元、暗黙実行なし。
 * @boundary Transport構成と内容認可Owner。
 * @security 拒否時は対象の存在を開示しない。
 * @compatibility 既存development権限だけを利用する。
 */
type RuntimeContentAccessResolver = (
  repositoryId: string,
  signal: AbortSignal,
  write: boolean,
) => DefinitionAccess | null | Promise<DefinitionAccess | null>;

/**
 * 読取りと定義変更の固定Tool集合を返す。
 * @responsibility 一覧と実受付の操作名・必須fieldを一致させる。
 * @trace ARCH-000012
 * @input N/A: 固定した操作集合。
 * @returns 操作ごとのToolと閉Schema。
 * @precondition 個別定義の意味検査はDomainが所有する。
 * @postcondition 承認・AI開始・Queue投入は一覧に含まない。
 * @effect N/A: 値構築だけ。
 * @failure N/A: 外部状態を参照しない。
 * @invariant CAS値を自動補完しない。
 * @boundary MCP Tool一覧とCore CRUD。
 * @security 任意Root・callback・資格入力なし。
 * @concurrency N/A: 共有可変状態なし。
 */
function getExecutionDefinitionToolDefinitions() {
  const id = { type: "string", pattern: RESOURCE_ID.source };
  const properties: Record<string, unknown> = {
    projectId: id,
    milestoneId: id,
    objectiveId: id,
    taskId: id,
    queueId: id,
    expectedAbsence: { const: true },
    expected: {
      type: "object",
      additionalProperties: false,
      required: ["revision", "payloadSha256"],
      properties: {
        revision: { type: "integer", minimum: 0 },
        payloadSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
    },
    expectedDefinitionHash: {
      anyOf: [{ type: "string", pattern: "^[a-f0-9]{64}$" }, { type: "null" }],
    },
    definition: {
      type: "object",
      description:
        "Domain定義。Plan/Objectives/Taskの閉形式・DAG・PathはDomainが検査します。",
    },
  };
  const fields = { ...definitionReadFields, ...definitionWriteFields };
  return Object.entries(executionDefinitionResources).map(([key, resource]) => {
    const operation = key as keyof typeof fields;
    const keys = [
      "repositoryId",
      "projectId",
      "milestoneId",
      ...fields[operation],
    ];
    const readOnly = resource.method === "get";
    return {
      name: resource.tool,
      title: resource.tool,
      description:
        "実行定義だけを扱います。保存不明・競合時は自動再送しません。",
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: !readOnly,
        idempotentHint: false,
      },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: keys.filter((field) => field !== "queueId"),
        properties: Object.fromEntries(
          keys.map((field) => [
            field,
            field === "repositoryId"
              ? id
              : field === "expectedDefinitionHash" && operation !== "plan.save"
                ? { type: "string", pattern: "^[a-f0-9]{64}$" }
                : properties[field],
          ]),
        ),
      },
    };
  });
}

/**
 * 当該要求のCore定義操作を一度だけDomainへ渡す。
 * @responsibility SDKが受理した入力を定義操作へ変換し、Domainの意味検査と現在認可を接続する。
 * @trace ARCH-000008
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input raw、resolve、signal: 元Protocol要求と信頼した現在認可解決。
 * @returns Domainの型付き結果、又は非開示Protocol拒否。
 * @precondition ContextはHostが現在権限とRootへ結合する。
 * @postcondition 保存のunknownと回復参照、競合、不存在を維持する。
 * @effect 明示した一つの一般CRUD／Queryだけ。
 * @failure 入力不正は-32602、開始前取消は-32800、認可・構成不明は-32603。
 * @invariant 保存後の通信取消・応答喪失を未保存又はrollbackに変換しない。
 * @boundary MCP→現在内容認可→Domain共有Writer。
 * @security 生例外・Root・Token・内部Snapshotを公開しない。
 * @concurrency 同期保存をjoinして結果を返す。新Worker・再送を作らない。
 */
async function dispatchExecutionDefinitionTool(
  params: McpToolCall,
  resolve: RuntimeContentAccessResolver,
  signal: AbortSignal,
): Promise<McpResponse> {
  const operations = Object.keys(executionDefinitionResources) as Array<
    keyof typeof executionDefinitionResources
  >;
  const operation = operations.find(
    (key) => executionDefinitionResources[key].tool === params.name,
  );
  if (!operation) return protocolError(params.id, -32601, "Method not found");
  const read = executionDefinitionResources[operation].method === "get";
  // 対象と既知の操作の外枠はSDKが検査済み。定義の意味は書込み先が検査する。
  const { repositoryId, ...input } = params.arguments as Record<
    string,
    unknown
  > & { repositoryId: string; projectId: string; milestoneId: string };
  const command = { operation, input };
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  try {
    const access = await resolve(repositoryId, signal, !read);
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (!access) throw new Error("runtime_content_access_unavailable");
    const result = executeDefinitionOperation(access, command);
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (
      access.canPublish &&
      !access.canPublish(
        read ? "definition.read" : "definition.write",
        command.input as Parameters<DefinitionAccess["revalidate"]>[1],
      )
    )
      throw new Error("runtime_content_access_unavailable");
    return protocolComplete(params.id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch {
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    return protocolError(
      params.id,
      -32603,
      "Runtime definition outcome unavailable",
    );
  }
}

/**
 * 要求内だけの現在Workspaceアクセス解決を定義する。
 * @responsibility Host指定をClientから受けずServerに限定する。
 * @trace ARCH-000013
 * @shape Root・Projectとfresh認可callback又は非開示null。
 * @invariant 次要求へ再利用しない。
 * @boundary 信頼したServer構成内部。
 * @security Root・関数はwireに載せない。
 * @compatibility AMの内容領域とGit Workspaceを分離する。
 */
type WorkspaceAccess = Readonly<{
  ownerRoot: string;
  projectId: string;
  authorize: () => boolean;
}>;
type WorkspaceAccessResolver = (
  repositoryId: string,
  write: boolean,
  signal: AbortSignal,
) => WorkspaceAccess | null | Promise<WorkspaceAccess | null>;

export const MCP_WORKSPACE_TOOLS = Object.freeze({
  list: "crdd.list_workspaces",
  get: "crdd.get_workspace",
  inspect: "crdd.inspect_workspace",
  "candidate-diff": "crdd.get_workspace_candidate_diff",
  create: "crdd.create_workspace",
  select: "crdd.select_workspace",
  rename: "crdd.rename_workspace",
  hold: "crdd.hold_workspace",
  freeze: "crdd.freeze_workspace",
  adopt: "crdd.adopt_workspace",
  "close-candidate": "crdd.close_workspace_candidate",
  discard: "crdd.discard_workspace",
} as const);

/**
 * Tool一覧の操作別閉Schemaを返す。
 * @responsibility 読取りと明示書込みをClientへ区別する。
 * @trace ARCH-000012
 * @input N/A: 固定契約。
 * @returns 二Toolの記述。
 * @precondition N/A: 外部状態なし。
 * @postcondition 任意Root・callback・参照解放申告はSchemaにない。
 * @effect N/A: 値構築。
 * @failure N/A: 外部処理なし。
 * @invariant 自動採用や自動再送を案内しない。
 * @boundary MCP Tool一覧。
 * @security SchemaはAuthorityを発行しない。
 * @concurrency N/A: 局所値。
 */
function getWorkspaceToolDefinitions() {
  return Object.entries(MCP_WORKSPACE_TOOLS).map(([operation, name]) => ({
    name,
    description:
      "人間が指定した対象・内容だけを扱います。固定と採用は別操作です。Task完了から固定・採用・破棄を自動発行せず、失敗時も自動再送しません。",
    annotations: {
      readOnlyHint: isWorkspaceRead(operation),
      destructiveHint: !isWorkspaceRead(operation),
      idempotentHint: false,
    },
    inputSchema: workspaceInputSchema(operation),
  }));
}

async function dispatchWorkspaceTool(
  params: McpToolCall,
  resolve: WorkspaceAccessResolver,
  signal: AbortSignal,
): Promise<McpResponse> {
  const operation = Object.entries(MCP_WORKSPACE_TOOLS).find(
    ([, name]) => name === params.name,
  )?.[0];
  if (!operation) return protocolError(params.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  // SDKが解析・検査した要求から、Workspaceの正式な入力を組み立てる。
  const { repositoryId, ...input } = params.arguments as Record<
    string,
    unknown
  > & { repositoryId: string };
  const captured = Object.freeze({ ...input, operation });
  let prepared: Awaited<ReturnType<typeof prepareWorkspaceOperation>>;
  try {
    prepared = await prepareWorkspaceOperation(captured, signal);
  } catch {
    return signal.aborted
      ? protocolError(params.id, -32800, "Request cancelled")
      : protocolError(params.id, -32603, "Workspace outcome unavailable");
  }
  let dispatched = false;
  try {
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (!prepared) return protocolError(params.id, -32602, "Invalid params");
    const { command, executeWorkspace } = prepared;
    const access = await resolve(
      repositoryId,
      !isWorkspaceRead(command.operation),
      signal,
    );
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (!access) throw new Error("workspace_access_unavailable");
    dispatched = true;
    const result = executeWorkspace(
      access.ownerRoot,
      access.projectId,
      command,
      access.authorize,
      signal,
    );
    if (signal.aborted)
      return protocolError(params.id, -32603, "Workspace outcome unavailable");
    return protocolComplete(params.id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch {
    if (signal.aborted && !dispatched)
      return protocolError(params.id, -32800, "Request cancelled");
    return protocolError(params.id, -32603, "Workspace outcome unavailable");
  }
}

/**
 * Project Context Adapterの外部依存を定義する。
 *
 * @responsibility Authority適用後のPortfolio Snapshot取得Portを所有する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape readPortfolioだけを持つ読取り専用依存を表す。
 * @invariant AdapterはRepository探索やWorkspace Grant判定を再実装しない。
 * @boundary MCP Toolと、許可済みリポジトリのProject Context読取りの境界。
 * @security readPortfolioは呼出し主体へ開示可能なSourceだけを返す。
 * @compatibility PortfolioProjectionの公開契約変更時はAdapterを再評価する。
 */
type McpProjectContextDependencies = Readonly<{
  requireRepository?: boolean;
  readPortfolio: (
    target?: ProjectContextTarget,
    signal?: AbortSignal,
  ) => Promise<PortfolioProjection>;
}>;

/**
 * Project Context Tool Callを処理する。
 *
 * @responsibility SDKが受理した一覧・取得を、一つのPortfolio Snapshotから応答する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input rawRequest、dependenciesおよび取消Signalを受け取る。
 * @returns MCP応答を返す。
 * @precondition 呼出し元がProject Context Tool名だけをRoutingする。
 * @postcondition 取得結果は五場面を含む保存済みContextか、非開示なNot Foundとなる。
 * @effect readPortfolioを一回だけ呼び出す。
 * @failure 入力不正、読取失敗、取消または未検出を構造化Errorへ閉じる。
 * @invariant 一覧と取得で同じPortfolio Snapshot契約を使用する。
 * @boundary MCP Tool CallとProject Context Consumer Read Modelの境界。
 * @security 未検出時にGrant外Sourceの存在や件数を返さない。
 * @concurrency Request間でSnapshotや認証状態を共有しない。
 */
async function dispatchProjectTool(
  params: McpToolCall,
  dependencies: McpProjectContextDependencies,
  signal: AbortSignal,
): Promise<McpResponse> {
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const args = params.arguments as Partial<ProjectContextTarget>;
  const requestedProjectId = args.projectId;
  let portfolio: PortfolioProjection;
  try {
    const target =
      dependencies.requireRepository &&
      params.name === MCP_PROJECT_CONTEXT_GET_TOOL
        ? (args as ProjectContextTarget)
        : undefined;
    portfolio = await dependencies.readPortfolio(target, signal);
  } catch {
    if (dependencies.requireRepository && signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    return protocolError(params.id, -32603, "Project Context unavailable");
  }
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  if (params.name === MCP_PROJECT_CONTEXT_LIST_TOOL)
    return protocolComplete(params.id, {
      content: Object.freeze([
        Object.freeze({
          type: "text",
          text: `${portfolio.projects.length}件のProject Contextを取得しました。`,
        }),
      ]),
      structuredContent: summarizeProjectPortfolio(portfolio),
      isError: false,
    });
  const project = portfolio.projects.find(
    ({ projectId }) => projectId === requestedProjectId,
  );
  if (!project)
    return protocolComplete(params.id, {
      content: Object.freeze([
        Object.freeze({
          type: "text",
          text: "指定したProject Contextは現在の接続から取得できません。",
        }),
      ]),
      structuredContent: Object.freeze({
        status: "unavailable",
        reason: "project_context_not_available",
      }),
      isError: true,
    });
  return protocolComplete(params.id, {
    content: Object.freeze([
      Object.freeze({
        type: "text",
        text: `${project.projectId}のProject Contextを取得しました。`,
      }),
    ]),
    structuredContent: Object.freeze({
      status: "completed",
      project,
      retainedAsSourceOfTruth: false,
    }),
    isError: false,
  });
}

export const MCP_PROJECT_CONTEXT_LIST_TOOL = "crdd.list_projects" as const;
export const MCP_PROJECT_CONTEXT_GET_TOOL = "crdd.get_project_context" as const;

/**
 * Project Context Tool Definitionsを取得する。
 *
 * @responsibility Project Contextの一覧・取得入力を固定Schemaとして公開する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input 外部ホスト利用時に対象Repositoryを明示するか。
 * @returns Project Context用MCP Tool記述を返す。
 * @precondition N/A: 固定契約だけを使用する。
 * @postcondition 一覧と取得の二Toolを固定順で返す。
 * @effect N/A: 入力、FilesystemまたはNetworkを変更しない。
 * @failure N/A: 固定値の構築に独自の失敗分岐を持たない。
 * @invariant Coordinator状態ToolとProject Context Toolを同一名にしない。
 * @boundary MCP Clientへ公開するTool Schema境界。
 * @security 外部ホスト利用時はRepositoryとProjectを明示し、入力をAuthorityとして扱わない。
 * @concurrency N/A: 同期的な純粋構築である。
 */
function getProjectToolDefinitions(requireRepository = false) {
  const projectId = Object.freeze({
    type: "string",
    pattern: RESOURCE_ID.source,
  });
  return Object.freeze([
    Object.freeze({
      name: MCP_PROJECT_CONTEXT_LIST_TOOL,
      title: "参照できるProjectの一覧を取得",
      description:
        "現在の接続から参照できるProject Contextだけを一覧として取得します。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze([]),
        properties: Object.freeze({}),
      }),
    }),
    Object.freeze({
      name: MCP_PROJECT_CONTEXT_GET_TOOL,
      title: "Project Contextを取得",
      description:
        "指定Projectの五場面とSource Coverageを、保存済み投影から取得します。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze(
          requireRepository ? ["repositoryId", "projectId"] : ["projectId"],
        ),
        properties: Object.freeze(
          requireRepository
            ? { repositoryId: projectId, projectId }
            : { projectId },
        ),
      }),
    }),
  ]);
}

export const EXECUTION_ACTIVITY_TOOL = "crdd.get_execution_activity" as const;

/**
 * 認可適用済みの活動読取り依存を定義する。
 *
 * @responsibility MCPがRepository探索と認可を再実装しない読取り境界を固定する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape readはProjectとページから観測または非開示nullを返す。
 * @invariant Reader完了を待ち、nullとunknownを混同しない。
 * @boundary MCP入力とCoordinator活動Ownerの境界。
 * @security 許可集合外のRepositoryを参照しない依存だけを渡す。
 * @compatibility Coordinatorの観測型を直接利用し、同型DTOを作らない。
 */
type ExecutionActivityInput = Readonly<{
  projectId: string;
  repositoryId?: string;
  cursor?: string;
  limit?: number;
}>;
type ExecutionActivityReader = Readonly<{
  read(
    query: ExecutionActivityInput & { readonly limit: number },
    signal: AbortSignal,
  ): Promise<ExecutionActivityObservation | null>;
}>;

/**
 * 実行状況と履歴を取得するToolの固定Schemaを返す。
 *
 * @responsibility 一覧とCallで同じ入力契約を公開する。
 * @trace ARCH-000012
 * @input N/A: 引数を受け取らない。
 * @returns 一つのTool記述。
 * @precondition N/A: 固定契約だけを構築する。
 * @postcondition projectIdを必須とし、余剰入力を許可しない。
 * @effect N/A: 値だけを構築する。
 * @failure N/A: 外部処理を行わない。
 * @invariant ページ上限は50、既定20である。
 * @boundary MCP Tool一覧の境界。
 * @security Schemaから未許可Projectを開示しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function getExecutionActivityToolDefinitions() {
  return Object.freeze([
    Object.freeze({
      name: EXECUTION_ACTIVITY_TOOL,
      title: "実行状況と履歴を取得",
      description:
        "現在参照可能なProjectの保存済み実行状況とページ単位の履歴を取得します。改訂と次の手順は保存済み状態の情報であり、現在の実行許可ではありません。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze(["projectId"]),
        properties: Object.freeze({
          projectId: Object.freeze({
            type: "string",
            pattern: RESOURCE_ID.source,
          }),
          repositoryId: Object.freeze({
            type: "string",
            pattern: RESOURCE_ID.source,
          }),
          cursor: Object.freeze({ type: "string" }),
          limit: Object.freeze({
            type: "integer",
            minimum: 1,
            maximum: 50,
            default: 20,
          }),
        }),
      }),
    }),
  ]);
}

async function dispatchActivityTool(
  params: McpToolCall,
  dependencies: ExecutionActivityReader,
  signal: AbortSignal,
): Promise<McpResponse> {
  const args = params.arguments as ExecutionActivityInput;
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const requestedProjectId = args.projectId;
  const input = { ...args, limit: args.limit ?? 20 };
  let observation: ExecutionActivityObservation | null;
  let ownedObservation: ExecutionActivityObservation | null;
  try {
    const { parseExecutionActivityObservation } = await import(
      "@qual-lab/crdd-coordinator"
    );
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    observation = await dependencies.read(input, signal);
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    ownedObservation =
      observation === null
        ? null
        : parseExecutionActivityObservation(observation);
  } catch {
    return signal.aborted
      ? protocolError(params.id, -32800, "Request cancelled")
      : protocolError(params.id, -32603, "Execution activity unavailable");
  }
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  if (
    observation !== null &&
    (ownedObservation === null ||
      ownedObservation.projectId !== requestedProjectId)
  )
    return protocolError(params.id, -32603, "Execution activity unavailable");
  return protocolComplete(params.id, {
    content: Object.freeze([
      Object.freeze({
        type: "text",
        text:
          observation === null
            ? "指定したProjectの実行状況は現在の接続から取得できません。"
            : "実行状況を取得しました。",
      }),
    ]),
    structuredContent:
      ownedObservation ??
      Object.freeze({
        status: "unavailable",
        reason: "execution_activity_unavailable",
      }),
    isError: observation === null,
  });
}

/**
 * 試験で指定リポジトリのTopic／Meeting処理を差し込むための境界。
 *
 * @responsibility 明示したリポジトリIDを、試験から渡した処理へ結び付ける。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @shape repositoryIdを受け、対象の処理または対象を解決できない場合のnullを返す。
 * @boundary 共有本番はこの差し込み口ではなく、記録の読取り・書込み時にrecordOperationsで現在の対象を解決する。
 * @security この差し込み口で使う対象の許可は呼出し元が設定する。
 */
type TopicMeetingAccessResolver = (
  repositoryId: string,
) => TopicMeetingAccess | null;

/**
 * 共有MCPで指定されたリポジトリを、共通のTopic／Meeting処理へ結び付ける。
 *
 * @responsibility SDKで検査された引数からリポジトリIDを分け、対象に結び付く処理へ渡す。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input call: SDKで検査されたTool呼出し、signal: 当該要求の取消、対象別の読取りまたは記録操作。
 * @returns 共通Topic／Meeting処理の応答または対象を開示しない失敗。
 * @precondition SDKの公開スキーマに適合し、共有リポジトリを明示している。
 * @postcondition 記録操作は業務入力と取消を確認し、有効な対象に対してだけ実行する。
 * @effect 許可済みApplicationが発行する一操作だけを許容する。
 * @failure 対象を観測または許可できない場合は処理せず、内部の認可情報を公開しない。
 * @invariant Repository Identityを暗黙選択または別RepositoryへFallbackしない。
 * @boundary 共有MCP Toolから対象リポジトリの記録サービスへの接続。
 * @security 拒否結果へRepositoryの存在、Role、WorkspaceまたはBindingを含めない。
 * @concurrency 一Requestで解決したApplicationだけを同じCallに使用する。
 */
async function dispatchRoutedTopicMeetingCall(
  call: McpToolCall,
  resolveTopicMeetingAccess: TopicMeetingAccessResolver | undefined,
  signal: AbortSignal,
  records?: McpServerDependencies["recordOperations"],
): Promise<McpResponse> {
  const { repositoryId, ...localArguments } = call.arguments as Record<
    string,
    unknown
  > & { repositoryId: string };
  const resolveLocal = () => resolveTopicMeetingAccess?.(repositoryId) ?? null;
  return dispatchTopicMeetingCall(
    Object.freeze({
      ...call,
      arguments: Object.freeze(localArguments),
    }),
    resolveLocal,
    signal,
    records?.(repositoryId, signal),
  );
}

/** 単体・共有の正規呼出しを、JSON-RPCの再構築なしで同じTool処理へ渡す。 @trace ARCH-000012 */
async function dispatchTopicMeetingCall(
  params: McpToolCall,
  access: TopicMeetingAccess | (() => TopicMeetingAccess | null),
  signal: AbortSignal,
  records?: RecordOperations,
): Promise<McpResponse> {
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const args = params.arguments as Record<string, unknown>;
  const kind = params.name.includes("meeting") ? "meeting" : "topic";
  let accessResolved = false;
  try {
    const operation = recordWriteOperations.get(params.name);
    if (operation) {
      const action = readRecordWrite(kind, operation, args);
      if (!action) return protocolError(params.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      const resolveLocal = () =>
        typeof access === "function" ? access() : access;
      const result = records
        ? await records.write(action)
        : (() => {
            const application = resolveLocal();
            return !signal.aborted && application
              ? executeRecordWrite(application, action)
              : null;
          })();
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (!result) return protocolError(params.id, -32602, "Invalid params");
      return protocolComplete(params.id, {
        content: Object.freeze([{ type: "text", text: result.reason }]),
        structuredContent: result,
        isError: result.status !== "completed",
      });
    }
    if (
      [MCP_TOPIC_LIST_TOOL, MCP_MEETING_LIST_TOOL].includes(
        params.name as never,
      )
    ) {
      // 形・上限は公開スキーマで検査済み。検索・ページ指定の意味は記録サービスが検査する。
      const query = {
        ...(args.query === undefined ? {} : { query: args.query as string }),
        ...(args.states === undefined
          ? {}
          : { states: args.states as readonly string[] }),
        ...(args.owner === undefined ? {} : { owner: args.owner as string }),
        ...(args.relation === undefined
          ? {}
          : { relation: args.relation as string }),
        ...(args.occurredFrom === undefined
          ? {}
          : { occurredFrom: args.occurredFrom as string }),
        ...(args.occurredTo === undefined
          ? {}
          : { occurredTo: args.occurredTo as string }),
        ...(args.pendingOnly === undefined
          ? {}
          : { pendingOnly: args.pendingOnly as boolean }),
        ...(args.sort === undefined ? {} : { sort: args.sort as never }),
      };
      const listInput = {
        ...(args.cursor === undefined ? {} : { cursor: args.cursor as string }),
        ...(args.limit === undefined ? {} : { limit: args.limit as number }),
        ...(Object.keys(query).length === 0 ? {} : { query }),
      };

      const result = records
        ? await records.list({ kind, ...listInput })
        : readTopicMeetingList(
            { kind, ...listInput },
            () => {
              const application =
                typeof access === "function" ? access() : access;
              accessResolved = true;
              return application;
            },
            signal,
          );
      if (signal.aborted || result.status === "cancelled")
        return protocolError(params.id, -32800, "Request cancelled");
      if (result.status !== "complete")
        return protocolError(params.id, -32602, "Invalid params");
      const page = result.page;
      return protocolComplete(params.id, {
        content: Object.freeze([
          { type: "text", text: `${page.records.length}件を取得しました。` },
        ]),
        structuredContent: page,
        isError: false,
      });
    }
    if (
      [MCP_TOPIC_GET_TOOL, MCP_MEETING_GET_TOOL].includes(params.name as never)
    ) {
      const id = args.id as string;
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (records) {
        const result = await records.get(kind, id);
        if (signal.aborted)
          return protocolError(params.id, -32800, "Request cancelled");
        if (!result) return protocolError(params.id, -32602, "Invalid params");
        return protocolComplete(params.id, {
          content: [{ type: "text", text: result.status }],
          structuredContent: result,
          isError: result.status !== "completed",
        });
      }
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(params.id, -32602, "Invalid params");
      const observed = application[kind].getDocumentWithRelations(id);
      const record = observed?.document.record ?? null;
      const relations = observed?.relations ?? Object.freeze([]);
      return protocolComplete(params.id, {
        content: Object.freeze([
          {
            type: "text",
            text: record ? `${id}を取得しました。` : `${id}は見つかりません。`,
          },
        ]),
        structuredContent: Object.freeze({
          status: record ? "completed" : "not_found",
          record,
          markdown: observed?.document.markdown ?? null,
          relations,
        }),
        isError: record === null,
      });
    }
  } catch (error) {
    if (records && signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (
      accessResolved &&
      [MCP_TOPIC_LIST_TOOL, MCP_MEETING_LIST_TOOL].includes(
        params.name as never,
      ) &&
      error instanceof Error &&
      [
        "project_operation_list_limit_invalid",
        "project_operation_list_query_invalid",
        "project_operation_list_cursor_invalid",
      ].includes(error.message)
    )
      return protocolError(params.id, -32602, "Invalid params");
    return protocolError(params.id, -32603, "Internal error");
  }
  return protocolError(params.id, -32601, "Method not found");
}

export const MCP_TOPIC_LIST_TOOL = "crdd.list_topics" as const;
export const MCP_TOPIC_GET_TOOL = "crdd.get_topic" as const;
export const MCP_TOPIC_CREATE_TOOL = "crdd.create_topic" as const;
export const MCP_TOPIC_UPDATE_TOOL = "crdd.update_topic" as const;
const MCP_TOPIC_DELETE_TOOL = "crdd.delete_topic" as const;
export const MCP_TOPIC_PROMOTE_TOOL = "crdd.promote_topic" as const;
const MCP_MEETING_LIST_TOOL = "crdd.list_meetings" as const;
const MCP_MEETING_GET_TOOL = "crdd.get_meeting" as const;
export const MCP_MEETING_CREATE_TOOL = "crdd.create_meeting" as const;
export const MCP_MEETING_UPDATE_TOOL = "crdd.update_meeting" as const;
const MCP_MEETING_DELETE_TOOL = "crdd.delete_meeting" as const;
export const MCP_MEETING_TREAT_OUTCOME_TOOL =
  "crdd.treat_meeting_outcome" as const;

export const MCP_TOPIC_MEETING_TOOLS = Object.freeze([
  MCP_TOPIC_LIST_TOOL,
  MCP_TOPIC_GET_TOOL,
  MCP_TOPIC_CREATE_TOOL,
  MCP_TOPIC_UPDATE_TOOL,
  MCP_TOPIC_DELETE_TOOL,
  MCP_TOPIC_PROMOTE_TOOL,
  MCP_MEETING_LIST_TOOL,
  MCP_MEETING_GET_TOOL,
  MCP_MEETING_CREATE_TOOL,
  MCP_MEETING_UPDATE_TOOL,
  MCP_MEETING_DELETE_TOOL,
  MCP_MEETING_TREAT_OUTCOME_TOOL,
]);

const recordWriteOperations = new Map<string, RecordActionName>([
  [MCP_TOPIC_CREATE_TOOL, "create"],
  [MCP_TOPIC_UPDATE_TOOL, "update"],
  [MCP_TOPIC_DELETE_TOOL, "delete"],
  [MCP_TOPIC_PROMOTE_TOOL, "promote"],
  [MCP_MEETING_CREATE_TOOL, "create"],
  [MCP_MEETING_UPDATE_TOOL, "update"],
  [MCP_MEETING_DELETE_TOOL, "delete"],
  [MCP_MEETING_TREAT_OUTCOME_TOOL, "treat-outcome"],
]);

const TEXT_SCHEMA = Object.freeze({ type: "string" });
const TOPIC_ID_SCHEMA = Object.freeze({
  type: "string",
  pattern: "^TOPIC-\\d{6}$",
});
const MEETING_ID_SCHEMA = Object.freeze({
  type: "string",
  pattern: "^MTG-\\d{6}$",
});
const POSITIVE_INTEGER_SCHEMA = Object.freeze({
  type: "integer",
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

/**
 * Topic／Meeting MCP Protocol境界におけるtoolの処理境界を固定する。
 *
 * @responsibility Topic／Meeting MCP Protocol境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000005
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function defineTopicMeetingTool(
  name: (typeof MCP_TOPIC_MEETING_TOOLS)[number],
  title: string,
  description: string,
  requiredKeys: readonly string[],
  properties: Readonly<Record<string, unknown>>,
  constraints: Readonly<Record<string, unknown>> = {},
) {
  return Object.freeze({
    name,
    title,
    description,
    inputSchema: Object.freeze({
      ...constraints,
      type: "object",
      additionalProperties: false,
      required: Object.freeze([...requiredKeys]),
      properties: Object.freeze(properties),
    }),
  });
}

/**
 * Topic／Meeting CRUD Tool Definitionsを固定順で返す。
 *
 * @responsibility 単体の起動対象と共有の明示対象を、同じToolの入力スキーマの差として表す。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input repositoryTarget: Repository対象を入口で暗黙化するか、各Callで必須にするかを指定する。
 * @returns 固定順のTopic／Meeting Tool Definition集合。
 * @precondition requiredは、明示対象を現在の認可で解決する処理に接続した場合だけ使用する。
 * @postcondition required時は全ToolのrequiredとpropertiesへrepositoryIdを一回だけ追加する。
 * @effect N/A: 不変Schema Objectを生成するだけである。
 * @failure N/A: 閉じた列挙値だけを受け取る。
 * @invariant Tool名とTopic／Meeting操作意味をTarget方式で変更しない。
 * @boundary MCP Tool DiscoveryとRepository Routing Adapterの境界。
 * @security 明示Repository IDだけでContent Accessを許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function getTopicMeetingToolDefinitions(
  repositoryTarget: "implicit" | "required" = "implicit",
) {
  const target =
    repositoryTarget === "required"
      ? Object.freeze({
          repositoryId: { type: "string", pattern: RESOURCE_ID.source },
        })
      : Object.freeze({});
  /**
   * Target方式に応じたrequired Key集合を生成する。
   *
   * @responsibility 共有の明示対象でだけrepositoryIdを各Toolの必須入力にする。
   * @trace ARCH-000005
   * @trace ARCH-000013
   * @input keys: Repository単体Toolが本来要求するKey集合。
   * @returns Target方式を反映した重複のないKey集合。
   * @precondition keysは各Tool固有の固定Keyである。
   * @postcondition 入力順を維持し、Remote時はrepositoryIdを先頭に置く。
   * @effect N/A: 配列を生成するだけである。
   * @failure N/A: 閉じた文字列配列だけを扱う。
   * @invariant Repository単体時のrequired集合を変更しない。
   * @boundary N/A: Tool Schema生成内部で完結する。
   * @security repositoryIdをAuthorityとして扱わない。
   * @concurrency N/A: 共有状態を持たない同期処理である。
   */
  const required = (keys: readonly string[]) =>
    repositoryTarget === "required"
      ? Object.freeze(["repositoryId", ...keys])
      : Object.freeze([...keys]);
  const page = (kind: ProjectOperationRecordKind) => ({
    ...target,
    cursor: TEXT_SCHEMA,
    limit: Object.freeze({ type: "integer", minimum: 1, maximum: 100 }),
    query: TEXT_SCHEMA,
    states: Object.freeze({
      type: "array",
      maxItems: 4,
      items: { type: "string", enum: recordListQueryConstraints[kind].states },
    }),
    owner: TEXT_SCHEMA,
    relation: {
      type: "string",
      pattern: recordListQueryConstraints.relatedId.source,
    },
    ...(kind === "meeting" && {
      occurredFrom: {
        type: "string",
        pattern: recordListQueryConstraints.date.source,
      },
      occurredTo: {
        type: "string",
        pattern: recordListQueryConstraints.date.source,
      },
      pendingOnly: { type: "boolean" },
    }),
    sort: { type: "string", enum: recordListQueryConstraints[kind].sorts },
  });
  const record = Object.freeze({ ...target, id: TEXT_SCHEMA });
  const create = Object.freeze({ ...target, markdown: TEXT_SCHEMA });
  const update = Object.freeze({
    ...target,
    id: TEXT_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    markdown: TEXT_SCHEMA,
  });
  const remove = Object.freeze({
    ...target,
    id: TEXT_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    confirmed: Object.freeze({ type: "boolean" }),
    reason: Object.freeze({ type: "string", const: "mistaken_registration" }),
  });
  const treatOutcome = Object.freeze({
    ...target,
    meetingId: MEETING_ID_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    outcomeId: Object.freeze({ type: "string", pattern: "^OUT-\\d{3,}$" }),
    disposition: Object.freeze({
      type: "string",
      enum: Object.freeze(["completed", "transferred", "promoted", "rejected"]),
    }),
    owner: TEXT_SCHEMA,
    reviewTrigger: TEXT_SCHEMA,
    targetKind: Object.freeze({
      type: "string",
      enum: Object.freeze(["topic", "change", "owner", "none"]),
    }),
    targetReference: TEXT_SCHEMA,
    treatment: TEXT_SCHEMA,
    completionCondition: TEXT_SCHEMA,
    result: TEXT_SCHEMA,
    closeMeeting: Object.freeze({ type: "boolean" }),
  });
  const promoteTopic = Object.freeze({
    ...target,
    topicId: TOPIC_ID_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    changeId: Object.freeze({ type: "string", pattern: "^CHG-\\d{6}$" }),
    reason: TEXT_SCHEMA,
    remainingResponsibility: TEXT_SCHEMA,
  });
  return Object.freeze([
    defineTopicMeetingTool(
      MCP_TOPIC_LIST_TOOL,
      "Topic一覧",
      "TopicをID順に取得します。",
      required([]),
      page("topic"),
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_GET_TOOL,
      "Topic取得",
      "Topicを一件取得します。",
      required(["id"]),
      { ...record, id: TOPIC_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_CREATE_TOOL,
      "Topic登録",
      "固定Markdownを検証してTopicを登録します。",
      required(["markdown"]),
      create,
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_UPDATE_TOOL,
      "Topic編集",
      "期待改訂と次改訂を検証してTopicを更新します。",
      required(["id", "expectedRevision", "markdown"]),
      { ...update, id: TOPIC_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_DELETE_TOOL,
      "Topic削除",
      "Relation影響と明示確認を検証して誤登録Topicを削除します。",
      required(["id", "expectedRevision", "confirmed", "reason"]),
      { ...remove, id: TOPIC_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_PROMOTE_TOOL,
      "Topic昇格",
      "実在する採用済みCHGへTopicを接続し、状態・Relation・改訂を同時更新します。",
      required([
        "topicId",
        "expectedRevision",
        "changeId",
        "reason",
        "remainingResponsibility",
      ]),
      promoteTopic,
    ),
    defineTopicMeetingTool(
      MCP_MEETING_LIST_TOOL,
      "Meeting一覧",
      "MeetingをID順に取得します。",
      required([]),
      page("meeting"),
    ),
    defineTopicMeetingTool(
      MCP_MEETING_GET_TOOL,
      "Meeting取得",
      "Meetingを一件取得します。",
      required(["id"]),
      { ...record, id: MEETING_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_MEETING_CREATE_TOOL,
      "Meeting登録",
      "固定Markdownを検証してMeetingを登録します。",
      required(["markdown"]),
      create,
    ),
    defineTopicMeetingTool(
      MCP_MEETING_UPDATE_TOOL,
      "Meeting編集",
      "期待改訂と次改訂を検証してMeetingを更新します。",
      required(["id", "expectedRevision", "markdown"]),
      { ...update, id: MEETING_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_MEETING_DELETE_TOOL,
      "Meeting削除",
      "Relation影響と明示確認を検証して誤登録Meetingを削除します。",
      required(["id", "expectedRevision", "confirmed", "reason"]),
      { ...remove, id: MEETING_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_MEETING_TREAT_OUTCOME_TOOL,
      "Meeting Outcome処置",
      "一つのOutcomeを完了・移管・昇格・不採用として処置し、全件処置済みの場合だけMeetingを閉じます。",
      required([
        "meetingId",
        "expectedRevision",
        "outcomeId",
        "disposition",
        "owner",
        "reviewTrigger",
        "targetKind",
        "targetReference",
        "treatment",
        "completionCondition",
        "result",
        "closeMeeting",
      ]),
      treatOutcome,
      {
        anyOf: [
          {
            properties: {
              targetKind: { const: "topic" },
              targetReference: TOPIC_ID_SCHEMA,
            },
          },
          {
            properties: {
              targetKind: { const: "change" },
              targetReference: { type: "string", pattern: "^CHG-\\d{6}$" },
            },
          },
          { properties: { targetKind: { enum: ["owner", "none"] } } },
        ].map(({ properties }) => ({
          type: "object",
          additionalProperties: false,
          properties: { ...treatOutcome, ...properties },
        })),
      },
    ),
  ]);
}

/**
 * 当該要求だけに結合した管理Context。
 * @responsibility 構成済みRootと検証済み主体を入力値から分離する。
 * @trace ARCH-000013
 * @shape rootとprincipalのみ。
 * @invariant Role・許可結果をcacheしない。
 * @boundary MCP要求closureの内部構成。
 * @security JSON・永続状態・ログへ公開しない。
 * @compatibility 単体stdioには共有のアクセス管理を構成しない。
 */
type McpAccessManagementContext = Readonly<{
  root: FilesystemStoreRoot;
  principal: AccountAccessPrincipal;
  isCurrent(): boolean;
}>;

/**
 * 通常本人Toolと現在主体に許可された管理Toolを一覧表示する。
 * @responsibility 本人表示と管理一覧を分離し、実行許可と一覧表示を区別する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 当該要求の管理Context。
 * @returns 全Roleの本人一Tool、manager／administratorには管理の読取り四Toolを追加。
 * @precondition 通常接続の要求で構成されている。
 * @postcondition 一覧のRoleを後続保存のAuthorityへ渡さない。
 * @effect AMの現在本人認証・既存短期Lock。
 * @failure 認証・状態不明は固定例外で一覧を停止する。
 * @invariant 管理一覧から内容閲覧を付与しない。
 * @boundary AM現在認証とMCP一覧。
 * @security 本人Snapshot・Root・資格を返さない。
 * @concurrency 各一覧でfresh認証し、後続callでも再評価する。
 */
function listMcpAccessTools(context: McpAccessManagementContext) {
  const actor = readCurrentAccess(context.root, context.principal);
  if (actor.status !== "completed" || !context.isCurrent())
    throw new Error("access_management_unavailable");
  return actor.user.role === "developer"
    ? mcpToolCatalog.access.self
    : mcpToolCatalog.access.management;
}

/**
 * 管理結果を標準Tool応答へ全量接続する。
 * @responsibility 閉UnionをstructuredContentに置き、部分結果を返さない。
 * @trace ARCH-000012
 * @input 元Request IDと投影済み非秘密結果。
 * @returns 閉じた管理結果を保持した通常Tool応答。
 * @precondition 値は本Adapterの閉投影で生成する。
 * @postcondition 説明textへ入力・理由・状態を複製しない。
 * @effect N/A: メモリ内serializeのみ。
 * @failure 下位結果の失敗分類を保持し、出力量だけでは結果を置換しない。
 * @invariant 保存や認可を再実行しない。
 * @boundary MCP Tool結果とJSON-RPC搬送。
 * @security Path・秘密を追加しない。
 * @concurrency N/A: 完了済み結果の同期投影だけ。
 */
function completeManagementResponse(
  id: JsonRpcId,
  result: Readonly<Record<string, unknown>>,
): McpResponse {
  return protocolComplete(id, {
    content: [{ type: "text", text: "アクセス管理結果を取得しました。" }],
    structuredContent: result,
    isError: result.status !== "completed",
  });
}

/** 管理の読取りだけをAMへ委譲する。直接呼出しでもAMが現在権限を照合する。 @trace ARCH-000013 */
async function dispatchAccessTool(
  params: McpToolCall,
  context: McpAccessManagementContext,
  signal: AbortSignal,
): Promise<McpResponse> {
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const kind = Object.hasOwn(managementReads, params.name)
    ? managementReads[params.name as keyof typeof managementReads].kind
    : undefined;
  try {
    // 切断を観測する待機は現在認可の前に置き、投影後に古い結果を持って待たない。
    await setTimeout(0);
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (!context.isCurrent())
      return protocolError(params.id, -32603, "Access management unavailable");
    let result: Readonly<Record<string, unknown>>;
    if (params.name === MCP_CURRENT_ACCESS_TOOL) {
      result = readCurrentAccess(context.root, context.principal);
    } else if (kind) {
      result = readManagementState(context.root, context.principal, kind);
    } else {
      return protocolError(params.id, -32601, "Method not found");
    }
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (!context.isCurrent())
      return protocolError(params.id, -32603, "Access management unavailable");
    return completeManagementResponse(params.id, result);
  } catch {
    return protocolError(
      params.id,
      signal.aborted ? -32800 : -32603,
      signal.aborted ? "Request cancelled" : "Access management unavailable",
    );
  }
}

/** MCPに公開する管理の読取り名。 @trace ARCH-000012 */
export const MCP_ACCESS_MANAGEMENT_READ_TOOLS = Object.freeze({
  listUsers: "crdd.list_access_users",
  listRepositories: "crdd.list_registered_repositories",
} as const);

const managementReads = {
  [MCP_ACCESS_MANAGEMENT_READ_TOOLS.listUsers]: {
    kind: "users",
    title: "ユーザー一覧",
  },
  [MCP_ACCESS_MANAGEMENT_READ_TOOLS.listRepositories]: {
    kind: "registeredRepositories",
    title: "登録リポジトリ一覧",
  },
} as const;

/**
 * 通常本人readの操作名を管理操作から分離する。
 * @responsibility 全Roleに提供する本人操作Identityを固定する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
export const MCP_CURRENT_ACCESS_TOOL = "crdd.get_current_access" as const;
/**
 * 本人readの空閉入力を定義する。
 * @responsibility 資格・管理Root・他User指定を受け取らない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
const MCP_CURRENT_ACCESS_TOOL_DEFINITION = Object.freeze({
  name: MCP_CURRENT_ACCESS_TOOL,
  title: "接続している本人",
  description:
    "現在の本人とロールを返します。リポジトリ内容の許可やToolの提供可否を示すものではありません。",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: [],
    properties: {},
  },
});

/** 管理読取りはどれも引数を受け付けない。 @trace ARCH-000012 */
function getAccessToolDefinitions() {
  return Object.entries(managementReads).map(([name, { title }]) => ({
    name,
    title,
    description: "現在の管理権限で読み取ります。内容や資格の操作は行いません。",
    annotations: { readOnlyHint: true, destructiveHint: false },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {},
    },
  }));
}

// 共有するのは入力スキーマだけ。主体ごとの公開集合や要求のServerは保持しない。
const mcpToolCatalog = {
  executionDefinition: getExecutionDefinitionToolDefinitions(),
  workspace: getWorkspaceToolDefinitions(),
  execution: {
    shared: {
      standard: getExecutionToolDefinitions(true),
      cancellable: getExecutionToolDefinitions(true, true),
    },
    single: {
      standard: getExecutionToolDefinitions(),
      cancellable: getExecutionToolDefinitions(false, true),
    },
  },
  project: {
    shared: getProjectToolDefinitions(true),
    single: getProjectToolDefinitions(),
  },
  activity: getExecutionActivityToolDefinitions(),
  records: {
    required: getTopicMeetingToolDefinitions("required"),
    implicit: getTopicMeetingToolDefinitions("implicit"),
  },
  access: {
    self: [MCP_CURRENT_ACCESS_TOOL_DEFINITION],
    management: [
      MCP_CURRENT_ACCESS_TOOL_DEFINITION,
      ...getAccessToolDefinitions(),
    ],
  },
};
