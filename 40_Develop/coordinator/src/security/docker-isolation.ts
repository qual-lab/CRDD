/**
 * docker-isolationに属する責務をまとめる。
 *
 * @responsibility EntityTypeを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { SpawnSyncReturns } from "node:child_process";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWindowsDockerCliEnvironment } from "../core/windows-child-environment.ts";
import {
  type DockerCliTrustSnapshot,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./docker-cli-trust.ts";

import {
  adoptOwnedHostRecoveryRecordTransition,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  transitionOwnedDockerSubmissionState,
  verifyOwnedMountCapability,
} from "./execution-environment.ts";
import {
  formatHostRecoveryToken,
  loadHostRecoveryRecordByToken,
} from "./host-recovery-record.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const PROBE_IMAGE =
  "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
const MAX_OUTPUT_BYTES = 64 * 1024;
const PROBE_MARKER = "crdd-coordinator-isolation-v1";
const OWNERSHIP_LABEL = "crdd.coordinator.probe";
const DOCKER_DESKTOP_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
/**
 * docker-isolationで使用するEntity Typeの値契約を定義する。
 *
 * @responsibility Entity TypeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape EntityTypeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant EntityTypeで宣言した値と責務の対応を維持する。
 * @boundary N/A: EntityTypeの宣言は外部境界を開かない。
 * @security EntityTypeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility EntityTypeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type EntityType = "file" | "directory";
/**
 * docker-isolationで使用するFilesystem Identityの値契約を定義する。
 *
 * @responsibility Filesystem IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape FilesystemIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FilesystemIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FilesystemIdentityの宣言は外部境界を開かない。
 * @security FilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FilesystemIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FilesystemIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;
/**
 * docker-isolationで使用するSerializable Identityの値契約を定義する。
 *
 * @responsibility Serializable IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape SerializableIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SerializableIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: SerializableIdentityの宣言は外部境界を開かない。
 * @security SerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SerializableIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SerializableIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;
/**
 * docker-isolationで使用するDocker Mountsの値契約を定義する。
 *
 * @responsibility Docker MountsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerMountsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerMountsで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerMountsの宣言は外部境界を開かない。
 * @security DockerMountsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerMountsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerMounts = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;
/**
 * docker-isolationで使用するDocker Environmentの値契約を定義する。
 *
 * @responsibility Docker EnvironmentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerEnvironmentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerEnvironmentで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerEnvironmentの宣言は外部境界を開かない。
 * @security DockerEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerEnvironmentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerEnvironment = Record<string, string>;
/**
 * docker-isolationで使用するDocker Executionの値契約を定義する。
 *
 * @responsibility Docker ExecutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerExecutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerExecutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerExecutionの宣言は外部境界を開かない。
 * @security DockerExecutionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerExecutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerExecution = Partial<
  Pick<
    SpawnSyncReturns<string>,
    "error" | "signal" | "status" | "stderr" | "stdout"
  >
>;
/**
 * docker-isolationで使用するAsync Docker Executionの値契約を定義する。
 *
 * @responsibility Async Docker ExecutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape AsyncDockerExecutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AsyncDockerExecutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: AsyncDockerExecutionの宣言は外部境界を開かない。
 * @security AsyncDockerExecutionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility AsyncDockerExecutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AsyncDockerExecution = DockerExecution &
  Readonly<{ outputExceeded: boolean }>;
/**
 * docker-isolationで使用するContainer Identityの値契約を定義する。
 *
 * @responsibility Container IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ContainerIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ContainerIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ContainerIdentityの宣言は外部境界を開かない。
 * @security ContainerIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ContainerIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ContainerIdentity = Readonly<{
  id: string;
  probeId: string;
  source?: string;
}>;
/**
 * docker-isolationで使用するCli Snapshotの値契約を定義する。
 *
 * @responsibility Cli SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CliSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CliSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: CliSnapshotの宣言は外部境界を開かない。
 * @security CliSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CliSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CliSnapshot = DockerCliTrustSnapshot;
/**
 * docker-isolationで使用するAbsence Observationの値契約を定義する。
 *
 * @responsibility Absence ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape AbsenceObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AbsenceObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: AbsenceObservationの宣言は外部境界を開かない。
 * @security AbsenceObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility AbsenceObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AbsenceObservation = Readonly<{
  probeId: string;
  containerId: string;
  hostRecoveryId: string;
  rootName: string;
  cli: object;
}>;
/**
 * docker-isolationで使用するDocker Probe 失敗 状態の値契約を定義する。
 *
 * @responsibility Docker Probe 失敗 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerProbeFailureStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerProbeFailureStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerProbeFailureStateの宣言は外部境界を開かない。
 * @security DockerProbeFailureStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerProbeFailureStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerProbeFailureState = Readonly<{
  submissionStarted: boolean;
  recoveryId: string | null;
  hostRecoveryId: string;
  rollbackFailed: boolean;
}>;
/**
 * docker-isolationで使用するDocker 回復 記録の値契約を定義する。
 *
 * @responsibility Docker 回復 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRecoveryRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRecoveryRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRecoveryRecordの宣言は外部境界を開かない。
 * @security DockerRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRecoveryRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerRecoveryRecord = Readonly<{
  schema: "crdd-coordinator-docker-recovery/v1";
  probeId: string;
  nonceHash: string;
  rootName: string;
  rootIdentity: SerializableIdentity;
  childIdentities: Readonly<Record<string, SerializableIdentity>>;
  container: Readonly<{ id: string | null; name: string; label: string }>;
  engine: string;
  image: string;
  hostRecoveryId: string;
  createdAt: string;
}>;
/**
 * docker-isolationで使用するLoaded Docker 回復の値契約を定義する。
 *
 * @responsibility Loaded Docker 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape LoadedDockerRecoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LoadedDockerRecoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: LoadedDockerRecoveryの宣言は外部境界を開かない。
 * @security LoadedDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LoadedDockerRecoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LoadedDockerRecovery = Readonly<{
  parsed: Readonly<{
    rootName: string;
    probeId: string;
    nonce: string;
    recordHash: string;
  }>;
  record: DockerRecoveryRecord;
  root: string;
  children: DockerMounts;
  marker: string;
  present: ReadonlySet<string>;
}>;

const containerIdentities = new WeakMap<object, ContainerIdentity>();
const cliIdentities = new WeakMap<object, CliSnapshot>();
const absenceCapabilities = new WeakMap<object, AbsenceObservation>();
/**
 * docker-isolationで使用するPending Dynamic Fake Provider Lifecycleの値契約を定義する。
 *
 * @responsibility Pending Dynamic Fake Provider LifecycleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PendingDynamicFakeProviderLifecycleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PendingDynamicFakeProviderLifecycleで宣言した値と責務の対応を維持する。
 * @boundary N/A: PendingDynamicFakeProviderLifecycleの宣言は外部境界を開かない。
 * @security PendingDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PendingDynamicFakeProviderLifecycleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PendingDynamicFakeProviderLifecycle = Readonly<{
  observation: DynamicFakeProviderLifecycleObservation;
  probeId: string;
  containerId: string;
  mountCapability: object;
  hostRecoveryId: string;
}>;
/**
 * docker-isolationで使用するDynamic Fake Provider Finalizationの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider FinalizationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFinalizationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFinalizationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFinalizationの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFinalizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFinalizationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderFinalization = Readonly<{
  pendingCapability: object;
  probeId: string;
  containerId: string;
  mountCapability: object;
  absenceCapability: object;
  hostCleanupCapability: object;
}>;
/**
 * docker-isolationで使用するDynamic Fake Provider Absenceの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider AbsenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderAbsenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderAbsenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderAbsenceの宣言は外部境界を開かない。
 * @security DynamicFakeProviderAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderAbsenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderAbsence = Readonly<{
  probeId: string;
  containerId: string;
  initialHostRecoveryId: string;
  confirmedHostRecoveryId: string;
}>;
/**
 * docker-isolationで使用するDynamic Fake Provider Host 清掃の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Host 清掃のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderHostCleanupが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderHostCleanupで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderHostCleanupの宣言は外部境界を開かない。
 * @security DynamicFakeProviderHostCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderHostCleanupの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderHostCleanup = Readonly<{
  probeId: string;
  confirmedHostRecoveryId: string;
  absenceCapability: object;
}>;
const pendingDynamicLifecycleObservations = new WeakMap<
  object,
  PendingDynamicFakeProviderLifecycle
>();
const dynamicLifecycleFinalizations = new WeakMap<
  object,
  DynamicFakeProviderFinalization
>();
const dynamicLifecycleAbsences = new WeakMap<
  object,
  DynamicFakeProviderAbsence
>();
const dynamicLifecycleHostCleanups = new WeakMap<
  object,
  DynamicFakeProviderHostCleanup
>();
const RECOVERY_FILE = "docker-probe-recovery-v1.json";
const OPERATION_PREFIX = "crdd-coordinator-doctor-";

/**
 * docker-isolationで使用するDocker Probe 結果の値契約を定義する。
 *
 * @responsibility Docker Probe 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerProbeResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerProbeResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerProbeResultの宣言は外部境界を開かない。
 * @security DockerProbeResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerProbeResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerProbeResult = Readonly<{
  status: "confirmed" | "blocked" | "recovered";
  reason: string;
  probeId: string | null;
  retainOperationDirectories: boolean;
  hostCleanupCompleted: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  fakeProviderLifecycle: DynamicFakeProviderLifecycleObservation;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Lifecycle Observationの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderLifecycleObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderLifecycleObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderLifecycleObservationの宣言は外部境界を開かない。
 * @security DynamicFakeProviderLifecycleObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderLifecycleObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderLifecycleObservation = Readonly<{
  status: "verified" | "candidate" | "blocked" | "not_evaluated";
  reason: string;
  provenance:
    | "repository_owned_docker_fake_provider"
    | "untrusted_execution_fixture";
  fakeProviderStartAttempted: boolean;
  fakeProviderExecuted: boolean;
  resultNormalizationVerified: boolean;
  containerAbsenceVerified: boolean;
  processTreeAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  elapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  cancellationRequested: false;
  cancellationObservation: "not_implemented";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Cancellation 結果の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Cancellation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderCancellationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderCancellationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderCancellationResultの宣言は外部境界を開かない。
 * @security DynamicFakeProviderCancellationResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderCancellationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderCancellationResult = Readonly<{
  status: "verified" | "candidate" | "blocked";
  reason: string;
  cancellationRequested: boolean;
  cancellationSignalRequested: "SIGTERM" | null;
  readyObserved: boolean;
  cancellationAcknowledged: boolean;
  processTerminationObserved: boolean;
  attachProcessTerminationObserved: boolean;
  attachProcessTerminationRequestCount: number;
  containerAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  graceElapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  retainOperationDirectories: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Recoverable Residue 結果の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Recoverable Residue 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderRecoverableResidueResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderRecoverableResidueResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderRecoverableResidueResultの宣言は外部境界を開かない。
 * @security DynamicFakeProviderRecoverableResidueResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderRecoverableResidueResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderRecoverableResidueResult = Readonly<{
  status: "ready" | "blocked";
  reason: string;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  containerRunning: boolean;
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

export const OWNED_ATTACH_TERMINATION_FIXTURE_SCENARIOS = Object.freeze([
  "never_ready",
  "ready_then_never_complete",
  "output_overflow",
] as const);
/**
 * docker-isolationで使用する所有 Attach Termination Fixture Scenarioの値契約を定義する。
 *
 * @responsibility 所有 Attach Termination Fixture ScenarioのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedAttachTerminationFixtureScenarioが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedAttachTerminationFixtureScenarioで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedAttachTerminationFixtureScenarioの宣言は外部境界を開かない。
 * @security OwnedAttachTerminationFixtureScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedAttachTerminationFixtureScenarioの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedAttachTerminationFixtureScenario =
  (typeof OWNED_ATTACH_TERMINATION_FIXTURE_SCENARIOS)[number];

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security isObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * own Stringを決定する。
 *
 * @responsibility own Stringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns string | nullを返す。
 * @precondition 「value: unknown、key: string」がownStringの入力契約を満たす。
 * @postcondition ownStringの責務を完了した結果だけを返す。
 * @effect N/A: ownStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownStringは独自の失敗分岐を所有しない。
 * @invariant ownStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownStringはProcess内の同一Subsystemで完結する。
 * @security ownStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownStringは共有非同期状態を持たない同期処理である。
 */
