/**
 * Docker技術資源の回収入力と観測結果を定義する。
 * @responsibility 上位の保存形式やTask判断を持たず、元構成とReceiptを表す。
 * @trace ARCH-000008
 */

import type {
  DirectoryInspectionInput,
  DirectoryCleanupResult,
  RepairDisposalInput,
} from "../docker-desktop/repair-session.ts";
import type {
  IsolationCleanupRequest,
  IsolationExecutionResult,
} from "../execution/types.ts";
import type { RepairRetentionTargets } from "../docker-desktop/types.ts";
import type { DockerContainerConfigurationExpectation } from "./configuration.ts";

/**
 * 用途によらない一資源のIdentityと技術構成期待値。
 *
 * @responsibility 資源種別・実ID・名前・Labelと必要な構成を明示する。
 * @trace ARCH-000008
 * @shape Network・Image・User・Mount・Init・Tmpfsの照合値。
 * @invariant この値だけでは実在・所有・処置許可を証明しない。
 * @boundary 検査済み計画から現在Docker観測への境界。
 * @security 非秘密Mount元だけを保持し、認証値と処置許可を含めない。
 * @compatibility Mount元nullとTmpfs nullは既存の非照合条件を表す。
 */
export type DockerResourceExpectation = Readonly<{
  key: string;
  kind: "container" | "network";
  dockerId: string;
  expectedName: string;
  ownershipLabel: string;
  expectedImage: string | null;
  shouldBeInternal: boolean | null;
  expectedNetworks: readonly string[];
  expectedUser: "65532:65532" | "65534:65534" | null;
  expectedMounts: readonly Readonly<{
    destination: string;
    readWrite: boolean;
    source: string | null;
  }>[];
  initRequired: boolean;
  tmpfsBytes: 16777216 | null;
}>;

/** 元Receiptの最小識別情報。実行構成は削除条件へ使わない。 */
export type ResourceIdentity = Readonly<{
  kind: "container" | "network";
  dockerId: string | null;
  name: string;
  ownershipLabel: string;
}>;

/** 非秘密の構成投影。環境値・Command引数は既定で非公開にする。 */
export type ResourceConfiguration = Readonly<{
  image: string | null;
  command: readonly string[] | null;
  environmentNames: readonly string[] | null;
  mounts:
    | readonly Readonly<{
        source: string;
        target: string;
        readOnly: boolean;
      }>[]
    | null;
  networks: readonly string[] | null;
  internal: boolean | null;
}>;

/** 資源の観測事実。Snapshotは保存指示や削除Authorityではない。 */
export type ResourceSnapshot = Readonly<{
  resources: readonly Readonly<{
    key: string;
    identity: ResourceIdentity;
    request: "not_issued" | "issued" | "unknown";
    configuration: ResourceConfiguration;
  }>[];
}>;

/**
 * 指定Snapshotから現在観測した技術資源の結果。
 * @responsibility 存在・不存在・不明とconfig終了を区別する。
 * @trace ARCH-000008
 * @shape 資源key、元実ID、存在三値、理由とconfig終了確認。
 * @invariant 診断の成功を削除許可・保存確定へ昇格しない。
 * @boundary 同期の技術観測からExecutorの結果解釈。
 * @security 認証内容・生出力・操作権限を含めない。
 * @compatibility 観測できた実体だけをSnapshotへ返す。
 */
export type SnapshotResourceInspection = Readonly<{
  resourceSnapshot: ResourceSnapshot;
  status: "completed" | "blocked";
  reason: string;
  configCleanupConfirmed: boolean;
  resources: readonly Readonly<{
    key: string;
    plannedResourceName: string;
    dockerId: string | null;
    observation: "not_requested" | "present" | "absent" | "unknown";
    absenceObservations: readonly ("absent" | "unknown")[];
  }>[];
}>;

/**
 * 上位で選定済みの単一Containerと、作成時の同じ技術構成。
 * @responsibility 用途・保持・保存を知らず元構成と取消状態だけを借用する。
 * @trace ARCH-000008
 * @shape container種別、作成構成、借用管理領域と取消Signal。
 * @invariant IDだけで処置せず資源の照合を維持し、取消後の前進処置を止める。
 * @boundary 上位の対象選定と既存資源API。
 * @security 任意Path削除や構成検査の省略を公開しない。
 * @compatibility 保存Schema・用途種別・既存Attempt契約を変更しない。
 */
