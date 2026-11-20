/**
 * Workspaceの結果保存へ渡すRepository・Project・Queueの結合情報を定義する。
 * @responsibility 上位の保存要求に必要な値契約を所有し、保存やGit操作を発行しない。
 * @trace ARCH-000005
 */

import { types } from "node:util";
import { snapshotPlainArray, snapshotPlainRecord } from "../input/snapshot.ts";
import { validIdentity } from "../state/validation.ts";
/**
 * Taskに結合したWorkspace観測を公開用の閉じた値へ写す。
 * @responsibility 試行相関・対象一致・欠測と観測不能を維持する。
 * @trace ARCH-000004
 * @input raw: 観測配列、expectedWorkspaceId: 要求対象（省略時も配列内の対象一致を検査）。
 * @returns 凍結した観測配列。不正又は重複はnull。
 * @precondition N/A: 外部由来のunknownを受ける。
 * @postcondition 元値の後続変更を公開結果へ搬送しない。
 * @effect N/A: 値検査と複製だけ。
 * @failure getter・Proxy・別対象・不明を空配列へ変換しない。
 * @invariant 変更観測は採用・Commit・Mergeの完了ではない。
 * @boundary Coordinator結果とWorkbench／MCPの公開投影。
 * @security 本文・絶対Path・Authorityを追加しない。
 * @concurrency 同期処理で共有状態を持たない。
 */
export function inspectCoordinatorWorkspaceResults(
  raw: unknown,
  expectedWorkspaceId?: string | null,
):
  | readonly Readonly<{
      taskId: string;
      attemptId: string;
      operationId: string;
      result: WorkspaceResult;
    }>[]
  | null {
  const array = snapshotPlainArray(raw, Number.MAX_SAFE_INTEGER);
  if (array.status !== "ok" || array.value.length === 0) return null;
  const entries: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    result: WorkspaceResult;
  }>[] = [];
  const attempts = new Set<string>();
  const operations = new Set<string>();
  let workspaceId = expectedWorkspaceId;
  for (const value of array.value) {
    const entry = snapshotPlainRecord(
      value,
      new Set(["taskId", "attemptId", "operationId", "result"] as const),
    );
    if (
      !entry ||
      !validIdentity(entry.taskId) ||
      !validIdentity(entry.attemptId) ||
      !validIdentity(entry.operationId) ||
      attempts.has(entry.attemptId) ||
      operations.has(entry.operationId)
    )
      return null;
    const result = inspectWorkspaceResult(entry.result);
    if (
      !result ||
      (workspaceId !== undefined && result.workspaceId !== workspaceId)
    )
      return null;
    workspaceId = result.workspaceId;
    attempts.add(entry.attemptId);
    operations.add(entry.operationId);
    entries.push(
      Object.freeze({
        taskId: entry.taskId,
        attemptId: entry.attemptId,
        operationId: entry.operationId,
        result,
      }),
    );
  }
  return Object.freeze(entries);
}

/**
 * 借用Treeの開始後変更について観測できた範囲を返す。
 * @responsibility 欠測と変更なし、採用と観測を混同しない。
 * @trace ARCH-000004
 * @shape Workspace ID、変更Path又はnull、所属Tree変更、帰属未確定、削除非発行。
 * @invariant 内容・Host Path・新しいAuthorityを含めない。
 * @boundary Task完了から上位Attempt。
 * @security 相対Pathだけを認可済み利用側へ渡す。
 * @compatibility 非借用の旧結果では省略する。
 */
export type WorkspaceResult = Readonly<{
  workspaceId: string | null;
  changedPaths: readonly string[] | null;
  canonicalRepositoryChanged: boolean | null;
  changeAttribution: "unattributed";
  workspaceDeletionIssued: false;
}>;

