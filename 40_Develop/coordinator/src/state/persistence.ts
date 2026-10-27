/**
 * 状態保存・Queue更新と実LeaseのPort契約を定義する。
 *
 * @responsibility Domainの共有値型を使い、既存の保存・更新・実行Owner接続だけを定義する。
 * @trace ARCH-000004
 */

import type {
  CoordinatorQueueEnqueueInput,
  ProjectQueueEntry,
  ProjectTaskResultFact,
  ProjectQueueState,
  CoordinatorState,
  CoordinatorLeaseKind,
} from "../../../domain-model/src/index.ts";
import type { CoordinatorPortResult } from "./result.ts";

/**
 * state-portで使用するCoordinator Queue Updateの値契約を定義する。
 *
 * @responsibility Coordinator Queue UpdateのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorQueueUpdateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorQueueUpdateで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorQueueUpdateの宣言は外部境界を開かない。
 * @security N/A: CoordinatorQueueUpdateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorQueueUpdateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorQueueUpdate = Readonly<{
  state: ProjectQueueState;
  lease: CoordinatorLease | null;
  resumeCondition: string | null;
  resultReference: string | null;
}>;

/**
 * Repository-bound durable state capability supplied by a composition root.
 *
 * @responsibility Coordinator 状態 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorStatePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorStatePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorStatePortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorStatePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorStatePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorStatePort = Readonly<{
  readWorkspaceTaskTarget?: (queueId: string) => CoordinatorPortResult<
    Readonly<{
      workspaceId: string | null;
      ownerRepositoryRoot: string;
      executionTree: string;
      baseCommit: string | null;
      head: string | null;
    }>
  >;
  writeState: (
    state: CoordinatorState,
    expectedGeneration: number,
    resultFacts?: readonly ProjectTaskResultFact[],
  ) => CoordinatorPortResult<CoordinatorState>;
  readState: (
    projectId: string,
  ) => CoordinatorPortResult<CoordinatorState | null>;
  enqueueOperation: (
    input: CoordinatorQueueEnqueueInput,
  ) => CoordinatorPortResult<ProjectQueueEntry>;
  readQueue: (queueId: string) => CoordinatorPortResult<ProjectQueueEntry>;
  selectNextOperation: () => CoordinatorPortResult<ProjectQueueEntry | null>;
  updateQueue: (
    queueId: string,
    expectedGeneration: number,
    next: CoordinatorQueueUpdate,
  ) => CoordinatorPortResult<ProjectQueueEntry>;
  settleQueueRecovery: (
    queueId: string,
    expectedGeneration: number,
    recoveryId: string,
  ) => CoordinatorPortResult<ProjectQueueEntry>;
  settleQueueLeaseRelease: (
    queueId: string,
    expectedGeneration: number,
    ownerGeneration: string,
  ) => CoordinatorPortResult<ProjectQueueEntry>;
}>;

/**
 * state-portで使用するCoordinator Persistence Portsの値契約を定義する。
 *
 * @responsibility Coordinator Persistence PortsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPersistencePortsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPersistencePortsで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPersistencePortsの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPersistencePortsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPersistencePortsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPersistencePorts = Readonly<{
  state: CoordinatorStatePort;
  lease: CoordinatorLeasePort;
}>;

/**
 * clock-identity-portで使用するCoordinator Clock Readingの値契約を定義する。
 *
 * @responsibility Coordinator Clock ReadingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorClockReadingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorClockReadingで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorClockReadingの宣言は外部境界を開かない。
 * @security N/A: CoordinatorClockReadingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorClockReadingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorClockReading = Readonly<{
  monotonicMs: number;
  iso: string;
}>;

/**
 * Host-supplied clock and deterministic identity operations.
 *
 * @responsibility Coordinator Clock Identity PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorClockIdentityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorClockIdentityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorClockIdentityPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorClockIdentityPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorClockIdentityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorClockIdentityPort = Readonly<{
  now: () => CoordinatorClockReading;
  createStableId: (prefix: string, parts: readonly string[]) => string;
  createContentHash: (content: string) => string;
}>;

/**
 * lease-portで使用するCoordinator Leaseの値契約を定義する。
 *
 * @responsibility Coordinator LeaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLease = Readonly<{
  kind: CoordinatorLeaseKind;
  ownerGeneration: string;
  release: () => CoordinatorPortResult<Readonly<{ released: true }>>;
}>;

/**
 * lease-portで使用するCoordinator Lease Acquisition Resolutionの値契約を定義する。
 *
 * @responsibility Coordinator Lease Acquisition ResolutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseAcquisitionResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseAcquisitionResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseAcquisitionResolutionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseAcquisitionResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseAcquisitionResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLeaseAcquisitionResolution = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

/**
 * lease-portで使用するCoordinator Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Coordinator Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseOwnerObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLeaseOwnerObservation = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

/**
 * lease-portで使用するCoordinator Lease Portの値契約を定義する。
 *
 * @responsibility Coordinator Lease PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeasePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeasePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeasePortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeasePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeasePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLeasePort = Readonly<{
  acquire: (
    projectId: string,
    queueId: string,
    kind: CoordinatorLeaseKind,
  ) => CoordinatorPortResult<CoordinatorLease>;
  inspectAcquisitionOwner: () => CoordinatorPortResult<
    Readonly<{ acquisition: CoordinatorLeaseAcquisitionResolution | null }>
  >;
  reconcileOperationOwnerLoss: (
    projectId: string,
    queueId: string,
    observeOwner: CoordinatorLeaseOwnerObservation,
  ) => CoordinatorPortResult<ProjectQueueEntry>;
  reconcileAdoptionOwnerLoss: (
    projectId: string,
    observeOwner: CoordinatorLeaseOwnerObservation,
  ) => CoordinatorPortResult<Readonly<{ recoveryId: string | null }>>;
}>;
