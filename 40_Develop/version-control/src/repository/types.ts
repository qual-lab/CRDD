/**
 * Gitの完成操作が受け渡す要求と技術結果。
 * @responsibility 業務上の採否・保存・命名を含めず、発行前拒否と発行後不明を区別する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 */
import type { REPOSITORY_LOCATION_CONTRACT } from "./location.ts";
import type { WorktreeTarget } from "../worktree/types.ts";
import type {
  LOCAL_CHANGE_SET_CONTRACT,
  LOCAL_CHANGE_SET_CONTRACT_REVISION,
} from "./working-directory.ts";

/** 対象Worktreeと操作する相対Path集合を指定する。 */
export type PathsRequest = Readonly<{ paths: readonly string[] }>;
/** 現在の変更からCommitするPath集合とメッセージを指定する。 */
export type ChangesCommitRequest = Readonly<{ message: string }>;

/** Git変更の発行・確認を、操作の意味上の完了と分離する。 */
export type ChangesResult = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string;
  effectIssued: boolean;
  effectConfirmed: boolean;
  revisionIdentity: string | null;
  automaticRetryIssued: false;
  forcePublicationIssued: false;
}>;

/** 送信Revisionと確認済み公開先を照合するPush要求。 */
export type RepositoryPushRequest = Readonly<{
  destination: string;
  branch: string;
  revisionIdentity: string;
  humanConfirmed: true;
}>;

/** 現在Branchの上流参照とRemote側Revisionの観測結果。 */
export type RemoteTarget = Readonly<{
  status: "available" | "not_configured" | "unknown";
  reason:
    | "publication_target_observed"
    | "publication_upstream_not_configured"
    | "publication_target_observation_failed";
  destination: string | null;
  branch: string | null;
  revisionIdentity: string | null;
}>;

/** 今回提供するのは共有の直接Branch Ref（refs/heads/）だけ。用途・名前の生成は上位が所有する。 */
export type ReferenceCreateRequest = Readonly<{
  name: string;
  commitId: string;
}>;
/** Symbolic Ref、checkout中Branch、Worktree固有Refは削除対象にしない。 */
export type ReferenceRemoveRequest = Readonly<{
  name: string;
  expectedCommitId: string | null;
  temporaryIndex?: Readonly<{ directory: string; value: CommitTemporary }>;
}>;
/** 管理参照の作成・削除結果とEffectの発行有無。 */
export type ReferenceResult = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string;
  name: string;
  commitId: string | null;
  effectIssued: boolean;
  effectConfirmed: boolean;
  present: boolean | null;
  cleanupConfirmed: boolean;
  temporary: CommitTemporary | null;
}>;
/** 検証済みのRepository。値の正当性は発行元の私有結合と現在実体で確認する。 */
export type Repository = Readonly<{
  contract: typeof REPOSITORY_LOCATION_CONTRACT;
}>;

/** Repository取得の結果。観測不能を取得成功や不存在へ読み替えない。 */
export type RepositoryResult =
  | Readonly<{
      status: "completed";
      reason: "repository_root_verified";
      capability: Repository;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_root_invalid";
      capability: null;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_object_format_unsupported";
      capability: null;
      /** 読取り専用の形式診断。操作用Rootの成立を表さない。 */
      objectFormat: "sha256";
    }>;

/** 現在Worktreeの四区分の変更観測。部分観測はこの型を返さない。 */
export type WorkingChanges = Readonly<{
  contract: typeof LOCAL_CHANGE_SET_CONTRACT;
  contractRevision: typeof LOCAL_CHANGE_SET_CONTRACT_REVISION;
  revisionChanges: readonly string[];
  preparedChanges: readonly string[];
  workingChanges: readonly string[];
  unregisteredPaths: readonly string[];
  changedPaths: readonly string[];
  observationComplete: true;
  repositoryPathReported: false;
}>;

/** Tree一覧と選択File差分の完成した観測値。 */
export type TreeEntry = Readonly<{
  path: string;
  name: string;
  kind: "directory" | "file";
  prepared: boolean;
  working: boolean;
  unregistered: boolean;
}>;

/** 指定Tree内の項目と読取り範囲を返す。 */
export type TreePage = Readonly<{
  directory: string;
  entries: readonly TreeEntry[];
  nextCursor: string | null;
}>;