function ownString(value: unknown, key: string): string | null {
  const candidate = isObject(value) ? ownValue(value, key) : undefined;
  return typeof candidate === "string" ? candidate : null;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown): string | null {
  return ownString(error, "code");
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security errorMessageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

/**
 * Serializable Identityを固定Schemaへ正規化する。
 *
 * @responsibility Serializable Identityの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns SerializableIdentityを返す。
 * @precondition 「value: unknown」がnormalizeSerializableIdentityの入力契約を満たす。
 * @postcondition normalizeSerializableIdentityの責務を完了した結果だけを返す。
 * @effect N/A: normalizeSerializableIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeSerializableIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeSerializableIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeSerializableIdentityはProcess内の同一Subsystemで完結する。
 * @security normalizeSerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeSerializableIdentityは共有非同期状態を持たない同期処理である。
 */
function normalizeSerializableIdentity(value: unknown): SerializableIdentity {
  if (!isObject(value)) throw new Error("docker_recovery_record_mismatch");
  const dev = ownString(value, "dev");
  const ino = ownString(value, "ino");
  const birthtimeNs = ownString(value, "birthtimeNs");
  if (!dev || !ino || !birthtimeNs)
    throw new Error("docker_recovery_record_mismatch");
  return Object.freeze({ dev, ino, birthtimeNs });
}

/**
 * Docker 回復 記録を固定Schemaへ正規化する。
 *
 * @responsibility Docker 回復 記録の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns DockerRecoveryRecordを返す。
 * @precondition 「value: unknown」がnormalizeDockerRecoveryRecordの入力契約を満たす。
 * @postcondition normalizeDockerRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDockerRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeDockerRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeDockerRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDockerRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security normalizeDockerRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDockerRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function normalizeDockerRecoveryRecord(value: unknown): DockerRecoveryRecord {
  if (!isObject(value)) throw new Error("docker_recovery_record_mismatch");
  const schema = ownString(value, "schema");
  const probeId = ownString(value, "probeId");
  const nonceHash = ownString(value, "nonceHash");
  const rootName = ownString(value, "rootName");
  const hostRecoveryId = ownString(value, "hostRecoveryId");
  const createdAt = ownString(value, "createdAt");
  const engine = ownString(value, "engine");
  const image = ownString(value, "image");
  const childrenValue = ownValue(value, "childIdentities");
  const containerValue = ownValue(value, "container");
  if (
    schema !== "crdd-coordinator-docker-recovery/v1" ||
    !probeId ||
    !nonceHash ||
    !rootName ||
    !hostRecoveryId ||
    !createdAt ||
    !engine ||
    !image ||
    !isObject(childrenValue) ||
    !isObject(containerValue)
  )
    throw new Error("docker_recovery_record_mismatch");
  const childIdentities: Record<string, SerializableIdentity> = {};
  for (const key of Object.keys(childrenValue)) {
    childIdentities[key] = normalizeSerializableIdentity(
      ownValue(childrenValue, key),
    );
  }
  const idValue = ownValue(containerValue, "id");
  const id = typeof idValue === "string" ? idValue : null;
  const name = ownString(containerValue, "name");
  const label = ownString(containerValue, "label");
  if ((idValue !== null && id === null) || !name || !label) {
    throw new Error("docker_recovery_record_mismatch");
  }
  return Object.freeze({
    schema,
    probeId,
    nonceHash,
    rootName,
    rootIdentity: normalizeSerializableIdentity(
      ownValue(value, "rootIdentity"),
    ),
    childIdentities: Object.freeze(childIdentities),
    container: Object.freeze({ id, name, label }),
    engine,
    image,
    hostRecoveryId,
    createdAt,
  });
}

const PROBE_SOURCE = `
import json, os, pathlib, socket, sys
result={"marker":"${PROBE_MARKER}","allowed_writes":{},"runtime_paths_absent":True,"credential_names_absent":True,"network_blocked":False,"home_isolated":False,"tmp_isolated":False}
for name in ("workspace","provider-home","tmp"):
    target=pathlib.Path("/operation")/name/".coordinator-probe"
    try:
        target.write_text(name,encoding="utf-8"); result["allowed_writes"][name]=target.read_text(encoding="utf-8")==name; target.unlink()
    except Exception: result["allowed_writes"][name]=False
result["runtime_paths_absent"]=all(not pathlib.Path("/runtime",name).exists() for name in ("events","projection","management"))
credential_names={"ANTHROPIC_API_KEY","CLAUDE_CODE_OAUTH_TOKEN","CODEX_API_KEY","CODEX_ACCESS_TOKEN","GH_TOKEN","GITHUB_TOKEN","GIT_ASKPASS","OPENAI_API_KEY","SSH_AUTH_SOCK"}
result["credential_names_absent"]=credential_names.isdisjoint(os.environ)
result["home_isolated"]=os.environ.get("HOME")=="/operation/provider-home"
result["tmp_isolated"]=os.environ.get("TMPDIR")=="/operation/tmp"
sock=socket.socket(socket.AF_INET,socket.SOCK_STREAM); sock.settimeout(0.5)
try: sock.connect(("1.1.1.1",443))
except OSError: result["network_blocked"]=True
finally: sock.close()
print(json.dumps(result,separators=(",",":")))
sys.exit(0 if all(result["allowed_writes"].values()) and all([result["runtime_paths_absent"],result["credential_names_absent"],result["network_blocked"],result["home_isolated"],result["tmp_isolated"]]) else 3)
`;

export const DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS = Object.freeze([
  "timeout",
  "output_limit",
  "invalid_output",
  "nonzero_exit",
] as const);
/**
 * docker-isolationで使用するDynamic Fake Provider 失敗 Scenarioの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider 失敗 ScenarioのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFailureScenarioが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFailureScenarioで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFailureScenarioの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFailureScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFailureScenarioの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderFailureScenario =
  (typeof DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS)[number];

const FAILURE_SCENARIO_SPECS = Object.freeze({
  timeout: Object.freeze({
    source: "import time; time.sleep(2)",
    timeoutMs: 250,
    expectedReason: "docker_isolation_probe_timeout",
  }),
  output_limit: Object.freeze({
    source: "print('x'*70000)",
    timeoutMs: 10_000,
    expectedReason: "docker_isolation_probe_output_too_large",
  }),
  invalid_output: Object.freeze({
    source: "print('not-json')",
    timeoutMs: 10_000,
    expectedReason: "docker_isolation_probe_invalid_output",
  }),
  nonzero_exit: Object.freeze({
    source: "import sys; sys.exit(7)",
    timeoutMs: 10_000,
    expectedReason: "docker_isolation_probe_failed",
  }),
} satisfies Readonly<
  Record<
    DynamicFakeProviderFailureScenario,
    Readonly<{ source: string; timeoutMs: number; expectedReason: string }>
  >
>);

const CANCELLATION_READY_OUTPUT =
  '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}';
const CANCELLATION_ACKNOWLEDGED_OUTPUT =
  '{"marker":"crdd-coordinator-cancellation-v1","state":"cancelled"}';
const CANCELLATION_SOURCE = `
import json, signal, sys, time
marker="crdd-coordinator-cancellation-v1"
def cancelled(_signal,_frame):
    print(json.dumps({"marker":marker,"state":"cancelled"},separators=(",",":")),flush=True)
    sys.exit(42)
signal.signal(signal.SIGTERM,cancelled)
print(json.dumps({"marker":marker,"state":"ready"},separators=(",",":")),flush=True)
while True: time.sleep(0.05)
`;

const repositoryOwnedProbeSources = Object.freeze(
  new Set([
    PROBE_SOURCE,
    ...Object.values(FAILURE_SCENARIO_SPECS).map(
      (specification) => specification.source,
    ),
    CANCELLATION_SOURCE,
  ]),
);

/**
 * filesystem Identityを決定する。
 *
 * @responsibility filesystem Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、expectedType: EntityType
 * @returns FilesystemIdentityを返す。
 * @precondition 「target: string、expectedType: EntityType」がfilesystemIdentityの入力契約を満たす。
 * @postcondition filesystemIdentityの責務を完了した結果だけを返す。
 * @effect filesystemIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure filesystemIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant filesystemIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security filesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: filesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function filesystemIdentity(
  target: string,
  expectedType: EntityType,
): FilesystemIdentity {
  const metadata = fs.lstatSync(target, { bigint: true });
  const isTypeValid =
    expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isTypeValid ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("docker_cli_untrusted");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * serializable Identityを決定する。
 *
 * @responsibility serializable Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、expectedType: EntityType
 * @returns SerializableIdentityを返す。
 * @precondition 「target: string、expectedType: EntityType」がserializableIdentityの入力契約を満たす。
 * @postcondition serializableIdentityの責務を完了した結果だけを返す。
 * @effect N/A: serializableIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: serializableIdentityは独自の失敗分岐を所有しない。
 * @invariant serializableIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: serializableIdentityはProcess内の同一Subsystemで完結する。
 * @security serializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: serializableIdentityは共有非同期状態を持たない同期処理である。
 */
function serializableIdentity(
  target: string,
  expectedType: EntityType = "directory",
): SerializableIdentity {
  const identity = filesystemIdentity(target, expectedType);
  return {
    dev: identity.dev.toString(),
    ino: identity.ino.toString(),
    birthtimeNs: identity.birthtimeNs.toString(),
  };
}

/**
 * identity Matches 記録を決定する。
 *
 * @responsibility identity Matches 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、record: SerializableIdentity、expectedType: EntityType
 * @returns booleanを返す。
 * @precondition 「target: string、record: SerializableIdentity、expectedType: EntityType」がidentityMatchesRecordの入力契約を満たす。
 * @postcondition identityMatchesRecordの責務を完了した結果だけを返す。
 * @effect N/A: identityMatchesRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure identityMatchesRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityMatchesRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityMatchesRecordはProcess内の同一Subsystemで完結する。
 * @security identityMatchesRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityMatchesRecordは共有非同期状態を持たない同期処理である。
 */
function identityMatchesRecord(
  target: string,
  record: SerializableIdentity,
  expectedType: EntityType = "directory",
): boolean {
  try {
    const identity = filesystemIdentity(target, expectedType);
    return (
      identity.dev === BigInt(record.dev) &&
      identity.ino === BigInt(record.ino) &&
      identity.birthtimeNs === BigInt(record.birthtimeNs)
    );
  } catch {
    return false;
  }
}

/**
 * Trusted Docker Cli Capabilityを構築する。
 *
 * @responsibility Trusted Docker Cli Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns Readonly<{ kind: "trusted_docker_cli"; }>を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateTrustedDockerCliCapabilityの入力契約を満たす。
 * @postcondition createTrustedDockerCliCapabilityの責務を完了した結果だけを返す。
 * @effect createTrustedDockerCliCapabilityは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure createTrustedDockerCliCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTrustedDockerCliCapabilityは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createTrustedDockerCliCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createTrustedDockerCliCapabilityは共有非同期状態を持たない同期処理である。
 */
function createTrustedDockerCliCapability(): Readonly<{
  kind: "trusted_docker_cli";
}> {
  if (process.platform !== "win32")
    throw new Error("docker_backend_platform_unsupported");
  let snapshot: DockerCliTrustSnapshot;
  try {
    snapshot = observeTrustedDockerCli();
  } catch {
    throw new Error("docker_cli_untrusted");
  }
  const capability = Object.freeze({ kind: "trusted_docker_cli" });
  cliIdentities.set(capability, snapshot);
  return capability;
}

/**
 * Trusted Docker Cli Capabilityを検証する。
 *
 * @responsibility Trusted Docker Cli Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: object
 * @returns stringを返す。
 * @precondition 「capability: object」がverifyTrustedDockerCliCapabilityの入力契約を満たす。
 * @postcondition verifyTrustedDockerCliCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyTrustedDockerCliCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyTrustedDockerCliCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyTrustedDockerCliCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyTrustedDockerCliCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyTrustedDockerCliCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyTrustedDockerCliCapabilityは共有非同期状態を持たない同期処理である。
 */
function verifyTrustedDockerCliCapability(capability: object): string {
  const snapshot = cliIdentities.get(capability);
  if (!snapshot) throw new Error("docker_cli_untrusted");
  try {
    return verifyTrustedDockerCliSnapshot(snapshot);
  } catch {
    throw new Error("docker_cli_untrusted");
  }
}

/**
 * MountをIdentityへ結合する。
 *
 * @responsibility Mountの結合条件、相関Identity、不一致の拒否境界を所有する。
 * @trace ARCH-000008
 * @input source: string、destination: string
 * @returns stringを返す。
 * @precondition 「source: string、destination: string」がbindMountの入力契約を満たす。
 * @postcondition bindMountの責務を完了した結果だけを返す。
 * @effect N/A: bindMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure bindMountは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant bindMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: bindMountはProcess内の同一Subsystemで完結する。
 * @security bindMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: bindMountは共有非同期状態を持たない同期処理である。
 */
function bindMount(source: string, destination: string): string {
  if (source.includes(",")) throw new Error("docker_mount_path_unsupported");
  return `type=bind,src=${source},dst=${destination}`;
}

/**
 * container Nameを決定する。
 *
 * @responsibility container Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input probeId: string
 * @returns stringを返す。
 * @precondition 「probeId: string」がcontainerNameの入力契約を満たす。
 * @postcondition containerNameの責務を完了した結果だけを返す。
 * @effect N/A: containerNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containerNameは独自の失敗分岐を所有しない。
 * @invariant containerNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containerNameはProcess内の同一Subsystemで完結する。
 * @security containerNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containerNameは共有非同期状態を持たない同期処理である。
 */
function containerName(probeId: string): string {
  return `crdd-coordinator-probe-${probeId}`;
}

/**
 * docker Create Argumentsを決定する。
 *
 * @responsibility docker Create Argumentsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerMounts、probeId: string、source: string
 * @returns string[]を返す。
 * @precondition 「mounts: DockerMounts、probeId: string、source: string」がdockerCreateArgumentsの入力契約を満たす。
 * @postcondition dockerCreateArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: dockerCreateArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerCreateArgumentsは独自の失敗分岐を所有しない。
 * @invariant dockerCreateArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dockerCreateArgumentsはProcess内の同一Subsystemで完結する。
 * @security dockerCreateArgumentsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerCreateArgumentsは共有非同期状態を持たない同期処理である。
 */
function dockerCreateArguments(
  mounts: DockerMounts,
  probeId: string,
  source: string,
): string[] {
  return [
    "-H",
    DOCKER_DESKTOP_ENGINE,
    "create",
    "--pull=never",
    "--network=none",
    "--read-only",
    "--name",
    containerName(probeId),
    "--label",
    `${OWNERSHIP_LABEL}=${probeId}`,
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=64",
    "--user=65532:65532",
    "--workdir=/operation/workspace",
    "--env",
    "HOME=/operation/provider-home",
    "--env",
    "TMPDIR=/operation/tmp",
    "--mount",
    bindMount(mounts.workspace, "/operation/workspace"),
    "--mount",
    bindMount(mounts.providerHome, "/operation/provider-home"),
    "--mount",
    bindMount(mounts.tmp, "/operation/tmp"),
    "--entrypoint",
    "python",
    PROBE_IMAGE,
    "-c",
    source,
  ];
}

/**
 * docker Create Arguments For Fixtureを決定する。
 *
 * @responsibility docker Create Arguments For Fixtureの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerMounts、probeId
 * @returns string[]を返す。
 * @precondition 「mounts: DockerMounts、probeId」がdockerCreateArgumentsForFixtureの入力契約を満たす。
 * @postcondition dockerCreateArgumentsForFixtureの責務を完了した結果だけを返す。
 * @effect N/A: dockerCreateArgumentsForFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerCreateArgumentsForFixtureは独自の失敗分岐を所有しない。
 * @invariant dockerCreateArgumentsForFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dockerCreateArgumentsForFixtureはProcess内の同一Subsystemで完結する。
 * @security dockerCreateArgumentsForFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerCreateArgumentsForFixtureは共有非同期状態を持たない同期処理である。
 */
export function dockerCreateArgumentsForFixture(
  mounts: DockerMounts,
  probeId = "fixture",
): string[] {
  return dockerCreateArguments(mounts, probeId, PROBE_SOURCE);
}

/**
 * docker Create Arguments For 失敗 Verification Fixtureを決定する。
 *
 * @responsibility docker Create Arguments For 失敗 Verification Fixtureの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerMounts、scenario: DynamicFakeProviderFailureScenario、probeId
 * @returns string[]を返す。
 * @precondition 「mounts: DockerMounts、scenario: DynamicFakeProviderFailureScenario、probeId」がdockerCreateArgumentsForFailureVerificationFixtureの入力契約を満たす。
 * @postcondition dockerCreateArgumentsForFailureVerificationFixtureの責務を完了した結果だけを返す。
 * @effect N/A: dockerCreateArgumentsForFailureVerificationFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerCreateArgumentsForFailureVerificationFixtureは独自の失敗分岐を所有しない。
 * @invariant dockerCreateArgumentsForFailureVerificationFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dockerCreateArgumentsForFailureVerificationFixtureはProcess内の同一Subsystemで完結する。
 * @security dockerCreateArgumentsForFailureVerificationFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerCreateArgumentsForFailureVerificationFixtureは共有非同期状態を持たない同期処理である。
 */
export function dockerCreateArgumentsForFailureVerificationFixture(
  mounts: DockerMounts,
  scenario: DynamicFakeProviderFailureScenario,
  probeId = "fixture",
): string[] {
  return dockerCreateArguments(
    mounts,
    probeId,
    FAILURE_SCENARIO_SPECS[scenario].source,
  );
}

/**
 * docker Create Arguments For Cancellation Verification Fixtureを決定する。
 *
 * @responsibility docker Create Arguments For Cancellation Verification Fixtureの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerMounts、probeId
 * @returns string[]を返す。
 * @precondition 「mounts: DockerMounts、probeId」がdockerCreateArgumentsForCancellationVerificationFixtureの入力契約を満たす。
 * @postcondition dockerCreateArgumentsForCancellationVerificationFixtureの責務を完了した結果だけを返す。
 * @effect N/A: dockerCreateArgumentsForCancellationVerificationFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerCreateArgumentsForCancellationVerificationFixtureは独自の失敗分岐を所有しない。
 * @invariant dockerCreateArgumentsForCancellationVerificationFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dockerCreateArgumentsForCancellationVerificationFixtureはProcess内の同一Subsystemで完結する。
 * @security dockerCreateArgumentsForCancellationVerificationFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerCreateArgumentsForCancellationVerificationFixtureは共有非同期状態を持たない同期処理である。
 */
export function dockerCreateArgumentsForCancellationVerificationFixture(
  mounts: DockerMounts,
  probeId = "fixture",
): string[] {
  return dockerCreateArguments(mounts, probeId, CANCELLATION_SOURCE);
}

/**
 * Docker Isolation 結果を固定Schemaへ正規化する。
 *
 * @responsibility Docker Isolation 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution
 * @returns Readonly<{ status: "confirmed" | "blocked"; reason: string }>を返す。
 * @precondition 「execution: DockerExecution」がnormalizeDockerIsolationResultの入力契約を満たす。
 * @postcondition normalizeDockerIsolationResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDockerIsolationResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeDockerIsolationResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeDockerIsolationResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDockerIsolationResultはProcess内の同一Subsystemで完結する。
 * @security normalizeDockerIsolationResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDockerIsolationResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeDockerIsolationResult(
  execution: DockerExecution,
): Readonly<{ status: "confirmed" | "blocked"; reason: string }> {
  if (errorCodeEquals(execution.error, "ETIMEDOUT"))
    return { status: "blocked", reason: "docker_isolation_probe_timeout" };
  if (errorCodeEquals(execution.error, "ENOBUFS"))
    return {
      status: "blocked",
      reason: "docker_isolation_probe_output_too_large",
    };
  if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string"
  )
    return { status: "blocked", reason: "docker_isolation_probe_failed" };
  if (Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES)
    return {
      status: "blocked",
      reason: "docker_isolation_probe_output_too_large",
    };
  let parsed: unknown;
  try {
    parsed = JSON.parse(execution.stdout.trim());
  } catch {
    return {
      status: "blocked",
      reason: "docker_isolation_probe_invalid_output",
    };
  }
  const result = snapshotPlainRecord(
    parsed,
    new Set([
      "marker",
      "allowed_writes",
      "runtime_paths_absent",
      "credential_names_absent",
      "network_blocked",
      "home_isolated",
      "tmp_isolated",
    ]),
  );
  const allowedWrites = result
    ? snapshotPlainRecord(
        result.allowed_writes,
        new Set(["workspace", "provider-home", "tmp"]),
      )
    : null;
  const isValid =
    result?.marker === PROBE_MARKER &&
    allowedWrites?.workspace === true &&
    allowedWrites?.["provider-home"] === true &&
    allowedWrites?.tmp === true &&
    result.runtime_paths_absent === true &&
    result.credential_names_absent === true &&
    result.network_blocked === true &&
    result.home_isolated === true &&
    result.tmp_isolated === true;
  return isValid
    ? {
        status: "confirmed",
        reason: "docker_fake_provider_isolation_confirmed",
      }
    : { status: "blocked", reason: "docker_isolation_probe_assertion_failed" };
}

/**
 * error Code Equalsを決定する。
 *
 * @responsibility error Code Equalsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、expected: string
 * @returns booleanを返す。
 * @precondition 「error: unknown、expected: string」がerrorCodeEqualsの入力契約を満たす。
 * @postcondition errorCodeEqualsの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeEqualsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeEqualsは独自の失敗分岐を所有しない。
 * @invariant errorCodeEqualsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeEqualsはProcess内の同一Subsystemで完結する。
 * @security errorCodeEqualsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeEqualsは共有非同期状態を持たない同期処理である。
 */
function errorCodeEquals(error: unknown, expected: string): boolean {
  return errorCode(error) === expected;
}

/**
 * dynamic Fake Lifecycle Blockedを決定する。
 *
 * @responsibility dynamic Fake Lifecycle Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: string
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「reason: string」がdynamicFakeLifecycleBlockedの入力契約を満たす。
 * @postcondition dynamicFakeLifecycleBlockedの責務を完了した結果だけを返す。
 * @effect N/A: dynamicFakeLifecycleBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dynamicFakeLifecycleBlockedは独自の失敗分岐を所有しない。
 * @invariant dynamicFakeLifecycleBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dynamicFakeLifecycleBlockedはProcess内の同一Subsystemで完結する。
 * @security dynamicFakeLifecycleBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dynamicFakeLifecycleBlockedは共有非同期状態を持たない同期処理である。
 */
function dynamicFakeLifecycleBlocked(
  reason: string,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    status: "blocked",
    reason,
    provenance: "repository_owned_docker_fake_provider",
    fakeProviderStartAttempted: false,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    containerAbsenceVerified: false,
    processTreeAbsenceVerified: false,
    hostCleanupVerified: false,
    elapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    timedOut: false,
    cancellationRequested: false,
    cancellationObservation: "not_implemented",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

/**
 * Dynamic Fake Provider Lifecycle For Fixtureを固定Schemaへ正規化する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle For Fixtureの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution、elapsedMs: number
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「execution: DockerExecution、elapsedMs: number」がnormalizeDynamicFakeProviderLifecycleForFixtureの入力契約を満たす。
 * @postcondition normalizeDynamicFakeProviderLifecycleForFixtureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDynamicFakeProviderLifecycleForFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeDynamicFakeProviderLifecycleForFixtureは独自の失敗分岐を所有しない。
 * @invariant normalizeDynamicFakeProviderLifecycleForFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDynamicFakeProviderLifecycleForFixtureはProcess内の同一Subsystemで完結する。
 * @security normalizeDynamicFakeProviderLifecycleForFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDynamicFakeProviderLifecycleForFixtureは共有非同期状態を持たない同期処理である。
 */
export function normalizeDynamicFakeProviderLifecycleForFixture(
  execution: DockerExecution,
  elapsedMs: number,
): DynamicFakeProviderLifecycleObservation {
  const stdoutBytes =
    typeof execution.stdout === "string"
      ? Buffer.byteLength(execution.stdout, "utf8")
      : 0;
  const stderrBytes =
    typeof execution.stderr === "string"
      ? Buffer.byteLength(execution.stderr, "utf8")
      : 0;
  const hasTimedOut = errorCodeEquals(execution.error, "ETIMEDOUT");
  const hasOutputExceeded = errorCodeEquals(execution.error, "ENOBUFS");
  const hasValidElapsed =
    Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 30_000;
  const hasExactExecutionEnvelope =
    !execution.error &&
    execution.status === 0 &&
    (execution.signal === null || execution.signal === undefined) &&
    typeof execution.stdout === "string" &&
    typeof execution.stderr === "string" &&
    stdoutBytes <= MAX_OUTPUT_BYTES &&
    stderrBytes <= MAX_OUTPUT_BYTES;
  const normalized = normalizeDockerIsolationResult(execution);
  const reason = hasTimedOut
    ? "dynamic_fake_provider_deadline_exceeded"
    : hasOutputExceeded
      ? "dynamic_fake_provider_output_limit_exceeded"
      : !hasValidElapsed
        ? "dynamic_fake_provider_elapsed_invalid"
        : !hasExactExecutionEnvelope
          ? "dynamic_fake_provider_execution_envelope_invalid"
          : normalized.status === "confirmed"
            ? "dynamic_fake_provider_result_observed"
            : normalized.reason;
  return Object.freeze({
    ...dynamicFakeLifecycleBlocked(reason),
    status:
      hasValidElapsed &&
      hasExactExecutionEnvelope &&
      normalized.status === "confirmed"
        ? "candidate"
        : "blocked",
    provenance: "untrusted_execution_fixture",
    fakeProviderStartAttempted: true,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    elapsedMs: hasValidElapsed ? elapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
    timedOut: hasTimedOut,
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
  });
}

/**
 * cancellation Blockedを決定する。
 *
 * @responsibility cancellation Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: string
 * @returns DynamicFakeProviderCancellationResultを返す。
 * @precondition 「reason: string」がcancellationBlockedの入力契約を満たす。
 * @postcondition cancellationBlockedの責務を完了した結果だけを返す。
 * @effect N/A: cancellationBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancellationBlockedは独自の失敗分岐を所有しない。
 * @invariant cancellationBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancellationBlockedはProcess内の同一Subsystemで完結する。
 * @security cancellationBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancellationBlockedは共有非同期状態を持たない同期処理である。
 */
function cancellationBlocked(
  reason: string,
): DynamicFakeProviderCancellationResult {
  return Object.freeze({
    status: "blocked",
    reason,
    cancellationRequested: false,
    cancellationSignalRequested: null,
    readyObserved: false,
    cancellationAcknowledged: false,
    processTerminationObserved: false,
    attachProcessTerminationObserved: false,
    attachProcessTerminationRequestCount: 0,
    containerAbsenceVerified: false,
    hostCleanupVerified: false,
    graceElapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    retainOperationDirectories: false,
    recoveryId: null,
    manualRecoveryRequired: false,
    cleanup: "not_required_or_confirmed",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

/**
 * Cancellation 失敗を固定Schemaへ正規化する。
 *
 * @responsibility Cancellation 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns stringを返す。
 * @precondition 「error: unknown」がnormalizeCancellationFailureの入力契約を満たす。
 * @postcondition normalizeCancellationFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeCancellationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeCancellationFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeCancellationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeCancellationFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeCancellationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeCancellationFailureは共有非同期状態を持たない同期処理である。
 */
function normalizeCancellationFailure(error: unknown): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_container_identity_unknown",
    "docker_container_security_profile_mismatch",
    "dynamic_fake_provider_cancellation_ready_unconfirmed",
    "dynamic_fake_provider_cancellation_not_requested",
    "dynamic_fake_provider_cancellation_grace_exceeded",
    "dynamic_fake_provider_cancellation_acknowledgement_invalid",
    "dynamic_fake_provider_cancellation_termination_invalid",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = errorMessage(error);
  return message && known.has(message)
    ? message
    : "dynamic_fake_provider_cancellation_verification_failed";
}

/**
 * Dynamic Fake Provider Cancellation For Fixtureを固定Schemaへ正規化する。
 *
 * @responsibility Dynamic Fake Provider Cancellation For Fixtureの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution、graceElapsedMs: number、isCancellationRequested: boolean
 * @returns DynamicFakeProviderCancellationResultを返す。
 * @precondition 「execution: DockerExecution、graceElapsedMs: number、isCancellationRequested: boolean」がnormalizeDynamicFakeProviderCancellationForFixtureの入力契約を満たす。
 * @postcondition normalizeDynamicFakeProviderCancellationForFixtureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDynamicFakeProviderCancellationForFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeDynamicFakeProviderCancellationForFixtureは独自の失敗分岐を所有しない。
 * @invariant normalizeDynamicFakeProviderCancellationForFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDynamicFakeProviderCancellationForFixtureはProcess内の同一Subsystemで完結する。
 * @security normalizeDynamicFakeProviderCancellationForFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDynamicFakeProviderCancellationForFixtureは共有非同期状態を持たない同期処理である。
 */
export function normalizeDynamicFakeProviderCancellationForFixture(
  execution: DockerExecution,
  graceElapsedMs: number,
  isCancellationRequested: boolean,
): DynamicFakeProviderCancellationResult {
  const stdout = typeof execution.stdout === "string" ? execution.stdout : "";
  const stderr = typeof execution.stderr === "string" ? execution.stderr : "";
  const stdoutBytes = Buffer.byteLength(stdout, "utf8");
  const stderrBytes = Buffer.byteLength(stderr, "utf8");
  const hasValidGrace =
    Number.isSafeInteger(graceElapsedMs) &&
    graceElapsedMs >= 0 &&
    graceElapsedMs <= 5_000;
  const hasExactOutput =
    stdout ===
      `${CANCELLATION_READY_OUTPUT}\n${CANCELLATION_ACKNOWLEDGED_OUTPUT}\n` &&
    stderr === "" &&
    stdoutBytes <= MAX_OUTPUT_BYTES &&
    stderrBytes <= MAX_OUTPUT_BYTES;
  const hasExactTermination =
    !execution.error &&
    execution.status === 42 &&
    (execution.signal === null || execution.signal === undefined);
  const isCandidate =
    isCancellationRequested &&
    hasValidGrace &&
    hasExactOutput &&
    hasExactTermination;
  return Object.freeze({
    ...cancellationBlocked(
      isCandidate
        ? "dynamic_fake_provider_cancellation_candidate"
        : !isCancellationRequested
          ? "dynamic_fake_provider_cancellation_not_requested"
          : !hasValidGrace
            ? "dynamic_fake_provider_cancellation_grace_exceeded"
            : !hasExactOutput
              ? "dynamic_fake_provider_cancellation_acknowledgement_invalid"
              : "dynamic_fake_provider_cancellation_termination_invalid",
    ),
    status: isCandidate ? "candidate" : "blocked",
    cancellationRequested: isCancellationRequested,
    cancellationSignalRequested: isCancellationRequested ? "SIGTERM" : null,
    readyObserved: stdout.startsWith(`${CANCELLATION_READY_OUTPUT}\n`),
    cancellationAcknowledged: isCandidate,
    processTerminationObserved: isCandidate,
    graceElapsedMs: hasValidGrace ? graceElapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
  });
}

/**
 * Dynamic Fake Provider Lifecycle Capabilityを構築する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution、elapsedMs: number、context: Readonly<{ probeId: string; containerId: string; mountCapability: object; hostRecoveryId: string; }>
 * @returns Readonly<{ kind: "dynamic_fake_provider_lifecycle" }>を返す。
 * @precondition 「execution: DockerExecution、elapsedMs: number、context: Readonly<{ probeId: string; containerId: string; mountCapability: object; hostRecoveryId: string; }>」がcreateDynamicFakeProviderLifecycleCapabilityの入力契約を満たす。
 * @postcondition createDynamicFakeProviderLifecycleCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createDynamicFakeProviderLifecycleCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDynamicFakeProviderLifecycleCapabilityは独自の失敗分岐を所有しない。
 * @invariant createDynamicFakeProviderLifecycleCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDynamicFakeProviderLifecycleCapabilityはProcess内の同一Subsystemで完結する。
 * @security createDynamicFakeProviderLifecycleCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDynamicFakeProviderLifecycleCapabilityは共有非同期状態を持たない同期処理である。
 */
function createDynamicFakeProviderLifecycleCapability(
  execution: DockerExecution,
  elapsedMs: number,
  context: Readonly<{
    probeId: string;
    containerId: string;
    mountCapability: object;
    hostRecoveryId: string;
  }>,
): Readonly<{ kind: "dynamic_fake_provider_lifecycle" }> {
  const normalized = normalizeDynamicFakeProviderLifecycleForFixture(
    execution,
    elapsedMs,
  );
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_lifecycle" as const,
  });
  pendingDynamicLifecycleObservations.set(
    capability,
    Object.freeze({
      observation: Object.freeze({
        ...normalized,
        provenance: "repository_owned_docker_fake_provider",
        fakeProviderExecuted: false,
        resultNormalizationVerified: false,
        diagnosticDockerContainerEffectIssued: true,
        diagnosticFilesystemEffectIssued: true,
      }),
      ...context,
    }),
  );
  return capability;
}

/**
 * docker-isolationで使用するDynamic Fake Provider Finalization Eligibilityの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Finalization EligibilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFinalizationEligibilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFinalizationEligibilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFinalizationEligibilityの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFinalizationEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFinalizationEligibilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderFinalizationEligibility = Readonly<{
  hasRepositoryOwnedProvenance: boolean;
  hasExactResult: boolean;
  hasValidElapsed: boolean;
  hasPostRunMountIdentity: boolean;
  hasContainerAbsence: boolean;
  hasHostCleanup: boolean;
  hasMatchingRunIdentity: boolean;
}>;

/**
 * Dynamic Fake Provider Finalizationを評価する。
 *
 * @responsibility Dynamic Fake Provider Finalizationの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input input: DynamicFakeProviderFinalizationEligibility
 * @returns evaluateDynamicFakeProviderFinalizationの計算結果を返す。
 * @precondition 「input: DynamicFakeProviderFinalizationEligibility」がevaluateDynamicFakeProviderFinalizationの入力契約を満たす。
 * @postcondition evaluateDynamicFakeProviderFinalizationの責務を完了した結果だけを返す。
 * @effect N/A: evaluateDynamicFakeProviderFinalizationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateDynamicFakeProviderFinalizationは独自の失敗分岐を所有しない。
 * @invariant evaluateDynamicFakeProviderFinalizationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateDynamicFakeProviderFinalizationはProcess内の同一Subsystemで完結する。
 * @security evaluateDynamicFakeProviderFinalizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateDynamicFakeProviderFinalizationは共有非同期状態を持たない同期処理である。
 */
function evaluateDynamicFakeProviderFinalization(
  input: DynamicFakeProviderFinalizationEligibility,
) {
  const isEligible =
    input.hasRepositoryOwnedProvenance &&
    input.hasExactResult &&
    input.hasValidElapsed &&
    input.hasPostRunMountIdentity &&
    input.hasContainerAbsence &&
    input.hasHostCleanup &&
    input.hasMatchingRunIdentity;
  return Object.freeze({
    status: isEligible ? ("candidate" as const) : ("blocked" as const),
    reason: isEligible
      ? "dynamic_fake_provider_finalization_candidate"
      : "dynamic_fake_provider_finalization_incomplete",
    observationAuthority: false,
  });
}

/**
 * Dynamic Fake Provider Finalization For Fixtureを評価する。
 *
 * @responsibility Dynamic Fake Provider Finalization For Fixtureの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input input: DynamicFakeProviderFinalizationEligibility
 * @returns evaluateDynamicFakeProviderFinalizationForFixtureの計算結果を返す。
 * @precondition 「input: DynamicFakeProviderFinalizationEligibility」がevaluateDynamicFakeProviderFinalizationForFixtureの入力契約を満たす。
 * @postcondition evaluateDynamicFakeProviderFinalizationForFixtureの責務を完了した結果だけを返す。
 * @effect N/A: evaluateDynamicFakeProviderFinalizationForFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateDynamicFakeProviderFinalizationForFixtureは独自の失敗分岐を所有しない。
 * @invariant evaluateDynamicFakeProviderFinalizationForFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateDynamicFakeProviderFinalizationForFixtureはProcess内の同一Subsystemで完結する。
 * @security evaluateDynamicFakeProviderFinalizationForFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateDynamicFakeProviderFinalizationForFixtureは共有非同期状態を持たない同期処理である。
 */
export function evaluateDynamicFakeProviderFinalizationForFixture(
  input: DynamicFakeProviderFinalizationEligibility,
) {
  return evaluateDynamicFakeProviderFinalization(input);
}

/**
 * Dynamic Fake Provider Finalization Capabilityを構築する。
 *
 * @responsibility Dynamic Fake Provider Finalization Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input pendingCapability: object、context: Omit<DynamicFakeProviderFinalization, "pendingCapability">
 * @returns Readonly<{ kind: "dynamic_fake_provider_finalization" }>を返す。
 * @precondition 「pendingCapability: object、context: Omit<DynamicFakeProviderFinalization, "pendingCapability">」がcreateDynamicFakeProviderFinalizationCapabilityの入力契約を満たす。
 * @postcondition createDynamicFakeProviderFinalizationCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createDynamicFakeProviderFinalizationCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDynamicFakeProviderFinalizationCapabilityは独自の失敗分岐を所有しない。
 * @invariant createDynamicFakeProviderFinalizationCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDynamicFakeProviderFinalizationCapabilityはProcess内の同一Subsystemで完結する。
 * @security createDynamicFakeProviderFinalizationCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDynamicFakeProviderFinalizationCapabilityは共有非同期状態を持たない同期処理である。
 */
function createDynamicFakeProviderFinalizationCapability(
  pendingCapability: object,
  context: Omit<DynamicFakeProviderFinalization, "pendingCapability">,
): Readonly<{ kind: "dynamic_fake_provider_finalization" }> {
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_finalization" as const,
  });
  dynamicLifecycleFinalizations.set(
    capability,
    Object.freeze({ pendingCapability, ...context }),
  );
  return capability;
}

