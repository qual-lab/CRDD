/**
 * Workspaceの明示操作入力を検査する。
 * @packageDocumentation
 * @responsibility 共有値の閉形式と相関を検査し、実行・保存・認可を発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary Domain値と利用側の入力・公開結果。
 */
import { types } from "node:util";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../state/validation.ts";
import {
  validWorkspaceCandidateRequest,
  validWorkspaceDisplayName,
  type WorkspaceCandidateSelection,
} from "../../../version-control/src/index.ts";
/**
 * 公開入力の閉じた操作集合。
 * @responsibility 読取り・固定・採用・終了を別要求にする。
 * @trace ARCH-000004
 * @shape Project／Queue／Workspace IDと確認済み操作値。
 * @invariant Root・Binding・認可関数を含めない。
 * @boundary JSON入力。
 * @security 参照解放の自己申告を受けない。
 * @compatibility 新Workspace専用、旧Bundleの採用契約とは別。
 */
export type WorkspaceCommand =
  | Readonly<{
      operation: "list";
      projectId: string;
      cursor: string | null;
      limit: number;
    }>
  | (Readonly<{ projectId: string; queueId: string; workspaceId: string }> &
      (
        | { operation: "get" }
        | { operation: "inspect"; path: string }
        | { operation: "candidate-diff"; path: string }
        | (Readonly<{ expectedGeneration: number }> &
            (
              | { operation: "create"; baseCommit: string; name: string | null }
              | { operation: "select" }
              | { operation: "rename"; name: string | null }
              | { operation: "hold"; until: string | null }
              | {
                  operation: "discard";
                  expectedHead: string;
                  discardChanges: boolean;
                }
              | {
                  operation: "freeze";
                  operationId: string;
                  baseCommit: string;
                  expectedHead: string;
                  selection: readonly WorkspaceCandidateSelection[];
                  candidateName: string | null;
                  relatedChangeIds: readonly string[];
                }
              | {
                  operation: "adopt";
                  candidateCommit: string;
                  targetBranch: string;
                  expectedTargetHead: string;
                }
              | {
                  operation: "close-candidate";
                  expectedCommit: string | null;
                  disposition: "adopted" | "rejected";
                }
            ))
      ));

/**
 * 公開入力の既存安定ID形式を検査する。
 * @responsibility Project・Queue IDの字句境界だけを扱う。
 * @trace ARCH-000004
 * @input 未検証値。
 * @returns 安定ID形式か。
 * @precondition N/A: 未検証値。
 * @postcondition 所属・認可は別に検査する。
 * @effect N/A: 純粋値検査。
 * @failure 不正はfalse。
 * @invariant ID形式はAuthorityではない。
 * @boundary 公開入力。
 * @security Pathを解決しない。
 * @concurrency N/A: 状態なし。
 */
const isStableId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
/**
 * WorkspaceのUUID形式を検査する。
 * @responsibility 任意PathをWorkspace IDとして受けない。
 * @trace ARCH-000004
 * @input 未検証値。
 * @returns UUID形式か。
 * @precondition N/A: 未検証値。
 * @postcondition 存在は別に観測する。
 * @effect N/A: 純粋値検査。
 * @failure 不正はfalse。
 * @invariant UUID形式は所有根拠ではない。
 * @boundary 公開入力。
 * @security IDから任意Rootを受理しない。
 * @concurrency N/A: 状態なし。
 */
const isWorkspaceId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);
/**
 * 対応するGit Object IDの字句形式を検査する。
 * @responsibility Ref名と固定Object IDを混同しない。
 * @trace ARCH-000009
 * @input 未検証値。
 * @returns SHA-1又はSHA-256のGit Object ID形式か。
 * @precondition N/A: 未検証値。
 * @postcondition Object実在はVCが観測する。
 * @effect N/A: 純粋値検査。
 * @failure 不正はfalse。
 * @invariant 形式だけで固定内容を保証しない。
 * @boundary 公開入力。
 * @security Git命令を発行しない。
 * @concurrency N/A: 状態なし。
 */
