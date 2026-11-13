/**
 * Workspaceと統合結果の保存値と操作契約を定義する。
 * @responsibility 保存Schemaを変更せず、完成操作と検査が共有する型の正本を持つ。
 * @trace ARCH-000008
 */

import type {
  CommitSelection,
  CommitTemporary,
} from "../../../version-control/src/index.ts";
import type { EXECUTION_INTEGRATION_CONTRACT } from "./validation.ts";

/**
 * Isolated Workspaceの現在値を表す。
 * @responsibility 同UUIDの作成・利用・破棄途中と現在世代を保持する。
 * @trace ARCH-000004
 * @shape ID、世代、Base、HEAD、状態、保留、処置、技術結果。
 * @invariant Task終端で自動除去しない。Task一覧を重複保持しない。
 * @boundary 同じRepositoryのstate.json。
 * @security この記録だけで実行・削除を許可しない。
 * @compatibility 新Snapshot専用。旧形式の補完なし。
 */
export type WorkspaceRecord = Readonly<{
  workspaceId: string;
  name: string | null;
  candidate: WorkspaceCandidateRecord | null;
  generation: number;
  baseCommit: string;
  head: string;
  phase: "creating" | "ready" | "discarding";
  holdUntil: string | null;
  pending: Readonly<{
    operationId: string;
    kind: "create" | "discard";
    expectedHead: string;
    discardChanges: boolean;
  }> | null;
  lastResult: RepositoryWorktreeResult | null;
  primaryFailure: string | null;
}>;

/**
 * 候補公開・採用結果の完全な保存値を定義する。
 *
 * @responsibility 候補公開と採用Receiptの結合・内容を現在状態の結果区画として保持する。
 * @trace ARCH-000005
 * @shape contract、kind、四つの結合ID、identity、contentHash、value。
 * @invariant 保存成功を受領・既読へ読み替えない。
 * @boundary 候補結果Portと現在状態保存。
 * @security 保護DecisionやAuthorityを追加しない。
 * @compatibility valueは既存PortのJSON値をそのまま保持する。
 */
export type ResultRecord = Readonly<{
  contract: typeof EXECUTION_INTEGRATION_CONTRACT;
  kind: "integration" | "adoption";
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string | null;
  queueId: string;
  identity: string;
  contentHash: string;
  value: unknown;
}>;

/**
 * 一つの固定候補の意図と結果を既存Workspace記録へ結合する。
 * @responsibility 固定・採用・Ref回収の同操作再入場。
 * @trace ARCH-000004
 * @shape 固定要求、段階、候補OID、取込先、結果と採否。
 * @invariant 候補固定と採用を別操作とし名前は固定時の値を保持。
 * @boundary 既存state.jsonのみ。
 * @security 現在認可への再結合なしでEffectを許可しない。
 * @compatibility 新形式のみ、旧記録を補完しない。
 */
export type WorkspaceCandidateRecord = Readonly<{
  request: WorkspaceCandidateRequest;
  phase: "freezing" | "fixed" | "merging" | "merged" | "removing";
  candidateCommit: string | null;
  target: Readonly<{ targetBranch: string; expectedTargetHead: string }> | null;
  mergeCommit: string | null;
  disposition: "adopted" | "rejected" | null;
  lastResult: WorkspaceCandidateResult | null;
  primaryFailure: string | null;
  cleanupFailure: string | null;
}>;

/** Workspace記録へ保持するGit Worktreeの技術結果。 */
export type RepositoryWorktreeResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  workspaceId: string;
  relativePath: string | null;
  branch: string | null;
  expectedCommit: string | null;
  effectIssued: boolean;
  worktreeRemoved: boolean | null;
  branchRemoved: boolean | null;
  workspaceDirectoryRetained: boolean | null;
  observation: RepositoryWorktreeObservation | null;
}>;

/** 保存に用いるWorktree登録・実体・Revisionの技術観測。 */
export type RepositoryWorktreeObservation = Readonly<{
  registered: boolean;
  directoryPresent: boolean;
  branchHead: string | null;
  head: string | null;
  locked: boolean;
  prunable: boolean;
  dirty: boolean | null;
}>;

/** 候補のWorkspace・表示名・関連変更と選択内容のDomain要求。 */
export type WorkspaceCandidateRequest = Readonly<{
  workspaceId: string;
  operationId: string;
  baseCommit: string;
  expectedWorkspaceHead: string;
  selection: readonly CommitSelection[];
  workspaceName: string | null;
  candidateName: string | null;
  relatedChangeIds: readonly string[];
}>;

/** 候補固定・取込の結果と元操作相関を保存するDomain値。 */
export type WorkspaceCandidateResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  candidateRef: string | null;
  candidateCommit: string | null;
  mergeCommit: string | null;
  effectIssued: boolean;
  cleanupConfirmed: boolean;
  temporary: CommitTemporary | null;
  changedPaths: readonly string[];
}>;
