/**
 * 管理画面へAMの表示許可を検査して渡す。
 * @trace ARCH-000013
 * @boundary 同一オリジンのHTTP結果。実行の認可はサーバー側が持つ。
 */
import { validateManagementResponse } from "./response.ts";
import { workbenchPath, workbenchRequest } from "./path.ts";

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("management_permissions_unavailable");
  return value as Record<string, unknown>;
};
const closed = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

type AccessRoleLabel = "developer" | "manager" | "administrator";
function readRoles(value: unknown): readonly AccessRoleLabel[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (role): role is AccessRoleLabel =>
        role === "developer" || role === "manager" || role === "administrator",
    ) ||
    new Set(value).size !== value.length
  )
    throw new Error("management_permissions_unavailable");
  return value;
}

/** 管理画面に表示できる操作。実行時の認可はサーバーが行う。 @trace ARCH-000013 */
export interface ManagementPermissions {
  readonly openSession: boolean;
  readonly registerRoles: readonly AccessRoleLabel[];
  readonly registerRepository: boolean;
  readonly unregisterRepository: boolean;
}

export function readManagementPermissions(
  input: unknown,
): ManagementPermissions {
  const value = object(input);
  const {
    openSession,
    registerRoles,
    registerRepository,
    unregisterRepository,
  } = value;
  if (
    !closed(value, [
      "openSession",
      "registerRoles",
      "registerRepository",
      "unregisterRepository",
    ]) ||
    typeof openSession !== "boolean" ||
    typeof registerRepository !== "boolean" ||
    typeof unregisterRepository !== "boolean"
  )
    throw new Error("management_permissions_unavailable");
  return {
    openSession,
    registerRoles: readRoles(registerRoles),
    registerRepository,
    unregisterRepository,
  };
}

export function inspectWorkbenchManagementUsers(input: unknown) {
  const value = object(input);
  const { formToken, users, ...result } = value;
  if (
    !Array.isArray(users) ||
    typeof formToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(formToken)
  )
    throw new Error("management_permissions_unavailable");
  const rows = users.map((raw: unknown) => {
    const { actions, ...user } = object(raw);
    const flags = object(actions);
    const { rename, changeRoles, renewInvitation } = flags;
    if (
      !closed(flags, ["rename", "changeRoles", "renewInvitation"]) ||
      typeof rename !== "boolean" ||
      typeof renewInvitation !== "boolean"
    )
      throw new Error("management_permissions_unavailable");
    return {
      user,
      actions: { rename, changeRoles: readRoles(changeRoles), renewInvitation },
    };
  });
  const checked = validateManagementResponse(
    { ...result, users: rows.map(({ user }) => user) },
    "users",
  );
  if (checked.status !== "completed" || !("users" in checked) || !checked.users)
    throw new Error("management_permissions_unavailable");
  return {
    formToken,
    revision: checked.revision,
    users: checked.users.map((user, index) => {
      const row = rows[index];
      if (!row) throw new Error("management_permissions_unavailable");
      return { ...user, actions: row.actions };
    }),
  };
}

export type WorkbenchManagementUsers = ReturnType<
  typeof inspectWorkbenchManagementUsers
>;

export async function requestManagementUsers(signal: AbortSignal) {
  const response = await requestManagementView("users", signal);
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("invitation_form_unavailable");
  return inspectWorkbenchManagementUsers(await response.json());
}

export function requestBrowserSession(signal: AbortSignal) {
  return fetch(workbenchPath(["GET", "/api/session"]), {
    cache: "no-store",
    signal,
  });
}

const managementPaths = {
  current: workbenchPath(["GET", "/api/access/me"]),
  users: workbenchPath(["GET", "/api/users"]),
  repositories: workbenchPath(["GET", "/api/repositories"]),
} as const;

export function requestManagementView(
  view: keyof typeof managementPaths,
  signal: AbortSignal,
) {
  return fetch(managementPaths[view], {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
}

export function requestGitHostConnections(signal: AbortSignal) {
  return fetch(workbenchPath(["GET", "/api/session/git"]), { signal });
}

export function disconnectGitHost(
  hostConnectionId: string,
  signal: AbortSignal,
) {
  const { method, path } = workbenchRequest(
    ["DELETE", "/api/session/git/:hostConnectionId"],
    { hostConnectionId },
  );
  return fetch(path, { method, signal });
}

export function changeBrowserSession(
  action: "start_management" | "sign_out",
  signal: AbortSignal,
) {
  const { method, path } =
    action === "start_management"
      ? workbenchRequest(["POST", "/api/session/management"])
      : workbenchRequest(["DELETE", "/api/session"]);
  return fetch(path, { method, signal });
}

type AccessRegistration =
  | {
      kind: "repository";
      repositoryId: FormDataEntryValue | null;
      directory: FormDataEntryValue | null;
    }
  | { kind: "invitation"; userId: string; email: FormDataEntryValue | null }
  | {
      kind: "user";
      username: FormDataEntryValue | null;
      role: FormDataEntryValue | null;
      email: FormDataEntryValue | null;
    };

/** 管理画面の選択を操作別のJSON要求にする。 @trace ARCH-000013 */
export function registerAccess(
  action: AccessRegistration,
  revision: {
    expectedRevision: number;
    operationId: string;
    formToken: string;
  },
  signal: AbortSignal,
) {
  const route =
    action.kind === "repository"
      ? workbenchRequest(["POST", "/api/repositories"])
      : action.kind === "invitation"
        ? workbenchRequest(["POST", "/api/users/:userId/invitations"], {
            userId: action.userId,
          })
        : workbenchRequest(["POST", "/api/users"]);
  const data =
    action.kind === "repository"
      ? { repositoryId: action.repositoryId, directory: action.directory }
      : action.kind === "invitation"
        ? { email: action.email }
        : { username: action.username, role: action.role, email: action.email };
  return fetch(route.path, {
    method: route.method,
    cache: "no-store",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, ...revision }),
  });
}

/** プロキシの502と、CRDDがローカル解除を確定した応答を区別する。 */
export async function isGitHostRevocationUnconfirmed(
  response: Response,
): Promise<boolean> {
  return (
    response.status === 502 &&
    response.headers.get("content-type") === "text/plain; charset=utf-8" &&
    (await response.text()) === "git_host_revocation_unconfirmed\n"
  );
}

/** 既にローカル連携がない場合は、提供元での失効確認とは区別する。 */
export async function isGitHostLinkAbsent(
  response: Response,
): Promise<boolean> {
  return (
    response.status === 200 &&
    response.headers.get("content-type") === "text/plain; charset=utf-8" &&
    (await response.text()) === "git_host_link_absent\n"
  );
}
