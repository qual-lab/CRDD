import type {
  ProjectQueueEntry,
  ProjectQueueState,
} from "../core/project-runtime-queue.ts";
import type { ProjectRuntimeState } from "../core/project-runtime-state.ts";
import type {
  ProjectRuntimeLease,
  ProjectRuntimeLeasePort,
} from "./lease-port.ts";
import type { ProjectRuntimePortResult } from "./port-result.ts";

/**
 * ProjectRuntimeQueueEnqueueInputが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeQueueEnqueueInputに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeQueueEnqueueInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeQueueEnqueueInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeQueueEnqueueInputの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeQueueEnqueueInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeQueueEnqueueInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeQueueEnqueueInput = Omit<
  ProjectQueueEntry,
  | "state"
  | "generation"
  | "ownerGeneration"
  | "resumeCondition"
  | "resultReference"
>;

/**
 * ProjectRuntimeQueueUpdateが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeQueueUpdateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeQueueUpdateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeQueueUpdateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeQueueUpdateの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeQueueUpdateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeQueueUpdateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeQueueUpdate = Readonly<{
  state: ProjectQueueState;
  lease: ProjectRuntimeLease | null;
  resumeCondition: string | null;
  resultReference: string | null;
}>;

/**
 * Repository-bound durable state capability supplied by a composition root.
 *
 * @responsibility ProjectRuntimeStatePortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeStatePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeStatePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeStatePortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeStatePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeStatePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeStatePort = Readonly<{
  writeState: (
    state: ProjectRuntimeState,
    expectedGeneration: number,
  ) => ProjectRuntimePortResult<ProjectRuntimeState>;
  readState: (
    projectId: string,
  ) => ProjectRuntimePortResult<ProjectRuntimeState | null>;
  enqueueOperation: (
    input: ProjectRuntimeQueueEnqueueInput,
  ) => ProjectRuntimePortResult<ProjectQueueEntry>;
  readQueue: (queueId: string) => ProjectRuntimePortResult<ProjectQueueEntry>;
  selectNextOperation: () => ProjectRuntimePortResult<ProjectQueueEntry | null>;
  updateQueue: (
    queueId: string,
    expectedGeneration: number,
    next: ProjectRuntimeQueueUpdate,
  ) => ProjectRuntimePortResult<ProjectQueueEntry>;
  settleQueueRecovery: (
    queueId: string,
    expectedGeneration: number,
    recoveryId: string,
  ) => ProjectRuntimePortResult<ProjectQueueEntry>;
  settleQueueLeaseRelease: (
    queueId: string,
    expectedGeneration: number,
    ownerGeneration: string,
  ) => ProjectRuntimePortResult<ProjectQueueEntry>;
}>;

/**
 * ProjectRuntimePersistencePortsが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimePersistencePortsに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimePersistencePortsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimePersistencePortsで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimePersistencePortsの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimePersistencePortsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimePersistencePortsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimePersistencePorts = Readonly<{
  state: ProjectRuntimeStatePort;
  lease: ProjectRuntimeLeasePort;
}>;
