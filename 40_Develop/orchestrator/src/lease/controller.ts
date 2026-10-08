/**
 * lease-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorLeaseKindを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { ProjectQueueEntry } from "../queue/types.ts";
import type { OrchestratorPortResult } from "../operation-result.ts";

/**
 * lease-portで使用するOrchestrator Lease Kindの値契約を定義する。
 *
 * @responsibility Orchestrator Lease KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorLeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorLeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorLeaseKindの宣言は外部境界を開かない。
 * @security N/A: OrchestratorLeaseKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorLeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorLeaseKind = "project-operation" | "canonical-adoption";

/**
 * lease-portで使用するOrchestrator Leaseの値契約を定義する。
 *
 * @responsibility Orchestrator LeaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorLeaseの宣言は外部境界を開かない。
 * @security N/A: OrchestratorLeaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorLease = Readonly<{
  kind: OrchestratorLeaseKind;
  ownerGeneration: string;
  release: () => OrchestratorPortResult<Readonly<{ released: true }>>;
}>;

/**
 * lease-portで使用するOrchestrator Lease Acquisition Resolutionの値契約を定義する。
 *
 * @responsibility Orchestrator Lease Acquisition ResolutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorLeaseAcquisitionResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorLeaseAcquisitionResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorLeaseAcquisitionResolutionの宣言は外部境界を開かない。
 * @security N/A: OrchestratorLeaseAcquisitionResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorLeaseAcquisitionResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorLeaseAcquisitionResolution = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

/**
 * lease-portで使用するOrchestrator Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Orchestrator Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security N/A: OrchestratorLeaseOwnerObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorLeaseOwnerObservation = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

/**
 * lease-portで使用するOrchestrator Lease Portの値契約を定義する。
 *
 * @responsibility Orchestrator Lease PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorLeasePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorLeasePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorLeasePortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorLeasePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorLeasePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorLeasePort = Readonly<{
  acquire: (
    projectId: string,
    queueId: string,
    kind: OrchestratorLeaseKind,
  ) => OrchestratorPortResult<OrchestratorLease>;
  inspectAcquisitionOwner: () => OrchestratorPortResult<
    Readonly<{ acquisition: OrchestratorLeaseAcquisitionResolution | null }>
  >;
  reconcileOperationOwnerLoss: (
    projectId: string,
    queueId: string,
    observeOwner: OrchestratorLeaseOwnerObservation,
  ) => OrchestratorPortResult<ProjectQueueEntry>;
  reconcileAdoptionOwnerLoss: (
    projectId: string,
    observeOwner: OrchestratorLeaseOwnerObservation,
  ) => OrchestratorPortResult<Readonly<{ recoveryId: string | null }>>;
}>;
