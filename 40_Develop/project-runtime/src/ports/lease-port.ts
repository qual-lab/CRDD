import type { ProjectQueueEntry } from "../core/project-runtime-queue.ts";
import type { ProjectRuntimePortResult } from "./port-result.ts";

export type ProjectRuntimeLeaseKind =
  | "project-operation"
  | "canonical-adoption";

export type ProjectRuntimeLease = Readonly<{
  kind: ProjectRuntimeLeaseKind;
  ownerGeneration: string;
  release: () => ProjectRuntimePortResult<Readonly<{ released: true }>>;
}>;

export type ProjectRuntimeLeaseAcquisitionResolution = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

export type ProjectRuntimeLeaseOwnerObservation = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

export type ProjectRuntimeLeasePort = Readonly<{
  acquire: (
    projectId: string,
    queueId: string,
    kind: ProjectRuntimeLeaseKind,
  ) => ProjectRuntimePortResult<ProjectRuntimeLease>;
  inspectAcquisitionOwner: () => ProjectRuntimePortResult<
    Readonly<{ acquisition: ProjectRuntimeLeaseAcquisitionResolution | null }>
  >;
  reconcileOperationOwnerLoss: (
    projectId: string,
    queueId: string,
    observeOwner: ProjectRuntimeLeaseOwnerObservation,
  ) => ProjectRuntimePortResult<ProjectQueueEntry>;
  reconcileAdoptionOwnerLoss: (
    projectId: string,
    observeOwner: ProjectRuntimeLeaseOwnerObservation,
  ) => ProjectRuntimePortResult<Readonly<{ recoveryId: string | null }>>;
}>;