export type ContainerResourceTarget = Readonly<{
  kind: "container";
  configuration:
    | DockerContainerConfigurationExpectation
    | Pick<
        DockerContainerConfigurationExpectation,
        "id" | "name" | "ownershipLabel"
      >;
  managementDirectory: string;
  signal?: AbortSignal;
}>;

/**
 * 単一Containerの現在観測。不明を不存在へ畳まない。
 * @responsibility Running肯定と不存在を分離する。
 * @trace ARCH-000008
 * @shape present・absent・unknownとRunning肯定。
 * @invariant 観測だけで保存完了や回収許可を確定しない。
 * @boundary DIの現在観測から上位の判断へ返す。
 * @security 生inspect・秘密・実行許可を含めない。
 * @compatibility Runningの否定を不存在に読み替えない。
 */
export type ContainerResourceInspection = Readonly<{
  observation: "present" | "absent" | "unknown";
  runningConfirmed: boolean;
  snapshot: ResourceSnapshot | null;
}>;

/**
 * 固定Docker runtime Directoryの観測対象。
 * @responsibility DIの固定入力を外側の資源種別へ結合する。
 * @trace ARCH-000008
 * @shape 固定kindとDI正本の元input。
 * @invariant 任意Path・保持期限・廃棄判断を含めない。
 * @boundary 共通資源APIからDIの二読取り。
 * @security 観測から処置権限を生成しない。
 * @compatibility kindをDIの閉形式inputへ混入しない。
 */
export type DirectoryResourceInspectionTarget = Readonly<{
  kind: "docker_runtime_directory";
  input: DirectoryInspectionInput;
}>;

/**
 * 固定用途のDirectory処置対象。
 * @responsibility DIの固定処置入力だけを種別へ結合する。
 * @trace ARCH-000008
 * @shape 固定kindとScope・用途・現在Queryを持つ元input。
 * @invariant 許可と用途Intentは上位が確認し、Executorは保存しない。
 * @boundary 共通資源APIからDIの元Promise。
 * @security 任意Path削除・期限による自動処置へ拡張しない。
 * @compatibility 元inputとSignal・Queryの参照を保持する。
 */
export type DirectoryResourceCleanupTarget = Readonly<{
  kind: "docker_runtime_directory";
  input: RepairDisposalInput;
}>;

/**
 * 資源種別と操作に対応する既存の必須入力を選択する。
 * @responsibility 観測入力と廃棄入力を混ぜず、技術入口の入力関係を示す。
 * @trace ARCH-000008
 * @invariant 実行時のkind・保存Schema・同期性は変更しない。
 */
export type ResourceTarget<
  K extends keyof ResourceOperations = keyof ResourceOperations,
  A extends "inspect" | "cleanup" = "inspect" | "cleanup",
> = ResourceOperations[K][A];

/** 共通観測の名前から、種別固有の不明・nullを保持して返す。 */
export type ResourceInspection<
  K extends keyof ResourceOperations = keyof ResourceOperations,
> = ResourceOperations[K]["inspection"];

/** 回収完了の技術結果。Snapshotの実行Handleとは区別する。 */
export type ResourceCleanupResult<
  K extends keyof ResourceOperations = keyof ResourceOperations,
> = ResourceOperations[K]["cleanupResult"];

interface ResourceOperations {
  snapshot: {
    inspect: IsolationCleanupRequest;
    cleanup: IsolationCleanupRequest;
    inspection: SnapshotResourceInspection;
    cleanupResult: IsolationExecutionResult;
  };
  container: {
    inspect: ContainerResourceTarget;
    cleanup: ContainerResourceTarget;
    inspection: ContainerResourceInspection;
    cleanupResult: Readonly<{ confirmed: boolean; reason: string }>;
  };
  directory: {
    inspect: DirectoryResourceInspectionTarget;
    cleanup: DirectoryResourceCleanupTarget;
    inspection: RepairRetentionTargets | null;
    cleanupResult: DirectoryCleanupResult;
  };
}
