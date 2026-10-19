/**
 * 非鍵管理のWorkbench要求を既存AMへ接続する。
 * @responsibility 入力搬送だけを所有し、現在認可と保存をAMへ残す。
 * @trace ARCH-000013
 * @boundary Workbench HTTPと同ProcessのAM。
 * @security 管理Rootは内部構成、Bearerは当該要求内だけ。MCPへ依存しない。
 */
import {
  updateUserRole,
  readCurrentAccess,
  readManagementState,
  registerRepository,
  registerUser,
  unregisterRepository,
  updateExposure,
  updateRoleContentAccess,
  updateUserName,
} from "../../../access-management/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import type { ManagementView, WorkbenchManagementResult } from "./contract.ts";

const FIELDS = {
  registerUser: ["username", "plannedRole"],
  updateUserName: ["userId", "username"],
  updateUserRole: ["userId", "currentRole", "nextRole"],
  updateRoleContentAccess: ["targetRole", "workspaceIds"],
  registerRepository: ["repositoryId", "repositoryRoot"],
  unregisterRepository: ["repositoryId"],
  updateExposure: ["repositoryId", "workspaceIds"],
} as const;

/**
 * 閉じたFormを操作固有引数へ固定する。
 * @responsibility 未知・重複fieldをAM／Network前に拒否する。
 * @trace ARCH-000013
 * @input Origin・Token・容量確認済みForm。
 * @returns 操作名と現在変更入力。
 * @precondition Callerが要求の取消を処置する。
 * @postcondition 資格や管理Rootを入力から生成しない。
 * @effect N/A: Form値検査だけ。
 * @failure 不正入力は固定例外。
 * @invariant 表示可否はAM実行認可を代替しない。
 * @boundary Browser Formと既存操作API。
 * @security 任意MethodやMCP Tool指定を受けない。
 * @concurrency 受付IDと表示改訂を一回の操作へ保持する。
 */
function command(form: URLSearchParams) {
  const operation = form.get("operation");
  if (!operation || !Object.hasOwn(FIELDS, operation))
    throw new Error("workbench_management_input_invalid");
  const fields = FIELDS[operation as keyof typeof FIELDS];
  const allowed = new Set<string>([
    "operation",
    "actionToken",
    "operationId",
    "expectedRevision",
    ...fields,
  ]);
  for (const key of form.keys())
    if (
      !allowed.has(key) ||
      (key !== "workspaceIds" && form.getAll(key).length !== 1)
    )
      throw new Error("workbench_management_input_invalid");
  const operationId = form.get("operationId"),
    expectedRevision = Number(form.get("expectedRevision"));
  if (
    !operationId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      operationId,
    ) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    form.getAll("actionToken").length !== 1
  )
    throw new Error("workbench_management_input_invalid");
  const args: Record<string, unknown> = { operationId, expectedRevision };
  for (const field of fields) {
    if (field === "workspaceIds") {
      const values = form.getAll(field);
      if (
        values.length > 2 ||
        new Set(values).size !== values.length ||
        values.some((x) => x !== "development" && x !== "management")
      )
        throw new Error("workbench_management_input_invalid");
      args[field] = values;
    } else {
      if (form.getAll(field).length !== 1)
        throw new Error("workbench_management_input_invalid");
      args[field] = form.get(field);
    }
  }
  return {
    operation: operation as keyof typeof FIELDS,
    args,
    expectedRevision,
    operationId,
  };
}

/**
 * 現在本人または管理対象を一回だけ読み取る。
 * @responsibility 各readの改訂と拒否／不明を分離する。
 * @trace ARCH-000013
 * @input 構成接続、固定view、所有Signal。
 * @returns 同じAM共通投影。
 * @precondition viewは閉GETで検査済み。
 * @postcondition 別改訂を同一Snapshotへ合成しない。
 * @effect 現在AM read一回。
 * @failure 拒否・不明は固定共通結果、搬送故障は固定例外。
 * @invariant 他ユーザー管理から本人を推定しない。
 * @boundary Workbenchの同Process入口。
 * @security Path・資格・Binding非公開。
 * @concurrency 開始前取消は呼出し0。終了後にCallerが公開を処置する。
 */
export async function readWorkbenchManagement(
  context: CredentialAdministration,
  view: ManagementView,
  signal: AbortSignal,
): Promise<WorkbenchManagementResult> {
  if (signal.aborted) throw new Error("workbench_management_cancelled");
  const { root, token } = context;
  return view === "current"
    ? readCurrentAccess(root, token)
    : readManagementState(
        root,
        token,
        view === "roles"
          ? "roleContentAccess"
          : view === "repositories"
            ? "registeredRepositories"
            : view,
      );
}

/**
 * 明示Formの通常管理を既存Ownerへ一回委譲する。
 * @responsibility Repository登録と共通六保存の同型結果を保持する。
 * @trace ARCH-000013
 * @input 構成接続、検査済みTransportのForm、所有Signal。
 * @returns AMの非秘密保存結果。
 * @precondition CallerがOrigin／Action Token／容量を確認する。
 * @postcondition 再送・保存取消・新Storeを作らない。
 * @effect AM明示保存一回。
 * @failure 入力拒否と保存後の不明を別に扱う。
 * @invariant 新登録だけでは公開しない。解除は本体削除ではない。
 * @boundary Browser明示操作から同じ保存Owner。
 * @security Root入力は明示登録の対象だけ、管理Rootは内部構成、Bearerは当該要求内だけ。
 * @concurrency 期待改訂と受付IDを保持し、開始前取消はEffect0。
 */
export async function executeWorkbenchManagement(
  context: CredentialAdministration,
  form: URLSearchParams,
  signal: AbortSignal,
): Promise<WorkbenchManagementResult> {
  const { operation, args, expectedRevision, operationId } = command(form);
  if (signal.aborted) throw new Error("workbench_management_cancelled");
  const { root, token } = context;
  switch (operation) {
    case "registerUser":
      return registerUser(
        root,
        token,
        expectedRevision,
        operationId,
        args.username as string,
        args.plannedRole,
      );
    case "updateUserName":
      return updateUserName(
        root,
        token,
        expectedRevision,
        operationId,
        args.userId as string,
        args.username as string,
      );
    case "updateUserRole":
      return updateUserRole(
        root,
        token,
        expectedRevision,
        operationId,
        args.userId as string,
        args.currentRole,
        args.nextRole,
      );
    case "updateRoleContentAccess":
      return updateRoleContentAccess(
        root,
        token,
        expectedRevision,
        operationId,
        args.targetRole,
        args.workspaceIds,
      );
    case "registerRepository":
      return registerRepository(
        root,
        token,
        expectedRevision,
        operationId,
        args.repositoryId,
        args.repositoryRoot,
      );
    case "unregisterRepository":
      return unregisterRepository(
        root,
        token,
        expectedRevision,
        operationId,
        args.repositoryId,
      );
    case "updateExposure":
      return updateExposure(
        root,
        token,
        expectedRevision,
        operationId,
        args.repositoryId,
        args.workspaceIds,
      );
  }
}
