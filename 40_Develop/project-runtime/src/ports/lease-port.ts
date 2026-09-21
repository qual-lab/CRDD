import type { ProjectQueueEntry } from "../core/project-runtime-queue.ts";
import type { ProjectRuntimePortResult } from "./port-result.ts";

/**
 * ProjectRuntimeLeaseKindが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeLeaseKindに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeLeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeLeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeLeaseKindの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeLeaseKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeLeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeLeaseKind =
  | "project-operation"
  | "canonical-adoption";

/**
 * ProjectRuntimeLeaseが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeLeaseに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeLeaseの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeLeaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeLease = Readonly<{
  kind: ProjectRuntimeLeaseKind;
  ownerGeneration: string;
  release: () => ProjectRuntimePortResult<Readonly<{ released: true }>>;
}>;

/**
 * ProjectRuntimeLeaseAcquisitionResolutionが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeLeaseAcquisitionResolutionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeLeaseAcquisitionResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeLeaseAcquisitionResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeLeaseAcquisitionResolutionの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeLeaseAcquisitionResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeLeaseAcquisitionResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeLeaseAcquisitionResolution = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

/**
 * ProjectRuntimeLeaseOwnerObservationが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeLeaseOwnerObservationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeLeaseOwnerObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeLeaseOwnerObservation = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

/**
 * ProjectRuntimeLeasePortが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeLeasePortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeLeasePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeLeasePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeLeasePortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeLeasePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeLeasePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