/**
 * invalidate Dynamic Fake Provider Lifecycleを決定する。
 *
 * @responsibility invalidate Dynamic Fake Provider Lifecycleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input capability: object | null
 * @returns N/A: invalidateDynamicFakeProviderLifecycleは戻り値を返さない。
 * @precondition 「capability: object | null」がinvalidateDynamicFakeProviderLifecycleの入力契約を満たす。
 * @postcondition invalidateDynamicFakeProviderLifecycleの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: invalidateDynamicFakeProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: invalidateDynamicFakeProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant invalidateDynamicFakeProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: invalidateDynamicFakeProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security invalidateDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: invalidateDynamicFakeProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
function invalidateDynamicFakeProviderLifecycle(capability: object | null) {
  if (capability) pendingDynamicLifecycleObservations.delete(capability);
}

/**
 * finalize Dynamic Fake Provider Lifecycleを決定する。
 *
 * @responsibility finalize Dynamic Fake Provider Lifecycleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input pendingCapability: object、finalizationCapability: object
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「pendingCapability: object、finalizationCapability: object」がfinalizeDynamicFakeProviderLifecycleの入力契約を満たす。
 * @postcondition finalizeDynamicFakeProviderLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: finalizeDynamicFakeProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finalizeDynamicFakeProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant finalizeDynamicFakeProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalizeDynamicFakeProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security finalizeDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalizeDynamicFakeProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
function finalizeDynamicFakeProviderLifecycle(
  pendingCapability: object,
  finalizationCapability: object,
): DynamicFakeProviderLifecycleObservation {
  const pending = pendingDynamicLifecycleObservations.get(pendingCapability);
  const finalization = dynamicLifecycleFinalizations.get(
    finalizationCapability,
  );
  pendingDynamicLifecycleObservations.delete(pendingCapability);
  dynamicLifecycleFinalizations.delete(finalizationCapability);
  const absence = finalization
    ? dynamicLifecycleAbsences.get(finalization.absenceCapability)
    : null;
  const hostCleanup = finalization
    ? dynamicLifecycleHostCleanups.get(finalization.hostCleanupCapability)
    : null;
  if (finalization) {
    dynamicLifecycleAbsences.delete(finalization.absenceCapability);
    dynamicLifecycleHostCleanups.delete(finalization.hostCleanupCapability);
  }
  if (!pending || !finalization || !absence || !hostCleanup)
    return dynamicFakeLifecycleBlocked(
      "dynamic_fake_provider_provenance_unverified",
    );
  const eligibility = evaluateDynamicFakeProviderFinalization({
    hasRepositoryOwnedProvenance:
      pending.observation.provenance ===
      "repository_owned_docker_fake_provider",
    hasExactResult: pending.observation.status === "candidate",
    hasValidElapsed:
      typeof pending.observation.elapsedMs === "number" &&
      Number.isSafeInteger(pending.observation.elapsedMs) &&
      pending.observation.elapsedMs >= 0 &&
      pending.observation.elapsedMs <= 30_000,
    hasPostRunMountIdentity:
      pending.mountCapability === finalization.mountCapability,
    hasContainerAbsence:
      absence.probeId === pending.probeId &&
      absence.containerId === pending.containerId &&
      absence.initialHostRecoveryId === pending.hostRecoveryId &&
      absence.confirmedHostRecoveryId !== absence.initialHostRecoveryId,
    hasHostCleanup:
      hostCleanup.probeId === pending.probeId &&
      hostCleanup.confirmedHostRecoveryId === absence.confirmedHostRecoveryId &&
      hostCleanup.absenceCapability === finalization.absenceCapability,
    hasMatchingRunIdentity:
      finalization.pendingCapability === pendingCapability &&
      pending.probeId === finalization.probeId &&
      pending.containerId === finalization.containerId,
  });
  if (eligibility.status !== "candidate")
    return Object.freeze({
      ...pending.observation,
      status: "blocked",
      reason: eligibility.reason,
    });
  return Object.freeze({
    ...pending.observation,
    status: "verified",
    fakeProviderExecuted: true,
    resultNormalizationVerified: true,
    containerAbsenceVerified: true,
    processTreeAbsenceVerified: true,
    hostCleanupVerified: true,
  });
}

/**
 * docker Environmentを決定する。
 *
 * @responsibility docker Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input management: string
 * @returns DockerEnvironmentを返す。
 * @precondition 「management: string」がdockerEnvironmentの入力契約を満たす。
 * @postcondition dockerEnvironmentの責務を完了した結果だけを返す。
 * @effect dockerEnvironmentはFilesystemの読取りまたは書込みを実行する。
 * @failure dockerEnvironmentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant dockerEnvironmentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security dockerEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerEnvironmentは共有非同期状態を持たない同期処理である。
 */
