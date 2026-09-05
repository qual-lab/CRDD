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

export type ProjectRuntimeQueueEnqueueInput = Omit<
  ProjectQueueEntry,
  | "state"
  | "generation"
  | "ownerGeneration"
  | "resumeCondition"
  | "resultReference"
>;

export type ProjectRuntimeQueueUpdate = Readonly<{
  state: ProjectQueueState;
  lease: ProjectRuntimeLease | null;
  resumeCondition: string | null;
  resultReference: string | null;
}>;

/** Repository-bound durable state capability supplied by a composition root. */
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

export type ProjectRuntimePersistencePorts = Readonly<{
  state: ProjectRuntimeStatePort;
  lease: ProjectRuntimeLeasePort;
}>;
