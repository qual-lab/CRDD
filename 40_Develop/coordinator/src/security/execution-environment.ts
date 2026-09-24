/**
 * execution-environmentに属する責務をまとめる。
 *
 * @responsibility FilesystemIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reduceHostGenerationLossTransition } from "../core/host-generation-loss-transition.ts";
import {
  beginRuntimeProcessEffectDrain,
  endRuntimeProcessEffectDrain,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import {
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedHostOperationSupervisorLock,
} from "./candidate-store-kernel-lock.ts";
import {
  loadHostRecoveryRecordByToken,
  parseHostRecoveryToken,
} from "./host-recovery-record.ts";

export const CREDENTIAL_ENV_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CODEX_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GIT_ASKPASS",
  "OPENAI_API_KEY",
  "SSH_AUTH_SOCK",
]);

const WINDOWS_RUNTIME_ENV = Object.freeze([
  "COMSPEC",
  "PATHEXT",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "WINDIR",
]);
const POSIX_RUNTIME_ENV = Object.freeze([
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SHELL",
]);
const OWNED_PREFIX = "crdd-coordinator-doctor-";
const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";
/**
 * execution-environmentで使用するFilesystem Identityの値契約を定義する。
 *
 * @responsibility Filesystem IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape FilesystemIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FilesystemIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FilesystemIdentityの宣言は外部境界を開かない。
 * @security FilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FilesystemIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FilesystemIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;
/**
 * execution-environmentで使用するSerializable Identityの値契約を定義する。
 *
 * @responsibility Serializable IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape SerializableIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SerializableIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: SerializableIdentityの宣言は外部境界を開かない。
 * @security SerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SerializableIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SerializableIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;
/**
 * execution-environmentで使用するDirectory Snapshotの値契約を定義する。
 *
 * @responsibility Directory SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DirectorySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DirectorySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: DirectorySnapshotの宣言は外部境界を開かない。
 * @security DirectorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DirectorySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DirectorySnapshot = Readonly<{
  parent: string;
  root: string;
  name: string;
  filesystem: FilesystemIdentity;
}>;
/**
 * execution-environmentで使用するOperation Directoriesの値契約を定義する。
 *
 * @responsibility Operation DirectoriesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationDirectoriesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationDirectoriesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationDirectoriesの宣言は外部境界を開かない。
 * @security OperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationDirectoriesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OperationDirectories = Readonly<{
  root: string;
  providerHome: string;
  workspace: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;
/**
 * execution-environmentで使用するChild Snapshotsの値契約を定義する。
 *
 * @responsibility Child SnapshotsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ChildSnapshotsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ChildSnapshotsで宣言した値と責務の対応を維持する。
 * @boundary N/A: ChildSnapshotsの宣言は外部境界を開かない。
 * @security ChildSnapshotsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ChildSnapshotsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ChildSnapshots = Readonly<{
  workspace: DirectorySnapshot;
  providerHome: DirectorySnapshot;
  tmp: DirectorySnapshot;
  events: DirectorySnapshot;
  projection: DirectorySnapshot;
  management: DirectorySnapshot;
}>;
/**
 * execution-environmentで使用する回復 状態の値契約を定義する。
 *
 * @responsibility 回復 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RecoveryStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RecoveryStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RecoveryStateの宣言は外部境界を開かない。
 * @security RecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RecoveryStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RecoveryState =
  | "initializing"
  | "host_only"
  | "docker_submission_started"
  | "docker_absent_confirmed";
/**
 * execution-environmentで使用するHost 回復 状態の値契約を定義する。
 *
 * @responsibility Host 回復 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecoveryStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecoveryStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecoveryStateの宣言は外部境界を開かない。
 * @security HostRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecoveryStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecoveryState = Readonly<{
  directory: string;
  directoryIdentity: FilesystemIdentity;
  record: string;
  recordIdentity: FilesystemIdentity | null;
  nonce: string;
  state: RecoveryState;
  recordHash: string | null;
}>;
/**
 * execution-environmentで使用する所有 Identityの値契約を定義する。
 *
 * @responsibility 所有 IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedIdentityの宣言は外部境界を開かない。
 * @security OwnedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedIdentity = Readonly<{
  operationId: string;
  parent: string;
  root: string;
  prefix: string;
  filesystem: FilesystemIdentity;
  createdAt: string;
  hostRecovery: HostRecoveryState;
  children?: ChildSnapshots;
  mounts?: Readonly<{
    workspace: DirectorySnapshot;
    providerHome: DirectorySnapshot;
    tmp: DirectorySnapshot;
  }>;
}>;
/**
 * execution-environmentで使用する所有 Operation Directoriesの値契約を定義する。
 *
 * @responsibility 所有 Operation DirectoriesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationDirectoriesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationDirectoriesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationDirectoriesの宣言は外部境界を開かない。
 * @security OwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationDirectoriesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationDirectories = {
  parent: string;
  root: string;
  directories: OperationDirectories | null;
  hostRecoveryId: string | null;
};
/**
 * execution-environmentで使用する所有 Mount Pathsの値契約を定義する。
 *
 * @responsibility 所有 Mount PathsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedMountPathsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedMountPathsで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedMountPathsの宣言は外部境界を開かない。
 * @security OwnedMountPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedMountPathsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedMountPaths = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;
/**
 * execution-environmentで使用するHost 記録 Childの値契約を定義する。
 *
 * @responsibility Host 記録 ChildのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecordChildが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecordChildで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecordChildの宣言は外部境界を開かない。
 * @security HostRecordChildはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecordChildの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecordChild = SerializableIdentity & Readonly<{ pathName: string }>;
/**
 * execution-environmentで使用するHost 回復 記録の値契約を定義する。
 *
 * @responsibility Host 回復 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecoveryRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecoveryRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecoveryRecordの宣言は外部境界を開かない。
 * @security HostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecoveryRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecoveryRecord = Readonly<{
  schema: "crdd-coordinator-host-recovery/v1";
  state: RecoveryState;
  rootName: string;
  rootIdentity: SerializableIdentity | null;
  childIdentities: Readonly<Record<string, HostRecordChild>>;
  createdAt: string;
}>;

const ownedIdentities = new WeakMap<object, OwnedIdentity>();
/**
 * execution-environmentで使用する所有 Operation Directory Creation 失敗の値契約を定義する。
 *
 * @responsibility 所有 Operation Directory Creation 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationDirectoryCreationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationDirectoryCreationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationDirectoryCreationFailureの宣言は外部境界を開かない。
 * @security OwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationDirectoryCreationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedOperationDirectoryCreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;
const ownedOperationDirectoryCreationFailures = new WeakMap<
  object,
  OwnedOperationDirectoryCreationFailure
>();
/**
 * execution-environmentで使用するHost 回復 Initialization 失敗の値契約を定義する。
 *
 * @responsibility Host 回復 Initialization 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecoveryInitializationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecoveryInitializationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecoveryInitializationFailureの宣言は外部境界を開かない。
 * @security HostRecoveryInitializationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecoveryInitializationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecoveryInitializationFailure = Readonly<{
  cleanupConfirmed: boolean;
  hostRecoveryId: string | null;
}>;
const hostRecoveryInitializationFailures = new WeakMap<
  object,
  HostRecoveryInitializationFailure
>();

/**
 * throw Host 回復 Initialization 失敗を決定する。
 *
 * @responsibility throw Host 回復 Initialization 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input cause: unknown、details: HostRecoveryInitializationFailure
 * @returns neverを返す。
 * @precondition 「cause: unknown、details: HostRecoveryInitializationFailure」がthrowHostRecoveryInitializationFailureの入力契約を満たす。
 * @postcondition throwHostRecoveryInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwHostRecoveryInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwHostRecoveryInitializationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwHostRecoveryInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwHostRecoveryInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security throwHostRecoveryInitializationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwHostRecoveryInitializationFailureは共有非同期状態を持たない同期処理である。
 */
function throwHostRecoveryInitializationFailure(
  cause: unknown,
  details: HostRecoveryInitializationFailure,
): never {
  const error = new Error("host_recovery_initialization_failed", { cause });
  hostRecoveryInitializationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * host 回復 Initialization 失敗を決定する。
 *
 * @responsibility host 回復 Initialization 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns hostRecoveryInitializationFailureの計算結果を返す。
 * @precondition 「error: unknown」がhostRecoveryInitializationFailureの入力契約を満たす。
 * @postcondition hostRecoveryInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: hostRecoveryInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hostRecoveryInitializationFailureは独自の失敗分岐を所有しない。
 * @invariant hostRecoveryInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hostRecoveryInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security hostRecoveryInitializationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostRecoveryInitializationFailureは共有非同期状態を持たない同期処理である。
 */
function hostRecoveryInitializationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (hostRecoveryInitializationFailures.get(error) ?? null)
    : null;
}

/**
 * throw 所有 Operation Directory Creation 失敗を決定する。
 *
 * @responsibility throw 所有 Operation Directory Creation 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input cause: unknown、details: OwnedOperationDirectoryCreationFailure
 * @returns neverを返す。
 * @precondition 「cause: unknown、details: OwnedOperationDirectoryCreationFailure」がthrowOwnedOperationDirectoryCreationFailureの入力契約を満たす。
 * @postcondition throwOwnedOperationDirectoryCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwOwnedOperationDirectoryCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwOwnedOperationDirectoryCreationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwOwnedOperationDirectoryCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwOwnedOperationDirectoryCreationFailureはProcess内の同一Subsystemで完結する。
 * @security throwOwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwOwnedOperationDirectoryCreationFailureは共有非同期状態を持たない同期処理である。
 */
function throwOwnedOperationDirectoryCreationFailure(
  cause: unknown,
  details: OwnedOperationDirectoryCreationFailure,
): never {
  const error = new Error("owned_operation_directory_creation_failed", {
    cause,
  });
  ownedOperationDirectoryCreationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * 所有 Operation Directory Creation 失敗を分類する。
 *
 * @responsibility 所有 Operation Directory Creation 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns classifyOwnedOperationDirectoryCreationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyOwnedOperationDirectoryCreationFailureの入力契約を満たす。
 * @postcondition classifyOwnedOperationDirectoryCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyOwnedOperationDirectoryCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyOwnedOperationDirectoryCreationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyOwnedOperationDirectoryCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyOwnedOperationDirectoryCreationFailureはProcess内の同一Subsystemで完結する。
 * @security classifyOwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyOwnedOperationDirectoryCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyOwnedOperationDirectoryCreationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (ownedOperationDirectoryCreationFailures.get(error) ?? null)
    : null;
}

/**
 * Isolated 所有 Operation Directory Creation 失敗 候補を構築する。
 *
 * @responsibility Isolated 所有 Operation Directory Creation 失敗 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createIsolatedOwnedOperationDirectoryCreationFailureCandidateの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateIsolatedOwnedOperationDirectoryCreationFailureCandidateの入力契約を満たす。
 * @postcondition createIsolatedOwnedOperationDirectoryCreationFailureCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedOwnedOperationDirectoryCreationFailureCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedOwnedOperationDirectoryCreationFailureCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedOwnedOperationDirectoryCreationFailureCandidate() {
  return Object.freeze({
    productionAuthority: false as const,
    fail: (details: OwnedOperationDirectoryCreationFailure): never =>
      throwOwnedOperationDirectoryCreationFailure(
        new Error("isolated_owned_operation_directory_creation_failed"),
        Object.freeze(details),
      ),
  });
}
/**
 * execution-environmentで使用するMount Capability Identityの値契約を定義する。
 *
 * @responsibility Mount Capability IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape MountCapabilityIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MountCapabilityIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: MountCapabilityIdentityの宣言は外部境界を開かない。
 * @security MountCapabilityIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility MountCapabilityIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type MountCapabilityIdentity = Readonly<{
  owned: object;
  children: ChildSnapshots;
}>;
const mountCapabilities = new WeakMap<object, MountCapabilityIdentity>();
/**
 * execution-environmentで使用するOperation Context Identityの値契約を定義する。
 *
 * @responsibility Operation Context IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationContextIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationContextIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationContextIdentityの宣言は外部境界を開かない。
 * @security OperationContextIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationContextIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationContextIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
}>;
/**
 * execution-environmentで使用する所有 Operation Contextの値契約を定義する。
 *
 * @responsibility 所有 Operation ContextのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationContextが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationContextで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationContextの宣言は外部境界を開かない。
 * @security OwnedOperationContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationContextの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationContext = Readonly<{
  operationId: string;
  createdAt: string;
}>;
const operationContextCapabilities = new WeakMap<
  object,
  OperationContextIdentity
>();
const operationContextAliases = new WeakMap<object, Set<object>>();
/**
 * execution-environmentで使用するOperation Management Identityの値契約を定義する。
 *
 * @responsibility Operation Management IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationManagementIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationManagementIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationManagementIdentityの宣言は外部境界を開かない。
 * @security OperationManagementIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationManagementIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationManagementIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
}>;
/**
 * execution-environmentで使用する所有 Operation Management Bindingの値契約を定義する。
 *
 * @responsibility 所有 Operation Management BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationManagementBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationManagementBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationManagementBindingの宣言は外部境界を開かない。
 * @security OwnedOperationManagementBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationManagementBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationManagementBinding = Readonly<{
  operationId: string;
  createdAt: string;
  managementScopeBound: true;
}>;
const operationManagementCapabilities = new WeakMap<
  object,
  OperationManagementIdentity
>();
/**
 * execution-environmentで使用するOperation Generation 状態の値契約を定義する。
 *
 * @responsibility Operation Generation 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationGenerationStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationGenerationStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationGenerationStateの宣言は外部境界を開かない。
 * @security OperationGenerationStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationGenerationStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationGenerationState = {
  owned: object;
  root: string;
  nonce: string;
  currentRecordHash: string;
  retired: boolean;
  lossOutcome: "cleanup_confirmed_failure" | "cleanup_unknown" | null;
  generationLock: NonNullable<
    Awaited<
      ReturnType<typeof acquireRuntimeOwnedHostOperationSupervisorLock>
    >["lock"]
  > | null;
};
const operationGenerationsByKey = new Map<string, OperationGenerationState>();
const operationGenerationByRoot = new Map<string, OperationGenerationState>();
/**
 * execution-environmentで使用するHost 清掃 Capability Identityの値契約を定義する。
 *
 * @responsibility Host 清掃 Capability IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostCleanupCapabilityIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostCleanupCapabilityIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostCleanupCapabilityIdentityの宣言は外部境界を開かない。
 * @security HostCleanupCapabilityIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostCleanupCapabilityIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostCleanupCapabilityIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
  root: string;
  nonce: string;
  recordHash: string;
  subject: object;
}>;
const hostCleanupCapabilities = new WeakMap<
  object,
  HostCleanupCapabilityIdentity
>();

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security isObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * Operation Idを構築する。
 *
 * @responsibility Operation Idの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns stringを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateOperationIdの入力契約を満たす。
 * @postcondition createOperationIdの責務を完了した結果だけを返す。
 * @effect N/A: createOperationIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOperationIdは独自の失敗分岐を所有しない。
 * @invariant createOperationIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOperationIdはProcess内の同一Subsystemで完結する。
 * @security createOperationIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOperationIdは共有非同期状態を持たない同期処理である。
 */
function createOperationId(): string {
  const decimal = BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString(10);
  return `OP-${decimal.padStart(6, "0")}`;
}

/**
 * 所有 Operation Context Capabilitiesを失効させる。
 *
 * @responsibility 所有 Operation Context Capabilitiesの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input owned: object
 * @returns N/A: revokeOwnedOperationContextCapabilitiesは戻り値を返さない。
 * @precondition 「owned: object」がrevokeOwnedOperationContextCapabilitiesの入力契約を満たす。
 * @postcondition revokeOwnedOperationContextCapabilitiesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: revokeOwnedOperationContextCapabilitiesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeOwnedOperationContextCapabilitiesは独自の失敗分岐を所有しない。
 * @invariant revokeOwnedOperationContextCapabilitiesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationContextCapabilitiesはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationContextCapabilitiesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeOwnedOperationContextCapabilitiesは共有非同期状態を持たない同期処理である。
 */
function revokeOwnedOperationContextCapabilities(owned: object): void {
  const aliases = operationContextAliases.get(owned);
  if (aliases) {
    for (const alias of aliases) {
      operationContextCapabilities.delete(alias);
      mountCapabilities.delete(alias);
      operationManagementCapabilities.delete(alias);
    }
    operationContextAliases.delete(owned);
  }
}

