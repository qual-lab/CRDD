/**
 * 実行依頼の定義をDomainへ直接読み書きするHTTP入口。
 * @packageDocumentation
 * @responsibility 閉入力・既存内容認可・CASと元の保存結果を搬送する。
 * @trace ARCH-000008
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary Browser操作とDomain。Coordinator・AI・文書計画を起動しない。
 * @security Rootと主体はHost構成だけから得る。Tokenを本人証明と扱わない。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveRuntimeContentAccess } from "../../../../access-management/src/index.ts";
import {
  initializeRuntimeState,
  savePlan,
  queryPlan,
  queryObjectives,
  queryTasks,
  createObjective,
  updateObjective,
  deleteObjective,
  createTask,
  updateTask,
  deleteTask,
  snapshotPlainRecord,
  parseUnambiguousJsonDocument,
  type RuntimeAccess,
  RUNTIME_STATE_MAXIMUM_BYTES,
  type FilesystemStoreRoot,
} from "../../../../domain-model/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../../version-control/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import { readActionForm, setResponseHeaders } from "../security.ts";

const fields = {
  initialize: ["expectedAbsence"],
  "plan.save": ["expected", "definition", "expectedDefinitionHash"],
  "objective.create": ["expected", "definition"],
  "objective.update": [
    "expected",
    "objectiveId",
    "definition",
    "expectedDefinitionHash",
  ],
  "objective.delete": ["expected", "objectiveId", "expectedDefinitionHash"],
  "task.create": ["expected", "definition"],
  "task.update": ["expected", "taskId", "definition", "expectedDefinitionHash"],
  "task.delete": ["expected", "taskId", "expectedDefinitionHash"],
  plan: [],
  objectives: [],
  tasks: [],
} as const;

/**
 * 定義照会又は明示保存を同じDomain操作へ一度だけ配送する。
 * @responsibility 保存不明を無保存へ変換せず、既知結果と現在公開認可を分ける。
 * @trace ARCH-000012
 * @input 既存HTTP前段の要求・Signal・Origin・Token・検証済みRoot。
 * @returns 当該応答又は開始済み同期保存の終了まで待機する。
 * @precondition 接続資格は共通前段で要求別に抽出する。
 * @postcondition 定義操作だけを許し、受付・承認・実行は発行しない。
 * @effect 明示POSTだけが既存Domain Writerで保存する。
 * @failure 閉入力拒否400、認可又はBody搬送拒否403、処置後の結果搬送不能503。再送しない。
 * @invariant Domain自身の検査・CAS・対象Hashを省略しない。
 * @boundary WorkbenchとCore定義のOwner。
 * @security Host Path・Error本文・Credentialを公開しない。
 * @concurrency 要求内認可だけを保持し、待機後に再確認する。
 */