/** 一Fileの差分と取得可否・制限を返す。 */
export type FileDiff = Readonly<{
  path: string;
  preparedPatch: string;
  workingPatch: string;
  preparedTruncated: boolean;
  workingTruncated: boolean;
  unregistered: boolean;
}>;

/** 固定Commit内の一Fileを、作業Treeに依存せず読み取る。 */
export type CommitFileReadRequest = Readonly<{
  commit: string;
  path: string;
  maximumBytes?: number;
}>;
/** 固定Commitから得た一Fileの内容・形式と取得結果。 */
export type CommitFile = Readonly<{
  status: "read";
  revisionIdentity: string;
  relativePath: string;
  mode: "100644" | "100755";
  bytes: Buffer;
  sha256: string;
  repositoryPathReported: false;
}>;
/** 出力Repository内の既存の空Directoryへコピーする。trueは内容拒否。 */
export type CommitFilesCopyRequest = Readonly<{
  commit: string;
  outputRepository: Repository;
  relativeDirectory: string;
  paths: readonly string[] | null;
  inspectContent: ((relativePath: string, bytes: Uint8Array) => boolean) | null;
}>;
/** 固定内容のコピー結果と出力先・途中失敗。 */
export type CommitFilesCopyResult =
  | Readonly<{
      status: "materialized";
      baseRevisionIdentity: string;
      baseSnapshotIdentity: string;
      fileCount: number;
      byteLength: number;
      contentManifestHash: string;
      repositoryPathReported: false;
      outputPathReported: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "fixed_snapshot_content_policy_rejected"
        | "commit_copy_destination_invalid"
        | "commit_copy_failed"
        | "commit_copy_cleanup_unconfirmed";
      effectIssued: boolean;
      effectStateUnknown: boolean;
      cleanupConfirmed: boolean;
      repositoryPathReported: false;
      outputPathReported: false;
    }>;

/** 確認したraw Blob又は明示削除。Indexや業務状態を含めない。 */
export type CommitSelection = Readonly<{
  path: string;
  blobId: string | null;
  mode: "100644" | "100755" | null;
}>;
/** この操作が生成した短命Indexの再入場参照。 */
export type CommitTemporary = Readonly<{
  relativePath: string;
  identity: string | null;
}>;
/** 基準Commitと選択内容から不変Commitを作る技術要求。 */
export type CommitCreateRequest = Readonly<{
  worktree?: WorktreeTarget;
  baseCommit: string;
  expectedHead: string;
  selection: readonly CommitSelection[];
  message: string;
  temporaryDirectory: string;
  previousCommit?: string | null;
  temporary?: CommitTemporary | null;
}>;
/** Commit生成結果と生成済みObject・一時領域の処置状態。 */
export type CommitCreateResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  commitId: string | null;
  effectIssued: boolean;
  cleanupConfirmed: boolean;
  temporary: CommitTemporary | null;
  changedPaths: readonly string[];
}>;

/** 対象Worktreeの期待HEADと統合するCommitを指定する。 */
export type CommitMergeRequest = Readonly<{
  baseCommit: string;
  sourceCommit: string;
  targetBranch: string;
  expectedHead: string;
  message: string;
}>;
/** Merge結果・現在Revision・発行有無と未確認状態。 */
export type CommitMergeResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  sourceCommit: string;
  commitId: string | null;
  effectIssued: boolean;
}>;

/** 現在Fileを読む。比較基準の省略時は同じ観測のHEADを使う。 */
export type FileReadRequest = Readonly<{
  baseCommit?: string | undefined;
  path: string;
}>;
/** 現在Worktreeから読んだFile内容と比較・取得結果。 */
export type WorkingFile = Readonly<{
  baseCommit: string;
  head: string;
  selection: CommitSelection;
  content: string | null;
  binary: boolean;
  patch: string;
  truncated: false;
}>;
/** 比較するCommitと差分の対象範囲を指定する。 */
export type CommitDiffRequest = Readonly<{
  baseCommit: string;
  commitId: string;
  path: string;
}>;
/** Commit間の変更集合と差分取得の結果。 */
export type CommitDiff = Readonly<{
  baseCommit: string;
  commitId: string;
  path: string;
  binary: boolean;
  patch: string;
  truncated: false;
}>;