/**
 * Read one own data property exactly once. Accessor properties, prototype
 *
 * @responsibility task-attempt-runtimeの入力からown Data Propertyを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input container: object、key: string
 * @returns unknownを返す。
 * @precondition 「container: object、key: string」がownDataPropertyの入力契約を満たす。
 * @postcondition ownDataPropertyの責務を完了した結果だけを返す。
 * @effect N/A: ownDataPropertyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownDataPropertyは独自の失敗分岐を所有しない。
 * @invariant ownDataPropertyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataPropertyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataPropertyは共有非同期状態を持たない同期処理である。
 */
function ownDataProperty(container: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (
    !descriptor ||
    !Object.hasOwn(descriptor, "value") ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    return undefined;
  return descriptor.value;
}

/**
 * Plain Containerかを判定する。
 *
 * @responsibility Plain Containerの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainContainerの入力契約を満たす。
 * @postcondition isPlainContainerの責務を完了した結果だけを返す。
 * @effect N/A: isPlainContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainContainerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlainContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlainContainerは共有非同期状態を持たない同期処理である。
 */
function isPlainContainer(value: unknown): value is object {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      types.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Workspace観測の閉じた値をsnapshotする。
 * @responsibility 欠測・null・空配列と方式別の変更相関を維持する。
 * @trace ARCH-000004
 * @input 未検証の観測値。
 * @returns 凍結metadata又はnull。
 * @precondition N/A: unknownを受ける。
 * @postcondition 元値の変更を搬送しない。
 * @effect N/A: 値検査のみ。
 * @failure 不正・不整合・getterはnull。
 * @invariant Pathは相対値であり内容・Host所在を含まない。
 * @boundary Coordinator結果から認可済み上位。
 * @security Authorityを新設しない。
 * @concurrency 純粋同期処理。
 */
export function inspectWorkspaceResult(raw: unknown): WorkspaceResult | null {
  try {
    if (!isPlainContainer(raw)) return null;
    const keys = [
      "workspaceId",
      "changedPaths",
      "canonicalRepositoryChanged",
      "changeAttribution",
      "workspaceDeletionIssued",
    ];
    if (
      Reflect.ownKeys(raw).length !== keys.length ||
      keys.some(
        (key) =>
          !Object.hasOwn(
            Object.getOwnPropertyDescriptor(raw, key) ?? {},
            "value",
          ),
      )
    )
      return null;
    const id = ownDataProperty(raw, "workspaceId");
    const paths = ownDataProperty(raw, "changedPaths");
    const changed = ownDataProperty(raw, "canonicalRepositoryChanged");
    if (
      (id !== null &&
        (typeof id !== "string" ||
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id))) ||
      ownDataProperty(raw, "changeAttribution") !== "unattributed" ||
      ownDataProperty(raw, "workspaceDeletionIssued") !== false ||
      (changed !== null && typeof changed !== "boolean")
    )
      return null;
    let snapshot: readonly string[] | null = null;
    if (paths !== null) {
      if (
        !Array.isArray(paths) ||
        types.isProxy(paths) ||
        Reflect.ownKeys(paths).length !== paths.length + 1
      )
        return null;
      const values: string[] = [];
      for (let index = 0; index < paths.length; index++) {
        const value = ownDataProperty(paths, String(index));
        if (
          typeof value !== "string" ||
          value.length === 0 ||
          /[\\:\0\r\n]/u.test(value) ||
          value
            .split("/")
            .some((part) => part === "" || part === "." || part === "..")
        )
          return null;
        values.push(value);
      }
      if (new Set(values).size !== values.length) return null;
      snapshot = Object.freeze(values);
    }
    if (
      id === null
        ? changed !== (snapshot === null ? null : snapshot.length > 0)
        : changed !== false
    )
      return null;
    return Object.freeze({
      workspaceId: id,
      changedPaths: snapshot,
      canonicalRepositoryChanged: changed,
      changeAttribution: "unattributed",
      workspaceDeletionIssued: false,
    });
  } catch {
    return null;
  }
}
