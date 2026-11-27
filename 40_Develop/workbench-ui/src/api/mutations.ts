/**
 * 非鍵業務操作の一回送信をTanStack Mutationへ接続する。
 * @packageDocumentation
 * @responsibility 再送・オフライン再開を無効にし、応答は既存の操作別検査へ直接返す。
 * @trace ARCH-000012
 * @boundary 明示Formと既存同Origin通信。
 * @security 鍵操作は対象外。Form・応答をMutation variables／data／metaへ保存しない。
 */
import { QueryClient } from "@tanstack/react-query";
import { requestWorkbench } from "./connection.ts";
import { validateAiRequestSnapshot } from "./response.ts";
import type { createRecordRequest } from "./record.ts";
import type { readRepositorySubmission } from "./repository.ts";

const client = new QueryClient();

/** 画面で検査したGit操作を、一度だけ対応するリソースへ送る。 */
export function requestRepositoryMutation(
  {
    path,
    method,
    body,
    token,
  }: ReturnType<typeof readRepositorySubmission>["request"],
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
  const id = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
  if (!id.test(repositoryId) || !id.test(requestId) || !token)
    throw new Error("workbench_mutation_rejected");
  const operation = fields.get("operation");
  const root = `/api/repositories/${repositoryId}`;
  let method: string, path: string, data: Record<string, unknown>;
  switch (operation) {
    case "start": {
      method = "POST";
      path = `${root}/ai-requests`;
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
      method = "POST";
      path = `${root}/ai-requests/${requestId}/cancellation`;
      data = {};
      break;
    case "observe":
      method = "PUT";
      path = `${root}/ai-request`;
      data = { requestId };
      break;
    default:
      throw new Error("workbench_mutation_rejected");
  }
  const response = await runMutation(
    path,
    {
      method,
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
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId))
    throw new Error("workbench_mutation_rejected");
  return runMutation(
    `/api/repositories/${repositoryId}/ai-selection`,
    {
      method: "PUT",
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
  request: ReturnType<typeof createRecordRequest>,
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
  list: ["GET", "/workspaces"],
  get: ["GET", "/workspaces/:id"],
  inspect: ["GET", "/workspaces/:id/inspection"],
  "candidate-diff": ["GET", "/workspaces/:id/candidate/diff"],
  create: ["POST", "/workspaces"],
  select: ["PUT", "/selected-workspace"],
  rename: ["PATCH", "/workspaces/:id"],
  hold: ["POST", "/workspaces/:id/hold"],
  freeze: ["POST", "/workspaces/:id/freeze"],
  adopt: ["POST", "/workspaces/:id/adoption"],
  "close-candidate": ["POST", "/workspaces/:id/candidate/closure"],
  discard: ["DELETE", "/workspaces/:id"],
} as const;

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
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId) ||
    !Object.hasOwn(workspaceRequests, command.operation)
  )
    throw new Error("workspace_request_rejected");
  const { operation, ...input } = command;
  const [method, suffix] = workspaceRequests[operation];
  let path = `/api/repositories/${repositoryId}${suffix}`;
  if (suffix.includes(":id")) {
    if (
      typeof input.workspaceId !== "string" ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(input.workspaceId)
    )
      throw new Error("workspace_request_rejected");
    path = path.replace(":id", input.workspaceId);
    delete input.workspaceId;
  }
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
  const user = encodeURIComponent(form.get("userId") ?? "");
  const repository = encodeURIComponent(form.get("repositoryId") ?? "");
  const operation = form.get("operation");
  let method: "PATCH" | "PUT" | "DELETE";
  let path: string;
  let data: Record<string, unknown> = {};
  switch (operation) {
    case "updateUserName":
      method = "PATCH";
      path = `/api/users/${user}`;
      data = { username: form.get("username") };
      break;
    case "updateUserRole":
      method = "PUT";
      path = `/api/users/${user}/role`;
      data = {
        currentRole: form.get("currentRole"),
        nextRole: form.get("nextRole"),
      };
      break;
    case "unregisterRepository":
      method = "DELETE";
      path = `/api/repositories/${repository}`;
      break;
    default:
      throw new Error("management_unavailable");
  }
  return fetch(path, {
    method,
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
