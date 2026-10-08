/**
 * state-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorQueueEnqueueInputを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { ProjectQueueEntry, ProjectQueueState } from "../queue/types.ts";
import type { OrchestratorState } from "./transitions.ts";
import type {
  OrchestratorLease,
  OrchestratorLeasePort,
} from "../lease/controller.ts";
import type { OrchestratorPortResult } from "../operation-result.ts";

/**
 * state-portで使用するOrchestrator Queue Enqueue 入力の値契約を定義する。
 *
 * @responsibility Orchestrator Queue Enqueue 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorQueueEnqueueInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorQueueEnqueueInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorQueueEnqueueInputの宣言は外部境界を開かない。
 * @security N/A: OrchestratorQueueEnqueueInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorQueueEnqueueInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorQueueEnqueueInput = Omit<
  ProjectQueueEntry,
  | "state"
  | "generation"
  | "ownerGeneration"
  | "resumeCondition"
  | "resultReference"
>;

/**
 * state-portで使用するOrchestrator Queue Updateの値契約を定義する。
 *
 * @responsibility Orchestrator Queue UpdateのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorQueueUpdateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorQueueUpdateで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorQueueUpdateの宣言は外部境界を開かない。
 * @security N/A: OrchestratorQueueUpdateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorQueueUpdateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorQueueUpdate = Readonly<{
  state: ProjectQueueState;
  lease: OrchestratorLease | null;
  resumeCondition: string | null;
  resultReference: string | null;
}>;

/**
 * Repository-bound durable state capability supplied by a composition root.
 *
 * @responsibility Orchestrator 状態 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorStatePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorStatePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorStatePortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorStatePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorStatePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorStatePort = Readonly<{
  writeState: (
    state: OrchestratorState,
    expectedGeneration: number,
  ) => OrchestratorPortResult<OrchestratorState>;
  readState: (
    projectId: string,
  ) => OrchestratorPortResult<OrchestratorState | null>;
  enqueueOperation: (
    input: OrchestratorQueueEnqueueInput,
  ) => OrchestratorPortResult<ProjectQueueEntry>;
  readQueue: (queueId: string) => OrchestratorPortResult<ProjectQueueEntry>;
  selectNextOperation: () => OrchestratorPortResult<ProjectQueueEntry | null>;
  updateQueue: (
    queueId: string,
    expectedGeneration: number,
    next: OrchestratorQueueUpdate,
  ) => OrchestratorPortResult<ProjectQueueEntry>;
  settleQueueRecovery: (
    queueId: string,
    expectedGeneration: number,
    recoveryId: string,
  ) => OrchestratorPortResult<ProjectQueueEntry>;
  settleQueueLeaseRelease: (
    queueId: string,
    expectedGeneration: number,
    ownerGeneration: string,
  ) => OrchestratorPortResult<ProjectQueueEntry>;
}>;

/**
 * state-portで使用するOrchestrator Persistence Portsの値契約を定義する。
 *
 * @responsibility Orchestrator Persistence PortsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPersistencePortsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPersistencePortsで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPersistencePortsの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPersistencePortsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPersistencePortsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPersistencePorts = Readonly<{
  state: OrchestratorStatePort;
  lease: OrchestratorLeasePort;
}>;