export async function handleRuntimeDefinition({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  capability,
  localAccessRoot,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  capability: VerifiedRepositoryRoot;
  localAccessRoot: FilesystemStoreRoot | undefined;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    const write = incoming.method === "POST";
    let repositoryId: string | null;
    let raw: unknown;
    if (write) {
      if (
        !origin ||
        incoming.headers.host !== new URL(origin).host ||
        incoming.headers.origin !== origin ||
        requestUrl.search !== "" ||
        incoming.headers["content-type"]?.split(";")[0]?.trim() !==
          "application/x-www-form-urlencoded"
      )
        throw new Error("runtime_input_invalid");
      // 定義本文は既存Domain上限で検査する。搬送にはpercent encoding分だけ余裕を持つ。
      const form = await readActionForm(
        incoming,
        3 * RUNTIME_STATE_MAXIMUM_BYTES + 16384,
      );
      if (
        [...form.keys()].some(
          (key) => !["actionToken", "repositoryId", "command"].includes(key),
        ) ||
        form.getAll("actionToken").length !== 1 ||
        form.getAll("command").length !== 1 ||
        form.getAll("repositoryId").length > 1 ||
        form.get("actionToken") !== actionToken
      )
        throw new Error("runtime_input_invalid");
      repositoryId = form.get("repositoryId");
      raw = parseUnambiguousJsonDocument(form.get("command") ?? "");
    } else {
      if (
        incoming.method !== "GET" ||
        [...requestUrl.searchParams.keys()].some(
          (key) =>
            !["repositoryId", "operation", "projectId", "milestoneId"].includes(
              key,
            ),
        ) ||
        ["operation", "projectId", "milestoneId"].some(
          (key) => requestUrl.searchParams.getAll(key).length !== 1,
        ) ||
        requestUrl.searchParams.getAll("repositoryId").length > 1
      )
        throw new Error("runtime_input_invalid");
      repositoryId = requestUrl.searchParams.get("repositoryId");
      raw = {
        operation: requestUrl.searchParams.get("operation"),
        projectId: requestUrl.searchParams.get("projectId"),
        milestoneId: requestUrl.searchParams.get("milestoneId"),
      };
    }
    const command = Object.entries(fields)
      .map(([operation, extra]) => {
        const candidate = snapshotPlainRecord(
          raw,
          new Set(["operation", "projectId", "milestoneId", ...extra]),
        );
        return candidate?.operation === operation ? candidate : null;
      })
      .find((value) => value !== null);
    if (
      !command ||
      typeof command.operation !== "string" ||
      write === ["plan", "objectives", "tasks"].includes(command.operation)
    )
      throw new Error("runtime_input_invalid");
    if (requestSignal.aborted) throw new Error("runtime_access_unavailable");
    let access: RuntimeAccess | null = null;
    if (localAccessRoot) {
      if (repositoryId && credentialAdministration)
        access = resolveRuntimeContentAccess(
          credentialAdministration.root,
          credentialAdministration.token,
          repositoryId,
          requestSignal,
        );
    } else {
      const root = resolveVerifiedRepositoryRoot(capability);
      if (repositoryId !== null || root === null)
        throw new Error("runtime_access_unavailable");
      access = {
        root: capability,
        principalId: "local-workbench-user",
        revalidate: (operation) =>
          !requestSignal.aborted &&
          ["definition.read", "definition.write"].includes(operation) &&
          resolveVerifiedRepositoryRoot(capability) === root,
      };
    }
    if (!access) throw new Error("runtime_access_unavailable");
    const { operation, ...input } = command;
    dispatched = true;
    // castは値検査を代替しない。各有限Domain APIが閉形式を検査する。
    let result: unknown;
    switch (operation) {
      case "initialize":
        result = initializeRuntimeState(
          access,
          input as Parameters<typeof initializeRuntimeState>[1],
        );
        break;
      case "plan.save":
        result = savePlan(access, input as Parameters<typeof savePlan>[1]);
        break;
      case "objective.create":
        result = createObjective(
          access,
          input as Parameters<typeof createObjective>[1],
        );
        break;
      case "objective.update":
        result = updateObjective(
          access,
          input as Parameters<typeof updateObjective>[1],
        );
        break;
      case "objective.delete":
        result = deleteObjective(
          access,
          input as Parameters<typeof deleteObjective>[1],
        );
        break;
      case "task.create":
        result = createTask(access, input as Parameters<typeof createTask>[1]);
        break;
      case "task.update":
        result = updateTask(access, input as Parameters<typeof updateTask>[1]);
        break;
      case "task.delete":
        result = deleteTask(access, input as Parameters<typeof deleteTask>[1]);
        break;
      case "plan":
        result = queryPlan(access, input as Parameters<typeof queryPlan>[1]);
        break;
      case "objectives":
        result = queryObjectives(
          access,
          input as Parameters<typeof queryObjectives>[1],
        );
        break;
      case "tasks":
        result = queryTasks(access, input as Parameters<typeof queryTasks>[1]);
        break;
      default:
        throw new Error("runtime_input_invalid");
    }
    if (
      !access.revalidate(
        write ? "definition.write" : "definition.read",
        input as Parameters<typeof queryPlan>[1],
      )
    )
      throw new Error("runtime_access_unavailable");
    setResponseHeaders(response);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(result));
  } catch (error) {
    setResponseHeaders(response);
    response.statusCode = dispatched
      ? 503
      : error instanceof Error && error.message === "runtime_input_invalid"
        ? 400
        : 403;
    response.end("runtime_definition_unavailable\n");
  }
}
