/**
 * HTTPとMCPが共用するWorkspaceの入力契約と実行準備。
 * @responsibility 操作と入力形を公開し、受理した要求だけをWorkspace処理へ接続する。
 * @trace ARCH-000012
 * @boundary 通信方式別の受付から専門Ownerへの接続。
 */
import { GIT_OBJECT_ID, RESOURCE_ID, UUID } from "./identity.ts";

/** Workspaceの実行基盤は、対象操作の受付時だけ読み込む。 @trace ARCH-000012 */
export async function prepareWorkspaceOperation(
  input: unknown,
  signal: AbortSignal,
) {
  if (signal.aborted) return null;
  const {
    executeWorkspace,
    inspectWorkspaceCommand,
    resolveLocalWorkspaceAccess,
  } = await import("./workspace.ts");
  if (signal.aborted) return null;
  const command = inspectWorkspaceCommand(input);
  return command
    ? { command, executeWorkspace, resolveLocalWorkspaceAccess }
    : null;
}
/** WorkspaceのOwnerを読み込む前に使う、通信横断の読み取り区分。 */
export function isWorkspaceRead(operation: string): boolean {
  return ["list", "get", "inspect", "candidate-diff"].includes(operation);
}

/** REST文書とMCP Toolの、操作を決めた後の公開入力欄。 @trace ARCH-000012 */
export function workspaceInputSchema(operation: string) {
  const actions: Record<string, string[]> = {
    list: ["cursor", "limit"],
    get: [],
    inspect: ["path"],
    "candidate-diff": ["path"],
    create: [
      "baseBranch",
      "baseCommit",
      "name",
      "acceptUncommittedChangesExcluded",
    ],
    select: [],
    rename: ["name"],
    hold: ["until"],
    discard: ["expectedHead", "discardChanges"],
    freeze: [
      "operationId",
      "baseCommit",
      "expectedHead",
      "selection",
      "candidateName",
      "relatedChangeIds",
    ],
    adopt: ["candidateCommit", "targetBranch", "expectedTargetHead"],
    "close-candidate": ["expectedCommit", "disposition"],
  };
  const keys = [
    "repositoryId",
    "projectId",
    ...(operation === "list" ? [] : ["queueId", "workspaceId"]),
    ...(!["list", "get", "inspect", "candidate-diff"].includes(operation)
      ? ["expectedGeneration"]
      : []),
    ...(actions[operation] ?? []),
  ];
  const string = { type: "string" };
  const nullable = <T extends object>(schema: T) => ({
    anyOf: [schema, { type: "null" }],
  });
  const resourceId = { ...string, pattern: RESOURCE_ID.source };
  const workspaceId = { ...string, pattern: UUID.source };
  const objectId = { ...string, pattern: GIT_OBJECT_ID.source };
  const fields: Readonly<Record<string, object>> = {
    repositoryId: resourceId,
    projectId: resourceId,
    queueId: resourceId,
    workspaceId,
    operationId: workspaceId,
    expectedGeneration:
      operation === "create"
        ? { type: "integer", const: 0 }
        : { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    limit: { type: "integer", minimum: 1, maximum: 50 },
    cursor: nullable({ ...string, maxLength: 1024 }),
    name: nullable(string),
    until: nullable(string),
    candidateName: nullable(string),
    baseCommit: objectId,
    expectedHead: objectId,
    candidateCommit: objectId,
    expectedTargetHead: objectId,
    expectedCommit: nullable(objectId),
    disposition: { type: "string", enum: ["adopted", "rejected"] },
    acceptUncommittedChangesExcluded: {
      type: "boolean",
      description:
        "未コミット変更は引き継がれないことを利用者が了承した場合だけtrue。変更があり未了承ならworkspace_creation_confirmation_requiredで作成前に停止します。",
    },
    discardChanges: { type: "boolean" },
    relatedChangeIds: {
      type: "array",
      items: { ...string, pattern: "^CHG-[0-9]{6}$" },
    },
    selection: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "blobId", "mode"],
        properties: {
          path: string,
          blobId: nullable(objectId),
          mode: { enum: ["100644", "100755", null] },
        },
      },
    },
  };
  const properties = Object.fromEntries(
    keys.map((key) => [key, fields[key] ?? string]),
  );
  return {
    type: "object",
    additionalProperties: false,
    required: keys.filter((key) => key !== "acceptUncommittedChangesExcluded"),
    properties,
  };
}