function dockerEnvironment(management: string): DockerEnvironment {
  const dockerConfig = path.join(management, "docker-config");
  const dockerHome = path.join(management, "docker-home");
  fs.mkdirSync(dockerConfig, { recursive: true });
  fs.mkdirSync(dockerHome, { recursive: true });
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig,
    dockerHome,
  });
  if (!environment) throw new Error("docker_runtime_environment_unavailable");
  return environment;
}

/**
 * Docker Isolation 回復 Tokenを表示形式へ整形する。
 *
 * @responsibility Docker Isolation 回復 Tokenの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000008
 * @input rootName: string、probeId: string、nonce: string、recordHash: string
 * @returns stringを返す。
 * @precondition 「rootName: string、probeId: string、nonce: string、recordHash: string」がformatDockerIsolationRecoveryTokenの入力契約を満たす。
 * @postcondition formatDockerIsolationRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: formatDockerIsolationRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: formatDockerIsolationRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant formatDockerIsolationRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: formatDockerIsolationRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security formatDockerIsolationRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: formatDockerIsolationRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function formatDockerIsolationRecoveryToken(
  rootName: string,
  probeId: string,
  nonce: string,
  recordHash: string,
): string {
  return `docker.${rootName}.${probeId}.${nonce}.${recordHash}`;
}

/**
 * Host 回復 状態を状態遷移させる。
 *
 * @responsibility Host 回復 状態の遷移前提、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、expectedState: string、nextState: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、expectedState: string、nextState: string、mountCapability: unknown」がtransitionHostRecoveryStateの入力契約を満たす。
 * @postcondition transitionHostRecoveryStateの責務を完了した結果だけを返す。
 * @effect transitionHostRecoveryStateはFilesystemの読取りまたは書込みを実行する。
 * @failure transitionHostRecoveryStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant transitionHostRecoveryStateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security transitionHostRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: transitionHostRecoveryStateは共有非同期状態を持たない同期処理である。
 */
function transitionHostRecoveryState(
  hostRecoveryId: string,
  expectedState: string,
  nextState: string,
  mountCapability: unknown,
): string {
  if (
    expectedState === "host_only" &&
    nextState === "docker_submission_started"
  )
    return transitionOwnedDockerSubmissionState(
      mountCapability,
      hostRecoveryId,
      "begin",
    );
  if (
    expectedState === "docker_submission_started" &&
    nextState === "host_only"
  )
    return transitionOwnedDockerSubmissionState(
      mountCapability,
      hostRecoveryId,
      "cancel",
    );
  if (
    expectedState !== "docker_submission_started" ||
    nextState !== "docker_absent_confirmed"
  )
    throw new Error("host_recovery_state_invalid");
  const loaded = loadHostRecoveryRecordByToken(hostRecoveryId);
  if (loaded.record.state !== expectedState)
    throw new Error("host_recovery_state_invalid");
  const updated = { ...loaded.record, state: nextState };
  const serialized = `${JSON.stringify(updated)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, loaded.marker);
  const updatedToken = formatHostRecoveryToken(
    loaded.parsed.rootName,
    loaded.parsed.nonce,
    recordHash,
  );
  if (mountCapability !== null)
    adoptOwnedHostRecoveryRecordTransition(
      mountCapability,
      hostRecoveryId,
      updatedToken,
    );
  return updatedToken;
}

/**
 * Docker Submissionを開始する。
 *
 * @responsibility Docker Submissionの開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown」がbeginDockerSubmissionの入力契約を満たす。
 * @postcondition beginDockerSubmissionの責務を完了した結果だけを返す。
 * @effect N/A: beginDockerSubmissionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: beginDockerSubmissionは独自の失敗分岐を所有しない。
 * @invariant beginDockerSubmissionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginDockerSubmissionはProcess内の同一Subsystemで完結する。
 * @security beginDockerSubmissionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginDockerSubmissionは共有非同期状態を持たない同期処理である。
 */
function beginDockerSubmission(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "host_only",
    "docker_submission_started",
    mountCapability,
  );
}

/**
 * Docker Submission Before Createを取り消す。
 *
 * @responsibility Docker Submission Before Createの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown」がcancelDockerSubmissionBeforeCreateの入力契約を満たす。
 * @postcondition cancelDockerSubmissionBeforeCreateの責務を完了した結果だけを返す。
 * @effect N/A: cancelDockerSubmissionBeforeCreateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelDockerSubmissionBeforeCreateは独自の失敗分岐を所有しない。
 * @invariant cancelDockerSubmissionBeforeCreateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelDockerSubmissionBeforeCreateはProcess内の同一Subsystemで完結する。
 * @security cancelDockerSubmissionBeforeCreateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelDockerSubmissionBeforeCreateは共有非同期状態を持たない同期処理である。
 */
function cancelDockerSubmissionBeforeCreate(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "host_only",
    mountCapability,
  );
}

/**
 * Docker Absenceを確認する。
 *
 * @responsibility Docker Absenceの確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown、capability: unknown、expected: Readonly<{ probeId: string; id: string; rootName: string; cli: object; }>
 * @returns Readonly<{ hostRecoveryId: string; lifecycleAbsenceCapability: object; }>を返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown、capability: unknown、expected: Readonly<{ probeId: string; id: string; rootName: string; cli: object; }>」がconfirmDockerAbsenceの入力契約を満たす。
 * @postcondition confirmDockerAbsenceの責務を完了した結果だけを返す。
 * @effect N/A: confirmDockerAbsenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure confirmDockerAbsenceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmDockerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmDockerAbsenceはProcess内の同一Subsystemで完結する。
 * @security confirmDockerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmDockerAbsenceは共有非同期状態を持たない同期処理である。
 */
function confirmDockerAbsence(
  hostRecoveryId: string,
  mountCapability: unknown,
  capability: unknown,
  expected: Readonly<{
    probeId: string;
    id: string;
    rootName: string;
    cli: object;
  }>,
): Readonly<{
  hostRecoveryId: string;
  lifecycleAbsenceCapability: object;
}> {
  const observation = isObject(capability)
    ? (absenceCapabilities.get(capability) ?? null)
    : null;
  if (
    !observation ||
    observation.hostRecoveryId !== hostRecoveryId ||
    observation.probeId !== expected.probeId ||
    observation.containerId !== expected.id ||
    observation.rootName !== expected.rootName ||
    observation.cli !== expected.cli
  )
    throw new Error("docker_absence_capability_required");
  const updated = transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "docker_absent_confirmed",
    mountCapability,
  );
  if (isObject(capability)) absenceCapabilities.delete(capability);
  const lifecycleAbsenceCapability = Object.freeze({
    kind: "dynamic_fake_provider_absence",
  });
  dynamicLifecycleAbsences.set(
    lifecycleAbsenceCapability,
    Object.freeze({
      probeId: expected.probeId,
      containerId: expected.id,
      initialHostRecoveryId: hostRecoveryId,
      confirmedHostRecoveryId: updated,
    }),
  );
  return Object.freeze({
    hostRecoveryId: updated,
    lifecycleAbsenceCapability,
  });
}

/**
 * recovery 記録 Pathを決定する。
 *
 * @responsibility recovery 記録 Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input management: string
 * @returns stringを返す。
 * @precondition 「management: string」がrecoveryRecordPathの入力契約を満たす。
 * @postcondition recoveryRecordPathの責務を完了した結果だけを返す。
 * @effect N/A: recoveryRecordPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryRecordPathは独自の失敗分岐を所有しない。
 * @invariant recoveryRecordPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryRecordPathはProcess内の同一Subsystemで完結する。
 * @security recoveryRecordPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryRecordPathは共有非同期状態を持たない同期処理である。
 */
function recoveryRecordPath(management: string): string {
  return path.join(management, RECOVERY_FILE);
}

/**
 * 回復 記録を書き込む。
 *
 * @responsibility 回復 記録の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerMounts、probeId: string、nonce: string、hostRecoveryId: string、containerId: string | null
 * @returns stringを返す。
 * @precondition 「mounts: DockerMounts、probeId: string、nonce: string、hostRecoveryId: string、containerId: string | null」がwriteRecoveryRecordの入力契約を満たす。
 * @postcondition writeRecoveryRecordの責務を完了した結果だけを返す。
 * @effect writeRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure writeRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function writeRecoveryRecord(
  mounts: DockerMounts,
  probeId: string,
  nonce: string,
  hostRecoveryId: string,
  containerId: string | null = null,
): string {
  const root = path.dirname(mounts.management);
  const rootName = path.basename(root);
  if (
    !rootName.startsWith(OPERATION_PREFIX) ||
    fs.realpathSync(path.dirname(root)) !== fs.realpathSync(os.tmpdir())
  )
    throw new Error("docker_recovery_boundary_failed");
  const record = {
    schema: "crdd-coordinator-docker-recovery/v1",
    probeId,
    nonceHash: createHash("sha256").update(nonce).digest("hex"),
    rootName,
    rootIdentity: serializableIdentity(root),
    childIdentities: {
      workspace: serializableIdentity(mounts.workspace),
      "provider-home": serializableIdentity(mounts.providerHome),
      tmp: serializableIdentity(mounts.tmp),
      events: serializableIdentity(mounts.events),
      projection: serializableIdentity(mounts.projection),
      management: serializableIdentity(mounts.management),
    },
    container: {
      id: containerId,
      name: containerName(probeId),
      label: `${OWNERSHIP_LABEL}=${probeId}`,
    },
    engine: "docker_desktop_linux_named_pipe",
    image: PROBE_IMAGE,
    hostRecoveryId,
    createdAt: new Date().toISOString(),
  };
  const target = recoveryRecordPath(mounts.management);
  const temporary = `${target}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  fs.writeFileSync(temporary, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, target);
  if (
    !identityMatchesRecord(target, serializableIdentity(target, "file"), "file")
  )
    throw new Error("docker_recovery_record_failed");
  return formatDockerIsolationRecoveryToken(
    rootName,
    probeId,
    nonce,
    recordHash,
  );
}

/**
 * Dockerを実行する。
 *
 * @responsibility Dockerの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input cliCapability: object、args: readonly string[]、environment: DockerEnvironment、timeout
 * @returns SpawnSyncReturns<string>を返す。
 * @precondition 「cliCapability: object、args: readonly string[]、environment: DockerEnvironment、timeout」がexecuteDockerの入力契約を満たす。
 * @postcondition executeDockerの責務を完了した結果だけを返す。
 * @effect executeDockerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: executeDockerは独自の失敗分岐を所有しない。
 * @invariant executeDockerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security executeDockerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: executeDockerは共有非同期状態を持たない同期処理である。
 */
function executeDocker(
  cliCapability: object,
  args: readonly string[],
  environment: DockerEnvironment,
  timeout = 10_000,
): SpawnSyncReturns<string> {
  const executable = verifyTrustedDockerCliCapability(cliCapability);
  return spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: MAX_OUTPUT_BYTES,
    env: environment,
  });
}

/**
 * docker Commandを決定する。
 *
 * @responsibility docker Commandの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input cli: object、environment: DockerEnvironment、args: readonly string[]、timeout
 * @returns SpawnSyncReturns<string>を返す。
 * @precondition 「cli: object、environment: DockerEnvironment、args: readonly string[]、timeout」がdockerCommandの入力契約を満たす。
 * @postcondition dockerCommandの責務を完了した結果だけを返す。
 * @effect N/A: dockerCommandは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerCommandは独自の失敗分岐を所有しない。
 * @invariant dockerCommandは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dockerCommandはProcess内の同一Subsystemで完結する。
 * @security dockerCommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerCommandは共有非同期状態を持たない同期処理である。
 */
