/**
 * 業務操作の一回送信をTanStack Mutationへ接続する。
 * @packageDocumentation
 * @responsibility 再送・オフライン再開を無効にし、応答は既存の操作別検査へ直接返す。
 * @trace ARCH-000012
 * @boundary 明示Formと既存同Origin通信。
 * @security Form・応答をMutation variables／data／metaへ保存しない。
 */
import { QueryClient } from "@tanstack/react-query";
import type { WorkspaceHttpRoutes } from "@qual-lab/crdd-server";
import { requestWorkbench } from "./connection.ts";
import { RESOURCE_ID, workbenchPath, workbenchRequest } from "./path.ts";
import { validateAiRequestSnapshot } from "./response.ts";
import type { RecordSubmission } from "./record.ts";
import type { RepositorySubmission } from "./repository.ts";

const client = new QueryClient();

/** 画面で検査したGit操作を、一度だけ対応するリソースへ送る。 */
export function requestRepositoryMutation(
  { path, method, body, token }: RepositorySubmission["request"],
  signal: AbortSignal,
  browserSession: boolean,
): Promise<Response> {
  return runMutation(
    path,
    {
      method,
      body,
      signal,
      headers: {
        "content-type": "application/json",
        "x-crdd-action-token": token,
      },
    },
    browserSession,
  );
}

/** AI依頼の画面入力を、操作が固定されたリソース別HTTPへ送る。 */
export async function requestAiRequestAction(
  repositoryId: string,
  form: FormData,
  signal: AbortSignal,
  browserSession = false,
) {
  const fields = new Map<string, string>();
  for (const [key, value] of form) {
    if (typeof value !== "string" || fields.has(key))
      throw new Error("workbench_mutation_rejected");
    fields.set(key, value);
  }
  const token = fields.get("actionToken") ?? "";
  const requestId = fields.get("requestId") ?? "";
  const id = RESOURCE_ID;
  if (!id.test(repositoryId) || !id.test(requestId) || !token)
    throw new Error("workbench_mutation_rejected");
  const operation = fields.get("operation");
  let route: { method: "POST" | "PUT"; path: string };
  let data: Record<string, unknown>;
  switch (operation) {
    case "start": {
      route = workbenchRequest(
        ["POST", "/api/repositories/:repositoryId/ai-requests"],
        { repositoryId },
      );
      data = { requestId };
      for (const name of [
        "mode",
        "workType",
        "workspaceId",
        "prompt",
        "allowedPaths",
      ]) {
        const value = fields.get(name);
        if (value !== undefined) data[name] = value;
      }
      const choice = fields.get("choice");
      if (choice) data.choice = JSON.parse(choice) as unknown;
      break;
    }
    case "cancel":
      route = workbenchRequest(
        [
          "POST",
          "/api/repositories/:repositoryId/ai-requests/:requestId/cancellation",
        ],
        { repositoryId, requestId },
      );
      data = {};
      break;
    case "observe":
      route = workbenchRequest(
        ["PUT", "/api/repositories/:repositoryId/ai-request"],
        { repositoryId },
      );
      data = { requestId };
      break;
    default:
      throw new Error("workbench_mutation_rejected");
  }
  const response = await runMutation(
    route.path,
    {
      method: route.method,
      headers: {
        "content-type": "application/json",
        "x-crdd-action-token": token,
      },
      body: JSON.stringify(data),
      signal,
    },
    browserSession,
  );
  if (
    operation === "start" &&
    (response.status === 201 || response.status === 409)
  ) {
    const value: unknown = await response.json();
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).sort().join(",") === "reason,requestId,status"
    ) {
      const result = value as Record<string, unknown>;
      if (
        response.status === 201 &&
        result.status === "accepted" &&
        result.requestId === requestId &&
        result.reason === null
      )
        return "confirmed" as const;
      if (
        response.status === 409 &&
        result.status === "blocked" &&
        (result.requestId === null || result.requestId === requestId) &&
        typeof result.reason === "string" &&
        result.reason.length > 0
      )
        return "blocked" as const;
    }
  } else if (operation !== "start" && response.status === 200) {
    const result = validateAiRequestSnapshot(await response.json());
    if (result.requestId === requestId) return "confirmed" as const;
  }
  throw new Error("ai_action_unconfirmed");
}

/** 選定設定を、検査済みの対象と期待値に対して一回だけ書き込む。 */
export function requestAiSelectionSave(
  repositoryId: string,
  actionToken: string,
  input: Readonly<{ expectedIdentity: string | null; configText: string }>,
  signal: AbortSignal,
  browserSession: boolean,
) {
  if (!RESOURCE_ID.test(repositoryId))
    throw new Error("workbench_mutation_rejected");
  const route = workbenchRequest(
    ["PUT", "/api/repositories/:repositoryId/ai-selection"],
    { repositoryId },
  );
  return runMutation(
    route.path,
    {
      method: route.method,
      headers: {
        "content-type": "application/json",
        "x-crdd-action-token": actionToken,
      },
      // 入力したJSONを再生成せず、重複キーもServerの閉入力検査へ渡す。
      body: `{"expectedIdentity":${JSON.stringify(input.expectedIdentity)},"config":${input.configText}}`,
      signal,
    },
    browserSession,
  );
}