/**
 * 所有 Operation Effect Capabilitiesを失効させる。
 *
 * @responsibility 所有 Operation Effect Capabilitiesの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input owned: object
 * @returns voidを返す。
 * @precondition 「owned: object」がrevokeOwnedOperationEffectCapabilitiesの入力契約を満たす。
 * @postcondition revokeOwnedOperationEffectCapabilitiesの責務を完了した結果だけを返す。
 * @effect N/A: revokeOwnedOperationEffectCapabilitiesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeOwnedOperationEffectCapabilitiesは独自の失敗分岐を所有しない。
 * @invariant revokeOwnedOperationEffectCapabilitiesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationEffectCapabilitiesはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationEffectCapabilitiesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeOwnedOperationEffectCapabilitiesは共有非同期状態を持たない同期処理である。
 */
function revokeOwnedOperationEffectCapabilities(owned: object): void {
  const aliases = operationContextAliases.get(owned);
  if (!aliases) return;
  for (const alias of aliases) {
    operationContextCapabilities.delete(alias);
    mountCapabilities.delete(alias);
  }
}

/**
 * operation Generation Keyを決定する。
 *
 * @responsibility operation Generation Keyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns stringを返す。
 * @precondition 「root: string、nonce: string」がoperationGenerationKeyの入力契約を満たす。
 * @postcondition operationGenerationKeyの責務を完了した結果だけを返す。
 * @effect N/A: operationGenerationKeyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: operationGenerationKeyは独自の失敗分岐を所有しない。
 * @invariant operationGenerationKeyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: operationGenerationKeyはProcess内の同一Subsystemで完結する。
 * @security operationGenerationKeyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationGenerationKeyは共有非同期状態を持たない同期処理である。
 */
function operationGenerationKey(root: string, nonce: string): string {
  return `${root}\0${nonce}`;
}

/**
 * 所有 Operation Generationを登録する。
 *
 * @responsibility 所有 Operation Generationの登録条件、Identity、一意性境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity
 * @returns N/A: registerOwnedOperationGenerationは戻り値を返さない。
 * @precondition 「owned: object、identity: OwnedIdentity」がregisterOwnedOperationGenerationの入力契約を満たす。
 * @postcondition registerOwnedOperationGenerationの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: registerOwnedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure registerOwnedOperationGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant registerOwnedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: registerOwnedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security registerOwnedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: registerOwnedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function registerOwnedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
): void {
  const recordHash = identity.hostRecovery.recordHash;
  if (!recordHash) throw new Error("owned_operation_generation_conflict");
  const key = operationGenerationKey(
    identity.root,
    identity.hostRecovery.nonce,
  );
  if (
    operationGenerationsByKey.has(key) ||
    operationGenerationByRoot.has(identity.root)
  )
    throw new Error("owned_operation_generation_conflict");
  const state: OperationGenerationState = {
    owned,
    root: identity.root,
    nonce: identity.hostRecovery.nonce,
    currentRecordHash: recordHash,
    retired: false,
    lossOutcome: null,
    generationLock: null,
  };
  operationGenerationsByKey.set(key, state);
  operationGenerationByRoot.set(identity.root, state);
}

/**
 * 所有 Operation Generationを失効させる。
 *
 * @responsibility 所有 Operation Generationの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns revokeOwnedOperationGenerationの計算結果を返す。
 * @precondition 「root: string、nonce: string」がrevokeOwnedOperationGenerationの入力契約を満たす。
 * @postcondition revokeOwnedOperationGenerationの責務を完了した結果だけを返す。
 * @effect N/A: revokeOwnedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeOwnedOperationGenerationは独自の失敗分岐を所有しない。
 * @invariant revokeOwnedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeOwnedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function revokeOwnedOperationGeneration(root: string, nonce: string) {
  const key = operationGenerationKey(root, nonce);
  const state = operationGenerationsByKey.get(key);
  if (!state) return true;
  if (state.generationLock) return false;
  revokeOwnedOperationContextCapabilities(state.owned);
  ownedIdentities.delete(state.owned);
  operationGenerationsByKey.delete(key);
  if (operationGenerationByRoot.get(root) === state)
    operationGenerationByRoot.delete(root);
  return true;
}

/**
 * 所有 Operation Generation Asyncを失効させる。
 *
 * @responsibility 所有 Operation Generation Asyncの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns revokeOwnedOperationGenerationAsyncの計算結果を返す。
 * @precondition 「root: string、nonce: string」がrevokeOwnedOperationGenerationAsyncの入力契約を満たす。
 * @postcondition revokeOwnedOperationGenerationAsyncの責務を完了した結果だけを返す。
 * @effect N/A: revokeOwnedOperationGenerationAsyncは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure revokeOwnedOperationGenerationAsyncは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant revokeOwnedOperationGenerationAsyncは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationGenerationAsyncはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationGenerationAsyncはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency revokeOwnedOperationGenerationAsyncは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function revokeOwnedOperationGenerationAsync(
  root: string,
  nonce: string,
) {
  const key = operationGenerationKey(root, nonce);
  const state = operationGenerationsByKey.get(key);
  if (!state) return "released" as const;
  revokeOwnedOperationContextCapabilities(state.owned);
  let generationRelease:
    | "released"
    | "cleanup_confirmed_failure"
    | "cleanup_unknown" = "released";
  if (state.generationLock) {
    try {
      generationRelease = await state.generationLock.release();
    } catch {
      generationRelease = "cleanup_unknown";
    }
    if (generationRelease !== "cleanup_unknown") state.generationLock = null;
  }
  if (generationRelease !== "cleanup_unknown") {
    ownedIdentities.delete(state.owned);
    operationGenerationsByKey.delete(key);
    if (operationGenerationByRoot.get(root) === state)
      operationGenerationByRoot.delete(root);
  } else {
    state.retired = true;
    poisonRuntimeProcessAfterCleanupUnknown();
  }
  return generationRelease;
}

/**
 * execution-environmentで使用するHost Operation 回復 Generationの値契約を定義する。
 *
 * @responsibility Host Operation 回復 GenerationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostOperationRecoveryGenerationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostOperationRecoveryGenerationで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostOperationRecoveryGenerationの宣言は外部境界を開かない。
 * @security HostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostOperationRecoveryGenerationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostOperationRecoveryGeneration = Readonly<{
  root: string;
  nonce: string;
  lock: NonNullable<
    ReturnType<typeof acquireRuntimeOwnedHostOperationKernelLock>
  >;
}>;
const hostOperationRecoveryGenerations = new WeakMap<
  object,
  HostOperationRecoveryGeneration
>();

/**
 * Host Operation 回復 Generationを取得する。
 *
 * @responsibility Host Operation 回復 Generationの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns acquireHostOperationRecoveryGenerationの計算結果を返す。
 * @precondition 「token: unknown」がacquireHostOperationRecoveryGenerationの入力契約を満たす。
 * @postcondition acquireHostOperationRecoveryGenerationの責務を完了した結果だけを返す。
 * @effect N/A: acquireHostOperationRecoveryGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure acquireHostOperationRecoveryGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireHostOperationRecoveryGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: acquireHostOperationRecoveryGenerationはProcess内の同一Subsystemで完結する。
 * @security acquireHostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireHostOperationRecoveryGenerationは共有非同期状態を持たない同期処理である。
 */
export function acquireHostOperationRecoveryGeneration(token: unknown) {
  try {
    const loaded = loadHostRecoveryRecordByToken(token);
    const root = path.join(loaded.parent, loaded.parsed.rootName);
    return acquireHostOperationRecoveryGenerationByIdentity(
      root,
      loaded.parsed.nonce,
    );
  } catch {
    return null;
  }
}

/**
 * Host Operation 回復 Generation By Identityを取得する。
 *
 * @responsibility Host Operation 回復 Generation By Identityの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000008
 * @input root: unknown、nonce: unknown
 * @returns acquireHostOperationRecoveryGenerationByIdentityの計算結果を返す。
 * @precondition 「root: unknown、nonce: unknown」がacquireHostOperationRecoveryGenerationByIdentityの入力契約を満たす。
 * @postcondition acquireHostOperationRecoveryGenerationByIdentityの責務を完了した結果だけを返す。
 * @effect acquireHostOperationRecoveryGenerationByIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure acquireHostOperationRecoveryGenerationByIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireHostOperationRecoveryGenerationByIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireHostOperationRecoveryGenerationByIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireHostOperationRecoveryGenerationByIdentityは共有非同期状態を持たない同期処理である。
 */
export function acquireHostOperationRecoveryGenerationByIdentity(
  root: unknown,
  nonce: unknown,
) {
  try {
    if (
      typeof root !== "string" ||
      !path.isAbsolute(root) ||
      path.dirname(root) !== fs.realpathSync(path.dirname(root)) ||
      typeof nonce !== "string"
    )
      return null;
    const lock = acquireRuntimeOwnedHostOperationKernelLock(
      path.basename(root),
      nonce,
    );
    if (!lock) return null;
    const capability = Object.freeze({});
    hostOperationRecoveryGenerations.set(
      capability,
      Object.freeze({ root, nonce, lock }),
    );
    return capability;
  } catch {
    return null;
  }
}

/**
 * Host Operation 回復 Generationを解放する。
 *
 * @responsibility Host Operation 回復 Generationの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns releaseHostOperationRecoveryGenerationの計算結果を返す。
 * @precondition 「capability: unknown」がreleaseHostOperationRecoveryGenerationの入力契約を満たす。
 * @postcondition releaseHostOperationRecoveryGenerationの責務を完了した結果だけを返す。
 * @effect N/A: releaseHostOperationRecoveryGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure releaseHostOperationRecoveryGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseHostOperationRecoveryGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: releaseHostOperationRecoveryGenerationはProcess内の同一Subsystemで完結する。
 * @security releaseHostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseHostOperationRecoveryGenerationは共有非同期状態を持たない同期処理である。
 */
export function releaseHostOperationRecoveryGeneration(capability: unknown) {
  if (!isObject(capability)) return false;
  const generation = hostOperationRecoveryGenerations.get(capability);
  if (!generation) return false;
  hostOperationRecoveryGenerations.delete(capability);
  try {
    return generation.lock.release();
  } catch {
    return false;
  }
}

/**
 * Host Operation 回復 Generationを検証する。
 *
 * @responsibility Host Operation 回復 Generationの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown、root: string、nonce: string
 * @returns N/A: verifyHostOperationRecoveryGenerationは戻り値を返さない。
 * @precondition 「capability: unknown、root: string、nonce: string」がverifyHostOperationRecoveryGenerationの入力契約を満たす。
 * @postcondition verifyHostOperationRecoveryGenerationの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyHostOperationRecoveryGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyHostOperationRecoveryGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyHostOperationRecoveryGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyHostOperationRecoveryGenerationはProcess内の同一Subsystemで完結する。
 * @security verifyHostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyHostOperationRecoveryGenerationは共有非同期状態を持たない同期処理である。
 */
function verifyHostOperationRecoveryGeneration(
  capability: unknown,
  root: string,
  nonce: string,
) {
  const generation = isObject(capability)
    ? (hostOperationRecoveryGenerations.get(capability) ?? null)
    : null;
  if (!generation || generation.root !== root || generation.nonce !== nonce)
    throw new Error("host_recovery_generation_active");
}

/**
 * retire 所有 Operation Generationを決定する。
 *
 * @responsibility retire 所有 Operation Generationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns voidを返す。
 * @precondition 「root: string、nonce: string」がretireOwnedOperationGenerationの入力契約を満たす。
 * @postcondition retireOwnedOperationGenerationの責務を完了した結果だけを返す。
 * @effect N/A: retireOwnedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retireOwnedOperationGenerationは独自の失敗分岐を所有しない。
 * @invariant retireOwnedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retireOwnedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security retireOwnedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: retireOwnedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function retireOwnedOperationGeneration(root: string, nonce: string): void {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(root, nonce),
  );
  if (!state) return;
  state.retired = true;
  revokeOwnedOperationContextCapabilities(state.owned);
}

/**
 * owned Operation Generationを決定する。
 *
 * @responsibility owned Operation Generationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity、shouldAllowRetired
 * @returns OperationGenerationStateを返す。
 * @precondition 「owned: object、identity: OwnedIdentity、shouldAllowRetired」がownedOperationGenerationの入力契約を満たす。
 * @postcondition ownedOperationGenerationの責務を完了した結果だけを返す。
 * @effect N/A: ownedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownedOperationGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security ownedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function ownedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): OperationGenerationState {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(identity.root, identity.hostRecovery.nonce),
  );
  if (
    !state ||
    state.owned !== owned ||
    operationGenerationByRoot.get(identity.root) !== state ||
    state.currentRecordHash !== identity.hostRecovery.recordHash ||
    (!shouldAllowRetired && state.retired)
  )
    throw new Error("owned_operation_identity_replaced");
  if (
    !shouldAllowRetired &&
    state.generationLock &&
    !state.generationLock.assertLive()
  ) {
    state.retired = true;
    revokeOwnedOperationEffectCapabilities(state.owned);
    throw new Error("owned_operation_generation_liveness_lost");
  }
  return state;
}

/**
 * operation Identity Replacementを決定する。
 *
 * @responsibility operation Identity Replacementの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns booleanを返す。
 * @precondition 「error: unknown」がoperationIdentityReplacementの入力契約を満たす。
 * @postcondition operationIdentityReplacementの責務を完了した結果だけを返す。
 * @effect N/A: operationIdentityReplacementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: operationIdentityReplacementは独自の失敗分岐を所有しない。
 * @invariant operationIdentityReplacementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: operationIdentityReplacementはProcess内の同一Subsystemで完結する。
 * @security operationIdentityReplacementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationIdentityReplacementは共有非同期状態を持たない同期処理である。
 */
function operationIdentityReplacement(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    errorCode(error) === "ENOENT" ||
    message === "owned_operation_identity_replaced" ||
    message === "owned_operation_mount_replaced"
  );
}

/**
 * 所有 Operation Identityの契約を検証する。
 *
 * @responsibility 所有 Operation Identityの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity、shouldAllowRetired
 * @returns ChildSnapshotsを返す。
 * @precondition 「owned: object、identity: OwnedIdentity、shouldAllowRetired」がvalidateOwnedOperationIdentityの入力契約を満たす。
 * @postcondition validateOwnedOperationIdentityの責務を完了した結果だけを返す。
 * @effect validateOwnedOperationIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure validateOwnedOperationIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateOwnedOperationIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateOwnedOperationIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateOwnedOperationIdentityは共有非同期状態を持たない同期処理である。
 */
function validateOwnedOperationIdentity(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): ChildSnapshots {
  try {
    ownedOperationGeneration(owned, identity, shouldAllowRetired);
    if (
      !identity.children ||
      ownString(owned, "root") !== identity.root ||
      ownString(owned, "parent") !== identity.parent ||
      fs.realpathSync(identity.root) !== identity.root ||
      fs.realpathSync(identity.parent) !== identity.parent ||
      path.dirname(identity.root) !== identity.parent ||
      !path.basename(identity.root).startsWith(identity.prefix) ||
      !sameFilesystemIdentity(
        readFilesystemIdentity(identity.root),
        identity.filesystem,
      )
    ) {
      throw new Error("owned_operation_identity_replaced");
    }
    for (const snapshot of Object.values(identity.children))
      validateDirectorySnapshot(snapshot);
    return identity.children;
  } catch (error) {
    if (operationIdentityReplacement(error)) {
      retireOwnedOperationGeneration(
        identity.root,
        identity.hostRecovery.nonce,
      );
      throw new Error("owned_operation_identity_replaced");
    }
    throw new Error("owned_operation_identity_observation_blocked");
  }
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (
    !descriptor ||
    !("value" in descriptor) ||
    descriptor.get ||
    descriptor.set
  )
    return undefined;
  return descriptor.value;
}

/**
 * own Stringを決定する。
 *
 * @responsibility own Stringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns string | nullを返す。
 * @precondition 「value: unknown、key: string」がownStringの入力契約を満たす。
 * @postcondition ownStringの責務を完了した結果だけを返す。
 * @effect N/A: ownStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownStringは独自の失敗分岐を所有しない。
 * @invariant ownStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownStringはProcess内の同一Subsystemで完結する。
 * @security ownStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownStringは共有非同期状態を持たない同期処理である。
 */
