/**
 * Worktreeと固定候補の技術入力を検査する。
 * @responsibility 閉形式を保持し、認可・保存・Git操作を発行しない。
 * @trace ARCH-000009
 */
import type { WorkspaceCandidateRequest } from "./types.ts";

const WORKSPACE_UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;

const COMMIT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

/**
 * 説明用の一行名を検査する。
 * @responsibility 制御文字・空名・過大入力をMessageへ流さない。
 * @trace ARCH-000009
 * @input value: 任意表示名。
 * @returns 説明用として有効か。
 * @precondition N/A: 未検証値も受け付ける。
 * @postcondition Identity・認可判定は変えない。
 * @effect N/A: 値検査。
 * @failure 不正値はfalse。
 * @invariant nullは名前省略。
 * @boundary 同一Process。
 * @security Shell・Ref用の安全性を意味しない。
 * @concurrency N/A: 状態なし。
 */
export function validWorkspaceDisplayName(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.trim() === value &&
      value.length > 0 &&
      [...value].length <= 120 &&
      !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
  );
}

/**
 * 固定要求の閉じた値契約を保存前とGit発行前で共用する。
 * @responsibility 管理Path・重複・欠測と明示削除の混同を拒否する。
 * @trace ARCH-000009
 * @input value: 未検証JSON値。
 * @returns 固定要求として有効か。
 * @precondition N/A: 未検証値を受け付ける。
 * @postcondition 内容実測・認可・Git実体確認は別に残す。
 * @effect N/A: 値検査。
 * @failure 不正はfalse。
 * @invariant 形式成立をEffect許可にしない。
 * @boundary VC／既存Snapshot codec。
 * @security Directory・glob・管理Pathを拒否。
 * @concurrency N/A: 局所値だけ。
 */
export function validWorkspaceCandidateRequest(
  value: unknown,
): value is WorkspaceCandidateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).sort().join(",") !==
      "baseCommit,candidateName,expectedWorkspaceHead,operationId,relatedChangeIds,selection,workspaceId,workspaceName" ||
    typeof r.operationId !== "string" ||
    !WORKSPACE_UUID.test(r.operationId) ||
    typeof r.workspaceId !== "string" ||
    !WORKSPACE_UUID.test(r.workspaceId) ||
    typeof r.baseCommit !== "string" ||
    !COMMIT_ID.test(r.baseCommit) ||
    typeof r.expectedWorkspaceHead !== "string" ||
    !COMMIT_ID.test(r.expectedWorkspaceHead) ||
    r.baseCommit.length !== r.expectedWorkspaceHead.length ||
    !validWorkspaceDisplayName(r.workspaceName) ||
    !validWorkspaceDisplayName(r.candidateName) ||
    !Array.isArray(r.relatedChangeIds) ||
    r.relatedChangeIds.length > 20 ||
    r.relatedChangeIds.some(
      (id) => typeof id !== "string" || !/^CHG-\d{6}$/u.test(id),
    ) ||
    new Set(r.relatedChangeIds).size !== r.relatedChangeIds.length ||
    !Array.isArray(r.selection) ||
    r.selection.length < 1 ||
    r.selection.length > 1000
  )
    return false;
  const selected = new Set<string>();
  for (const item of r.selection) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).sort().join(",") !== "blobId,mode,path" ||
      typeof item.path !== "string" ||
      item.path.length > 1000 ||
      item.path
        .split("/")
        .some(
          (segment: string) =>
            !segment ||
            segment === "." ||
            segment === ".." ||
            segment.trim() !== segment ||
            /[. ]$/u.test(segment) ||
            /^\.(?:git|crdd)$/iu.test(segment) ||
            /[\\:\x00-\x1f\x7f*?[\]]/u.test(segment),
        ) ||
      !(
        (item.blobId === null && item.mode === null) ||
        (typeof item.blobId === "string" &&
          COMMIT_ID.test(item.blobId) &&
          item.blobId.length === r.baseCommit.length &&
          ["100644", "100755"].includes(item.mode))
      )
    )
      return false;
    const key = item.path.toLowerCase();
    if (selected.has(key)) return false;
    selected.add(key);
  }
  return true;
}

/**
 * Workspaceの固定Commit ID文法を検査する。
 * @responsibility SHA-1／SHA-256の既存閉形式だけを判定する。
 * @trace ARCH-000004
 * @input value: 未信頼のCommit ID候補。
 * @returns 固定文法に一致する文字列だけtrue。
 * @precondition N/A: 任意値を拒否できる。
 * @postcondition 検査に使う可変実体を利用側へ返さない。
 * @effect N/A: 純粋な値検査。
 * @failure 不正値はfalse。
 * @invariant 文法一致からCommitの存在・採用・権限を推定しない。
 * @boundary Domainの値とVersion Controlの技術操作。
 * @security 正規表現の変更口を公開しない。
 * @concurrency N/A: 共有可変状態を更新しない。
 */
export function isWorkspaceCommitId(value: unknown): value is string {
  return typeof value === "string" && COMMIT_ID.test(value);
}