/** 検査したTopic／Meetingの一件をリソース別HTTPへ送る。 @trace ARCH-000012 */
export function requestRecordMutation(
  request: RecordSubmission,
  signal: AbortSignal,
) {
  return runMutation(
    request.path,
    {
      method: request.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      signal,
    },
    true,
  );
}

const workspaceRequests = {
  list: ["GET", "/api/repositories/:repositoryId/workspaces"],
  get: ["GET", "/api/repositories/:repositoryId/workspaces/:workspaceId"],
  inspect: [
    "GET",
    "/api/repositories/:repositoryId/workspaces/:workspaceId/inspection",
  ],
  "candidate-diff": [
    "GET",
    "/api/repositories/:repositoryId/workspaces/:workspaceId/candidate/diff",
  ],
  create: ["POST", "/api/repositories/:repositoryId/workspaces"],
  select: ["PUT", "/api/repositories/:repositoryId/selected-workspace"],
  rename: ["PATCH", "/api/repositories/:repositoryId/workspaces/:workspaceId"],
  hold: [
    "POST",
    "/api/repositories/:repositoryId/workspaces/:workspaceId/hold",
  ],
  freeze: [
    "POST",
    "/api/repositories/:repositoryId/workspaces/:workspaceId/freeze",
  ],
  adopt: [
    "POST",
    "/api/repositories/:repositoryId/workspaces/:workspaceId/adoption",
  ],
  "close-candidate": [
    "POST",
    "/api/repositories/:repositoryId/workspaces/:workspaceId/candidate/closure",
  ],
  discard: [
    "DELETE",
    "/api/repositories/:repositoryId/workspaces/:workspaceId",
  ],
} as const satisfies WorkspaceHttpRoutes;

/** Workspaceの対象・操作をURLとMethodに結び、同一Originだけへ一回送る。 */
export function requestWorkspace(
  repositoryId: string,
  command: Readonly<{
    operation: keyof typeof workspaceRequests;
    workspaceId?: string;
    [key: string]: unknown;
  }>,
  signal?: AbortSignal,
  browserSession = false,
): Promise<Response> {
  if (
    !RESOURCE_ID.test(repositoryId) ||
    !Object.hasOwn(workspaceRequests, command.operation)
  )
    throw new Error("workspace_request_rejected");
  const { operation, ...input } = command;
  const route = workspaceRequests[operation];
  const [method, template] = route;
  let workspaceId = "";
  if (template.includes(":workspaceId")) {
    if (
      typeof input.workspaceId !== "string" ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(input.workspaceId)
    )
      throw new Error("workspace_request_rejected");
    workspaceId = input.workspaceId;
    delete input.workspaceId;
  }
  const path = workbenchPath(route, { repositoryId, workspaceId });
  const options = signal ? { signal } : {};
  if (method === "GET") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input))
      if (value !== null) query.append(key, String(value));
    return requestWorkbench(`${path}?${query}`, options, browserSession);
  }
  return runMutation(
    path,
    {
      ...options,
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    browserSession,
  );
}

async function runMutation(
  input: string,
  options: RequestInit,
  allowBrowserSession = false,
) {
  let response: Response | undefined;
  const mutation = client.getMutationCache().build(client, {
    retry: false,
    gcTime: 0,
    networkMode: "always",
    mutationFn: async () => {
      try {
        response = await requestWorkbench(input, options, allowBrowserSession);
      } catch {
        throw new Error("workbench_mutation_unavailable");
      }
    },
  });
  try {
    await mutation.execute(undefined);
    if (response === undefined)
      throw new Error("workbench_mutation_unavailable");
    return response;
  } finally {
    client.getMutationCache().remove(mutation);
  }
}
/** 現在の管理セッションと非秘密入力だけを操作別HTTPへ送る。 */
export function requestSessionManagementChange(
  form: URLSearchParams,
  signal: AbortSignal,
) {
  const userId = form.get("userId") ?? "";
  const repositoryId = form.get("repositoryId") ?? "";
  const operation = form.get("operation");
  let route: { method: "PATCH" | "PUT" | "DELETE"; path: string };
  let data: Record<string, unknown> = {};
  switch (operation) {
    case "updateUserName":
      route = workbenchRequest(["PATCH", "/api/users/:userId"], { userId });
      data = { username: form.get("username") };
      break;
    case "updateUserRole":
      route = workbenchRequest(["PUT", "/api/users/:userId/role"], { userId });
      data = {
        currentRole: form.get("currentRole"),
        nextRole: form.get("nextRole"),
      };
      break;
    case "unregisterRepository":
      route = workbenchRequest(["DELETE", "/api/repositories/:repositoryId"], {
        repositoryId,
      });
      break;
    default:
      throw new Error("management_unavailable");
  }
  return fetch(route.path, {
    method: route.method,
    signal,
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      ...data,
      expectedRevision: Number(form.get("expectedRevision")),
      operationId: form.get("operationId"),
      formToken: form.get("actionToken"),
    }),
  });
}
