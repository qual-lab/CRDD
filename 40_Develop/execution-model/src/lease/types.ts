/** Leaseの記録値・照会・処置入力契約を所有する。 @trace ARCH-000008 */
import type { ExecutionStateEnvelope, Snapshot } from "../composition/types.ts";
import type { ProjectQueueEntry } from "../task/types.ts";

/**
 * durable-foundationで使用するLease Evidence ExecutionStateEnvelopeの値契約を定義する。
 *
 * @responsibility Lease Evidence ExecutionStateEnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceEnvelopeの宣言は外部境界を開かない。
 * @security LeaseEvidenceEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseEvidenceEnvelope = ExecutionStateEnvelope &
  Readonly<{ recordKind: "lease-evidence"; content: LeaseEvidenceContent }>;

/**
 * durable-foundationで使用するLease Evidence Contentの値契約を定義する。
 *
 * @responsibility Lease Evidence ContentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceContentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceContentで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceContentの宣言は外部境界を開かない。
 * @security LeaseEvidenceContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceContentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseEvidenceContent = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  disposition:
    | "acquired"
    | "released"
    | "recovered_after_owner_loss"
    | "acquisition_unknown_closed";
}>;

/**
 * lease-portで使用するCoordinator Lease Kindの値契約を定義する。
 *
 * @responsibility Coordinator Lease KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseKindの宣言は外部境界を開かない。
 * @security N/A: LeaseKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseKind = "project-operation";

/**
 * Rootだけを渡す用途固定の観測入力。保存OwnerやSnapshotは渡さない。
 * @responsibility Lease観測に必要な検証済みRootだけを元の呼出し位置へ渡す。
 * @trace ARCH-000008
 * @shape 元の固定入力と、Rootを先頭に受ける観測関数。
 * @invariant RuntimeのFactory・dispatcher・任意Snapshot契約に使用しない。
 * @boundary 保存Module内の有限な関数署名。
 * @security Rootは観測対象であり実行Authorityではない。
 * @compatibility 元の引数と観測回数を維持する。
 */
export type RootObservedInput<T extends readonly unknown[]> = T extends [
  unknown,
  ...infer Rest,
]
  ? Rest extends [...infer Prefix, infer Observations]
    ? [
        ...Prefix,
        {
          [K in keyof Observations]: K extends "resourcesAbsent" | "observeRoot"
            ? Observations[K] extends (...args: infer A) => infer R
              ? (repositoryRoot: string, ...args: A) => R
              : never
            : Observations[K];
        },
      ]
    : never
  : never;

/** 保存候補の全照合後、同じ短期Owner内で一度だけ呼ぶCoordinatorの同期回収操作。 */
export type LeaseRecoveryInput = [
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: Snapshot["leaseIntents"],
  pending: Snapshot["leaseIntents"][number],
  first: Snapshot["leaseIntents"][number],
  recoveryId: string,
  operations: Readonly<{
    observeRoot: (repositoryRoot: string) => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
    recoverResources: (repositoryRoot: string) => boolean;
    resourcesAbsent: (repositoryRoot: string) => boolean;
  }>,
];

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseReadRequest = Readonly<
  | {
      kind: "acquisition";
      input: Parameters<
        typeof import("./crud.ts").projectLeaseAcquisitionOwner
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "owner_loss";
      input: RootObservedInput<
        Parameters<typeof import("./crud.ts").projectLeaseOwnerLossState>
      >;
    }
>;

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseRecoveryRequest = Readonly<
  | {
      kind: "reconcile";
      input: RootObservedInput<
        Parameters<
          typeof import("./crud.ts").prepareReleasedLeaseReconciliation
        >
      >;
    }
  | {
      kind: "intent";
      input: RootObservedInput<
        Parameters<typeof import("./crud.ts").prepareLeaseRecoveryReservation>
      >;
    }
  | { kind: "observed"; input: LeaseRecoveryInput }
>;

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseReleaseRequest = Readonly<
  | {
      kind: "intent";
      input: Parameters<
        typeof import("./crud.ts").prepareLeaseReleaseIntent
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "observed";
      input: Parameters<
        typeof import("./crud.ts").prepareLeaseReleaseSettlement
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
>;

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseAcquisitionRequest = Readonly<
  | {
      kind: "intent";
      input: [
        projectId: string,
        queueId: string,
        kind: LeaseKind,
        owner: Pick<
          Snapshot["leaseIntents"][number],
          "ownerGeneration" | "ownerProcessId"
        >,
        observations: Readonly<{
          resourcesAbsent: (
            repositoryRoot: string,
            identity: string,
          ) => boolean;
          observeRoot: (
            repositoryRoot: string,
          ) => Readonly<{ repositoryRoot: string; rootIdentity: string }>;
          markIntentSaveRequested: (recoveryId: string) => void;
        }>,
        recoveryGeneration?: number | undefined,
        admission?:
          | Readonly<{
              queueGeneration: number;
              stateGeneration: number;
            }>
          | undefined,
      ];
    }
  | {
      kind: "observed";
      input: Parameters<
        typeof import("./crud.ts").prepareLeaseAcquisitionConfirmation
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
>;
