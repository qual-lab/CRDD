/**
 * state-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorQueueEnqueueInputを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { ProjectQueueEntry, ProjectQueueState } from "../queue/types.ts";
import type { CoordinatorState } from "./model.ts";
import type {
  CoordinatorLease,
  CoordinatorLeasePort,
} from "../lease/controller.ts";
import type { CoordinatorPortResult } from "../operation-result.ts";

/**
 * state-portで使用するCoordinator Queue Enqueue 入力の値契約を定義する。
 *
 * @responsibility Coordinator Queue Enqueue 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorQueueEnqueueInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorQueueEnqueueInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorQueueEnqueueInputの宣言は外部境界を開かない。
 * @security N/A: CoordinatorQueueEnqueueInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorQueueEnqueueInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorQueueEnqueueInput = Omit<
  ProjectQueueEntry,
  | "state"
  | "generation"
  | "ownerGeneration"
  | "resumeCondition"
  | "resultReference"
  | "singleTask"
  | "milestoneId"
> &
  Readonly<{ milestoneId: string }>;

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
