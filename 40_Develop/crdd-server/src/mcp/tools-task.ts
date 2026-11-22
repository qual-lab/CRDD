/**
 * CoordinatorのTool定義と要求・結果の搬送を所有する。
 *
 * @responsibility McpCoordinatorDependenciesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000012
 */

import {
  inspectCoordinatorDecisionRequest,
  inspectCoordinatorDecisionResult,
  inspectCoordinatorObjectiveRequest,
  inspectCoordinatorObjectiveResult,
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
} from "../../../coordinator/src/index.ts";
import { isPrincipalId } from "../../../execution-model/src/index.ts";

import { snapshotPlainRecord } from "../request/snapshot.ts";
import {
  callKeys,
  discoverKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  listKeys,
  listKeysNoCursor,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  type McpResponse,
  protocolComplete,
  protocolError,
} from "./request-validation.ts";

export const MCP_COORDINATOR_ADAPTER_CONTRACT =
  "crdd-mcp/coordinator-adapter/v6" as const;
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
export type McpCoordinatorDependencies = Readonly<{
  authenticateClient: () => unknown;
  runObjective: (
    request: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
  submitDecision: (
    request: Readonly<Record<string, unknown>>,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
  getProjectState: (
    request: Readonly<Record<string, unknown>>,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
}>;

/**
 * Mcp Coordinator Requestを処理する。
 *
 * @responsibility Mcp Coordinator Requestの受付条件、処理結果、失敗時の戻り境界を所有する。
 * @trace ARCH-000012
 * @input rawRequest: unknown、dependencies: McpCoordinatorDependencies、signal: AbortSignal
 * @returns Promise<McpResponse>を返す。
 * @precondition 「rawRequest: unknown、dependencies: McpCoordinatorDependencies、signal: AbortSignal」がhandleMcpCoordinatorRequestの入力契約を満たす。
 * @postcondition handleMcpCoordinatorRequestの責務を完了した結果だけを返す。
 * @effect N/A: handleMcpCoordinatorRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure handleMcpCoordinatorRequestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant handleMcpCoordinatorRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: handleMcpCoordinatorRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency handleMcpCoordinatorRequestは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function handleMcpCoordinatorRequest(
  rawRequest: unknown,
  dependencies: McpCoordinatorDependencies,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(rawRequest);
  if (!request) return protocolError(null, -32600, "Invalid Request");
  if (request.method === "server/discover") {
    const params = snapshotPlainRecord(request.params, discoverKeys);
    return !params || !inspectMcpEnvelope(params._meta)
      ? protocolError(request.id, -32602, "Invalid params")
      : protocolComplete(request.id, {
          supportedVersions: Object.freeze([MCP_COORDINATOR_PROTOCOL_VERSION]),
          capabilities: Object.freeze({ tools: Object.freeze({}) }),
          ttlMs: 0,
          cacheScope: "private",
        });
  }
  if (request.method === "tools/list") {
    const params =
      snapshotPlainRecord(request.params, listKeysNoCursor) ??
      snapshotPlainRecord(request.params, listKeys);
    const paramsRecord: Readonly<Record<string, unknown>> | null = params;
    return !params ||
      !inspectMcpEnvelope(params._meta) ||
      (Object.hasOwn(params, "cursor") && paramsRecord?.cursor !== null)
      ? protocolError(request.id, -32602, "Invalid params")
      : protocolComplete(request.id, {
          tools: getMcpCoordinatorToolDefinitions(),
          ttlMs: 0,
          cacheScope: "private",
        });
  }
  if (request.method !== "tools/call")
    return protocolError(request.id, -32601, "Method not found");
  const params = snapshotPlainRecord(request.params, callKeys);
  if (
    !params ||
    !inspectMcpEnvelope(params._meta) ||
    (params.name !== MCP_COORDINATOR_OBJECTIVE_TOOL &&
      params.name !== MCP_COORDINATOR_DECISION_TOOL &&
      params.name !== MCP_COORDINATOR_STATE_TOOL)
  )
    return protocolError(request.id, -32602, "Invalid params");
  const args =
    params.name === MCP_COORDINATOR_OBJECTIVE_TOOL
      ? inspectCoordinatorObjectiveRequest(params.arguments)
      : params.name === MCP_COORDINATOR_DECISION_TOOL
        ? inspectCoordinatorDecisionRequest(params.arguments)
        : inspectCoordinatorStateQuery(params.arguments);
  if (!args) return protocolError(request.id, -32602, "Invalid params");
  let authentication: unknown;
  try {
    authentication = dependencies.authenticateClient();
  } catch {
    authentication = null;
  }
  const authenticationSnapshot = snapshotPlainRecord(
    authentication,
    new Set(["principalId", "status"] as const),
  );
  if (
    authenticationSnapshot?.status !== "verified" ||
    !isPrincipalId(authenticationSnapshot.principalId)
  )
    return protocolComplete(request.id, {
      content: Object.freeze([
        Object.freeze({
          type: "text",
          text: "利用者を確認できないため、処理を開始していません。",
        }),
      ]),
      structuredContent: Object.freeze({
        status: "blocked",
        reason: "mcp_client_not_authenticated",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect",
      }),
      isError: true,
    });
  let raw: unknown;
  const authenticatedContext = Object.freeze({
    principalId: authenticationSnapshot.principalId,
  });
  try {
    raw =
      params.name === MCP_COORDINATOR_OBJECTIVE_TOOL
        ? await dependencies.runObjective(args, signal, authenticatedContext)
        : params.name === MCP_COORDINATOR_DECISION_TOOL
          ? await dependencies.submitDecision(args, authenticatedContext)
          : await dependencies.getProjectState(args, authenticatedContext);
  } catch {
    raw = null;
  }
  let snapshot: ReturnType<typeof inspectCoordinatorObjectiveResult> | null =
    null;
  try {
    snapshot =
      params.name === MCP_COORDINATOR_OBJECTIVE_TOOL
        ? inspectCoordinatorObjectiveResult(
            raw,
            "workspaceId" in args && typeof args.workspaceId === "string"
              ? args.workspaceId
              : null,
          )
        : params.name === MCP_COORDINATOR_DECISION_TOOL
          ? inspectCoordinatorDecisionResult(raw)
          : inspectCoordinatorStateQueryResult(raw);
  } catch {
    snapshot = null;
  }
  const result =
    snapshot ??
    Object.freeze({
      status: "blocked",
      reason: "mcp_coordinator_result_invalid",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  const isFailed = result.status !== "completed";
  return protocolComplete(request.id, {
    content: Object.freeze([
      Object.freeze({
        type: "text",
        text: isFailed
          ? "処理は完了していません。構造化された理由を確認してください。"
          : "処理が完了しました。",
      }),
    ]),
    structuredContent: result,
    isError: isFailed,
  });
}

/**
 * Mcp Coordinator Adapter 契約の公開契約を記述する。
 *
 * @responsibility Mcp Coordinator Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeMcpCoordinatorAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeMcpCoordinatorAdapterContractの入力契約を満たす。
 * @postcondition describeMcpCoordinatorAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeMcpCoordinatorAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeMcpCoordinatorAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeMcpCoordinatorAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeMcpCoordinatorAdapterContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeMcpCoordinatorAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeMcpCoordinatorAdapterContract() {
  return Object.freeze({
    contract: MCP_COORDINATOR_ADAPTER_CONTRACT,
    protocolVersion: MCP_COORDINATOR_PROTOCOL_VERSION,
    tools: Object.freeze([
      MCP_COORDINATOR_OBJECTIVE_TOOL,
      MCP_COORDINATOR_DECISION_TOOL,
      MCP_COORDINATOR_STATE_TOOL,
    ]),
    transportState: "stateless_per_request",
    clientMetadataAuthority: "none",
    projectModelOwnership: "coordinator",
  });
}

export const MCP_COORDINATOR_OBJECTIVE_TOOL = "crdd.run_objective" as const;
export const MCP_COORDINATOR_DECISION_TOOL = "crdd.submit_decision" as const;
export const MCP_COORDINATOR_STATE_TOOL = "crdd.get_coordinator_state" as const;

const objectiveKeys = new Set([
  "operation",
  "plan",
  "taskInputs",
  "requestId",
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "maximumConcurrency",
  "maximumReplans",
  "originLane",
  "adoptResult",
  "workType",
  "choice",
  "workspaceId",
] as const);
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
 * Mcp Coordinator Tool Definitionsを取得する。
 *
 * @responsibility Mcp Coordinator Tool Definitionsの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns getMcpCoordinatorToolDefinitionsの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がgetMcpCoordinatorToolDefinitionsの入力契約を満たす。
 * @postcondition getMcpCoordinatorToolDefinitionsの責務を完了した結果だけを返す。
 * @effect N/A: getMcpCoordinatorToolDefinitionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getMcpCoordinatorToolDefinitionsは独自の失敗分岐を所有しない。
 * @invariant getMcpCoordinatorToolDefinitionsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getMcpCoordinatorToolDefinitionsはProcess内の同一Subsystemで完結する。
 * @security N/A: getMcpCoordinatorToolDefinitionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: getMcpCoordinatorToolDefinitionsは共有非同期状態を持たない同期処理である。
 */
export function getMcpCoordinatorToolDefinitions() {
  const id = Object.freeze({
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  });
  const rev = Object.freeze({ type: "string", pattern: "^[0-9a-f]{40,64}$" });
  const list = (maximum: number) =>
    Object.freeze({
      type: "array",
      minItems: 1,
      maxItems: maximum,
      items: Object.freeze({ type: "string" }),
    });
  const decisionBase = {
    operation: { enum: ["request", "answer", "apply", "close"] },
    decisionId: id,
    projectId: id,
    milestoneId: id,
    generation: { type: "integer", minimum: 1 },
    repositoryRevision: rev,
  };
  const decisionVariants = {
    request: {
      blockerId: id,
      queueId: id,
      question: { type: "string", minLength: 1, maxLength: 8192 },
      allowedOptions: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        uniqueItems: true,
        items: { enum: ["resume", "cancel"] },
      },
    },
    answer: {
      selectedOption: { enum: ["resume", "cancel"] },
      comment: { type: "string", maxLength: 1024 },
    },
    apply: {},
    close: {
      status: { enum: ["invalidated"] },
      reason: { type: "string", minLength: 1, maxLength: 1024 },
    },
  };
  return Object.freeze([
    tool(
      MCP_COORDINATOR_OBJECTIVE_TOOL,
      "CRDD Objectiveを実行",
      "検証済みProjectへObjectiveを登録し、Coordinatorで実行します。",
      {
        operation: { type: "string", enum: ["start", "resume"] },
        plan: {
          type: "object",
          additionalProperties: false,
          required: ["milestoneAcceptanceCriteria", "objectives", "tasks"],
          properties: {
            milestoneAcceptanceCriteria: list(128),
            objectives: {
              type: "array",
              minItems: 1,
              maxItems: 128,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "acceptanceCriteria"],
                properties: { id, acceptanceCriteria: list(128) },
              },
            },
            tasks: {
              type: "array",
              minItems: 1,
              maxItems: 1024,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "id",
                  "objectiveId",
                  "dependencies",
                  "allowedPaths",
                  "conflictKeys",
                ],
                properties: {
                  id,
                  objectiveId: id,
                  dependencies: { ...list(128), minItems: 0 },
                  allowedPaths: list(128),
                  conflictKeys: { ...list(128), minItems: 0 },
                },
              },
            },
          },
        },
        taskInputs: {
          type: "array",
          minItems: 1,
          maxItems: 1024,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "taskId",
              "objective",
              "acceptanceCriteria",
              "readPaths",
            ],
            properties: {
              taskId: id,
              objective: { type: "string", minLength: 1, maxLength: 16_384 },
              acceptanceCriteria: list(128),
              readPaths: list(128),
            },
          },
        },
        requestId: id,
        projectId: id,
        milestoneId: id,
        repositoryRevision: rev,
        objective: Object.freeze({ type: "string", maxLength: 16_384 }),
        acceptanceCriteria: list(128),
        allowedPaths: list(128),
        readPaths: list(128),
        maximumConcurrency: Object.freeze({
          type: "integer",
          minimum: 1,
          maximum: 5,
        }),
        maximumReplans: Object.freeze({
          type: "integer",
          minimum: 0,
          maximum: 32,
        }),
        originLane: Object.freeze({
          enum: Object.freeze(["interactive", "scheduled"]),
        }),
        adoptResult: Object.freeze({ type: "boolean" }),
        workType: Object.freeze({
          type: "string",
          pattern: "^[a-z0-9][a-z0-9._-]*$",
        }),
        choice: Object.freeze({
          type: "object",
          additionalProperties: false,
          required: Object.freeze(["provider", "model", "effort"]),
          properties: Object.freeze({
            provider: Object.freeze({
              enum: Object.freeze(["codex", "claude"]),
            }),
            model: Object.freeze({
              type: "string",
              maxLength: 128,
              pattern: "^[a-z0-9][a-z0-9._-]{0,127}$",
            }),
            effort: Object.freeze({
              enum: Object.freeze(["low", "medium", "high", "xhigh", "max"]),
            }),
          }),
        }),
        workspaceId: Object.freeze({
          type: "string",
          pattern: "^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$",
        }),
      },
      [...objectiveKeys].filter(
        (key) =>
          key !== "workType" && key !== "choice" && key !== "workspaceId",
      ),
    ),
    Object.freeze({
      ...tool(
        MCP_COORDINATOR_DECISION_TOOL,
        "CRDDの判断を処理",
        "認証済みの同じ利用者が継続判断を要求・回答・明示適用・閉鎖します。回答だけでAIを再実行しません。",
        Object.assign({}, decisionBase, ...Object.values(decisionVariants)),
        Object.keys(decisionBase),
      ),
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        properties: Object.assign(
          {},
          decisionBase,
          ...Object.values(decisionVariants),
        ),
        required: Object.keys(decisionBase),
        oneOf: Object.entries(decisionVariants).map(
          ([operation, properties]) => ({
            type: "object",
            additionalProperties: false,
            properties: {
              ...decisionBase,
              operation: { const: operation },
              ...properties,
            },
            required: [
              ...Object.keys(decisionBase),
              ...Object.keys(properties).filter((key) => key !== "comment"),
            ],
          }),
        ),
      }),
    }),
    tool(
      MCP_COORDINATOR_STATE_TOOL,
      "CRDDのTask実行状態を取得",
      "Taskの実行状態を、Project Contextとは別の読取り専用投影として取得します。",
      {
        requestId: id,
        projectId: id,
        repositoryRevision: rev,
      },
      [...stateQueryKeys],
    ),
  ]);
}