function dockerCommand(
  cli: object,
  environment: DockerEnvironment,
  args: readonly string[],
  timeout = 10_000,
): SpawnSyncReturns<string> {
  return executeDocker(
    cli,
    ["-H", DOCKER_DESKTOP_ENGINE, ...args],
    environment,
    timeout,
  );
}

/**
 * docker-isolationで使用する所有 Attached Processの値契約を定義する。
 *
 * @responsibility 所有 Attached ProcessのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedAttachedProcessが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedAttachedProcessで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedAttachedProcessの宣言は外部境界を開かない。
 * @security OwnedAttachedProcessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedAttachedProcessの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedAttachedProcess = Readonly<{
  started: Promise<boolean>;
  ready: Promise<boolean>;
  completion: Promise<AsyncDockerExecution>;
  terminateAndWait: () => Promise<AsyncDockerExecution | null>;
  isClosed: () => boolean;
  getTerminationRequestCount: () => number;
}>;

/**
 * 所有 Attached Processを開始する。
 *
 * @responsibility 所有 Attached Processの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input executable: string、args: readonly string[]、environment: DockerEnvironment、readyPrefix: string
 * @returns Readonly<{ started: Promise<boolean>; ready: Promise<boolean>; completion: Promise<AsyncDockerExecution>; terminateAndWait: () => Promise<AsyncDockerExecution | null>; isClosed: () => boolean; getTerminationRequestCount: () => number; }>を返す。
 * @precondition 「executable: string、args: readonly string[]、environment: DockerEnvironment、readyPrefix: string」がstartOwnedAttachedProcessの入力契約を満たす。
 * @postcondition startOwnedAttachedProcessの責務を完了した結果だけを返す。
 * @effect startOwnedAttachedProcessは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: startOwnedAttachedProcessは独自の失敗分岐を所有しない。
 * @invariant startOwnedAttachedProcessは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startOwnedAttachedProcessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency startOwnedAttachedProcessは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function startOwnedAttachedProcess(
  executable: string,
  args: readonly string[],
  environment: DockerEnvironment,
  readyPrefix: string,
): Readonly<{
  started: Promise<boolean>;
  ready: Promise<boolean>;
  completion: Promise<AsyncDockerExecution>;
  terminateAndWait: () => Promise<AsyncDockerExecution | null>;
  isClosed: () => boolean;
  getTerminationRequestCount: () => number;
}> {
  const child = spawn(executable, args, {
    windowsHide: true,
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let hasOutputExceeded = false;
  let hasStartedSettled = false;
  let hasReadySettled = false;
  let hasClosed = false;
  let hasTerminationRequested = false;
  let terminationRequestCount = 0;
  let settleStarted: (isStarted: boolean) => void = () => undefined;
  let settleReady: (isReady: boolean) => void = () => undefined;
  const started = new Promise<boolean>((resolve) => {
    settleStarted = resolve;
  });
  const ready = new Promise<boolean>((resolve) => {
    settleReady = resolve;
  });
  const finishStarted = (isStarted: boolean) => {
    if (hasStartedSettled) return;
    hasStartedSettled = true;
    settleStarted(isStarted);
  };
  const finishReady = (isReady: boolean) => {
    if (hasReadySettled) return;
    hasReadySettled = true;
    settleReady(isReady);
  };
  const append = (
    chunks: Buffer[],
    chunk: Buffer | string,
    isStdout: boolean,
  ) => {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const nextBytes = (isStdout ? stdoutBytes : stderrBytes) + value.length;
    if (isStdout) stdoutBytes = nextBytes;
    else stderrBytes = nextBytes;
    if (nextBytes > MAX_OUTPUT_BYTES) {
      hasOutputExceeded = true;
      void terminateAndWait();
      return;
    }
    chunks.push(value);
    if (
      isStdout &&
      Buffer.concat(chunks).toString("utf8").startsWith(readyPrefix)
    )
      finishReady(true);
  };
  child.stdout.on("data", (chunk: Buffer | string) =>
    append(stdoutChunks, chunk, true),
  );
  child.stderr.on("data", (chunk: Buffer | string) =>
    append(stderrChunks, chunk, false),
  );
  const completion = new Promise<AsyncDockerExecution>((resolve) => {
    let hasSettled = false;
    const finish = (execution: AsyncDockerExecution) => {
      if (hasSettled) return;
      hasSettled = true;
      finishReady(false);
      resolve(execution);
    };
    child.once("error", (error) => {
      finishStarted(false);
      finish({
        error,
        status: null,
        signal: null,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        outputExceeded: hasOutputExceeded,
      });
    });
    child.once("spawn", () => finishStarted(true));
    child.once("close", (status, signal) => {
      hasClosed = true;
      finishStarted(false);
      finish({
        status,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        outputExceeded: hasOutputExceeded,
      });
    });
  });
  /**
   * And Waitを終了させる。
   *
   * @responsibility And Waitの終了Authority、対象Process、終了確認境界を所有する。
   * @trace ARCH-000008
   * @input N/A: 実行時引数を受け取らない。
   * @returns Promise<AsyncDockerExecution | null>を返す。
   * @precondition 「N/A: 実行時引数を受け取らない。」がterminateAndWaitの入力契約を満たす。
   * @postcondition terminateAndWaitの責務を完了した結果だけを返す。
   * @effect N/A: terminateAndWaitは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: terminateAndWaitは独自の失敗分岐を所有しない。
   * @invariant terminateAndWaitは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: terminateAndWaitはProcess内の同一Subsystemで完結する。
   * @security terminateAndWaitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency terminateAndWaitは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function terminateAndWait(): Promise<AsyncDockerExecution | null> {
    if (!hasClosed && !hasTerminationRequested) {
      hasTerminationRequested = true;
      terminationRequestCount += 1;
      child.kill();
    }
    const execution = await boundedPromise(completion, 5_000, null);
    return hasClosed ? execution : null;
  }
  return Object.freeze({
    started,
    ready,
    completion,
    terminateAndWait,
    isClosed: () => hasClosed,
    getTerminationRequestCount: () => terminationRequestCount,
  });
}

/**
 * Attached Docker Commandを開始する。
 *
 * @responsibility Attached Docker Commandの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input cliCapability: object、environment: DockerEnvironment、args: readonly string[]
 * @returns OwnedAttachedProcessを返す。
 * @precondition 「cliCapability: object、environment: DockerEnvironment、args: readonly string[]」がstartAttachedDockerCommandの入力契約を満たす。
 * @postcondition startAttachedDockerCommandの責務を完了した結果だけを返す。
 * @effect N/A: startAttachedDockerCommandは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startAttachedDockerCommandは独自の失敗分岐を所有しない。
 * @invariant startAttachedDockerCommandは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startAttachedDockerCommandはProcess内の同一Subsystemで完結する。
 * @security startAttachedDockerCommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startAttachedDockerCommandは共有非同期状態を持たない同期処理である。
 */
function startAttachedDockerCommand(
  cliCapability: object,
  environment: DockerEnvironment,
  args: readonly string[],
): OwnedAttachedProcess {
  const executable = verifyTrustedDockerCliCapability(cliCapability);
  return startOwnedAttachedProcess(
    executable,
    ["-H", DOCKER_DESKTOP_ENGINE, ...args],
    environment,
    `${CANCELLATION_READY_OUTPUT}\n`,
  );
}

/**
 * bounded Promiseを決定する。
 *
 * @responsibility bounded Promiseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input promise: Promise<T>、timeoutMs: number、fallback: T
 * @returns Promise<T>を返す。
 * @precondition 「promise: Promise<T>、timeoutMs: number、fallback: T」がboundedPromiseの入力契約を満たす。
 * @postcondition boundedPromiseの責務を完了した結果だけを返す。
 * @effect N/A: boundedPromiseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: boundedPromiseは独自の失敗分岐を所有しない。
 * @invariant boundedPromiseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: boundedPromiseはProcess内の同一Subsystemで完結する。
 * @security boundedPromiseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency boundedPromiseは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function boundedPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const OWNED_ATTACH_FIXTURE_READY = "crdd-owned-attach-ready\n";
const OWNED_ATTACH_FIXTURE_SOURCES = Object.freeze({
  never_ready: "setInterval(() => undefined, 1000);",
  ready_then_never_complete:
    'process.stdout.write("crdd-owned-attach-ready\\n"); setInterval(() => undefined, 1000);',
  output_overflow: `process.stdout.write("x".repeat(${MAX_OUTPUT_BYTES + 1})); setInterval(() => undefined, 1000);`,
} satisfies Readonly<Record<OwnedAttachTerminationFixtureScenario, string>>);

/**
 * 所有 Attach Termination For Fixtureを検証する。
 *
 * @responsibility 所有 Attach Termination For Fixtureの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input scenario: OwnedAttachTerminationFixtureScenario
 * @returns Promise< Readonly<{ status: "verified" | "blocked"; reason: string; scenario: OwnedAttachTerminationFixtureScenario; readyObserved: boolean; outputExceeded: boolean; terminationRequestCount: number; attachProcessTerminationObserved: boolean; }> >を返す。
 * @precondition 「scenario: OwnedAttachTerminationFixtureScenario」がverifyOwnedAttachTerminationForFixtureの入力契約を満たす。
 * @postcondition verifyOwnedAttachTerminationForFixtureの責務を完了した結果だけを返す。
 * @effect verifyOwnedAttachTerminationForFixtureは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: verifyOwnedAttachTerminationForFixtureは独自の失敗分岐を所有しない。
 * @invariant verifyOwnedAttachTerminationForFixtureは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security verifyOwnedAttachTerminationForFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency verifyOwnedAttachTerminationForFixtureは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function verifyOwnedAttachTerminationForFixture(
  scenario: OwnedAttachTerminationFixtureScenario,
): Promise<
  Readonly<{
    status: "verified" | "blocked";
    reason: string;
    scenario: OwnedAttachTerminationFixtureScenario;
    readyObserved: boolean;
    outputExceeded: boolean;
    terminationRequestCount: number;
    attachProcessTerminationObserved: boolean;
  }>
> {
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_runtime_environment_unavailable",
      scenario,
      readyObserved: false,
      outputExceeded: false,
      terminationRequestCount: 0,
      attachProcessTerminationObserved: false,
    });
  const controller = startOwnedAttachedProcess(
    process.execPath,
    ["-e", OWNED_ATTACH_FIXTURE_SOURCES[scenario]],
    environment,
    OWNED_ATTACH_FIXTURE_READY,
  );
  const isStarted = await boundedPromise(controller.started, 5_000, false);
  const isReady =
    scenario === "ready_then_never_complete" && isStarted
      ? await boundedPromise(controller.ready, 5_000, false)
      : false;
  if (scenario === "output_overflow" && isStarted) {
    await boundedPromise(controller.completion, 5_000, null);
  }
  if (scenario !== "output_overflow" || !controller.isClosed()) {
    await controller.terminateAndWait();
  }
  const execution = await controller.terminateAndWait();
  const hasClosed = controller.isClosed() && execution !== null;
  const hasExpectedReady =
    isReady === (scenario === "ready_then_never_complete");
  const hasExpectedOverflow =
    execution?.outputExceeded === (scenario === "output_overflow");
  const hasExactTerminationRequest =
    controller.getTerminationRequestCount() === 1;
  const isVerified =
    isStarted &&
    hasClosed &&
    hasExpectedReady &&
    hasExpectedOverflow &&
    hasExactTerminationRequest;
  return Object.freeze({
    status: isVerified ? "verified" : "blocked",
    reason: isVerified
      ? "owned_attach_process_termination_verified"
      : "owned_attach_process_termination_unconfirmed",
    scenario,
    readyObserved: isReady,
    outputExceeded: execution?.outputExceeded === true,
    terminationRequestCount: controller.getTerminationRequestCount(),
    attachProcessTerminationObserved: hasClosed,
  });
}

/**
 * 失敗を固定Schemaへ正規化する。
 *
 * @responsibility 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、fallback
 * @returns stringを返す。
 * @precondition 「error: unknown、fallback」がnormalizeFailureの入力契約を満たす。
 * @postcondition normalizeFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeFailureは共有非同期状態を持たない同期処理である。
 */
function normalizeFailure(
  error: unknown,
  fallback = "docker_isolation_probe_failed",
): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_mount_path_unsupported",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = errorMessage(error);
  return message && known.has(message) ? message : fallback;
}

/**
 * Container Idが有効か判定する。
 *
 * @responsibility Container Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidContainerIdの入力契約を満たす。
 * @postcondition validContainerIdの責務を完了した結果だけを返す。
 * @effect N/A: validContainerIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validContainerIdは独自の失敗分岐を所有しない。
 * @invariant validContainerIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validContainerIdはProcess内の同一Subsystemで完結する。
 * @security validContainerIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validContainerIdは共有非同期状態を持たない同期処理である。
 */
function validContainerId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value.trim());
}

/**
 * Container Creationを固定Schemaへ正規化する。
 *
 * @responsibility Container Creationの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution
 * @returns | Readonly<{ status: "confirmed"; id: string }> | Readonly<{ status: "blocked"; reason: "docker_container_identity_unknown"; }>を返す。
 * @precondition 「execution: DockerExecution」がnormalizeContainerCreationの入力契約を満たす。
 * @postcondition normalizeContainerCreationの責務を完了した結果だけを返す。
 * @effect N/A: normalizeContainerCreationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeContainerCreationは独自の失敗分岐を所有しない。
 * @invariant normalizeContainerCreationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeContainerCreationはProcess内の同一Subsystemで完結する。
 * @security normalizeContainerCreationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeContainerCreationは共有非同期状態を持たない同期処理である。
 */
export function normalizeContainerCreation(execution: DockerExecution):
  | Readonly<{ status: "confirmed"; id: string }>
  | Readonly<{
      status: "blocked";
      reason: "docker_container_identity_unknown";
    }> {
  if (
    execution?.error ||
    execution?.status !== 0 ||
    !validContainerId(execution?.stdout)
  ) {
    return { status: "blocked", reason: "docker_container_identity_unknown" };
  }
  return { status: "confirmed", id: execution.stdout.trim() };
}

/**
 * Id Setを固定Schemaへ正規化する。
 *
 * @responsibility Id Setの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution
 * @returns Set<string> | nullを返す。
 * @precondition 「execution: DockerExecution」がnormalizedIdSetの入力契約を満たす。
 * @postcondition normalizedIdSetの責務を完了した結果だけを返す。
 * @effect N/A: normalizedIdSetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedIdSetは独自の失敗分岐を所有しない。
 * @invariant normalizedIdSetは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedIdSetはProcess内の同一Subsystemで完結する。
 * @security normalizedIdSetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizedIdSetは共有非同期状態を持たない同期処理である。
 */
function normalizedIdSet(execution: DockerExecution): Set<string> | null {
  if (
    execution?.error ||
    execution?.status !== 0 ||
    typeof execution?.stdout !== "string" ||
    Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES
  )
    return null;
  const lines = execution.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines.some((line) => !validContainerId(line)) ||
    new Set(lines).size !== lines.length
  )
    return null;
  return new Set(lines);
}

/**
 * Container Absenceを固定Schemaへ正規化する。
 *
 * @responsibility Container Absenceの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input idExecution: DockerExecution、nameExecution: DockerExecution、labelExecution: DockerExecution
 * @returns normalizeContainerAbsenceの計算結果を返す。
 * @precondition 「idExecution: DockerExecution、nameExecution: DockerExecution、labelExecution: DockerExecution」がnormalizeContainerAbsenceの入力契約を満たす。
 * @postcondition normalizeContainerAbsenceの責務を完了した結果だけを返す。
 * @effect N/A: normalizeContainerAbsenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeContainerAbsenceは独自の失敗分岐を所有しない。
 * @invariant normalizeContainerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeContainerAbsenceはProcess内の同一Subsystemで完結する。
 * @security normalizeContainerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeContainerAbsenceは共有非同期状態を持たない同期処理である。
 */
export function normalizeContainerAbsence(
  idExecution: DockerExecution,
  nameExecution: DockerExecution,
  labelExecution: DockerExecution,
) {
  const sets = [idExecution, nameExecution, labelExecution].map(
    normalizedIdSet,
  );
  const isConfirmed = sets.every((set) => set instanceof Set && set.size === 0);
  return isConfirmed
    ? { status: "confirmed", reason: "docker_probe_absence_confirmed" }
    : { status: "blocked", reason: "docker_probe_absence_unconfirmed" };
}

