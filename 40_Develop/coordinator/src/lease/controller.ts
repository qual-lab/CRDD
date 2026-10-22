/**
 * lease-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorLeaseKindを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { ProjectQueueEntry } from "../queue/types.ts";
import type { CoordinatorPortResult } from "../operation-result.ts";

/**
 * lease-portで使用するCoordinator Lease Kindの値契約を定義する。
 *
 * @responsibility Coordinator Lease KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseKindの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLeaseKind = "project-operation" | "canonical-adoption";

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