function ownString(value: unknown, key: string): string | null {
  if (!isObject(value)) return null;
  const candidate = ownValue(value, key);
  return typeof candidate === "string" ? candidate : null;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown): string | null {
  return ownString(error, "code");
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security errorMessageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

/**
 * Filesystem Entryを観測する。
 *
 * @responsibility Filesystem Entryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns "present" | "confirmed_absent" | "unknown"を返す。
 * @precondition 「target: string」がobserveFilesystemEntryの入力契約を満たす。
 * @postcondition observeFilesystemEntryの責務を完了した結果だけを返す。
 * @effect observeFilesystemEntryはFilesystemの読取りまたは書込みを実行する。
 * @failure observeFilesystemEntryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeFilesystemEntryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeFilesystemEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeFilesystemEntryは共有非同期状態を持たない同期処理である。
 */
function observeFilesystemEntry(
  target: string,
): "present" | "confirmed_absent" | "unknown" {
  try {
    fs.lstatSync(target);
    return "present";
  } catch (error) {
    return errorCode(error) === "ENOENT" ? "confirmed_absent" : "unknown";
  }
}

/**
 * require Confirmed Absentを決定する。
 *
 * @responsibility require Confirmed Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、reason: string
 * @returns N/A: requireConfirmedAbsentは戻り値を返さない。
 * @precondition 「target: string、reason: string」がrequireConfirmedAbsentの入力契約を満たす。
 * @postcondition requireConfirmedAbsentの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: requireConfirmedAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireConfirmedAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireConfirmedAbsentはProcess内の同一Subsystemで完結する。
 * @security requireConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
function requireConfirmedAbsent(target: string, reason: string): void {
  if (observeFilesystemEntry(target) !== "confirmed_absent")
    throw new Error(reason);
}

/**
 * Plain 記録かを判定する。
 *
 * @responsibility Plain 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisPlainRecordの入力契約を満たす。
 * @postcondition isPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: isPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlainRecordは独自の失敗分岐を所有しない。
 * @invariant isPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlainRecordはProcess内の同一Subsystemで完結する。
 * @security isPlainRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlainRecordは共有非同期状態を持たない同期処理である。
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Serializable Identityを固定Schemaへ正規化する。
 *
 * @responsibility Serializable Identityの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns SerializableIdentityを返す。
 * @precondition 「value: unknown」がnormalizeSerializableIdentityの入力契約を満たす。
 * @postcondition normalizeSerializableIdentityの責務を完了した結果だけを返す。
 * @effect N/A: normalizeSerializableIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeSerializableIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeSerializableIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeSerializableIdentityはProcess内の同一Subsystemで完結する。
 * @security normalizeSerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeSerializableIdentityは共有非同期状態を持たない同期処理である。
 */
function normalizeSerializableIdentity(value: unknown): SerializableIdentity {
  if (!isPlainRecord(value)) throw new Error("host_recovery_record_mismatch");
  const dev = ownString(value, "dev");
  const ino = ownString(value, "ino");
  const birthtimeNs = ownString(value, "birthtimeNs");
  if (!dev || !ino || !birthtimeNs)
    throw new Error("host_recovery_record_mismatch");
  return Object.freeze({ dev, ino, birthtimeNs });
}

/**
 * 回復 状態を固定Schemaへ正規化する。
 *
 * @responsibility 回復 状態の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns RecoveryStateを返す。
 * @precondition 「value: unknown」がnormalizeRecoveryStateの入力契約を満たす。
 * @postcondition normalizeRecoveryStateの責務を完了した結果だけを返す。
 * @effect N/A: normalizeRecoveryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeRecoveryStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeRecoveryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeRecoveryStateはProcess内の同一Subsystemで完結する。
 * @security normalizeRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeRecoveryStateは共有非同期状態を持たない同期処理である。
 */
function normalizeRecoveryState(value: unknown): RecoveryState {
  if (
    value !== "initializing" &&
    value !== "host_only" &&
    value !== "docker_submission_started" &&
    value !== "docker_absent_confirmed"
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  return value;
}

/**
 * Host 回復 記録を固定Schemaへ正規化する。
 *
 * @responsibility Host 回復 記録の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns HostRecoveryRecordを返す。
 * @precondition 「value: unknown」がnormalizeHostRecoveryRecordの入力契約を満たす。
 * @postcondition normalizeHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: normalizeHostRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeHostRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeHostRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security normalizeHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function normalizeHostRecoveryRecord(value: unknown): HostRecoveryRecord {
  if (!isPlainRecord(value)) throw new Error("host_recovery_record_mismatch");
  const schema = ownString(value, "schema");
  const rootName = ownString(value, "rootName");
  const createdAt = ownString(value, "createdAt");
  const childValues = ownValue(value, "childIdentities");
  if (
    schema !== "crdd-coordinator-host-recovery/v1" ||
    !rootName ||
    !createdAt ||
    !isPlainRecord(childValues)
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  const childIdentities: Record<string, HostRecordChild> = {};
  for (const [name, childValue] of Object.entries(childValues)) {
    if (!isPlainRecord(childValue))
      throw new Error("host_recovery_record_mismatch");
    const pathName = ownString(childValue, "pathName");
    if (!pathName) throw new Error("host_recovery_record_mismatch");
    childIdentities[name] = Object.freeze({
      pathName,
      ...normalizeSerializableIdentity(childValue),
    });
  }
  const state = normalizeRecoveryState(ownValue(value, "state"));
  const rootIdentityValue = ownValue(value, "rootIdentity");
  const rootIdentity =
    rootIdentityValue === null
      ? null
      : normalizeSerializableIdentity(rootIdentityValue);
  if (
    (state === "initializing" && rootIdentity !== null) ||
    (state !== "initializing" && rootIdentity === null) ||
    (state === "initializing" && Object.keys(childIdentities).length !== 0)
  )
    throw new Error("host_recovery_record_mismatch");
  return Object.freeze({
    schema,
    state,
    rootName,
    rootIdentity,
    childIdentities: Object.freeze(childIdentities),
    createdAt,
  });
}

/**
 * owned Identityを決定する。
 *
 * @responsibility owned Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns OwnedIdentity | nullを返す。
 * @precondition 「value: unknown」がownedIdentityの入力契約を満たす。
 * @postcondition ownedIdentityの責務を完了した結果だけを返す。
 * @effect N/A: ownedIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownedIdentityは独自の失敗分岐を所有しない。
 * @invariant ownedIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedIdentityはProcess内の同一Subsystemで完結する。
 * @security ownedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedIdentityは共有非同期状態を持たない同期処理である。
 */
function ownedIdentity(value: unknown): OwnedIdentity | null {
  return isObject(value) ? (ownedIdentities.get(value) ?? null) : null;
}

/**
 * require 所有 Identityを決定する。
 *
 * @responsibility require 所有 Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object
 * @returns OwnedIdentityを返す。
 * @precondition 「value: object」がrequireOwnedIdentityの入力契約を満たす。
 * @postcondition requireOwnedIdentityの責務を完了した結果だけを返す。
 * @effect N/A: requireOwnedIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireOwnedIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireOwnedIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireOwnedIdentityはProcess内の同一Subsystemで完結する。
 * @security requireOwnedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireOwnedIdentityは共有非同期状態を持たない同期処理である。
 */
function requireOwnedIdentity(value: object): OwnedIdentity {
  const identity = ownedIdentities.get(value);
  if (!identity) throw new Error("owned_operation_directory_identity_required");
  return identity;
}

/**
 * Filesystem Identityを読み取る。
 *
 * @responsibility Filesystem Identityの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input root: string
 * @returns FilesystemIdentityを返す。
 * @precondition 「root: string」がreadFilesystemIdentityの入力契約を満たす。
 * @postcondition readFilesystemIdentityの責務を完了した結果だけを返す。
 * @effect readFilesystemIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure readFilesystemIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readFilesystemIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readFilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readFilesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function readFilesystemIdentity(root: string): FilesystemIdentity {
  const metadata = fs.lstatSync(root, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("owned_operation_directory_identity_unavailable");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * File Identityを読み取る。
 *
 * @responsibility File Identityの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns FilesystemIdentityを返す。
 * @precondition 「target: string」がreadFileIdentityの入力契約を満たす。
 * @postcondition readFileIdentityの責務を完了した結果だけを返す。
 * @effect readFileIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure readFileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readFileIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readFileIdentityは共有非同期状態を持たない同期処理である。
 */
function readFileIdentity(target: string): FilesystemIdentity {
  const metadata = fs.lstatSync(target, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("owned_operation_file_identity_unavailable");
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * Open File Identityを読み取る。
 *
 * @responsibility Open File Identityの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input handle: number
 * @returns FilesystemIdentityを返す。
 * @precondition 「handle: number」がreadOpenFileIdentityの入力契約を満たす。
 * @postcondition readOpenFileIdentityの責務を完了した結果だけを返す。
 * @effect readOpenFileIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure readOpenFileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readOpenFileIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readOpenFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readOpenFileIdentityは共有非同期状態を持たない同期処理である。
 */
function readOpenFileIdentity(handle: number): FilesystemIdentity {
  const metadata = fs.fstatSync(handle, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("owned_operation_file_identity_unavailable");
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * Host 回復 Token From Markerが完全一致するか判定する。
 *
 * @responsibility Host 回復 Token From Markerの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input target: string、expectedRootName: string、nonce: string、allowedItems: readonly Readonly<{ identity: FilesystemIdentity; serialized: string; }>[]
 * @returns string | nullを返す。
 * @precondition 「target: string、expectedRootName: string、nonce: string、allowedItems: readonly Readonly<{ identity: FilesystemIdentity; serialized: string; }>[]」がexactHostRecoveryTokenFromMarkerの入力契約を満たす。
 * @postcondition exactHostRecoveryTokenFromMarkerの責務を完了した結果だけを返す。
 * @effect exactHostRecoveryTokenFromMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure exactHostRecoveryTokenFromMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactHostRecoveryTokenFromMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security exactHostRecoveryTokenFromMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactHostRecoveryTokenFromMarkerは共有非同期状態を持たない同期処理である。
 */
function exactHostRecoveryTokenFromMarker(
  target: string,
  expectedRootName: string,
  nonce: string,
  allowedItems: readonly Readonly<{
    identity: FilesystemIdentity;
    serialized: string;
  }>[],
): string | null {
  try {
    if (observeFilesystemEntry(target) !== "present") return null;
    const firstIdentity = readFileIdentity(target);
    const firstSerialized = fs.readFileSync(target, "utf8");
    if (
      !allowedItems.some(
        (candidate) =>
          sameFilesystemIdentity(firstIdentity, candidate.identity) &&
          firstSerialized === candidate.serialized,
      )
    )
      return null;
    const record = normalizeHostRecoveryRecord(JSON.parse(firstSerialized));
    if (record.rootName !== expectedRootName) return null;
    const secondIdentity = readFileIdentity(target);
    const secondSerialized = fs.readFileSync(target, "utf8");
    if (
      !sameFilesystemIdentity(firstIdentity, secondIdentity) ||
      firstSerialized !== secondSerialized
    )
      return null;
    const recordHash = createHash("sha256")
      .update(firstSerialized)
      .digest("hex");
    return `host.${expectedRootName}.${nonce}.${recordHash}`;
  } catch {
    return null;
  }
}

/**
 * Filesystem Identityが同一かを判定する。
 *
 * @responsibility Filesystem Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: FilesystemIdentity、right: FilesystemIdentity
 * @returns booleanを返す。
 * @precondition 「left: FilesystemIdentity、right: FilesystemIdentity」がsameFilesystemIdentityの入力契約を満たす。
 * @postcondition sameFilesystemIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameFilesystemIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameFilesystemIdentityは独自の失敗分岐を所有しない。
 * @invariant sameFilesystemIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameFilesystemIdentityはProcess内の同一Subsystemで完結する。
 * @security sameFilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameFilesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function sameFilesystemIdentity(
  left: FilesystemIdentity,
  right: FilesystemIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

/**
 * directory Snapshotを決定する。
 *
 * @responsibility directory Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、parent: string、name: string
 * @returns DirectorySnapshotを返す。
 * @precondition 「directory: string、parent: string、name: string」がdirectorySnapshotの入力契約を満たす。
 * @postcondition directorySnapshotの責務を完了した結果だけを返す。
 * @effect directorySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure directorySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant directorySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security directorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: directorySnapshotは共有非同期状態を持たない同期処理である。
 */
function directorySnapshot(
  directory: string,
  parent: string,
  name: string,
): DirectorySnapshot {
  const realParent = fs.realpathSync(parent);
  const realDirectory = fs.realpathSync(directory);
  if (
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== name
  ) {
    throw new Error("owned_operation_mount_boundary_failed");
  }
  return Object.freeze({
    parent: realParent,
    root: realDirectory,
    name,
    filesystem: readFilesystemIdentity(realDirectory),
  });
}

/**
 * Directory Snapshotの契約を検証する。
 *
 * @responsibility Directory Snapshotの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input snapshot: DirectorySnapshot
 * @returns stringを返す。
 * @precondition 「snapshot: DirectorySnapshot」がvalidateDirectorySnapshotの入力契約を満たす。
 * @postcondition validateDirectorySnapshotの責務を完了した結果だけを返す。
 * @effect validateDirectorySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure validateDirectorySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateDirectorySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateDirectorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDirectorySnapshotは共有非同期状態を持たない同期処理である。
 */
function validateDirectorySnapshot(snapshot: DirectorySnapshot): string {
  const realParent = fs.realpathSync(snapshot.parent);
  const realDirectory = fs.realpathSync(snapshot.root);
  const filesystem = readFilesystemIdentity(snapshot.root);
  if (
    realParent !== snapshot.parent ||
    realDirectory !== snapshot.root ||
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== snapshot.name ||
    !sameFilesystemIdentity(filesystem, snapshot.filesystem)
  ) {
    throw new Error("owned_operation_mount_replaced");
  }
  return snapshot.root;
}

/**
 * copy If Presentを決定する。
 *
 * @responsibility copy If Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: Record<string, string>、source: unknown、name: string
 * @returns N/A: copyIfPresentは戻り値を返さない。
 * @precondition 「target: Record<string, string>、source: unknown、name: string」がcopyIfPresentの入力契約を満たす。
 * @postcondition copyIfPresentの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: copyIfPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: copyIfPresentは独自の失敗分岐を所有しない。
 * @invariant copyIfPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: copyIfPresentはProcess内の同一Subsystemで完結する。
 * @security copyIfPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: copyIfPresentは共有非同期状態を持たない同期処理である。
 */
function copyIfPresent(
  target: Record<string, string>,
  source: unknown,
  name: string,
): void {
  const candidate = ownString(source, name);
  if (candidate !== null) target[name] = candidate;
}

/**
 * serializable Identityを決定する。
 *
 * @responsibility serializable Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns SerializableIdentityを返す。
 * @precondition 「target: string」がserializableIdentityの入力契約を満たす。
 * @postcondition serializableIdentityの責務を完了した結果だけを返す。
 * @effect serializableIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: serializableIdentityは独自の失敗分岐を所有しない。
 * @invariant serializableIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security serializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: serializableIdentityは共有非同期状態を持たない同期処理である。
 */
function serializableIdentity(target: string): SerializableIdentity {
  const identity = readFilesystemIdentity(target);
  return {
    dev: identity.dev.toString(),
    ino: identity.ino.toString(),
    birthtimeNs: identity.birthtimeNs.toString(),
  };
}

/**
 * identity Matches 記録を決定する。
 *
 * @responsibility identity Matches 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、record: SerializableIdentity
 * @returns booleanを返す。
 * @precondition 「target: string、record: SerializableIdentity」がidentityMatchesRecordの入力契約を満たす。
 * @postcondition identityMatchesRecordの責務を完了した結果だけを返す。
 * @effect identityMatchesRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure identityMatchesRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityMatchesRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security identityMatchesRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityMatchesRecordは共有非同期状態を持たない同期処理である。
 */
function identityMatchesRecord(
  target: string,
  record: SerializableIdentity,
): boolean {
  try {
    const identity = readFilesystemIdentity(target);
    return (
      identity.dev === BigInt(record.dev) &&
      identity.ino === BigInt(record.ino) &&
      identity.birthtimeNs === BigInt(record.birthtimeNs)
    );
  } catch {
    return false;
  }
}

/**
 * Host 回復 Directoryが成立する状態を確保する。
 *
 * @responsibility Host 回復 Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000008
 * @input parent: string
 * @returns Readonly<{ directory: string; identity: FilesystemIdentity }>を返す。
 * @precondition 「parent: string」がensureHostRecoveryDirectoryの入力契約を満たす。
 * @postcondition ensureHostRecoveryDirectoryの責務を完了した結果だけを返す。
 * @effect ensureHostRecoveryDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureHostRecoveryDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureHostRecoveryDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security ensureHostRecoveryDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureHostRecoveryDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureHostRecoveryDirectory(
  parent: string,
): Readonly<{ directory: string; identity: FilesystemIdentity }> {
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  const before = observeFilesystemEntry(directory);
  if (before === "unknown")
    throwHostRecoveryInitializationFailure(
      new Error("host_recovery_directory_observation_unknown"),
      { cleanupConfirmed: false, hostRecoveryId: null },
    );
  let isCreationAttempted = false;
  let isCreated = false;
  let identity: FilesystemIdentity | null = null;
  try {
    if (before === "confirmed_absent") {
      isCreationAttempted = true;
      fs.mkdirSync(directory, { mode: 0o700 });
      isCreated = true;
    }
    const real = fs.realpathSync(directory);
    const metadata = fs.lstatSync(real);
    identity = readFilesystemIdentity(real);
    if (
      real !== directory ||
      path.dirname(real) !== parent ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink()
    ) {
      throw new Error("host_recovery_directory_untrusted");
    }
    return { directory: real, identity };
  } catch (error) {
    let cleanupConfirmed = !isCreationAttempted;
    if (isCreated && identity) {
      try {
        if (
          !sameFilesystemIdentity(
            readFilesystemIdentity(directory),
            identity,
          ) ||
          fs.readdirSync(directory).length !== 0
        )
          throw new Error("host_recovery_directory_replaced");
        fs.rmdirSync(directory);
        requireConfirmedAbsent(
          directory,
          "host_recovery_directory_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (!cleanupConfirmed)
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: null,
      });
    throw error;
  }
}

/**
 * host 記録 Contentを決定する。
 *
 * @responsibility host 記録 Contentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity、state: RecoveryState
 * @returns HostRecoveryRecordを返す。
 * @precondition 「identity: OwnedIdentity、state: RecoveryState」がhostRecordContentの入力契約を満たす。
 * @postcondition hostRecordContentの責務を完了した結果だけを返す。
 * @effect N/A: hostRecordContentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hostRecordContentは独自の失敗分岐を所有しない。
 * @invariant hostRecordContentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hostRecordContentはProcess内の同一Subsystemで完結する。
 * @security hostRecordContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostRecordContentは共有非同期状態を持たない同期処理である。
 */
function hostRecordContent(
  identity: OwnedIdentity,
  state: RecoveryState,
): HostRecoveryRecord {
  return {
    schema: "crdd-coordinator-host-recovery/v1",
    state,
    rootName: path.basename(identity.root),
    rootIdentity: serializableIdentity(identity.root),
    childIdentities: Object.fromEntries(
      Object.entries(identity.children ?? {}).map(([name, snapshot]) => [
        name,
        {
          pathName: snapshot.name,
          ...serializableIdentity(snapshot.root),
        },
      ]),
    ),
    createdAt: identity.createdAt,
  };
}

/**
 * Initializing Host 回復 記録を書き込む。
 *
 * @responsibility Initializing Host 回復 記録の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input target: string、rootName: string、nonce: string、createdAt: string
 * @returns Readonly<{ recordHash: string; recordIdentity: FilesystemIdentity; serialized: string; token: string; }>を返す。
 * @precondition 「target: string、rootName: string、nonce: string、createdAt: string」がwriteInitializingHostRecoveryRecordの入力契約を満たす。
 * @postcondition writeInitializingHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect writeInitializingHostRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure writeInitializingHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeInitializingHostRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeInitializingHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeInitializingHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function writeInitializingHostRecoveryRecord(
  target: string,
  rootName: string,
  nonce: string,
  createdAt: string,
): Readonly<{
  recordHash: string;
  recordIdentity: FilesystemIdentity;
  serialized: string;
  token: string;
}> {
  const record: HostRecoveryRecord = Object.freeze({
    schema: "crdd-coordinator-host-recovery/v1",
    state: "initializing",
    rootName,
    rootIdentity: null,
    childIdentities: Object.freeze({}),
    createdAt,
  });
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const token = `host.${rootName}.${nonce}.${recordHash}`;
  let handle: number | null = null;
  let recordIdentity: FilesystemIdentity | null = null;
  let entryCreated = false;
  try {
    handle = fs.openSync(target, "wx", 0o600);
    entryCreated = true;
    recordIdentity = readOpenFileIdentity(handle);
    fs.writeFileSync(handle, serialized, "utf8");
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
    if (
      !sameFilesystemIdentity(readFileIdentity(target), recordIdentity) ||
      fs.readFileSync(target, "utf8") !== serialized
    )
      throw new Error("host_recovery_record_replaced");
  } catch (error) {
    let cleanupConfirmed = !entryCreated;
    let handleSettled = handle === null;
    if (handle !== null) {
      try {
        fs.closeSync(handle);
        handle = null;
        handleSettled = true;
      } catch {
        handleSettled = false;
      }
    }
    if (recordIdentity && handleSettled) {
      try {
        const observation = observeFilesystemEntry(target);
        if (observation === "present") {
          if (!sameFilesystemIdentity(readFileIdentity(target), recordIdentity))
            throw new Error("host_recovery_record_replaced");
          fs.rmSync(target);
        } else if (observation === "unknown") {
          throw new Error("host_recovery_record_observation_unknown");
        }
        requireConfirmedAbsent(
          target,
          "host_recovery_record_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (!cleanupConfirmed || !handleSettled)
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: exactHostRecoveryTokenFromMarker(
          target,
          rootName,
          nonce,
          recordIdentity
            ? [Object.freeze({ identity: recordIdentity, serialized })]
            : [],
        ),
      });
    throw error;
  }
  if (!recordIdentity)
    throw new Error("host_recovery_record_identity_unavailable");
  return Object.freeze({
    recordHash,
    recordIdentity,
    serialized,
    token,
  });
}

/**
 * Host 回復 記録を書き込む。
 *
 * @responsibility Host 回復 記録の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity、state: RecoveryState
 * @returns stringを返す。
 * @precondition 「owned: object、identity: OwnedIdentity、state: RecoveryState」がwriteHostRecoveryRecordの入力契約を満たす。
 * @postcondition writeHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect writeHostRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure writeHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeHostRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function writeHostRecoveryRecord(
  owned: object,
  identity: OwnedIdentity,
  state: RecoveryState,
): string {
  const previous = readCurrentOwnedHostRecord(identity);
  if (
    !identity.hostRecovery.recordIdentity ||
    createHash("sha256").update(previous.serialized).digest("hex") !==
      identity.hostRecovery.recordHash ||
    previous.record.state !== identity.hostRecovery.state
  )
    throw new Error("host_recovery_record_mismatch");
  const record = hostRecordContent(identity, state);
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const target = identity.hostRecovery.record;
  const temporary = `${target}.${randomUUID()}.tmp`;
  let temporaryHandle: number | null = null;
  let temporaryIdentity: FilesystemIdentity | null = null;
  let temporaryCreated = false;
  let wasRenamed = false;
  try {
    temporaryHandle = fs.openSync(temporary, "wx", 0o600);
    temporaryCreated = true;
    temporaryIdentity = readOpenFileIdentity(temporaryHandle);
    fs.writeFileSync(temporaryHandle, serialized, "utf8");
    fs.fsyncSync(temporaryHandle);
    fs.closeSync(temporaryHandle);
    temporaryHandle = null;
    fs.renameSync(temporary, target);
    wasRenamed = true;
    if (
      !temporaryIdentity ||
      !sameFilesystemIdentity(readFileIdentity(target), temporaryIdentity)
    )
      throw new Error("host_recovery_record_replaced");
    if (fs.readFileSync(target, "utf8") !== serialized)
      throw new Error("host_recovery_record_replaced");
  } catch (error) {
    let cleanupConfirmed = !temporaryCreated;
    let handleSettled = temporaryHandle === null;
    if (temporaryHandle !== null) {
      try {
        fs.closeSync(temporaryHandle);
        temporaryHandle = null;
        handleSettled = true;
      } catch {
        handleSettled = false;
      }
    }
    const cleanupTarget = wasRenamed ? target : temporary;
    if (temporaryIdentity && handleSettled) {
      try {
        const observation = observeFilesystemEntry(cleanupTarget);
        if (observation === "present") {
          if (
            !sameFilesystemIdentity(
              readFileIdentity(cleanupTarget),
              temporaryIdentity,
            )
          )
            throw new Error("host_recovery_record_replaced");
          fs.rmSync(cleanupTarget);
        } else if (observation === "unknown") {
          throw new Error("host_recovery_record_observation_unknown");
        }
        requireConfirmedAbsent(
          cleanupTarget,
          "host_recovery_record_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    const retainedRecoveryId = exactHostRecoveryTokenFromMarker(
      target,
      path.basename(identity.root),
      identity.hostRecovery.nonce,
      [
        Object.freeze({
          identity: identity.hostRecovery.recordIdentity,
          serialized: previous.serialized,
        }),
        ...(temporaryIdentity
          ? [Object.freeze({ identity: temporaryIdentity, serialized })]
          : []),
      ],
    );
    const originalRecoveryId = expectedHostRecoveryToken(identity);
    if (
      !cleanupConfirmed ||
      !handleSettled ||
      retainedRecoveryId !== originalRecoveryId
    )
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: retainedRecoveryId,
      });
    throw error;
  }
  const updated = Object.freeze({
    ...identity,
    hostRecovery: Object.freeze({
      ...identity.hostRecovery,
      state,
      recordHash,
      recordIdentity: readFileIdentity(target),
    }),
  });
  ownedIdentities.set(owned, updated);
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${recordHash}`;
}

/**
 * Operation Directoriesを構築する。
 *
 * @responsibility Operation Directoriesの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input rootDirectory: string
 * @returns OperationDirectoriesを返す。
 * @precondition 「rootDirectory: string」がcreateOperationDirectoriesの入力契約を満たす。
 * @postcondition createOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect createOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: createOperationDirectoriesは独自の失敗分岐を所有しない。
 * @invariant createOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function createOperationDirectories(
  rootDirectory: string,
): OperationDirectories {
  const directories = {
    root: rootDirectory,
    providerHome: path.join(rootDirectory, "provider-home"),
    workspace: path.join(rootDirectory, "workspace"),
    tmp: path.join(rootDirectory, "tmp"),
    events: path.join(rootDirectory, "events"),
    projection: path.join(rootDirectory, "projection"),
    management: path.join(rootDirectory, "management"),
  };
  for (const directory of Object.values(directories))
    fs.mkdirSync(directory, { recursive: true });
  return directories;
}

/**
 * 所有 Operation Directoriesを構築する。
 *
 * @responsibility 所有 Operation Directoriesの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input temporaryParent: string
 * @returns OwnedOperationDirectories & { directories: OperationDirectories }を返す。
 * @precondition 「temporaryParent: string」がcreateOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition createOwnedOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationDirectoriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOwnedOperationDirectoriesは独自の失敗分岐を所有しない。
 * @invariant createOwnedOperationDirectoriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationDirectoriesはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationDirectories(
  temporaryParent?: string,
): OwnedOperationDirectories & { directories: OperationDirectories };
/**
 * 所有 Operation Directoriesを構築する。
 *
 * @responsibility 所有 Operation Directoriesの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input temporaryParent: string
 * @returns OwnedOperationDirectoriesを返す。
 * @precondition 「temporaryParent: string」がcreateOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition createOwnedOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect createOwnedOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure createOwnedOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationDirectories(
  temporaryParent: string = os.tmpdir(),
): OwnedOperationDirectories {
  let parent: string | null = null;
  let createdRoot: string | null = null;
  let createdRootIdentity: FilesystemIdentity | null = null;
  let realRoot: string | null = null;
  let owned: OwnedOperationDirectories | null = null;
  let initializingRecord: Readonly<{
    path: string;
    identity: FilesystemIdentity;
    serialized: string;
    token: string;
  }> | null = null;
  try {
    parent = fs.realpathSync(temporaryParent);
    const parentMetadata = fs.lstatSync(parent);
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
      throw new Error("temporary_parent_must_be_real_directory");
    }
    const recovery = ensureHostRecoveryDirectory(parent);
    const nonce = randomUUID();
    const rootName = `${OWNED_PREFIX}${nonce}`;
    const createdAt = new Date().toISOString();
    const recoveryRecord = path.join(
      recovery.directory,
      `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
    );
    const initializing = writeInitializingHostRecoveryRecord(
      recoveryRecord,
      rootName,
      nonce,
      createdAt,
    );
    initializingRecord = Object.freeze({
      path: recoveryRecord,
      identity: initializing.recordIdentity,
      serialized: initializing.serialized,
      token: initializing.token,
    });
    const candidateRoot = path.join(parent, rootName);
    fs.mkdirSync(candidateRoot);
    createdRoot = candidateRoot;
    createdRootIdentity = readFilesystemIdentity(createdRoot);
    realRoot = fs.realpathSync(createdRoot);
    if (
      path.dirname(realRoot) !== parent ||
      !path.basename(realRoot).startsWith(OWNED_PREFIX)
    ) {
      throw new Error("owned_operation_directory_boundary_failed");
    }
    owned = {
      parent,
      root: realRoot,
      directories: null,
      hostRecoveryId: null,
    };
    ownedIdentities.set(
      owned,
      Object.freeze({
        operationId: createOperationId(),
        parent,
        root: realRoot,
        prefix: OWNED_PREFIX,
        filesystem: readFilesystemIdentity(realRoot),
        createdAt,
        hostRecovery: Object.freeze({
          directory: recovery.directory,
          directoryIdentity: recovery.identity,
          record: recoveryRecord,
          recordIdentity: initializing.recordIdentity,
          nonce,
          state: "initializing",
          recordHash: initializing.recordHash,
        }),
      }),
    );
    owned.directories = createOperationDirectories(realRoot);
    const identity = requireOwnedIdentity(owned);
    if (!owned.directories)
      throw new Error("owned_operation_directory_identity_required");
    const children = Object.freeze({
      workspace: directorySnapshot(
        owned.directories.workspace,
        realRoot,
        "workspace",
      ),
      providerHome: directorySnapshot(
        owned.directories.providerHome,
        realRoot,
        "provider-home",
      ),
      tmp: directorySnapshot(owned.directories.tmp, realRoot, "tmp"),
      events: directorySnapshot(owned.directories.events, realRoot, "events"),
      projection: directorySnapshot(
        owned.directories.projection,
        realRoot,
        "projection",
      ),
      management: directorySnapshot(
        owned.directories.management,
        realRoot,
        "management",
      ),
    });
    ownedIdentities.set(
      owned,
      Object.freeze({
        ...identity,
        children,
        mounts: Object.freeze({
          workspace: children.workspace,
          providerHome: children.providerHome,
          tmp: children.tmp,
        }),
      }),
    );
    owned.hostRecoveryId = writeHostRecoveryRecord(
      owned,
      requireOwnedIdentity(owned),
      "host_only",
    );
    registerOwnedOperationGeneration(owned, requireOwnedIdentity(owned));
    return owned;
  } catch (error) {
    const nestedFailure = hostRecoveryInitializationFailure(error);
    let cleanupConfirmed = nestedFailure?.cleanupConfirmed ?? true;
    let rootCleanupConfirmed = createdRoot === null;
    let markerCleanupConfirmed = initializingRecord === null;
    if (cleanupConfirmed) {
      try {
        if (realRoot !== null && owned && ownedIdentity(owned)) {
          rollbackInitializingOperationDirectories(owned);
          rootCleanupConfirmed = true;
          markerCleanupConfirmed = true;
        } else if (
          createdRoot !== null &&
          createdRootIdentity !== null &&
          parent !== null
        ) {
          const metadata = fs.lstatSync(createdRoot);
          if (
            metadata.isSymbolicLink() ||
            !metadata.isDirectory() ||
            fs.realpathSync(createdRoot) !== createdRoot ||
            path.dirname(createdRoot) !== parent ||
            !path.basename(createdRoot).startsWith(OWNED_PREFIX) ||
            !sameFilesystemIdentity(
              readFilesystemIdentity(createdRoot),
              createdRootIdentity,
            )
          )
            throw new Error("owned_operation_directory_boundary_failed");
          fs.rmSync(createdRoot, { recursive: true, force: false });
          requireConfirmedAbsent(
            createdRoot,
            "owned_operation_directory_cleanup_incomplete",
          );
          rootCleanupConfirmed = true;
        }
      } catch {
        rootCleanupConfirmed = false;
      }
      if (rootCleanupConfirmed && !owned && initializingRecord) {
        try {
          const observation = observeFilesystemEntry(initializingRecord.path);
          if (observation === "present") {
            if (
              !sameFilesystemIdentity(
                readFileIdentity(initializingRecord.path),
                initializingRecord.identity,
              )
            )
              throw new Error("host_recovery_record_replaced");
            fs.rmSync(initializingRecord.path);
          } else if (observation === "unknown") {
            throw new Error("host_recovery_record_observation_unknown");
          }
          requireConfirmedAbsent(
            initializingRecord.path,
            "host_recovery_record_cleanup_unconfirmed",
          );
          markerCleanupConfirmed = true;
        } catch {
          markerCleanupConfirmed = false;
        }
      }
    }
    cleanupConfirmed =
      cleanupConfirmed && rootCleanupConfirmed && markerCleanupConfirmed;
    let retainedRecoveryId = nestedFailure?.hostRecoveryId ?? null;
    if (!nestedFailure && initializingRecord) {
      try {
        const parsed = parseHostRecoveryToken(initializingRecord.token);
        retainedRecoveryId = sameFilesystemIdentity(
          readFileIdentity(initializingRecord.path),
          initializingRecord.identity,
        )
          ? exactHostRecoveryTokenFromMarker(
              initializingRecord.path,
              parsed.rootName,
              parsed.nonce,
              [
                Object.freeze({
                  identity: initializingRecord.identity,
                  serialized: initializingRecord.serialized,
                }),
              ],
            )
          : null;
      } catch {
        retainedRecoveryId = null;
      }
    }
    throwOwnedOperationDirectoryCreationFailure(error, {
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed,
      hostRecoveryId: !cleanupConfirmed ? retainedRecoveryId : null,
    });
  }
}

/**
 * 所有 Host 回復 Idを取得する。
 *
 * @responsibility 所有 Host 回復 Idの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns stringを返す。
 * @precondition 「owned: unknown」がgetOwnedHostRecoveryIdの入力契約を満たす。
 * @postcondition getOwnedHostRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: getOwnedHostRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure getOwnedHostRecoveryIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant getOwnedHostRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getOwnedHostRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security getOwnedHostRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: getOwnedHostRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function getOwnedHostRecoveryId(owned: unknown): string {
  const identity = ownedIdentity(owned);
  if (!identity?.hostRecovery?.recordHash)
    throw new Error("owned_operation_directory_identity_required");
  validatePrivateHostRecoveryRecord(identity, "host_only");
  return expectedHostRecoveryToken(identity);
}

/**
 * 所有 Transition Inputsが有効な状態か判定する。
 *
 * @responsibility 所有 Transition Inputsの有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000008
 * @input mountCapability: unknown、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"
 * @returns Readonly<{ loaded: ReturnType<typeof loadHostRecoveryRecord>; state: OperationGenerationState; identity: OwnedIdentity; }>を返す。
 * @precondition 「mountCapability: unknown、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"」がactiveOwnedTransitionInputsの入力契約を満たす。
 * @postcondition activeOwnedTransitionInputsの責務を完了した結果だけを返す。
 * @effect N/A: activeOwnedTransitionInputsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure activeOwnedTransitionInputsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeOwnedTransitionInputsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activeOwnedTransitionInputsはProcess内の同一Subsystemで完結する。
 * @security activeOwnedTransitionInputsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeOwnedTransitionInputsは共有非同期状態を持たない同期処理である。
 */
function activeOwnedTransitionInputs(
  mountCapability: unknown,
  currentToken: unknown,
  expectedState: "host_only" | "docker_submission_started",
): Readonly<{
  loaded: ReturnType<typeof loadHostRecoveryRecord>;
  state: OperationGenerationState;
  identity: OwnedIdentity;
}> {
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!mount) throw new Error("owned_operation_mount_capability_required");
  return activeOwnedTransitionInputsForOwned(
    mount.owned,
    currentToken,
    expectedState,
    "owned_operation_mount_capability_required",
  );
}

/**
 * 所有 Transition Inputs For 所有が有効な状態か判定する。
 *
 * @responsibility 所有 Transition Inputs For 所有の有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"、bindingError
 * @returns Readonly<{ loaded: ReturnType<typeof loadHostRecoveryRecord>; state: OperationGenerationState; identity: OwnedIdentity; }>を返す。
 * @precondition 「owned: object、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"、bindingError」がactiveOwnedTransitionInputsForOwnedの入力契約を満たす。
 * @postcondition activeOwnedTransitionInputsForOwnedの責務を完了した結果だけを返す。
 * @effect N/A: activeOwnedTransitionInputsForOwnedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure activeOwnedTransitionInputsForOwnedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeOwnedTransitionInputsForOwnedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activeOwnedTransitionInputsForOwnedはProcess内の同一Subsystemで完結する。
 * @security activeOwnedTransitionInputsForOwnedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeOwnedTransitionInputsForOwnedは共有非同期状態を持たない同期処理である。
 */
function activeOwnedTransitionInputsForOwned(
  owned: object,
  currentToken: unknown,
  expectedState: "host_only" | "docker_submission_started",
  bindingError = "owned_operation_management_binding_required",
): Readonly<{
  loaded: ReturnType<typeof loadHostRecoveryRecord>;
  state: OperationGenerationState;
  identity: OwnedIdentity;
}> {
  const loaded = loadHostRecoveryRecord(currentToken);
  if (loaded.record.state !== expectedState)
    throw new Error("host_recovery_state_invalid");
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  const state = operationGenerationByRoot.get(root);
  if (!state || state.owned !== owned || state.retired)
    throw new Error(bindingError);
  const identity = ownedIdentities.get(state.owned);
  if (!identity) throw new Error(bindingError);
  validateOwnedOperationIdentity(state.owned, identity);
  if (
    loaded.parsed.nonce !== state.nonce ||
    loaded.parsed.recordHash !== state.currentRecordHash ||
    loaded.marker !== identity.hostRecovery.record ||
    identity.hostRecovery.state !== expectedState
  )
    throw new Error("host_recovery_generation_mismatch");
  return Object.freeze({ loaded, state, identity });
}

/**
 * replace Host 回復 記録 状態を決定する。
 *
 * @responsibility replace Host 回復 記録 状態の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input loaded: ReturnType<typeof loadHostRecoveryRecord>、nextState: RecoveryState
 * @returns Readonly<{ recordHash: string; recordIdentity: FilesystemIdentity; token: string; }>を返す。
 * @precondition 「loaded: ReturnType<typeof loadHostRecoveryRecord>、nextState: RecoveryState」がreplaceHostRecoveryRecordStateの入力契約を満たす。
 * @postcondition replaceHostRecoveryRecordStateの責務を完了した結果だけを返す。
 * @effect replaceHostRecoveryRecordStateはFilesystemの読取りまたは書込みを実行する。
 * @failure replaceHostRecoveryRecordStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant replaceHostRecoveryRecordStateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security replaceHostRecoveryRecordStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: replaceHostRecoveryRecordStateは共有非同期状態を持たない同期処理である。
 */
function replaceHostRecoveryRecordState(
  loaded: ReturnType<typeof loadHostRecoveryRecord>,
  nextState: RecoveryState,
): Readonly<{
  recordHash: string;
  recordIdentity: FilesystemIdentity;
  token: string;
}> {
  const updatedRecord = { ...loaded.record, state: nextState };
  const serialized = `${JSON.stringify(updatedRecord)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
  const temporaryHandle = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(temporaryHandle, serialized, "utf8");
    fs.fsyncSync(temporaryHandle);
  } finally {
    fs.closeSync(temporaryHandle);
  }
  fs.renameSync(temporary, loaded.marker);
  if (fs.readFileSync(loaded.marker, "utf8") !== serialized)
    throw new Error("host_recovery_record_replaced");
  return Object.freeze({
    recordHash,
    recordIdentity: readFileIdentity(loaded.marker),
    token: `host.${loaded.parsed.rootName}.${loaded.parsed.nonce}.${recordHash}`,
  });
}

/**
 * 所有 Docker Submission 状態を状態遷移させる。
 *
 * @responsibility 所有 Docker Submission 状態の遷移前提、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000008
 * @input mountCapability: unknown、currentToken: unknown、action: unknown
 * @returns stringを返す。
 * @precondition 「mountCapability: unknown、currentToken: unknown、action: unknown」がtransitionOwnedDockerSubmissionStateの入力契約を満たす。
 * @postcondition transitionOwnedDockerSubmissionStateの責務を完了した結果だけを返す。
 * @effect N/A: transitionOwnedDockerSubmissionStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure transitionOwnedDockerSubmissionStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant transitionOwnedDockerSubmissionStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: transitionOwnedDockerSubmissionStateはProcess内の同一Subsystemで完結する。
 * @security transitionOwnedDockerSubmissionStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: transitionOwnedDockerSubmissionStateは共有非同期状態を持たない同期処理である。
 */
export function transitionOwnedDockerSubmissionState(
  mountCapability: unknown,
  currentToken: unknown,
  action: unknown,
): string {
  const expectedState =
    action === "begin" ? "host_only" : "docker_submission_started";
  const nextState =
    action === "begin" ? "docker_submission_started" : "host_only";
  if (action !== "begin" && action !== "cancel")
    throw new Error("host_recovery_state_invalid");
  const { loaded, state, identity } = activeOwnedTransitionInputs(
    mountCapability,
    currentToken,
    expectedState,
  );
  const updated = replaceHostRecoveryRecordState(loaded, nextState);
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: nextState,
        recordHash: updated.recordHash,
        recordIdentity: updated.recordIdentity,
      }),
    }),
  );
  state.currentRecordHash = updated.recordHash;
  return updated.token;
}

/**
 * owned Operation From Management Capabilityを決定する。
 *
 * @responsibility owned Operation From Management Capabilityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns ownedOperationFromManagementCapabilityの計算結果を返す。
 * @precondition 「managementCapability: unknown」がownedOperationFromManagementCapabilityの入力契約を満たす。
 * @postcondition ownedOperationFromManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: ownedOperationFromManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownedOperationFromManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownedOperationFromManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedOperationFromManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security ownedOperationFromManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedOperationFromManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
function ownedOperationFromManagementCapability(managementCapability: unknown) {
  const binding = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({ binding, identity });
}

/**
 * 所有 Host Operation Generation Lockを有効化する。
 *
 * @responsibility 所有 Host Operation Generation Lockの有効化条件、状態遷移、失敗時の非発効境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns activateOwnedHostOperationGenerationLockの計算結果を返す。
 * @precondition 「managementCapability: unknown」がactivateOwnedHostOperationGenerationLockの入力契約を満たす。
 * @postcondition activateOwnedHostOperationGenerationLockの責務を完了した結果だけを返す。
 * @effect N/A: activateOwnedHostOperationGenerationLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure activateOwnedHostOperationGenerationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activateOwnedHostOperationGenerationLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activateOwnedHostOperationGenerationLockはProcess内の同一Subsystemで完結する。
 * @security activateOwnedHostOperationGenerationLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency activateOwnedHostOperationGenerationLockは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function activateOwnedHostOperationGenerationLock(
  managementCapability: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  const state = ownedOperationGeneration(binding.owned, identity);
  if (state.generationLock)
    throw new Error("owned_operation_generation_lock_already_active");
  const outcome = await acquireRuntimeOwnedHostOperationSupervisorLock(
    path.basename(identity.root),
    identity.hostRecovery.nonce,
  );
  if (outcome.status === "acquired" && outcome.lock) {
    state.generationLock = outcome.lock;
    return "activated" as const;
  }
  if (outcome.status === "cleanup_unknown") {
    if (outcome.lock) state.generationLock = outcome.lock;
    state.retired = true;
    revokeOwnedOperationContextCapabilities(state.owned);
    poisonRuntimeProcessAfterCleanupUnknown();
    return "cleanup_unknown" as const;
  }
  return outcome.status;
}

/**
 * 所有 Host Operation Generation Lock Readinessを確認する。
 *
 * @responsibility 所有 Host Operation Generation Lock Readinessの確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns confirmOwnedHostOperationGenerationLockReadinessの計算結果を返す。
 * @precondition 「managementCapability: unknown」がconfirmOwnedHostOperationGenerationLockReadinessの入力契約を満たす。
 * @postcondition confirmOwnedHostOperationGenerationLockReadinessの責務を完了した結果だけを返す。
 * @effect N/A: confirmOwnedHostOperationGenerationLockReadinessは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure confirmOwnedHostOperationGenerationLockReadinessは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmOwnedHostOperationGenerationLockReadinessは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmOwnedHostOperationGenerationLockReadinessはProcess内の同一Subsystemで完結する。
 * @security confirmOwnedHostOperationGenerationLockReadinessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency confirmOwnedHostOperationGenerationLockReadinessは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function confirmOwnedHostOperationGenerationLockReadiness(
  managementCapability: unknown,
) {
  try {
    const before = ownedOperationFromManagementCapability(managementCapability);
    const generation = ownedOperationGeneration(
      before.binding.owned,
      before.identity,
    );
    const lock = generation.generationLock;
    if (!lock) return "cleanup_confirmed_failure" as const;
    const readiness = await lock.confirmReady();
    if (readiness !== "ready") {
      if (readiness === "cleanup_unknown") {
        generation.retired = true;
        revokeOwnedOperationContextCapabilities(generation.owned);
        poisonRuntimeProcessAfterCleanupUnknown();
      } else generation.generationLock = null;
      return readiness;
    }
    const after = ownedOperationFromManagementCapability(managementCapability);
    const current = ownedOperationGeneration(
      after.binding.owned,
      after.identity,
    );
    const isCurrent =
      before.binding.owned === after.binding.owned &&
      current === generation &&
      current.generationLock === lock &&
      current.retired === false;
    if (!isCurrent)
      throw new Error("owned_operation_generation_readiness_replaced");
    validatePrivateHostRecoveryRecord(
      after.identity,
      after.identity.hostRecovery.state,
    );
    return "ready" as const;
  } catch {
    try {
      const { binding, identity } =
        ownedOperationFromManagementCapabilityForCleanup(managementCapability);
      const generation = ownedOperationGeneration(
        binding.owned,
        identity,
        true,
      );
      generation.retired = true;
      revokeOwnedOperationContextCapabilities(generation.owned);
      const lock = generation.generationLock;
      if (!lock) return "cleanup_confirmed_failure" as const;
      const released = await lock.release();
      if (released === "cleanup_unknown") {
        poisonRuntimeProcessAfterCleanupUnknown();
        return "cleanup_unknown" as const;
      }
      generation.generationLock = null;
      return "cleanup_confirmed_failure" as const;
    } catch {
      poisonRuntimeProcessAfterCleanupUnknown();
      return "cleanup_unknown" as const;
    }
  }
}

/**
 * owned Operation From Management Capability For 清掃を決定する。
 *
 * @responsibility owned Operation From Management Capability For 清掃の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns ownedOperationFromManagementCapabilityForCleanupの計算結果を返す。
 * @precondition 「managementCapability: unknown」がownedOperationFromManagementCapabilityForCleanupの入力契約を満たす。
 * @postcondition ownedOperationFromManagementCapabilityForCleanupの責務を完了した結果だけを返す。
 * @effect N/A: ownedOperationFromManagementCapabilityForCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownedOperationFromManagementCapabilityForCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownedOperationFromManagementCapabilityForCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedOperationFromManagementCapabilityForCleanupはProcess内の同一Subsystemで完結する。
 * @security ownedOperationFromManagementCapabilityForCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedOperationFromManagementCapabilityForCleanupは共有非同期状態を持たない同期処理である。
 */
function ownedOperationFromManagementCapabilityForCleanup(
  managementCapability: unknown,
) {
  const binding = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (!identity) throw new Error("owned_operation_management_binding_required");
  return Object.freeze({ binding, identity });
}

/**
 * 所有 Host Operation Generation Lossを観測する。
 *
 * @responsibility 所有 Host Operation Generation Lossの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns observeOwnedHostOperationGenerationLossの計算結果を返す。
 * @precondition 「managementCapability: unknown」がobserveOwnedHostOperationGenerationLossの入力契約を満たす。
 * @postcondition observeOwnedHostOperationGenerationLossの責務を完了した結果だけを返す。
 * @effect N/A: observeOwnedHostOperationGenerationLossは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeOwnedHostOperationGenerationLossは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeOwnedHostOperationGenerationLossは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeOwnedHostOperationGenerationLossはProcess内の同一Subsystemで完結する。
 * @security observeOwnedHostOperationGenerationLossはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency observeOwnedHostOperationGenerationLossは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function observeOwnedHostOperationGenerationLoss(
  managementCapability: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  const generation = ownedOperationGeneration(binding.owned, identity);
  const lock = generation.generationLock;
  if (!lock) throw new Error("owned_operation_generation_lock_required");
  let drainToken: object | null = null;
  let resolveDetected!: () => void;
  const detected = new Promise<void>((resolve) => {
    resolveDetected = resolve;
  });
  lock.onFailureDetected(() => {
    const transition = reduceHostGenerationLossTransition("failure_detected");
    generation.retired = transition.retired;
    if (transition.revokeEffectCapabilities)
      revokeOwnedOperationEffectCapabilities(generation.owned);
    if (transition.beginEffectDrain)
      drainToken ??= beginRuntimeProcessEffectDrain();
    resolveDetected();
  });
  return Object.freeze({
    detected,
    outcome: lock.loss.then((outcome) => {
      const transition = reduceHostGenerationLossTransition(outcome);
      generation.retired = transition.retired;
      generation.lossOutcome = outcome;
      if (transition.revokeEffectCapabilities)
        revokeOwnedOperationEffectCapabilities(generation.owned);
      if (transition.poisonProcess) poisonRuntimeProcessAfterCleanupUnknown();
      return outcome;
    }),
    releaseDrain: () => {
      if (!drainToken) return false;
      const token = drainToken;
      drainToken = null;
      return endRuntimeProcessEffectDrain(token);
    },
  });
}

/**
 * abandon 所有 Host Operation Generation Lockを決定する。
 *
 * @responsibility abandon 所有 Host Operation Generation Lockの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns abandonOwnedHostOperationGenerationLockの計算結果を返す。
 * @precondition 「managementCapability: unknown」がabandonOwnedHostOperationGenerationLockの入力契約を満たす。
 * @postcondition abandonOwnedHostOperationGenerationLockの責務を完了した結果だけを返す。
 * @effect N/A: abandonOwnedHostOperationGenerationLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure abandonOwnedHostOperationGenerationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant abandonOwnedHostOperationGenerationLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: abandonOwnedHostOperationGenerationLockはProcess内の同一Subsystemで完結する。
 * @security abandonOwnedHostOperationGenerationLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency abandonOwnedHostOperationGenerationLockは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function abandonOwnedHostOperationGenerationLock(
  managementCapability: unknown,
) {
  try {
    const { binding, identity } =
      ownedOperationFromManagementCapability(managementCapability);
    const state = ownedOperationGeneration(binding.owned, identity, true);
    if (!state.generationLock) return true;
    const released = await state.generationLock.release();
    if (released === "released") {
      state.generationLock = null;
      return true;
    }
    state.retired = true;
    revokeOwnedOperationContextCapabilities(state.owned);
    if (released === "cleanup_unknown")
      poisonRuntimeProcessAfterCleanupUnknown();
    return false;
  } catch {
    return false;
  }
}

/**
 * 所有 Docker Submission By Managementを状態遷移させる。
 *
 * @responsibility 所有 Docker Submission By Managementの遷移前提、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、currentToken: unknown、action: "begin" | "cancel"
 * @returns transitionOwnedDockerSubmissionByManagementの計算結果を返す。
 * @precondition 「managementCapability: unknown、currentToken: unknown、action: "begin" | "cancel"」がtransitionOwnedDockerSubmissionByManagementの入力契約を満たす。
 * @postcondition transitionOwnedDockerSubmissionByManagementの責務を完了した結果だけを返す。
 * @effect N/A: transitionOwnedDockerSubmissionByManagementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: transitionOwnedDockerSubmissionByManagementは独自の失敗分岐を所有しない。
 * @invariant transitionOwnedDockerSubmissionByManagementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: transitionOwnedDockerSubmissionByManagementはProcess内の同一Subsystemで完結する。
 * @security transitionOwnedDockerSubmissionByManagementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: transitionOwnedDockerSubmissionByManagementは共有非同期状態を持たない同期処理である。
 */
function transitionOwnedDockerSubmissionByManagement(
  managementCapability: unknown,
  currentToken: unknown,
  action: "begin" | "cancel",
) {
  const { binding } =
    ownedOperationFromManagementCapability(managementCapability);
  const expectedState =
    action === "begin" ? "host_only" : "docker_submission_started";
  const nextState =
    action === "begin" ? "docker_submission_started" : "host_only";
  const { loaded, state, identity } = activeOwnedTransitionInputsForOwned(
    binding.owned,
    currentToken,
    expectedState,
  );
  const updated = replaceHostRecoveryRecordState(loaded, nextState);
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: nextState,
        recordHash: updated.recordHash,
        recordIdentity: updated.recordIdentity,
      }),
    }),
  );
  state.currentRecordHash = updated.recordHash;
  return updated.token;
}

/**
 * 所有 Docker Submission 回復を開始する。
 *
 * @responsibility 所有 Docker Submission 回復の開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、operationId: unknown
 * @returns beginOwnedDockerSubmissionRecoveryの計算結果を返す。
 * @precondition 「managementCapability: unknown、operationId: unknown」がbeginOwnedDockerSubmissionRecoveryの入力契約を満たす。
 * @postcondition beginOwnedDockerSubmissionRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: beginOwnedDockerSubmissionRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure beginOwnedDockerSubmissionRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant beginOwnedDockerSubmissionRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginOwnedDockerSubmissionRecoveryはProcess内の同一Subsystemで完結する。
 * @security beginOwnedDockerSubmissionRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginOwnedDockerSubmissionRecoveryは共有非同期状態を持たない同期処理である。
 */
export function beginOwnedDockerSubmissionRecovery(
  managementCapability: unknown,
  operationId: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  if (operationId !== binding.operationId)
    throw new Error("owned_operation_management_binding_required");
  return transitionOwnedDockerSubmissionByManagement(
    managementCapability,
    expectedHostRecoveryToken(identity),
    "begin",
  );
}

/**
 * 所有 Host 回復 Id By Management Capabilityを取得する。
 *
 * @responsibility 所有 Host 回復 Id By Management Capabilityの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns getOwnedHostRecoveryIdByManagementCapabilityの計算結果を返す。
 * @precondition 「managementCapability: unknown」がgetOwnedHostRecoveryIdByManagementCapabilityの入力契約を満たす。
 * @postcondition getOwnedHostRecoveryIdByManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: getOwnedHostRecoveryIdByManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getOwnedHostRecoveryIdByManagementCapabilityは独自の失敗分岐を所有しない。
 * @invariant getOwnedHostRecoveryIdByManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getOwnedHostRecoveryIdByManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security getOwnedHostRecoveryIdByManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: getOwnedHostRecoveryIdByManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function getOwnedHostRecoveryIdByManagementCapability(
  managementCapability: unknown,
) {
  const { identity } =
    ownedOperationFromManagementCapability(managementCapability);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  return expectedHostRecoveryToken(identity);
}

/**
 * 所有 Host 清掃 Capabilityを発行する。
 *
 * @responsibility 所有 Host 清掃 Capabilityの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、subject: unknown
 * @returns issueOwnedHostCleanupCapabilityの計算結果を返す。
 * @precondition 「managementCapability: unknown、subject: unknown」がissueOwnedHostCleanupCapabilityの入力契約を満たす。
 * @postcondition issueOwnedHostCleanupCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: issueOwnedHostCleanupCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure issueOwnedHostCleanupCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant issueOwnedHostCleanupCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueOwnedHostCleanupCapabilityはProcess内の同一Subsystemで完結する。
 * @security issueOwnedHostCleanupCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueOwnedHostCleanupCapabilityは共有非同期状態を持たない同期処理である。
 */
export function issueOwnedHostCleanupCapability(
  managementCapability: unknown,
  subject: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  if (!isObject(subject))
    throw new Error("owned_host_cleanup_subject_required");
  const generation = ownedOperationGeneration(binding.owned, identity);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  const capability = Object.freeze({});
  hostCleanupCapabilities.set(
    capability,
    Object.freeze({
      owned: binding.owned,
      operationId: binding.operationId,
      createdAt: binding.createdAt,
      root: identity.root,
      nonce: identity.hostRecovery.nonce,
      recordHash: generation.currentRecordHash,
      subject,
    }),
  );
  return capability;
}

/**
 * 所有 Host 回復 Id For 清掃を一回限りで消費する。
 *
 * @responsibility 所有 Host 回復 Id For 清掃の消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000008
 * @input cleanupCapability: unknown、subject: unknown
 * @returns consumeOwnedHostRecoveryIdForCleanupの計算結果を返す。
 * @precondition 「cleanupCapability: unknown、subject: unknown」がconsumeOwnedHostRecoveryIdForCleanupの入力契約を満たす。
 * @postcondition consumeOwnedHostRecoveryIdForCleanupの責務を完了した結果だけを返す。
 * @effect N/A: consumeOwnedHostRecoveryIdForCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeOwnedHostRecoveryIdForCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeOwnedHostRecoveryIdForCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeOwnedHostRecoveryIdForCleanupはProcess内の同一Subsystemで完結する。
 * @security consumeOwnedHostRecoveryIdForCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeOwnedHostRecoveryIdForCleanupは共有非同期状態を持たない同期処理である。
 */
export function consumeOwnedHostRecoveryIdForCleanup(
  cleanupCapability: unknown,
  subject: unknown,
) {
  const capability = isObject(cleanupCapability) ? cleanupCapability : null;
  const binding = capability
    ? (hostCleanupCapabilities.get(capability) ?? null)
    : null;
  if (!capability || !binding || binding.subject !== subject)
    throw new Error("owned_host_cleanup_capability_required");
  hostCleanupCapabilities.delete(capability);
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt ||
    identity.root !== binding.root ||
    identity.hostRecovery.nonce !== binding.nonce
  )
    throw new Error("owned_host_cleanup_identity_changed");
  const generation = ownedOperationGeneration(binding.owned, identity, true);
  if (
    generation.currentRecordHash !== binding.recordHash ||
    (generation.retired &&
      generation.lossOutcome !== "cleanup_confirmed_failure")
  )
    throw new Error("owned_host_cleanup_generation_unavailable");
  validateOwnedOperationIdentity(binding.owned, identity, true);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  return expectedHostRecoveryToken(identity);
}

/**
 * 所有 Docker Submission 回復を完了状態へ遷移させる。
 *
 * @responsibility 所有 Docker Submission 回復の完了条件、終了後状態、未完了境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、recoveryToken: unknown
 * @returns completeOwnedDockerSubmissionRecoveryの計算結果を返す。
 * @precondition 「managementCapability: unknown、recoveryToken: unknown」がcompleteOwnedDockerSubmissionRecoveryの入力契約を満たす。
 * @postcondition completeOwnedDockerSubmissionRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: completeOwnedDockerSubmissionRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completeOwnedDockerSubmissionRecoveryは独自の失敗分岐を所有しない。
 * @invariant completeOwnedDockerSubmissionRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completeOwnedDockerSubmissionRecoveryはProcess内の同一Subsystemで完結する。
 * @security completeOwnedDockerSubmissionRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completeOwnedDockerSubmissionRecoveryは共有非同期状態を持たない同期処理である。
 */
export function completeOwnedDockerSubmissionRecovery(
  managementCapability: unknown,
  recoveryToken: unknown,
) {
  return transitionOwnedDockerSubmissionByManagement(
    managementCapability,
    recoveryToken,
    "cancel",
  );
}

/**
 * 所有 Docker Absence For 回復を確認する。
 *
 * @responsibility 所有 Docker Absence For 回復の確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、recoveryGenerationCapability: unknown
 * @returns confirmOwnedDockerAbsenceForRecoveryの計算結果を返す。
 * @precondition 「token: unknown、recoveryGenerationCapability: unknown」がconfirmOwnedDockerAbsenceForRecoveryの入力契約を満たす。
 * @postcondition confirmOwnedDockerAbsenceForRecoveryの責務を完了した結果だけを返す。
 * @effect confirmOwnedDockerAbsenceForRecoveryはFilesystemの読取りまたは書込みを実行する。
 * @failure confirmOwnedDockerAbsenceForRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmOwnedDockerAbsenceForRecoveryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security confirmOwnedDockerAbsenceForRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmOwnedDockerAbsenceForRecoveryは共有非同期状態を持たない同期処理である。
 */
export function confirmOwnedDockerAbsenceForRecovery(
  token: unknown,
  recoveryGenerationCapability: unknown = null,
) {
  const loaded = loadHostRecoveryRecord(token);
  if (loaded.record.state !== "docker_submission_started")
    throw new Error("host_recovery_state_invalid");
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  verifyHostOperationRecoveryGeneration(
    recoveryGenerationCapability,
    root,
    loaded.parsed.nonce,
  );
  if (operationGenerationByRoot.has(root))
    throw new Error("host_recovery_generation_active");
  if (
    observeFilesystemEntry(root) !== "present" ||
    fs.realpathSync(root) !== root ||
    path.dirname(root) !== loaded.parent ||
    !loaded.record.rootIdentity ||
    !identityMatchesRecord(root, loaded.record.rootIdentity)
  )
    throw new Error("host_recovery_root_replaced");
  const updated = replaceHostRecoveryRecordState(
    loaded,
    "docker_absent_confirmed",
  );
  return updated.token;
}

/**
 * 所有 Host 回復 記録 Transitionを引き継ぐ。
 *
 * @responsibility 所有 Host 回復 記録 Transitionの引継ぎ条件、Identity結合、拒否境界を所有する。
 * @trace ARCH-000008
 * @input mountCapability: unknown、previousToken: unknown、nextToken: unknown
 * @returns N/A: adoptOwnedHostRecoveryRecordTransitionは戻り値を返さない。
 * @precondition 「mountCapability: unknown、previousToken: unknown、nextToken: unknown」がadoptOwnedHostRecoveryRecordTransitionの入力契約を満たす。
 * @postcondition adoptOwnedHostRecoveryRecordTransitionの責務を完了して呼出し元へ制御を戻す。
 * @effect adoptOwnedHostRecoveryRecordTransitionはFilesystemの読取りまたは書込みを実行する。
 * @failure adoptOwnedHostRecoveryRecordTransitionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant adoptOwnedHostRecoveryRecordTransitionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security adoptOwnedHostRecoveryRecordTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: adoptOwnedHostRecoveryRecordTransitionは共有非同期状態を持たない同期処理である。
 */
export function adoptOwnedHostRecoveryRecordTransition(
  mountCapability: unknown,
  previousToken: unknown,
  nextToken: unknown,
): void {
  const previous = parseHostRecoveryToken(previousToken);
  const loaded = loadHostRecoveryRecord(nextToken);
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  const state = operationGenerationByRoot.get(root);
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!state || !mount || mount.owned !== state.owned || state.retired)
    throw new Error("owned_operation_mount_capability_required");
  const identity = ownedIdentities.get(state.owned);
  if (!identity) throw new Error("owned_operation_mount_capability_required");
  validateOwnedOperationIdentity(state.owned, identity);
  const expectedSerialized = `${JSON.stringify(
    hostRecordContent(identity, "docker_absent_confirmed"),
  )}\n`;
  const expectedRecordHash = createHash("sha256")
    .update(expectedSerialized)
    .digest("hex");
  if (
    previous.rootName !== loaded.parsed.rootName ||
    previous.nonce !== loaded.parsed.nonce ||
    previous.nonce !== state.nonce ||
    previous.recordHash !== state.currentRecordHash ||
    loaded.parsed.recordHash === previous.recordHash ||
    loaded.parsed.recordHash !== expectedRecordHash ||
    loaded.marker !== identity.hostRecovery.record ||
    identity.hostRecovery.state !== "docker_submission_started" ||
    loaded.record.state !== "docker_absent_confirmed"
  )
    throw new Error("host_recovery_generation_mismatch");
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: "docker_absent_confirmed",
        recordHash: loaded.parsed.recordHash,
        recordIdentity: readFileIdentity(loaded.marker),
      }),
    }),
  );
  state.currentRecordHash = loaded.parsed.recordHash;
}

/**
 * Current 所有 Host 記録を読み取る。
 *
 * @responsibility Current 所有 Host 記録の読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity
 * @returns Readonly<{ record: HostRecoveryRecord; serialized: string }>を返す。
 * @precondition 「identity: OwnedIdentity」がreadCurrentOwnedHostRecordの入力契約を満たす。
 * @postcondition readCurrentOwnedHostRecordの責務を完了した結果だけを返す。
 * @effect readCurrentOwnedHostRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure readCurrentOwnedHostRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readCurrentOwnedHostRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readCurrentOwnedHostRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readCurrentOwnedHostRecordは共有非同期状態を持たない同期処理である。
 */
function readCurrentOwnedHostRecord(
  identity: OwnedIdentity,
): Readonly<{ record: HostRecoveryRecord; serialized: string }> {
  const metadata = fs.lstatSync(identity.hostRecovery.record);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    !identity.hostRecovery.recordIdentity ||
    !sameFilesystemIdentity(
      readFileIdentity(identity.hostRecovery.record),
      identity.hostRecovery.recordIdentity,
    )
  )
    throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(identity.hostRecovery.record, "utf8");
  const record: unknown = JSON.parse(serialized);
  const normalized = normalizeHostRecoveryRecord(record);
  if (normalized.rootName !== path.basename(identity.root))
    throw new Error("host_recovery_record_mismatch");
  return { record: normalized, serialized };
}

/**
 * expected Host 回復 Tokenを決定する。
 *
 * @responsibility expected Host 回復 Tokenの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity
 * @returns stringを返す。
 * @precondition 「identity: OwnedIdentity」がexpectedHostRecoveryTokenの入力契約を満たす。
 * @postcondition expectedHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: expectedHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedHostRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant expectedHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security expectedHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
function expectedHostRecoveryToken(identity: OwnedIdentity): string {
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${identity.hostRecovery.recordHash}`;
}

/**
 * Private Host 回復 記録の契約を検証する。
 *
 * @responsibility Private Host 回復 記録の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity、expectedState: RecoveryState
 * @returns HostRecoveryRecordを返す。
 * @precondition 「identity: OwnedIdentity、expectedState: RecoveryState」がvalidatePrivateHostRecoveryRecordの入力契約を満たす。
 * @postcondition validatePrivateHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: validatePrivateHostRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validatePrivateHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validatePrivateHostRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatePrivateHostRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security validatePrivateHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validatePrivateHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function validatePrivateHostRecoveryRecord(
  identity: OwnedIdentity,
  expectedState: RecoveryState,
): HostRecoveryRecord {
  const { record, serialized } = readCurrentOwnedHostRecord(identity);
  const actualHash = createHash("sha256").update(serialized).digest("hex");
  if (
    actualHash !== identity.hostRecovery.recordHash ||
    record.state !== expectedState ||
    identity.hostRecovery.state !== expectedState ||
    record.rootName !== path.basename(identity.root)
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  if (
    !record.rootIdentity ||
    !identityMatchesRecord(identity.root, record.rootIdentity)
  )
    throw new Error("host_recovery_record_mismatch");
  for (const [name, snapshot] of Object.entries(identity.children ?? {})) {
    const recorded = record.childIdentities?.[name];
    if (!recorded || recorded.pathName !== snapshot.name)
      throw new Error("host_recovery_record_mismatch");
    if (
      BigInt(recorded.dev) !== snapshot.filesystem.dev ||
      BigInt(recorded.ino) !== snapshot.filesystem.ino ||
      BigInt(recorded.birthtimeNs) !== snapshot.filesystem.birthtimeNs
    )
      throw new Error("host_recovery_record_mismatch");
  }
  return record;
}

/**
 * rollback Initializing Operation Directoriesを決定する。
 *
 * @responsibility rollback Initializing Operation Directoriesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns voidを返す。
 * @precondition 「owned: unknown」がrollbackInitializingOperationDirectoriesの入力契約を満たす。
 * @postcondition rollbackInitializingOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect rollbackInitializingOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure rollbackInitializingOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant rollbackInitializingOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security rollbackInitializingOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rollbackInitializingOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
function rollbackInitializingOperationDirectories(owned: unknown): void {
  const identity = ownedIdentity(owned);
  if (identity?.hostRecovery.state !== "initializing") {
    cleanupOwnedOperationDirectories(owned);
    return;
  }
  const realRoot = fs.realpathSync(identity.root);
  if (
    realRoot !== identity.root ||
    fs.realpathSync(identity.parent) !== identity.parent ||
    path.dirname(realRoot) !== identity.parent ||
    !path.basename(realRoot).startsWith(identity.prefix) ||
    !sameFilesystemIdentity(
      readFilesystemIdentity(realRoot),
      identity.filesystem,
    )
  )
    throw new Error("owned_operation_directory_replaced");
  const allowed = new Set([
    "workspace",
    "provider-home",
    "tmp",
    "events",
    "projection",
    "management",
  ]);
  for (const entry of fs.readdirSync(realRoot, { withFileTypes: true })) {
    if (
      !allowed.has(entry.name) ||
      !entry.isDirectory() ||
      entry.isSymbolicLink()
    ) {
      throw new Error("owned_operation_unknown_child");
    }
  }
  fs.rmSync(realRoot, { recursive: true, force: false });
  requireConfirmedAbsent(
    realRoot,
    "owned_operation_directory_cleanup_incomplete",
  );
  if (isObject(owned)) {
    revokeOwnedOperationContextCapabilities(owned);
    ownedIdentities.delete(owned);
  }
  if (
    !revokeOwnedOperationGeneration(identity.root, identity.hostRecovery.nonce)
  )
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
}

/**
 * 所有 Mount Capabilityを構築する。
 *
 * @responsibility 所有 Mount Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Readonly<{ kind: "owned_operation_mounts" }>を返す。
 * @precondition 「owned: unknown」がcreateOwnedMountCapabilityの入力契約を満たす。
 * @postcondition createOwnedMountCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedMountCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedMountCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedMountCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedMountCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedMountCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedMountCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedMountCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_mounts" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_mount_identity_required");
  }
  const children = validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_mounts" });
  mountCapabilities.set(capability, Object.freeze({ owned, children }));
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

/**
 * 所有 Mount Capabilityを検証する。
 *
 * @responsibility 所有 Mount Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns OwnedMountPathsを返す。
 * @precondition 「capability: unknown」がverifyOwnedMountCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedMountCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedMountCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedMountCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedMountCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedMountCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedMountCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedMountCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedMountCapability(
  capability: unknown,
): OwnedMountPaths {
  const mount = isObject(capability)
    ? (mountCapabilities.get(capability) ?? null)
    : null;
  if (!mount) throw new Error("owned_operation_mount_capability_required");
  const identity = ownedIdentities.get(mount.owned);
  if (!identity) throw new Error("owned_operation_mount_capability_required");
  const children = validateOwnedOperationIdentity(mount.owned, identity);
  if (children !== mount.children)
    throw new Error("owned_operation_mount_capability_required");
  return Object.freeze({
    workspace: validateDirectorySnapshot(children.workspace),
    providerHome: validateDirectorySnapshot(children.providerHome),
    tmp: validateDirectorySnapshot(children.tmp),
    events: validateDirectorySnapshot(children.events),
    projection: validateDirectorySnapshot(children.projection),
    management: validateDirectorySnapshot(children.management),
  });
}

/**
 * 所有 Operation Context Capabilityを構築する。
 *
 * @responsibility 所有 Operation Context Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Readonly<{ kind: "owned_operation_context" }>を返す。
 * @precondition 「owned: unknown」がcreateOwnedOperationContextCapabilityの入力契約を満たす。
 * @postcondition createOwnedOperationContextCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationContextCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedOperationContextCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationContextCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationContextCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationContextCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationContextCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationContextCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_context" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_context_identity_required");
  }
  validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_context" });
  operationContextCapabilities.set(
    capability,
    Object.freeze({
      owned,
      operationId: identity.operationId,
      createdAt: identity.createdAt,
    }),
  );
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

/**
 * 所有 Operation Context Capabilityを検証する。
 *
 * @responsibility 所有 Operation Context Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns OwnedOperationContextを返す。
 * @precondition 「capability: unknown」がverifyOwnedOperationContextCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedOperationContextCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationContextCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationContextCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationContextCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationContextCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationContextCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationContextCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationContextCapability(
  capability: unknown,
): OwnedOperationContext {
  const capabilityObject = isObject(capability) ? capability : null;
  const context = capabilityObject
    ? (operationContextCapabilities.get(capabilityObject) ?? null)
    : null;
  if (!context) throw new Error("owned_operation_context_capability_required");
  const identity = ownedIdentities.get(context.owned);
  if (
    !identity?.children ||
    identity.operationId !== context.operationId ||
    identity.createdAt !== context.createdAt
  ) {
    if (capabilityObject) operationContextCapabilities.delete(capabilityObject);
    throw new Error("owned_operation_context_capability_revoked");
  }
  validateOwnedOperationIdentity(context.owned, identity);
  return Object.freeze({
    operationId: context.operationId,
    createdAt: context.createdAt,
  });
}

/**
 * 所有 Operation Management Capabilityを構築する。
 *
 * @responsibility 所有 Operation Management Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input operationContextCapability: unknown、mountCapability: unknown
 * @returns Readonly<{ kind: "owned_operation_management_binding" }>を返す。
 * @precondition 「operationContextCapability: unknown、mountCapability: unknown」がcreateOwnedOperationManagementCapabilityの入力契約を満たす。
 * @postcondition createOwnedOperationManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedOperationManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationManagementCapability(
  operationContextCapability: unknown,
  mountCapability: unknown,
): Readonly<{ kind: "owned_operation_management_binding" }> {
  const context = isObject(operationContextCapability)
    ? (operationContextCapabilities.get(operationContextCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!context || !mount || context.owned !== mount.owned)
    throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(context.owned);
  if (!identity) throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(context.owned, identity);
  if (
    children !== mount.children ||
    identity.operationId !== context.operationId ||
    identity.createdAt !== context.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateDirectorySnapshot(children.management);
  const capability = Object.freeze({
    kind: "owned_operation_management_binding" as const,
  });
  operationManagementCapabilities.set(
    capability,
    Object.freeze({
      owned: context.owned,
      operationId: context.operationId,
      createdAt: context.createdAt,
    }),
  );
  const aliases =
    operationContextAliases.get(context.owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(context.owned, aliases);
  return capability;
}

/**
 * 所有 Operation Management Capabilityを検証する。
 *
 * @responsibility 所有 Operation Management Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns OwnedOperationManagementBindingを返す。
 * @precondition 「capability: unknown」がverifyOwnedOperationManagementCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedOperationManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationManagementCapability(
  capability: unknown,
): OwnedOperationManagementBinding {
  const binding = isObject(capability)
    ? (operationManagementCapabilities.get(capability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    operationId: binding.operationId,
    createdAt: binding.createdAt,
    managementScopeBound: true as const,
  });
}

/**
 * 所有 Operation Management Mount Bindingを検証する。
 *
 * @responsibility 所有 Operation Management Mount Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、mountCapability: unknown
 * @returns Readonly<{ operationId: string; createdAt: string; mounts: OwnedMountPaths; }>を返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown」がverifyOwnedOperationManagementMountBindingの入力契約を満たす。
 * @postcondition verifyOwnedOperationManagementMountBindingの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationManagementMountBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationManagementMountBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationManagementMountBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationManagementMountBindingはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationManagementMountBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationManagementMountBindingは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationManagementMountBinding(
  managementCapability: unknown,
  mountCapability: unknown,
): Readonly<{
  operationId: string;
  createdAt: string;
  mounts: OwnedMountPaths;
}> {
  const management = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!management || !mount || management.owned !== mount.owned) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const identity = ownedIdentities.get(management.owned);
  if (
    !identity ||
    identity.operationId !== management.operationId ||
    identity.createdAt !== management.createdAt
  ) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const children = validateOwnedOperationIdentity(management.owned, identity);
  if (children !== mount.children) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  return Object.freeze({
    operationId: management.operationId,
    createdAt: management.createdAt,
    mounts: Object.freeze({
      workspace: validateDirectorySnapshot(children.workspace),
      providerHome: validateDirectorySnapshot(children.providerHome),
      tmp: validateDirectorySnapshot(children.tmp),
      events: validateDirectorySnapshot(children.events),
      projection: validateDirectorySnapshot(children.projection),
      management: validateDirectorySnapshot(children.management),
    }),
  });
}

/**
 * 所有 Docker Execution Pathsを一時参照として取得する。
 *
 * @responsibility 所有 Docker Execution Pathsの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns Readonly<{ tmp: string; management: string }>を返す。
 * @precondition 「managementCapability: unknown」がborrowOwnedDockerExecutionPathsの入力契約を満たす。
 * @postcondition borrowOwnedDockerExecutionPathsの責務を完了した結果だけを返す。
 * @effect N/A: borrowOwnedDockerExecutionPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure borrowOwnedDockerExecutionPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant borrowOwnedDockerExecutionPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowOwnedDockerExecutionPathsはProcess内の同一Subsystemで完結する。
 * @security borrowOwnedDockerExecutionPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowOwnedDockerExecutionPathsは共有非同期状態を持たない同期処理である。
 */
export function borrowOwnedDockerExecutionPaths(
  managementCapability: unknown,
): Readonly<{ tmp: string; management: string }> {
  const { binding } =
    ownedOperationFromManagementCapability(managementCapability);
  const identity = ownedIdentities.get(binding.owned);
  if (!identity?.children)
    throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    tmp: validateDirectorySnapshot(children.tmp),
    management: validateDirectorySnapshot(children.management),
  });
}

/**
 * 所有 Child Setの契約を検証する。
 *
 * @responsibility 所有 Child Setの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、children: ChildSnapshots
 * @returns N/A: validateOwnedChildSetは戻り値を返さない。
 * @precondition 「root: string、children: ChildSnapshots」がvalidateOwnedChildSetの入力契約を満たす。
 * @postcondition validateOwnedChildSetの責務を完了して呼出し元へ制御を戻す。
 * @effect validateOwnedChildSetはFilesystemの読取りまたは書込みを実行する。
 * @failure validateOwnedChildSetは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateOwnedChildSetは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateOwnedChildSetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateOwnedChildSetは共有非同期状態を持たない同期処理である。
 */
function validateOwnedChildSet(root: string, children: ChildSnapshots): void {
  const known = new Set(
    Object.values(children).map((snapshot) => snapshot.name),
  );
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!known.has(entry.name))
      throw new Error("owned_operation_unknown_child");
  }
  for (const snapshot of Object.values(children)) {
    try {
      const metadata = fs.lstatSync(snapshot.root);
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("owned_operation_child_replaced");
      validateDirectorySnapshot(snapshot);
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      const message = errorMessage(error);
      if (
        message &&
        [
          "owned_operation_child_replaced",
          "owned_operation_mount_replaced",
        ].includes(message)
      )
        throw new Error("owned_operation_child_replaced");
      throw error;
    }
  }
}

/**
 * require No Active Docker Bindingを決定する。
 *
 * @responsibility require No Active Docker Bindingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、managementName: string | undefined
 * @returns voidを返す。
 * @precondition 「root: string、managementName: string | undefined」がrequireNoActiveDockerBindingの入力契約を満たす。
 * @postcondition requireNoActiveDockerBindingの責務を完了した結果だけを返す。
 * @effect N/A: requireNoActiveDockerBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireNoActiveDockerBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireNoActiveDockerBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireNoActiveDockerBindingはProcess内の同一Subsystemで完結する。
 * @security requireNoActiveDockerBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireNoActiveDockerBindingは共有非同期状態を持たない同期処理である。
 */
function requireNoActiveDockerBinding(
  root: string,
  managementName: string | undefined,
): void {
  if (!managementName) return;
  const activeDockerBinding = path.join(
    root,
    managementName,
    "active-docker-task-v1.json",
  );
  for (const candidate of [
    activeDockerBinding,
    `${activeDockerBinding}.crdd-commit.json`,
  ]) {
    const observation = observeFilesystemEntry(candidate);
    if (observation === "unknown")
      throw new Error("host_recovery_root_observation_unknown");
    if (observation === "present")
      throw new Error("host_recovery_requires_docker_absence");
  }
}

/**
 * 所有 Operation Root For 清掃を除去する。
 *
 * @responsibility 所有 Operation Root For 清掃の対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns removeOwnedOperationRootForCleanupの計算結果を返す。
 * @precondition 「owned: unknown」がremoveOwnedOperationRootForCleanupの入力契約を満たす。
 * @postcondition removeOwnedOperationRootForCleanupの責務を完了した結果だけを返す。
 * @effect removeOwnedOperationRootForCleanupはFilesystemの読取りまたは書込みを実行する。
 * @failure removeOwnedOperationRootForCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeOwnedOperationRootForCleanupは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security removeOwnedOperationRootForCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeOwnedOperationRootForCleanupは共有非同期状態を持たない同期処理である。
 */
function removeOwnedOperationRootForCleanup(owned: unknown) {
  const identity = ownedIdentity(owned);
  if (!identity) {
    throw new Error("owned_operation_directory_identity_required");
  }
  try {
    if (!isObject(owned)) throw new Error("owned_operation_directory_replaced");
    ownedOperationGeneration(owned, identity, true);
    if (
      ownString(owned, "root") !== identity.root ||
      ownString(owned, "parent") !== identity.parent
    ) {
      throw new Error("owned_operation_directory_replaced");
    }
    const realRoot = fs.realpathSync(identity.root);
    const realParent = fs.realpathSync(identity.parent);
    const currentFilesystem = readFilesystemIdentity(identity.root);
    if (
      realRoot !== identity.root ||
      realParent !== identity.parent ||
      path.dirname(realRoot) !== realParent ||
      !path.basename(realRoot).startsWith(identity.prefix) ||
      !sameFilesystemIdentity(currentFilesystem, identity.filesystem)
    ) {
      throw new Error("owned_operation_directory_replaced");
    }
    if (identity.children)
      validateOwnedChildSet(identity.root, identity.children);
    requireNoActiveDockerBinding(
      identity.root,
      identity.children?.management.name,
    );
  } catch (error) {
    const message = errorMessage(error);
    if (
      isObject(owned) &&
      message &&
      [
        "owned_operation_directory_replaced",
        "owned_operation_child_replaced",
      ].includes(message)
    ) {
      retireOwnedOperationGeneration(
        identity.root,
        identity.hostRecovery.nonce,
      );
    }
    if (
      message &&
      [
        "owned_operation_directory_replaced",
        "owned_operation_child_replaced",
        "owned_operation_unknown_child",
        "host_recovery_requires_docker_absence",
        "host_recovery_root_observation_unknown",
      ].includes(message)
    )
      throw error;
    throw new Error("owned_operation_directory_replaced");
  }
  validatePrivateHostRecoveryRecord(identity, "host_only");
  fs.rmSync(identity.root, { recursive: true, force: false });
  requireConfirmedAbsent(
    identity.root,
    "owned_operation_directory_cleanup_incomplete",
  );
  return identity;
}

/**
 * 所有 Operation 回復 記録を除去する。
 *
 * @responsibility 所有 Operation 回復 記録の対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity
 * @returns N/A: removeOwnedOperationRecoveryRecordは戻り値を返さない。
 * @precondition 「identity: OwnedIdentity」がremoveOwnedOperationRecoveryRecordの入力契約を満たす。
 * @postcondition removeOwnedOperationRecoveryRecordの責務を完了して呼出し元へ制御を戻す。
 * @effect removeOwnedOperationRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure removeOwnedOperationRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeOwnedOperationRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security removeOwnedOperationRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeOwnedOperationRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function removeOwnedOperationRecoveryRecord(identity: OwnedIdentity) {
  try {
    const recoveryDirectory = fs.realpathSync(identity.hostRecovery.directory);
    if (
      !sameFilesystemIdentity(
        readFilesystemIdentity(recoveryDirectory),
        identity.hostRecovery.directoryIdentity,
      )
    )
      throw new Error("host_recovery_directory_replaced");
    const marker = fs.lstatSync(identity.hostRecovery.record);
    if (
      !marker.isFile() ||
      marker.isSymbolicLink() ||
      !identity.hostRecovery.recordIdentity ||
      !sameFilesystemIdentity(
        readFileIdentity(identity.hostRecovery.record),
        identity.hostRecovery.recordIdentity,
      )
    )
      throw new Error("host_recovery_record_replaced");
    fs.rmSync(identity.hostRecovery.record);
    requireConfirmedAbsent(
      identity.hostRecovery.record,
      "host_recovery_record_observation_unknown",
    );
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

/**
 * 所有 Operation Directoriesを清掃する。
 *
 * @responsibility 所有 Operation Directoriesの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns N/A: cleanupOwnedOperationDirectoriesは戻り値を返さない。
 * @precondition 「owned: unknown」がcleanupOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition cleanupOwnedOperationDirectoriesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: cleanupOwnedOperationDirectoriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure cleanupOwnedOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant cleanupOwnedOperationDirectoriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cleanupOwnedOperationDirectoriesはProcess内の同一Subsystemで完結する。
 * @security cleanupOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function cleanupOwnedOperationDirectories(owned: unknown): void {
  const currentIdentity = ownedIdentity(owned);
  if (!isObject(owned) || !currentIdentity)
    throw new Error("owned_operation_directory_identity_required");
  if (
    ownedOperationGeneration(owned, currentIdentity, true).generationLock !==
    null
  )
    throw new Error("owned_operation_async_cleanup_required");
  const identity = removeOwnedOperationRootForCleanup(owned);
  if (
    !revokeOwnedOperationGeneration(identity.root, identity.hostRecovery.nonce)
  )
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
}

/**
 * 所有 Operation Directories Asyncを清掃する。
 *
 * @responsibility 所有 Operation Directories Asyncの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns cleanupOwnedOperationDirectoriesAsyncの計算結果を返す。
 * @precondition 「owned: unknown」がcleanupOwnedOperationDirectoriesAsyncの入力契約を満たす。
 * @postcondition cleanupOwnedOperationDirectoriesAsyncの責務を完了した結果だけを返す。
 * @effect N/A: cleanupOwnedOperationDirectoriesAsyncは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure cleanupOwnedOperationDirectoriesAsyncは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant cleanupOwnedOperationDirectoriesAsyncは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cleanupOwnedOperationDirectoriesAsyncはProcess内の同一Subsystemで完結する。
 * @security cleanupOwnedOperationDirectoriesAsyncはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cleanupOwnedOperationDirectoriesAsyncは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function cleanupOwnedOperationDirectoriesAsync(owned: unknown) {
  const identity = removeOwnedOperationRootForCleanup(owned);
  const release = await revokeOwnedOperationGenerationAsync(
    identity.root,
    identity.hostRecovery.nonce,
  );
  if (release === "cleanup_unknown")
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
  if (release === "cleanup_confirmed_failure")
    return createOwnedOperationCleanupOutcome(
      "protocol_failure_cleanup_confirmed",
    );
  return createOwnedOperationCleanupOutcome("completed");
}

/**
 * execution-environmentで使用する所有 Operation 清掃 Statusの値契約を定義する。
 *
 * @responsibility 所有 Operation 清掃 StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationCleanupStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationCleanupStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationCleanupStatusの宣言は外部境界を開かない。
 * @security OwnedOperationCleanupStatusはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationCleanupStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedOperationCleanupStatus =
  | "completed"
  | "protocol_failure_cleanup_confirmed";
const ownedOperationCleanupOutcomes = new WeakMap<
  object,
  OwnedOperationCleanupStatus
>();

/**
 * 所有 Operation 清掃 Outcomeを構築する。
 *
 * @responsibility 所有 Operation 清掃 Outcomeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input status: OwnedOperationCleanupStatus
 * @returns createOwnedOperationCleanupOutcomeの計算結果を返す。
 * @precondition 「status: OwnedOperationCleanupStatus」がcreateOwnedOperationCleanupOutcomeの入力契約を満たす。
 * @postcondition createOwnedOperationCleanupOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationCleanupOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOwnedOperationCleanupOutcomeは独自の失敗分岐を所有しない。
 * @invariant createOwnedOperationCleanupOutcomeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationCleanupOutcomeはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationCleanupOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationCleanupOutcomeは共有非同期状態を持たない同期処理である。
 */
function createOwnedOperationCleanupOutcome(
  status: OwnedOperationCleanupStatus,
) {
  const outcome = Object.freeze({ kind: "owned_operation_cleanup_outcome" });
  ownedOperationCleanupOutcomes.set(outcome, status);
  return outcome;
}

/**
 * 所有 Operation 清掃 Outcomeを検証する。
 *
 * @responsibility 所有 Operation 清掃 Outcomeの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input outcome: unknown
 * @returns OwnedOperationCleanupStatus | nullを返す。
 * @precondition 「outcome: unknown」がverifyOwnedOperationCleanupOutcomeの入力契約を満たす。
 * @postcondition verifyOwnedOperationCleanupOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationCleanupOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyOwnedOperationCleanupOutcomeは独自の失敗分岐を所有しない。
 * @invariant verifyOwnedOperationCleanupOutcomeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationCleanupOutcomeはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationCleanupOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationCleanupOutcomeは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationCleanupOutcome(
  outcome: unknown,
): OwnedOperationCleanupStatus | null {
  return isObject(outcome)
    ? (ownedOperationCleanupOutcomes.get(outcome) ?? null)
    : null;
}

/**
 * Host 回復 記録を読み込む。
 *
 * @responsibility Host 回復 記録の読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns Readonly<{ parsed: Readonly<{ rootName: string; nonce: string; recordHash: string }>; parent: string; recovery: Readonly<{ directory: string }>; marker: string; record: HostRecoveryRecord; }>を返す。
 * @precondition 「token: unknown」がloadHostRecoveryRecordの入力契約を満たす。
 * @postcondition loadHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: loadHostRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: loadHostRecoveryRecordは独自の失敗分岐を所有しない。
 * @invariant loadHostRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadHostRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security loadHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function loadHostRecoveryRecord(token: unknown): Readonly<{
  parsed: Readonly<{ rootName: string; nonce: string; recordHash: string }>;
  parent: string;
  recovery: Readonly<{ directory: string }>;
  marker: string;
  record: HostRecoveryRecord;
}> {
  const loaded = loadHostRecoveryRecordByToken(token);
  return {
    parsed: loaded.parsed,
    parent: loaded.parent,
    recovery: { directory: loaded.directory },
    marker: loaded.marker,
    record: normalizeHostRecoveryRecord(loaded.record),
  };
}

/**
 * recover 所有 Operation Directoriesを決定する。
 *
 * @responsibility recover 所有 Operation Directoriesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、suppliedRecoveryGenerationCapability: unknown
 * @returns Readonly<{ status: "recovered" | "blocked"; reason: string; recoveryId: string | null; }>を返す。
 * @precondition 「token: unknown、suppliedRecoveryGenerationCapability: unknown」がrecoverOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition recoverOwnedOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect recoverOwnedOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure recoverOwnedOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverOwnedOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoverOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function recoverOwnedOperationDirectories(
  token: unknown,
  suppliedRecoveryGenerationCapability: unknown = null,
): Readonly<{
  status: "recovered" | "blocked";
  reason: string;
  recoveryId: string | null;
}> {
  let recoveryGeneration: Readonly<{ root: string; nonce: string }> | null =
    null;
  let verifiedRecoveryId: string | null = null;
  let markerPendingAfterRelease: string | null = null;
  const ownedRecoveryGenerationCapability = suppliedRecoveryGenerationCapability
    ? null
    : acquireHostOperationRecoveryGeneration(token);
  const recoveryGenerationCapability =
    suppliedRecoveryGenerationCapability ?? ownedRecoveryGenerationCapability;
  const result = (() => {
    try {
      const { parsed, parent, marker, record } = loadHostRecoveryRecord(token);
      verifiedRecoveryId = typeof token === "string" ? token : null;
      if (record.state === "docker_submission_started")
        throw new Error("host_recovery_requires_docker_absence");
      if (
        !["initializing", "host_only", "docker_absent_confirmed"].includes(
          record.state,
        )
      )
        throw new Error("host_recovery_state_invalid");
      const root = path.join(parent, parsed.rootName);
      recoveryGeneration = Object.freeze({ root, nonce: parsed.nonce });
      verifyHostOperationRecoveryGeneration(
        recoveryGenerationCapability,
        root,
        parsed.nonce,
      );
      const activeGeneration = operationGenerationByRoot.get(root);
      if (
        activeGeneration &&
        (activeGeneration.nonce !== parsed.nonce ||
          activeGeneration.currentRecordHash !== parsed.recordHash)
      )
        throw new Error("host_recovery_generation_mismatch");
      let reason = "host_root_already_absent";
      const rootObservation = observeFilesystemEntry(root);
      if (rootObservation === "unknown")
        throw new Error("host_recovery_root_observation_unknown");
      if (record.state === "initializing" && rootObservation === "present")
        throw new Error("host_recovery_initialization_root_identity_unknown");
      if (rootObservation === "present") {
        if (
          fs.realpathSync(root) !== root ||
          path.dirname(root) !== parent ||
          !record.rootIdentity ||
          !identityMatchesRecord(root, record.rootIdentity)
        )
          throw new Error("host_recovery_root_replaced");
        const known = new Set(
          Object.values(record.childIdentities).map((child) => child.pathName),
        );
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          if (!known.has(entry.name))
            throw new Error("host_recovery_unknown_child");
        }
        for (const child of Object.values(record.childIdentities)) {
          const target = path.join(root, child.pathName);
          try {
            const metadata = fs.lstatSync(target);
            if (
              !metadata.isDirectory() ||
              metadata.isSymbolicLink() ||
              fs.realpathSync(target) !== target ||
              path.dirname(target) !== root ||
              !identityMatchesRecord(target, child)
            )
              throw new Error("host_recovery_child_replaced");
          } catch (error) {
            if (errorCode(error) === "ENOENT") continue;
            throw error;
          }
        }
        requireNoActiveDockerBinding(
          root,
          record.childIdentities.management?.pathName,
        );
        fs.rmSync(root, { recursive: true, force: false });
        requireConfirmedAbsent(root, "host_recovery_cleanup_incomplete");
        reason = "host_cleanup_recovered";
      }
      if (!revokeOwnedOperationGeneration(root, parsed.nonce))
        throw new Error("host_recovery_generation_release_unconfirmed");
      if (ownedRecoveryGenerationCapability) markerPendingAfterRelease = marker;
      else fs.rmSync(marker);
      return { status: "recovered" as const, reason, recoveryId: null };
    } catch (error) {
      const allowed = new Set([
        "host_recovery_token_invalid",
        "host_recovery_record_replaced",
        "host_recovery_record_mismatch",
        "host_recovery_requires_docker_absence",
        "host_recovery_state_invalid",
        "host_recovery_root_replaced",
        "host_recovery_child_replaced",
        "host_recovery_unknown_child",
        "host_recovery_cleanup_incomplete",
        "host_recovery_root_observation_unknown",
        "host_recovery_initialization_root_identity_unknown",
        "host_recovery_generation_mismatch",
        "host_recovery_generation_active",
        "host_recovery_generation_release_unconfirmed",
      ]);
      const message = errorMessage(error);
      if (
        recoveryGeneration &&
        message &&
        [
          "host_recovery_root_replaced",
          "host_recovery_child_replaced",
        ].includes(message)
      ) {
        const { root, nonce } = recoveryGeneration;
        retireOwnedOperationGeneration(root, nonce);
      }
      return {
        status: "blocked" as const,
        reason:
          message && allowed.has(message) ? message : "host_recovery_failed",
        recoveryId: verifiedRecoveryId,
      };
    }
  })();
  if (
    ownedRecoveryGenerationCapability &&
    !releaseHostOperationRecoveryGeneration(ownedRecoveryGenerationCapability)
  )
    return {
      status: "blocked",
      reason: "host_recovery_generation_release_unconfirmed",
      recoveryId: verifiedRecoveryId,
    };
  if (result.status === "recovered" && markerPendingAfterRelease) {
    try {
      const markerObservation = observeFilesystemEntry(
        markerPendingAfterRelease,
      );
      if (markerObservation === "unknown")
        throw new Error("host_recovery_record_observation_unknown");
      if (markerObservation === "present") {
        const loaded = loadHostRecoveryRecord(token);
        if (loaded.marker !== markerPendingAfterRelease)
          throw new Error("host_recovery_record_replaced");
        fs.rmSync(markerPendingAfterRelease);
        requireConfirmedAbsent(
          markerPendingAfterRelease,
          "host_recovery_record_observation_unknown",
        );
      }
    } catch {
      return {
        status: "blocked",
        reason: "host_recovery_record_replaced",
        recoveryId: verifiedRecoveryId,
      };
    }
  }
  return result;
}

/**
 * Provider Environmentを構築する。
 *
 * @responsibility Provider Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input baseEnvironment: unknown、directories: OperationDirectories
 * @returns Record<string, string>を返す。
 * @precondition 「baseEnvironment: unknown、directories: OperationDirectories」がcreateProviderEnvironmentの入力契約を満たす。
 * @postcondition createProviderEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createProviderEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProviderEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createProviderEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProviderEnvironmentはProcess内の同一Subsystemで完結する。
 * @security createProviderEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProviderEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createProviderEnvironment(
  baseEnvironment: unknown,
  directories: OperationDirectories,
): Record<string, string> {
  const environment: Record<string, string> = {};
  copyIfPresent(environment, baseEnvironment, "PATH");
  copyIfPresent(environment, baseEnvironment, "Path");
  for (const name of WINDOWS_RUNTIME_ENV)
    copyIfPresent(environment, baseEnvironment, name);
  for (const name of POSIX_RUNTIME_ENV)
    copyIfPresent(environment, baseEnvironment, name);
  environment.HOME = directories.providerHome;
  environment.USERPROFILE = directories.providerHome;
  environment.TEMP = directories.tmp;
  environment.TMP = directories.tmp;
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  return environment;
}

/**
 * Filesystem Policyの公開契約を記述する。
 *
 * @responsibility Filesystem Policyの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input directories: OperationDirectories
 * @returns describeFilesystemPolicyの計算結果を返す。
 * @precondition 「directories: OperationDirectories」がdescribeFilesystemPolicyの入力契約を満たす。
 * @postcondition describeFilesystemPolicyの責務を完了した結果だけを返す。
 * @effect N/A: describeFilesystemPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeFilesystemPolicyは独自の失敗分岐を所有しない。
 * @invariant describeFilesystemPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeFilesystemPolicyはProcess内の同一Subsystemで完結する。
 * @security describeFilesystemPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeFilesystemPolicyは共有非同期状態を持たない同期処理である。
 */
export function describeFilesystemPolicy(directories: OperationDirectories) {
  return {
    coordinatorRuntime: {
      write: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    repositoryAdapter: { write: [directories.workspace] },
    providerProcess: {
      write: [directories.workspace, directories.providerHome, directories.tmp],
      deny: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    credentialBroker: {
      credentialStoreAccess: "read-minimum",
      exposeCredentialStorePathToProvider: false,
    },
  };
}

/**
 * credential Environment Names Presentを決定する。
 *
 * @responsibility credential Environment Names Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input environment: unknown
 * @returns readonly string[]を返す。
 * @precondition 「environment: unknown」がcredentialEnvironmentNamesPresentの入力契約を満たす。
 * @postcondition credentialEnvironmentNamesPresentの責務を完了した結果だけを返す。
 * @effect N/A: credentialEnvironmentNamesPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: credentialEnvironmentNamesPresentは独自の失敗分岐を所有しない。
 * @invariant credentialEnvironmentNamesPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: credentialEnvironmentNamesPresentはProcess内の同一Subsystemで完結する。
 * @security credentialEnvironmentNamesPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: credentialEnvironmentNamesPresentは共有非同期状態を持たない同期処理である。
 */
export function credentialEnvironmentNamesPresent(
  environment: unknown,
): readonly string[] {
  return CREDENTIAL_ENV_NAMES.filter((name) => {
    const value = ownString(environment, name);
    return value !== null && value.length > 0;
  });
}