/**
 * Inspectを読み取る。
 *
 * @responsibility Inspectの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution
 * @returns unknown | nullを返す。
 * @precondition 「execution: DockerExecution」がreadInspectの入力契約を満たす。
 * @postcondition readInspectの責務を完了した結果だけを返す。
 * @effect N/A: readInspectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readInspectは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readInspectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readInspectはProcess内の同一Subsystemで完結する。
 * @security readInspectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readInspectは共有非同期状態を持たない同期処理である。
 */
function readInspect(execution: DockerExecution): unknown | null {
  if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string" ||
    Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(execution.stdout);
    return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
  } catch {
    return null;
  }
}

/**
 * expected Mountsを決定する。
 *
 * @responsibility expected Mountsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerMounts
 * @returns Map<string, string>を返す。
 * @precondition 「mounts: DockerMounts」がexpectedMountsの入力契約を満たす。
 * @postcondition expectedMountsの責務を完了した結果だけを返す。
 * @effect N/A: expectedMountsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedMountsは独自の失敗分岐を所有しない。
 * @invariant expectedMountsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedMountsはProcess内の同一Subsystemで完結する。
 * @security expectedMountsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedMountsは共有非同期状態を持たない同期処理である。
 */
function expectedMounts(mounts: DockerMounts): Map<string, string> {
  return new Map([
    ["/operation/workspace", mounts.workspace],
    ["/operation/provider-home", mounts.providerHome],
    ["/operation/tmp", mounts.tmp],
  ]);
}

/**
 * Container Inspectの契約を検証する。
 *
 * @responsibility Container Inspectの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input inspect: unknown、expected: ContainerIdentity & Readonly<{ mounts: DockerMounts }>
 * @returns booleanを返す。
 * @precondition 「inspect: unknown、expected: ContainerIdentity & Readonly<{ mounts: DockerMounts }>」がvalidateContainerInspectの入力契約を満たす。
 * @postcondition validateContainerInspectの責務を完了した結果だけを返す。
 * @effect validateContainerInspectはFilesystemの読取りまたは書込みを実行する。
 * @failure validateContainerInspectは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateContainerInspectは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateContainerInspectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateContainerInspectは共有非同期状態を持たない同期処理である。
 */
export function validateContainerInspect(
  inspect: unknown,
  expected: ContainerIdentity & Readonly<{ mounts: DockerMounts }>,
): boolean {
  if (!isObject(inspect)) return false;
  if (
    ownValue(inspect, "Id") !== expected.id ||
    ownValue(inspect, "Name") !== `/${containerName(expected.probeId)}`
  )
    return false;
  const config = ownValue(inspect, "Config");
  const host = ownValue(inspect, "HostConfig");
  if (!isObject(config) || !isObject(host)) return false;
  const labels = ownValue(config, "Labels");
  const entrypoint = ownValue(config, "Entrypoint");
  const command = ownValue(config, "Cmd");
  if (
    !isObject(labels) ||
    ownValue(labels, OWNERSHIP_LABEL) !== expected.probeId
  )
    return false;
  if (
    ownValue(config, "Image") !== PROBE_IMAGE ||
    ownValue(config, "User") !== "65532:65532"
  )
    return false;
  if (
    !Array.isArray(entrypoint) ||
    entrypoint.length !== 1 ||
    entrypoint[0] !== "python"
  )
    return false;
  if (
    !Array.isArray(command) ||
    command.length !== 2 ||
    command[0] !== "-c" ||
    typeof command[1] !== "string" ||
    (expected.source
      ? command[1] !== expected.source
      : !repositoryOwnedProbeSources.has(command[1]))
  )
    return false;
  if (
    ownValue(host, "NetworkMode") !== "none" ||
    ownValue(host, "ReadonlyRootfs") !== true ||
    ownValue(host, "Privileged") !== false ||
    Number(ownValue(host, "PidsLimit")) !== 64
  )
    return false;
  const capDrop = ownValue(host, "CapDrop");
  const capAdd = ownValue(host, "CapAdd");
  const devices = ownValue(host, "Devices");
  const securityOptions = ownValue(host, "SecurityOpt");
  if (!Array.isArray(capDrop) || capDrop.length !== 1 || capDrop[0] !== "ALL")
    return false;
  if (
    (capAdd != null && (!Array.isArray(capAdd) || capAdd.length !== 0)) ||
    (devices != null && (!Array.isArray(devices) || devices.length !== 0)) ||
    !Array.isArray(securityOptions) ||
    !securityOptions.includes("no-new-privileges")
  )
    return false;
  const wanted = expectedMounts(expected.mounts);
  const inspectMounts = ownValue(inspect, "Mounts");
  if (!Array.isArray(inspectMounts) || inspectMounts.length !== wanted.size)
    return false;
  for (const mount of inspectMounts) {
    if (!isObject(mount)) return false;
    const destination = ownValue(mount, "Destination");
    const sourcePath = ownValue(mount, "Source");
    if (typeof destination !== "string" || typeof sourcePath !== "string")
      return false;
    const source = wanted.get(destination);
    if (
      !source ||
      ownValue(mount, "Type") !== "bind" ||
      ownValue(mount, "RW") !== true
    )
      return false;
    try {
      const observedSource = fs.realpathSync.native(sourcePath);
      const expectedSource = fs.realpathSync.native(source);
      if (
        process.platform === "win32"
          ? observedSource.toLocaleLowerCase("en-US") !==
            expectedSource.toLocaleLowerCase("en-US")
          : observedSource !== expectedSource
      )
        return false;
    } catch {
      return false;
    }
    wanted.delete(destination);
  }
  return wanted.size === 0;
}

/**
 * 所有 Containerを観測する。
 *
 * @responsibility 所有 Containerの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input cli: object、environment: DockerEnvironment、capability: object、mounts: DockerMounts
 * @returns unknown | nullを返す。
 * @precondition 「cli: object、environment: DockerEnvironment、capability: object、mounts: DockerMounts」がinspectOwnedContainerの入力契約を満たす。
 * @postcondition inspectOwnedContainerの責務を完了した結果だけを返す。
 * @effect N/A: inspectOwnedContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectOwnedContainerは独自の失敗分岐を所有しない。
 * @invariant inspectOwnedContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectOwnedContainerはProcess内の同一Subsystemで完結する。
 * @security inspectOwnedContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectOwnedContainerは共有非同期状態を持たない同期処理である。
 */
function inspectOwnedContainer(
  cli: object,
  environment: DockerEnvironment,
  capability: object,
  mounts: DockerMounts,
): unknown | null {
  const identity = containerIdentities.get(capability);
  if (!identity) return null;
  const execution = dockerCommand(cli, environment, [
    "container",
    "inspect",
    identity.id,
  ]);
  const inspect = readInspect(execution);
  return validateContainerInspect(inspect, { ...identity, mounts })
    ? inspect
    : null;
}

/**
 * inspected Container Is Runningを決定する。
 *
 * @responsibility inspected Container Is Runningの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input inspect: unknown
 * @returns booleanを返す。
 * @precondition 「inspect: unknown」がinspectedContainerIsRunningの入力契約を満たす。
 * @postcondition inspectedContainerIsRunningの責務を完了した結果だけを返す。
 * @effect N/A: inspectedContainerIsRunningは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectedContainerIsRunningは独自の失敗分岐を所有しない。
 * @invariant inspectedContainerIsRunningは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectedContainerIsRunningはProcess内の同一Subsystemで完結する。
 * @security inspectedContainerIsRunningはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectedContainerIsRunningは共有非同期状態を持たない同期処理である。
 */
function inspectedContainerIsRunning(inspect: unknown): boolean {
  if (!isObject(inspect)) return false;
  const state = ownValue(inspect, "State");
  return isObject(state) && ownValue(state, "Running") === true;
}

/**
 * Container Absenceを観測する。
 *
 * @responsibility Container Absenceの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input cli: object、environment: DockerEnvironment、identity: ContainerIdentity、hostRecoveryId: string、rootName: string
 * @returns Readonly<{ kind: "docker_absence" }> | nullを返す。
 * @precondition 「cli: object、environment: DockerEnvironment、identity: ContainerIdentity、hostRecoveryId: string、rootName: string」がobserveContainerAbsenceの入力契約を満たす。
 * @postcondition observeContainerAbsenceの責務を完了した結果だけを返す。
 * @effect N/A: observeContainerAbsenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeContainerAbsenceは独自の失敗分岐を所有しない。
 * @invariant observeContainerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeContainerAbsenceはProcess内の同一Subsystemで完結する。
 * @security observeContainerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeContainerAbsenceは共有非同期状態を持たない同期処理である。
 */
function observeContainerAbsence(
  cli: object,
  environment: DockerEnvironment,
  identity: ContainerIdentity,
  hostRecoveryId: string,
  rootName: string,
): Readonly<{ kind: "docker_absence" }> | null {
  const containerListArguments = [
    "container",
    "ls",
    "--all",
    "--quiet",
    "--no-trunc",
  ];
  const id = dockerCommand(cli, environment, [
    ...containerListArguments,
    "--filter",
    `id=${identity.id}`,
  ]);
  const name = dockerCommand(cli, environment, [
    ...containerListArguments,
    "--filter",
    `name=^/${containerName(identity.probeId)}$`,
  ]);
  const label = dockerCommand(cli, environment, [
    ...containerListArguments,
    "--filter",
    `label=${OWNERSHIP_LABEL}=${identity.probeId}`,
  ]);
  if (normalizeContainerAbsence(id, name, label).status !== "confirmed")
    return null;
  const capability = Object.freeze({ kind: "docker_absence" });
  absenceCapabilities.set(
    capability,
    Object.freeze({
      probeId: identity.probeId,
      containerId: identity.id,
      hostRecoveryId,
      rootName,
      cli,
    }),
  );
  return capability;
}

/**
 * 所有 Containerを清掃する。
 *
 * @responsibility 所有 Containerの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input cli: object、environment: DockerEnvironment、capability: object、mounts: DockerMounts、hostRecoveryId: string
 * @returns cleanupOwnedContainerの計算結果を返す。
 * @precondition 「cli: object、environment: DockerEnvironment、capability: object、mounts: DockerMounts、hostRecoveryId: string」がcleanupOwnedContainerの入力契約を満たす。
 * @postcondition cleanupOwnedContainerの責務を完了した結果だけを返す。
 * @effect N/A: cleanupOwnedContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cleanupOwnedContainerは独自の失敗分岐を所有しない。
 * @invariant cleanupOwnedContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cleanupOwnedContainerはProcess内の同一Subsystemで完結する。
 * @security cleanupOwnedContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupOwnedContainerは共有非同期状態を持たない同期処理である。
 */
function cleanupOwnedContainer(
  cli: object,
  environment: DockerEnvironment,
  capability: object,
  mounts: DockerMounts,
  hostRecoveryId: string,
) {
  const identity = containerIdentities.get(capability);
  if (!identity)
    return { confirmed: false, reason: "docker_container_identity_unknown" };
  if (!inspectOwnedContainer(cli, environment, capability, mounts))
    return { confirmed: false, reason: "docker_container_identity_mismatch" };
  const removal = dockerCommand(cli, environment, [
    "container",
    "rm",
    "--force",
    identity.id,
  ]);
  const absenceCapability =
    removal.error || removal.status !== 0
      ? null
      : observeContainerAbsence(
          cli,
          environment,
          identity,
          hostRecoveryId,
          path.basename(path.dirname(mounts.management)),
        );
  if (!absenceCapability)
    return { confirmed: false, reason: "docker_probe_cleanup_failed" };
  containerIdentities.delete(capability);
  return {
    confirmed: true,
    reason: "docker_probe_absence_confirmed",
    absenceCapability,
  };
}

/**
 * Local Linux Engineを検証する。
 *
 * @responsibility Local Linux Engineの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input cli: object、environment: DockerEnvironment
 * @returns booleanを返す。
 * @precondition 「cli: object、environment: DockerEnvironment」がverifyLocalLinuxEngineの入力契約を満たす。
 * @postcondition verifyLocalLinuxEngineの責務を完了した結果だけを返す。
 * @effect N/A: verifyLocalLinuxEngineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyLocalLinuxEngineは独自の失敗分岐を所有しない。
 * @invariant verifyLocalLinuxEngineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyLocalLinuxEngineはProcess内の同一Subsystemで完結する。
 * @security verifyLocalLinuxEngineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyLocalLinuxEngineは共有非同期状態を持たない同期処理である。
 */
function verifyLocalLinuxEngine(
  cli: object,
  environment: DockerEnvironment,
): boolean {
  const execution = dockerCommand(cli, environment, [
    "version",
    "--format",
    "{{.Server.Os}}",
  ]);
  return (
    !execution.error &&
    execution.status === 0 &&
    execution.stdout.trim() === "linux"
  );
}

/**
 * docker-isolationを停止結果として構築する。
 *
 * @responsibility docker-isolationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired
 * @returns DockerProbeResultを返す。
 * @precondition 「reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  reason: string,
  probeId: string | null = null,
  shouldRetainOperationDirectories = false,
  recoveryId: string | null = null,
  isManualRecoveryRequired = false,
): DockerProbeResult {
  return {
    status: "blocked",
    reason,
    probeId,
    retainOperationDirectories: shouldRetainOperationDirectories,
    hostCleanupCompleted: false,
    recoveryId,
    manualRecoveryRequired: isManualRecoveryRequired,
    cleanup: shouldRetainOperationDirectories
      ? "unconfirmed"
      : "not_required_or_confirmed",
    fakeProviderLifecycle: dynamicFakeLifecycleBlocked(reason),
  };
}

/**
 * Docker Probe 失敗を固定Schemaへ正規化する。
 *
 * @responsibility Docker Probe 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、probeId: string、state: DockerProbeFailureState
 * @returns DockerProbeResultを返す。
 * @precondition 「error: unknown、probeId: string、state: DockerProbeFailureState」がnormalizeDockerProbeFailureの入力契約を満たす。
 * @postcondition normalizeDockerProbeFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDockerProbeFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeDockerProbeFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeDockerProbeFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDockerProbeFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeDockerProbeFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDockerProbeFailureは共有非同期状態を持たない同期処理である。
 */
export function normalizeDockerProbeFailure(
  error: unknown,
  probeId: string,
  state: DockerProbeFailureState,
): DockerProbeResult {
  if (state.rollbackFailed === true) {
    return blocked(
      "docker_submission_rollback_failed",
      probeId,
      true,
      null,
      true,
    );
  }
  return blocked(
    normalizeFailure(error),
    probeId,
    state.submissionStarted,
    state.submissionStarted ? state.recoveryId : state.hostRecoveryId,
  );
}

/**
 * Host 回復を終了状態へ収束させる。
 *
 * @responsibility Host 回復の終了条件、最終状態、残存義務の境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string、lifecycleAbsenceCapability: object
 * @returns Readonly<{ result: DockerProbeResult; lifecycleHostCleanupCapability: object | null; }>を返す。
 * @precondition 「hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string、lifecycleAbsenceCapability: object」がfinishHostRecoveryの入力契約を満たす。
 * @postcondition finishHostRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: finishHostRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finishHostRecoveryは独自の失敗分岐を所有しない。
 * @invariant finishHostRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finishHostRecoveryはProcess内の同一Subsystemで完結する。
 * @security finishHostRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishHostRecoveryは共有非同期状態を持たない同期処理である。
 */
function finishHostRecovery(
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
  lifecycleAbsenceCapability: object,
): Readonly<{
  result: DockerProbeResult;
  lifecycleHostCleanupCapability: object | null;
}> {
  const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
  const result = normalizeHostCleanupResult(
    recovered,
    hostRecoveryId,
    baseResult,
    probeId,
  );
  if (!result.hostCleanupCompleted)
    return Object.freeze({ result, lifecycleHostCleanupCapability: null });
  const lifecycleHostCleanupCapability = Object.freeze({
    kind: "dynamic_fake_provider_host_cleanup",
  });
  dynamicLifecycleHostCleanups.set(
    lifecycleHostCleanupCapability,
    Object.freeze({
      probeId,
      confirmedHostRecoveryId: hostRecoveryId,
      absenceCapability: lifecycleAbsenceCapability,
    }),
  );
  return Object.freeze({ result, lifecycleHostCleanupCapability });
}

