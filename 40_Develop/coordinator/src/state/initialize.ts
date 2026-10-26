/**
 * 現在RepositoryのCoordinator状態を明示初期化する。
 * @responsibility 最寄りRootと既存Bindingを解決し、単一Writerへ渡す。
 * @trace ARCH-000004
 * @boundary 公開初期化要求とRepository-localの現在状態。
 * @security 任意Binding・保存先・既存状態の上書きを要求へ追加しない。
 */
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { deriveCoordinatorRepositoryBindingId } from "./validation.ts";
import { initializeCoordinatorSnapshot } from "../storage/state.ts";

/**
 * 初期化する現在位置だけを指定する。
 * @responsibility 対象Root・Bindingの確定を状態Ownerへ残す。
 * @trace ARCH-000004
 * @shape 任意のworkingDirectoryだけ。
 * @invariant Path入力を検証済みRootや書込み権限とみなさない。
 * @boundary 信頼したHost入口とRoot検証。
 * @security Credential・任意保存先を含めない。
 * @compatibility 新しい公開要求。保存Schemaは変更しない。
 */
export type ProjectInitializationRequest = Readonly<{
  workingDirectory?: string;
}>;

/**
 * 同じRepository Bindingの空状態を既存Writerで初期化する。
 * @responsibility CLIにあったRoot／Binding導出だけを状態Ownerへ集約する。
 * @trace ARCH-000004
 * @input request: 現在位置。省略時はProcessの現在位置。
 * @returns 既存Writerの結果又は開始前の固定拒否。
 * @precondition 呼出し元が初期化を明示要求する。
 * @postcondition 既存状態・保存Schema・CAS・排他の扱いを変更しない。
 * @effect 検証済みRepository内の既存状態初期化だけ。
 * @failure 不正要求・不明RootではWriterを呼ばない。
 * @invariant 任意Binding・新Registry・互換Readerを追加しない。
 * @boundary Package公開操作と単一保存Owner。
 * @security Getter／Proxyを評価せず、内部Rootを結果へ返さない。
 * @concurrency 初期化と既存状態の競合は既存Writerが調停する。
 */
export function initializeProject(request: ProjectInitializationRequest = {}) {
  const value =
    snapshotPlainRecord(request, new Set(["workingDirectory"])) ??
    snapshotPlainRecord(request, new Set());
  if (
    !value ||
    (value.workingDirectory !== undefined &&
      typeof value.workingDirectory !== "string")
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "project_initialization_request_invalid",
    });
  let root: string;
  try {
    root = resolveVerifiedRepositoryRootFromWorkingDirectory(
      typeof value.workingDirectory === "string"
        ? value.workingDirectory
        : process.cwd(),
    );
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_repository_root_not_verified",
    });
  }
  return initializeCoordinatorSnapshot(
    root,
    deriveCoordinatorRepositoryBindingId(root),
  );
}