const isGitObjectId = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);
const fields: Readonly<Record<string, readonly string[]>> = {
  get: [],
  inspect: ["path"],
  "candidate-diff": ["path"],
  create: ["baseCommit", "name"],
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

/**
 * 公開操作を認可・Root観測より前に閉検査する。
 * @responsibility 未知field、callback、Host指定と不正選択を拒否する。
 * @trace ARCH-000004
 * @input 未検証JSON値。
 * @returns 閉じた操作又はnull。
 * @precondition N/A: 未検証入力を受ける。
 * @postcondition 形式成立を認可へ変換しない。
 * @effect N/A: 値検査。
 * @failure 不正値はnull。
 * @invariant 固定と採用を一要求にしない。
 * @boundary 公開JSON。
 * @security Proxy・Accessorを実行しない。
 * @concurrency N/A: 局所値のみ。
 */
export function inspectWorkspaceCommand(
  value: unknown,
): WorkspaceCommand | null {
  if (!value || typeof value !== "object" || types.isProxy(value)) return null;
  const operation = Object.getOwnPropertyDescriptor(value, "operation")?.value;
  if (operation === "list") {
    const r = snapshotPlainRecord(
      value,
      new Set(["operation", "projectId", "cursor", "limit"]),
    );
    return r &&
      isStableId(r.projectId) &&
      (r.cursor === null ||
        (typeof r.cursor === "string" && r.cursor.length <= 1024)) &&
      Number.isSafeInteger(r.limit) &&
      Number(r.limit) >= 1 &&
      Number(r.limit) <= 50
      ? (r as WorkspaceCommand)
      : null;
  }
  if (typeof operation !== "string" || !Object.hasOwn(fields, operation))
    return null;
  const read =
    operation === "get" ||
    operation === "inspect" ||
    operation === "candidate-diff";
  const r = snapshotPlainRecord(
    value,
    new Set([
      "operation",
      "projectId",
      "queueId",
      "workspaceId",
      ...(!read ? ["expectedGeneration"] : []),
      ...(fields[operation] ?? []),
    ]),
  );
  if (
    !r ||
    !isStableId(r.projectId) ||
    !isStableId(r.queueId) ||
    !isWorkspaceId(r.workspaceId) ||
    (!read &&
      (!Number.isSafeInteger(r.expectedGeneration) ||
        Number(r.expectedGeneration) < 0))
  )
    return null;
  if (
    (operation === "rename" || operation === "create") &&
    !validWorkspaceDisplayName(r.name)
  )
    return null;
  if (
    operation === "create" &&
    (!isGitObjectId(r.baseCommit) || r.expectedGeneration !== 0)
  )
    return null;
  if (
    operation === "hold" &&
    !(
      r.until === null ||
      (typeof r.until === "string" && Number.isFinite(Date.parse(r.until)))
    )
  )
    return null;
  if (
    operation === "discard" &&
    (!isGitObjectId(r.expectedHead) || typeof r.discardChanges !== "boolean")
  )
    return null;
  if (
    operation === "adopt" &&
    (!isGitObjectId(r.candidateCommit) ||
      !isGitObjectId(r.expectedTargetHead) ||
      typeof r.targetBranch !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(r.targetBranch))
  )
    return null;
  if (
    operation === "close-candidate" &&
    (!(r.expectedCommit === null || isGitObjectId(r.expectedCommit)) ||
      !["adopted", "rejected"].includes(String(r.disposition)))
  )
    return null;
  if (operation === "freeze") {
    const selection = snapshotPlainArray(r.selection, 1000);
    const changes = snapshotPlainArray(r.relatedChangeIds, 100);
    if (selection.status !== "ok" || changes.status !== "ok") return null;
    const items = selection.value.map((item) =>
      snapshotPlainRecord(item, new Set(["path", "blobId", "mode"])),
    );
    if (items.some((item) => item === null)) return null;
    const safe = { ...r, selection: items, relatedChangeIds: changes.value };
    if (
      !validWorkspaceCandidateRequest({
        workspaceId: r.workspaceId,
        operationId: r.operationId,
        baseCommit: r.baseCommit,
        expectedWorkspaceHead: r.expectedHead,
        selection: safe.selection,
        candidateName: r.candidateName,
        workspaceName: null,
        relatedChangeIds: safe.relatedChangeIds,
      })
    )
      return null;
    return safe as unknown as WorkspaceCommand;
  }
  if (
    (operation === "inspect" || operation === "candidate-diff") &&
    (typeof r.path !== "string" ||
      !validWorkspaceCandidateRequest({
        workspaceId: r.workspaceId,
        operationId: r.workspaceId,
        baseCommit: "0".repeat(40),
        expectedWorkspaceHead: "0".repeat(40),
        selection: [{ path: r.path, mode: null, blobId: null }],
        workspaceName: null,
        candidateName: null,
        relatedChangeIds: [],
      }))
  )
    return null;
  return r as WorkspaceCommand;
}