/**
 * Host 清掃 結果を固定Schemaへ正規化する。
 *
 * @responsibility Host 清掃 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input recovered: Readonly<{ status: string; reason: string }>、hostRecoveryId: string、baseResult: Partial<DockerProbeResult>、probeId: string | null
 * @returns DockerProbeResultを返す。
 * @precondition 「recovered: Readonly<{ status: string; reason: string }>、hostRecoveryId: string、baseResult: Partial<DockerProbeResult>、probeId: string | null」がnormalizeHostCleanupResultの入力契約を満たす。
 * @postcondition normalizeHostCleanupResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeHostCleanupResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeHostCleanupResultは独自の失敗分岐を所有しない。
 * @invariant normalizeHostCleanupResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeHostCleanupResultはProcess内の同一Subsystemで完結する。
 * @security normalizeHostCleanupResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeHostCleanupResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeHostCleanupResult(
  recovered: Readonly<{ status: string; reason: string }>,
  hostRecoveryId: string,
  baseResult: Partial<DockerProbeResult> = {},
  probeId: string | null = null,
): DockerProbeResult {
  return recovered?.status === "recovered"
    ? {
        ...blocked(
          typeof baseResult.reason === "string"
            ? baseResult.reason
            : "host_cleanup_recovered",
          typeof baseResult.probeId === "string" ? baseResult.probeId : probeId,
        ),
        ...baseResult,
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      }
    : blocked(
        recovered?.reason ?? "host_recovery_failed",
        probeId,
        true,
        hostRecoveryId,
      );
}

/**
 * Pre Submission 清掃を終了状態へ収束させる。
 *
 * @responsibility Pre Submission 清掃の終了条件、最終状態、残存義務の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string」がfinishPreSubmissionCleanupの入力契約を満たす。
 * @postcondition finishPreSubmissionCleanupの責務を完了した結果だけを返す。
 * @effect N/A: finishPreSubmissionCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure finishPreSubmissionCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant finishPreSubmissionCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finishPreSubmissionCleanupはProcess内の同一Subsystemで完結する。
 * @security finishPreSubmissionCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishPreSubmissionCleanupは共有非同期状態を持たない同期処理である。
 */
function finishPreSubmissionCleanup(
  owned: unknown,
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
): DockerProbeResult {
  try {
    cleanupOwnedOperationDirectories(owned);
    return {
      ...baseResult,
      hostCleanupCompleted: true,
      retainOperationDirectories: false,
      recoveryId: null,
      cleanup: "confirmed",
    };
  } catch {
    return {
      ...blocked(
        "host_operation_cleanup_failed",
        probeId,
        true,
        hostRecoveryId,
      ),
    };
  }
}

/**
 * Docker Isolation Scenarioを実行する。
 *
 * @responsibility Docker Isolation Scenarioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、scenario: DynamicFakeProviderFailureScenario | null
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、scenario: DynamicFakeProviderFailureScenario | null」がrunDockerIsolationScenarioの入力契約を満たす。
 * @postcondition runDockerIsolationScenarioの責務を完了した結果だけを返す。
 * @effect N/A: runDockerIsolationScenarioは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runDockerIsolationScenarioは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runDockerIsolationScenarioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDockerIsolationScenarioはProcess内の同一Subsystemで完結する。
 * @security runDockerIsolationScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDockerIsolationScenarioは共有非同期状態を持たない同期処理である。
 */
function runDockerIsolationScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario | null,
): DockerProbeResult {
  const specification = scenario ? FAILURE_SCENARIO_SPECS[scenario] : null;
  const source = specification?.source ?? PROBE_SOURCE;
  const executionTimeoutMs = specification?.timeoutMs ?? 30_000;
  const probeId = randomUUID();
  let cli: Readonly<{ kind: "trusted_docker_cli" }> | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let environment: DockerEnvironment | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let recoveryId: string | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  let hasRollbackFailed = false;
  const recoveryNonce = randomUUID();
  let result: DockerProbeResult = blocked("docker_isolation_probe_failed");
  let dynamicLifecycleCapability: Readonly<{
    kind: "dynamic_fake_provider_lifecycle";
  }> | null = null;
  try {
    cli = createTrustedDockerCliCapability();
    mountCapability = createOwnedMountCapability(owned);
    mounts = verifyOwnedMountCapability(mountCapability);
    environment = dockerEnvironment(mounts.management);
    if (!verifyLocalLinuxEngine(cli, environment)) {
      result = blocked("local_docker_desktop_linux_engine_required", probeId);
    } else {
      mounts = verifyOwnedMountCapability(mountCapability);
      hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
      hasSubmissionStarted = true;
      try {
        recoveryId = writeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          null,
        );
      } catch (error) {
        try {
          hostRecoveryId = cancelDockerSubmissionBeforeCreate(
            hostRecoveryId,
            mountCapability,
          );
          hasSubmissionStarted = false;
        } catch {
          hasRollbackFailed = true;
        }
        throw error;
      }
      hasContainerCreateAttempted = true;
      const creation = dockerCommand(
        cli,
        environment,
        dockerCreateArguments(mounts, probeId, source).slice(2),
        30_000,
      );
      const normalizedCreation = normalizeContainerCreation(creation);
      if (normalizedCreation.status !== "confirmed") {
        result = blocked(
          "docker_container_identity_unknown",
          probeId,
          true,
          recoveryId,
        );
      } else {
        const identity = Object.freeze({
          id: normalizedCreation.id,
          probeId,
          source,
        });
        containerIdentity = identity;
        containerCapability = Object.freeze({ kind: "owned_docker_probe" });
        containerIdentities.set(containerCapability, identity);
        recoveryId = writeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          identity.id,
        );
        mounts = verifyOwnedMountCapability(mountCapability);
        if (
          !inspectOwnedContainer(cli, environment, containerCapability, mounts)
        ) {
          result = blocked(
            "docker_container_security_profile_mismatch",
            probeId,
            true,
            recoveryId,
          );
        } else {
          mounts = verifyOwnedMountCapability(mountCapability);
          const lifecycleStartedAt = performance.now();
          const execution = dockerCommand(
            cli,
            environment,
            ["start", "--attach", identity.id],
            executionTimeoutMs,
          );
          const lifecycleElapsedMs = Math.max(
            0,
            Math.round(performance.now() - lifecycleStartedAt),
          );
          const normalized = normalizeDockerIsolationResult(execution);
          result = {
            ...blocked(normalized.reason, probeId),
            status: normalized.status === "confirmed" ? "confirmed" : "blocked",
            fakeProviderLifecycle: dynamicFakeLifecycleBlocked(
              "dynamic_fake_provider_absence_unconfirmed",
            ),
          };
          mounts = verifyOwnedMountCapability(mountCapability);
          dynamicLifecycleCapability =
            createDynamicFakeProviderLifecycleCapability(
              execution,
              lifecycleElapsedMs,
              {
                probeId,
                containerId: identity.id,
                mountCapability,
                hostRecoveryId,
              },
            );
        }
      }
    }
  } catch (error) {
    result = normalizeDockerProbeFailure(error, probeId, {
      submissionStarted: hasSubmissionStarted,
      recoveryId,
      hostRecoveryId,
      rollbackFailed: hasRollbackFailed,
    });
  } finally {
    if (containerCapability && cli && environment && mounts) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          environment,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed) {
          invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
          result = blocked(cleanup.reason, probeId, true, recoveryId);
        } else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity?.id ?? "",
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const hostCleanup = finishHostRecovery(
            hostRecoveryId,
            result,
            probeId,
            absence.lifecycleAbsenceCapability,
          );
          result = hostCleanup.result;
          if (
            dynamicLifecycleCapability &&
            mountCapability &&
            containerIdentity &&
            result.status === "confirmed" &&
            result.hostCleanupCompleted &&
            hostCleanup.lifecycleHostCleanupCapability
          ) {
            const finalizationCapability =
              createDynamicFakeProviderFinalizationCapability(
                dynamicLifecycleCapability,
                {
                  probeId,
                  containerId: containerIdentity.id,
                  mountCapability,
                  absenceCapability: absence.lifecycleAbsenceCapability,
                  hostCleanupCapability:
                    hostCleanup.lifecycleHostCleanupCapability,
                },
              );
            const lifecycle = finalizeDynamicFakeProviderLifecycle(
              dynamicLifecycleCapability,
              finalizationCapability,
            );
            result = {
              ...result,
              status:
                lifecycle.status === "verified" ? result.status : "blocked",
              reason:
                lifecycle.status === "verified"
                  ? result.reason
                  : lifecycle.reason,
              fakeProviderLifecycle: lifecycle,
            };
          } else {
            invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
            const failureReason =
              result.status === "blocked"
                ? result.reason
                : "dynamic_fake_provider_finalization_incomplete";
            result = {
              ...result,
              status: "blocked",
              reason: failureReason,
              fakeProviderLifecycle: dynamicFakeLifecycleBlocked(failureReason),
            };
          }
        }
      } catch {
        invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
        result = blocked(
          "docker_probe_cleanup_failed",
          probeId,
          true,
          recoveryId,
        );
      }
    } else if (!hasSubmissionStarted) {
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
      result = finishPreSubmissionCleanup(
        owned,
        hostRecoveryId,
        result,
        probeId,
      );
    }
    if (hasSubmissionStarted && !containerCapability)
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
  }
  return {
    ...result,
    fakeProviderLifecycle: Object.freeze({
      ...result.fakeProviderLifecycle,
      diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
      diagnosticFilesystemEffectIssued: true,
    }),
  };
}

/**
 * Docker Isolation Probeを実行する。
 *
 * @responsibility Docker Isolation Probeの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown」がrunDockerIsolationProbeの入力契約を満たす。
 * @postcondition runDockerIsolationProbeの責務を完了した結果だけを返す。
 * @effect N/A: runDockerIsolationProbeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runDockerIsolationProbeは独自の失敗分岐を所有しない。
 * @invariant runDockerIsolationProbeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDockerIsolationProbeはProcess内の同一Subsystemで完結する。
 * @security runDockerIsolationProbeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDockerIsolationProbeは共有非同期状態を持たない同期処理である。
 */
export function runDockerIsolationProbe(owned: unknown): DockerProbeResult {
  return runDockerIsolationScenario(owned, null);
}

/**
 * Dynamic Fake Provider 失敗 Scenarioを実行する。
 *
 * @responsibility Dynamic Fake Provider 失敗 Scenarioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、scenario: DynamicFakeProviderFailureScenario
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、scenario: DynamicFakeProviderFailureScenario」がrunDynamicFakeProviderFailureScenarioの入力契約を満たす。
 * @postcondition runDynamicFakeProviderFailureScenarioの責務を完了した結果だけを返す。
 * @effect N/A: runDynamicFakeProviderFailureScenarioは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runDynamicFakeProviderFailureScenarioは独自の失敗分岐を所有しない。
 * @invariant runDynamicFakeProviderFailureScenarioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDynamicFakeProviderFailureScenarioはProcess内の同一Subsystemで完結する。
 * @security runDynamicFakeProviderFailureScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDynamicFakeProviderFailureScenarioは共有非同期状態を持たない同期処理である。
 */
export function runDynamicFakeProviderFailureScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario,
): DockerProbeResult {
  return runDockerIsolationScenario(owned, scenario);
}

/**
 * Dynamic Fake Provider Cancellation Verificationを実行する。
 *
 * @responsibility Dynamic Fake Provider Cancellation Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Promise<DynamicFakeProviderCancellationResult>を返す。
 * @precondition 「owned: unknown」がrunDynamicFakeProviderCancellationVerificationの入力契約を満たす。
 * @postcondition runDynamicFakeProviderCancellationVerificationの責務を完了した結果だけを返す。
 * @effect N/A: runDynamicFakeProviderCancellationVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runDynamicFakeProviderCancellationVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runDynamicFakeProviderCancellationVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDynamicFakeProviderCancellationVerificationはProcess内の同一Subsystemで完結する。
 * @security runDynamicFakeProviderCancellationVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runDynamicFakeProviderCancellationVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runDynamicFakeProviderCancellationVerification(
  owned: unknown,
): Promise<DynamicFakeProviderCancellationResult> {
  const probeId = randomUUID();
  const recoveryNonce = randomUUID();
  let cli: Readonly<{ kind: "trusted_docker_cli" }> | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let environment: DockerEnvironment | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let recoveryId: string | null = null;
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  let hasPostRunMountVerified = false;
  let hasAttachProcessTerminationObserved = false;
  let attachProcessTerminationRequestCount = 0;
  let attachedController: OwnedAttachedProcess | null = null;
  let base = cancellationBlocked(
    "dynamic_fake_provider_cancellation_verification_failed",
  );
  try {
    cli = createTrustedDockerCliCapability();
    mountCapability = createOwnedMountCapability(owned);
    mounts = verifyOwnedMountCapability(mountCapability);
    environment = dockerEnvironment(mounts.management);
    if (!verifyLocalLinuxEngine(cli, environment))
      throw new Error("docker_backend_platform_unsupported");
    mounts = verifyOwnedMountCapability(mountCapability);
    hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
    hasSubmissionStarted = true;
    try {
      recoveryId = writeRecoveryRecord(
        mounts,
        probeId,
        recoveryNonce,
        hostRecoveryId,
        null,
      );
    } catch (error) {
      try {
        hostRecoveryId = cancelDockerSubmissionBeforeCreate(
          hostRecoveryId,
          mountCapability,
        );
        hasSubmissionStarted = false;
      } catch {
        hasSubmissionStarted = true;
      }
      throw error;
    }
    hasContainerCreateAttempted = true;
    const creation = dockerCommand(
      cli,
      environment,
      dockerCreateArguments(mounts, probeId, CANCELLATION_SOURCE).slice(2),
      30_000,
    );
    const normalizedCreation = normalizeContainerCreation(creation);
    if (normalizedCreation.status !== "confirmed")
      throw new Error("docker_container_identity_unknown");
    containerIdentity = Object.freeze({
      id: normalizedCreation.id,
      probeId,
      source: CANCELLATION_SOURCE,
    });
    containerCapability = Object.freeze({ kind: "owned_docker_probe" });
    containerIdentities.set(containerCapability, containerIdentity);
    recoveryId = writeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      containerIdentity.id,
    );
    mounts = verifyOwnedMountCapability(mountCapability);
    if (!inspectOwnedContainer(cli, environment, containerCapability, mounts))
      throw new Error("docker_container_security_profile_mismatch");

    attachedController = startAttachedDockerCommand(cli, environment, [
      "start",
      "--attach",
      containerIdentity.id,
    ]);
    const isReady = await boundedPromise(
      attachedController.ready,
      5_000,
      false,
    );
    if (!isReady) {
      await attachedController.terminateAndWait();
      throw new Error("dynamic_fake_provider_cancellation_ready_unconfirmed");
    }
    mounts = verifyOwnedMountCapability(mountCapability);
    const runningInspect = inspectOwnedContainer(
      cli,
      environment,
      containerCapability,
      mounts,
    );
    if (!inspectedContainerIsRunning(runningInspect))
      throw new Error("dynamic_fake_provider_cancellation_ready_unconfirmed");

    const cancellationStartedAt = performance.now();
    const cancellation = dockerCommand(
      cli,
      environment,
      ["container", "kill", "--signal", "SIGTERM", containerIdentity.id],
      5_000,
    );
    const execution = await boundedPromise<AsyncDockerExecution>(
      attachedController.completion,
      5_000,
      {
        error: Object.assign(new Error("cancellation timeout"), {
          code: "ETIMEDOUT",
        }),
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        outputExceeded: false,
      },
    );
    if (
      errorCodeEquals(execution.error, "ETIMEDOUT") ||
      execution.outputExceeded
    )
      await attachedController.terminateAndWait();
    const graceElapsedMs = Math.max(
      0,
      Math.round(performance.now() - cancellationStartedAt),
    );
    base = normalizeDynamicFakeProviderCancellationForFixture(
      execution,
      graceElapsedMs,
      true,
    );
    if (
      cancellation.error ||
      cancellation.status !== 0 ||
      execution.outputExceeded ||
      base.status !== "candidate"
    )
      throw new Error(base.reason);
    mounts = verifyOwnedMountCapability(mountCapability);
    if (!inspectOwnedContainer(cli, environment, containerCapability, mounts))
      throw new Error("owned_operation_mount_replaced");
    hasPostRunMountVerified = true;
  } catch (error) {
    base = Object.freeze({
      ...base,
      status: "blocked",
      reason: normalizeCancellationFailure(error),
    });
  } finally {
    if (attachedController) {
      const attachExecution = await attachedController.terminateAndWait();
      hasAttachProcessTerminationObserved =
        attachExecution !== null && attachedController.isClosed();
      attachProcessTerminationRequestCount =
        attachedController.getTerminationRequestCount();
      if (!hasAttachProcessTerminationObserved)
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason:
            "dynamic_fake_provider_attach_process_termination_unconfirmed",
          attachProcessTerminationObserved: false,
        });
    }
    if (
      containerCapability &&
      containerIdentity &&
      cli &&
      environment &&
      mounts
    ) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          environment,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed)
          base = Object.freeze({
            ...base,
            status: "blocked",
            reason: cleanup.reason,
            retainOperationDirectories: true,
            recoveryId,
            manualRecoveryRequired: true,
            cleanup: "unconfirmed",
          });
        else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity.id,
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
          const isHostCleanupVerified = recovered.status === "recovered";
          const isVerified =
            base.status === "candidate" &&
            hasPostRunMountVerified &&
            hasAttachProcessTerminationObserved &&
            isHostCleanupVerified;
          base = Object.freeze({
            ...base,
            status: isVerified ? "verified" : "blocked",
            reason: isVerified
              ? "dynamic_fake_provider_cancellation_verified"
              : isHostCleanupVerified
                ? base.reason
                : recovered.reason,
            containerAbsenceVerified: true,
            attachProcessTerminationObserved:
              hasAttachProcessTerminationObserved,
            hostCleanupVerified: isHostCleanupVerified,
            retainOperationDirectories: !isHostCleanupVerified,
            recoveryId: isHostCleanupVerified ? null : hostRecoveryId,
            manualRecoveryRequired: !isHostCleanupVerified,
            cleanup: isHostCleanupVerified ? "confirmed" : "unconfirmed",
          });
        }
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "docker_probe_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else if (!hasSubmissionStarted) {
      try {
        cleanupOwnedOperationDirectories(owned);
        base = Object.freeze({
          ...base,
          hostCleanupVerified: true,
          cleanup: "confirmed",
        });
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "host_operation_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId: hostRecoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else {
      base = Object.freeze({
        ...base,
        status: "blocked",
        retainOperationDirectories: true,
        recoveryId,
        manualRecoveryRequired: true,
        cleanup: "unconfirmed",
      });
    }
  }
  return Object.freeze({
    ...base,
    attachProcessTerminationObserved: hasAttachProcessTerminationObserved,
    attachProcessTerminationRequestCount,
    diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
    diagnosticFilesystemEffectIssued: true,
  });
}

/**
 * Creates one exact, recoverable verification residue for crash/recovery E2E.
 *
 * @responsibility Dynamic Fake Provider Recoverable Residueの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns DynamicFakeProviderRecoverableResidueResultを返す。
 * @precondition 「owned: unknown」がcreateDynamicFakeProviderRecoverableResidueの入力契約を満たす。
 * @postcondition createDynamicFakeProviderRecoverableResidueの責務を完了した結果だけを返す。
 * @effect N/A: createDynamicFakeProviderRecoverableResidueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDynamicFakeProviderRecoverableResidueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDynamicFakeProviderRecoverableResidueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDynamicFakeProviderRecoverableResidueはProcess内の同一Subsystemで完結する。
 * @security createDynamicFakeProviderRecoverableResidueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDynamicFakeProviderRecoverableResidueは共有非同期状態を持たない同期処理である。
 */
export function createDynamicFakeProviderRecoverableResidue(
  owned: unknown,
): DynamicFakeProviderRecoverableResidueResult {
  const probeId = randomUUID();
  const recoveryNonce = randomUUID();
  let recoveryId: string | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  try {
    const cli = createTrustedDockerCliCapability();
    mountCapability = createOwnedMountCapability(owned);
    let mounts = verifyOwnedMountCapability(mountCapability);
    const environment = dockerEnvironment(mounts.management);
    if (!verifyLocalLinuxEngine(cli, environment))
      throw new Error("docker_backend_platform_unsupported");
    mounts = verifyOwnedMountCapability(mountCapability);
    hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
    hasSubmissionStarted = true;
    recoveryId = writeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      null,
    );
    hasContainerCreateAttempted = true;
    const creation = dockerCommand(
      cli,
      environment,
      dockerCreateArguments(mounts, probeId, CANCELLATION_SOURCE).slice(2),
      30_000,
    );
    const normalizedCreation = normalizeContainerCreation(creation);
    if (normalizedCreation.status !== "confirmed")
      throw new Error("docker_container_identity_unknown");
    const identity = Object.freeze({
      id: normalizedCreation.id,
      probeId,
      source: CANCELLATION_SOURCE,
    });
    const containerCapability = Object.freeze({ kind: "owned_docker_probe" });
    containerIdentities.set(containerCapability, identity);
    recoveryId = writeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      identity.id,
    );
    mounts = verifyOwnedMountCapability(mountCapability);
    if (!inspectOwnedContainer(cli, environment, containerCapability, mounts))
      throw new Error("docker_container_security_profile_mismatch");
    const started = dockerCommand(
      cli,
      environment,
      ["start", identity.id],
      10_000,
    );
    if (started.error || started.status !== 0)
      throw new Error("dynamic_fake_provider_recoverable_start_failed");
    const running = inspectOwnedContainer(
      cli,
      environment,
      containerCapability,
      verifyOwnedMountCapability(mountCapability),
    );
    if (!inspectedContainerIsRunning(running))
      throw new Error("dynamic_fake_provider_recoverable_not_running");
    return Object.freeze({
      status: "ready" as const,
      reason: "dynamic_fake_provider_recoverable_residue_ready",
      recoveryId,
      manualRecoveryRequired: true,
      containerRunning: true,
      diagnosticDockerContainerEffectIssued: true,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false as const,
      runtimeAuthorityIssued: false as const,
      operationCapabilityIssued: false as const,
      realProviderReadiness: false as const,
    });
  } catch (error) {
    if (!hasSubmissionStarted) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        // The blocked result remains recovery-authoritative.
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: normalizeFailure(
        error,
        "dynamic_fake_provider_recoverable_residue_failed",
      ),
      recoveryId,
      manualRecoveryRequired: recoveryId !== null || hasSubmissionStarted,
      containerRunning: false,
      diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false as const,
      runtimeAuthorityIssued: false as const,
      operationCapabilityIssued: false as const,
      realProviderReadiness: false as const,
    });
  }
}

/**
 * expected Dynamic Fake Provider 失敗 Reasonを決定する。
 *
 * @responsibility expected Dynamic Fake Provider 失敗 Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input scenario: DynamicFakeProviderFailureScenario
 * @returns stringを返す。
 * @precondition 「scenario: DynamicFakeProviderFailureScenario」がexpectedDynamicFakeProviderFailureReasonの入力契約を満たす。
 * @postcondition expectedDynamicFakeProviderFailureReasonの責務を完了した結果だけを返す。
 * @effect N/A: expectedDynamicFakeProviderFailureReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedDynamicFakeProviderFailureReasonは独自の失敗分岐を所有しない。
 * @invariant expectedDynamicFakeProviderFailureReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedDynamicFakeProviderFailureReasonはProcess内の同一Subsystemで完結する。
 * @security expectedDynamicFakeProviderFailureReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedDynamicFakeProviderFailureReasonは共有非同期状態を持たない同期処理である。
 */
export function expectedDynamicFakeProviderFailureReason(
  scenario: DynamicFakeProviderFailureScenario,
): string {
  return FAILURE_SCENARIO_SPECS[scenario].expectedReason;
}

/**
 * Docker Isolation 回復 Id 候補かを判定する。
 *
 * @responsibility Docker Isolation 回復 Id 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisDockerIsolationRecoveryIdCandidateの入力契約を満たす。
 * @postcondition isDockerIsolationRecoveryIdCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isDockerIsolationRecoveryIdCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isDockerIsolationRecoveryIdCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isDockerIsolationRecoveryIdCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDockerIsolationRecoveryIdCandidateはProcess内の同一Subsystemで完結する。
 * @security isDockerIsolationRecoveryIdCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDockerIsolationRecoveryIdCandidateは共有非同期状態を持たない同期処理である。
 */
export function isDockerIsolationRecoveryIdCandidate(
  value: unknown,
): value is string {
  if (typeof value !== "string" || value.length > 1024) return false;
  try {
    parseRecoveryToken(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 回復 Tokenを構造化値へ解析する。
 *
 * @responsibility 回復 Tokenの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns Readonly<{ rootName: string; probeId: string; nonce: string; recordHash: string; }>を返す。
 * @precondition 「token: unknown」がparseRecoveryTokenの入力契約を満たす。
 * @postcondition parseRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: parseRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseRecoveryTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security parseRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
function parseRecoveryToken(token: unknown): Readonly<{
  rootName: string;
  probeId: string;
  nonce: string;
  recordHash: string;
}> {
  if (typeof token !== "string")
    throw new Error("docker_recovery_token_invalid");
  const match =
    /^docker\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(
      token,
    );
  if (!match) throw new Error("docker_recovery_token_invalid");
  const rootName = match[1];
  const probeId = match[2];
  const nonce = match[3];
  const recordHash = match[4];
  if (!rootName || !probeId || !nonce || !recordHash)
    throw new Error("docker_recovery_token_invalid");
  return { rootName, probeId, nonce, recordHash };
}

/**
 * 回復 記録を読み込む。
 *
 * @responsibility 回復 記録の読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns LoadedDockerRecoveryを返す。
 * @precondition 「token: unknown」がloadRecoveryRecordの入力契約を満たす。
 * @postcondition loadRecoveryRecordの責務を完了した結果だけを返す。
 * @effect loadRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure loadRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security loadRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function loadRecoveryRecord(token: unknown): LoadedDockerRecovery {
  const parsed = parseRecoveryToken(token);
  const parent = fs.realpathSync(os.tmpdir());
  const root = path.join(parent, parsed.rootName);
  if (
    path.dirname(root) !== parent ||
    fs.realpathSync(root) !== root ||
    fs.lstatSync(root).isSymbolicLink()
  )
    throw new Error("docker_recovery_boundary_failed");
  const management = path.join(root, "management");
  const marker = path.join(management, RECOVERY_FILE);
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    throw new Error("docker_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (
    createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash
  )
    throw new Error("docker_recovery_record_mismatch");
  const record = normalizeDockerRecoveryRecord(JSON.parse(serialized));
  if (
    record.schema !== "crdd-coordinator-docker-recovery/v1" ||
    record.rootName !== parsed.rootName ||
    record.probeId !== parsed.probeId ||
    record.nonceHash !== createHash("sha256").update(parsed.nonce).digest("hex")
  )
    throw new Error("docker_recovery_record_mismatch");
  if (!identityMatchesRecord(root, record.rootIdentity))
    throw new Error("docker_recovery_root_replaced");
  const { children, present: presentChildren } = classifyRecoveryChildren(
    root,
    record.childIdentities,
  );
  if (!presentChildren.includes("management"))
    throw new Error("docker_recovery_management_missing");
  return {
    parsed,
    record,
    root,
    children,
    marker,
    present: new Set(presentChildren),
  };
}

/**
 * 回復 Childrenを分類する。
 *
 * @responsibility 回復 Childrenの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input root: string、childIdentities: Readonly<Record<string, SerializableIdentity>>
 * @returns classifyRecoveryChildrenの計算結果を返す。
 * @precondition 「root: string、childIdentities: Readonly<Record<string, SerializableIdentity>>」がclassifyRecoveryChildrenの入力契約を満たす。
 * @postcondition classifyRecoveryChildrenの責務を完了した結果だけを返す。
 * @effect classifyRecoveryChildrenはFilesystemの読取りまたは書込みを実行する。
 * @failure classifyRecoveryChildrenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant classifyRecoveryChildrenは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security classifyRecoveryChildrenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyRecoveryChildrenは共有非同期状態を持たない同期処理である。
 */
export function classifyRecoveryChildren(
  root: string,
  childIdentities: Readonly<Record<string, SerializableIdentity>>,
) {
  const children = {
    workspace: path.join(root, "workspace"),
    providerHome: path.join(root, "provider-home"),
    tmp: path.join(root, "tmp"),
    events: path.join(root, "events"),
    projection: path.join(root, "projection"),
    management: path.join(root, "management"),
  };
  const byRecordName = {
    workspace: children.workspace,
    "provider-home": children.providerHome,
    tmp: children.tmp,
    events: children.events,
    projection: children.projection,
    management: children.management,
  };
  const knownNames = new Set(Object.keys(byRecordName));
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!knownNames.has(entry.name))
      throw new Error("docker_recovery_unknown_child");
  }
  const present = new Set<string>();
  for (const [name, target] of Object.entries(byRecordName)) {
    try {
      const metadata = fs.lstatSync(target);
      const recordedIdentity = childIdentities[name];
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync(target) !== target ||
        path.dirname(target) !== root ||
        !recordedIdentity ||
        !identityMatchesRecord(target, recordedIdentity)
      )
        throw new Error("docker_recovery_child_replaced");
      present.add(name);
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      throw error;
    }
  }
  return { children, present: [...present].sort() };
}

/**
 * recovery Mountsを決定する。
 *
 * @responsibility recovery Mountsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recovery: LoadedDockerRecovery
 * @returns DockerMountsを返す。
 * @precondition 「recovery: LoadedDockerRecovery」がrecoveryMountsの入力契約を満たす。
 * @postcondition recoveryMountsの責務を完了した結果だけを返す。
 * @effect N/A: recoveryMountsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoveryMountsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoveryMountsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryMountsはProcess内の同一Subsystemで完結する。
 * @security recoveryMountsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryMountsは共有非同期状態を持たない同期処理である。
 */
function recoveryMounts(recovery: LoadedDockerRecovery): DockerMounts {
  for (const name of ["workspace", "provider-home", "tmp", "management"]) {
    if (!recovery.present.has(name))
      throw new Error("docker_recovery_mount_missing");
  }
  return recovery.children;
}

/**
 * recover Docker Isolation Probeを決定する。
 *
 * @responsibility recover Docker Isolation Probeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns recoverDockerIsolationProbeの計算結果を返す。
 * @precondition 「token: unknown」がrecoverDockerIsolationProbeの入力契約を満たす。
 * @postcondition recoverDockerIsolationProbeの責務を完了した結果だけを返す。
 * @effect N/A: recoverDockerIsolationProbeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoverDockerIsolationProbeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverDockerIsolationProbeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverDockerIsolationProbeはProcess内の同一Subsystemで完結する。
 * @security recoverDockerIsolationProbeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverDockerIsolationProbeは共有非同期状態を持たない同期処理である。
 */
export function recoverDockerIsolationProbe(token: unknown) {
  let activeRecoveryId = token;
  try {
    const recovery = loadRecoveryRecord(token);
    const cli = createTrustedDockerCliCapability();
    const environment = dockerEnvironment(recovery.children.management);
    const containerId = recovery.record.container.id;
    if (!containerId) {
      return {
        status: "blocked",
        reason: "docker_recovery_container_identity_unknown",
        recoveryId: token,
      };
    }
    const identity: ContainerIdentity = {
      id: containerId,
      probeId: recovery.record.probeId,
    };
    let absenceCapability = null;
    if (identity.id) {
      absenceCapability = observeContainerAbsence(
        cli,
        environment,
        identity,
        recovery.record.hostRecoveryId,
        recovery.record.rootName,
      );
      if (!absenceCapability) {
        const mounts = recoveryMounts(recovery);
        const capability = Object.freeze({ kind: "recovered_docker_probe" });
        containerIdentities.set(capability, Object.freeze(identity));
        const inspect = inspectOwnedContainer(
          cli,
          environment,
          capability,
          mounts,
        );
        if (!inspect)
          return {
            status: "blocked",
            reason: "docker_recovery_container_mismatch",
            recoveryId: token,
          };
        const cleanup = cleanupOwnedContainer(
          cli,
          environment,
          capability,
          mounts,
          recovery.record.hostRecoveryId,
        );
        if (!cleanup.confirmed)
          return {
            status: "blocked",
            reason: cleanup.reason,
            recoveryId: token,
          };
        absenceCapability = cleanup.absenceCapability;
      }
    }
    const absence = confirmDockerAbsence(
      recovery.record.hostRecoveryId,
      null,
      absenceCapability,
      {
        probeId: identity.probeId,
        id: identity.id,
        rootName: recovery.record.rootName,
        cli,
      },
    );
    activeRecoveryId = absence.hostRecoveryId;
    const recovered = recoverOwnedOperationDirectories(absence.hostRecoveryId);
    const normalized = normalizeHostCleanupResult(
      recovered,
      absence.hostRecoveryId,
      {
        status: "recovered",
        reason: "docker_probe_recovery_completed",
      },
    );
    return normalized.hostCleanupCompleted
      ? normalized
      : { ...normalized, status: "blocked" };
  } catch (error) {
    return {
      status: "blocked",
      reason: normalizeFailure(error, "docker_probe_recovery_failed"),
      recoveryId: activeRecoveryId,
      hostCleanupCompleted: false,
    };
  }
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  backend: "docker_desktop_linux",
  endpoint: "local_named_pipe",
  dockerCliTrust:
    "fixed_path_valid_windows_authenticode_docker_inc_and_operation_snapshot",
  imagePinnedByDigest: true,
  networkMode: "none",
  dynamicFakeProviderProcessImplemented: true,
  realProviderProcessesExecuted: false,
});
