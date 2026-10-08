/**
 * Repository内容とRuntime保存領域の値契約を定義する。
 *
 * @packageDocumentation
 * @responsibility 検証済みRepository Rootに結合した観測結果と保存領域の型を所有する。
 * @trace ARCH-000008
 * @trace ARCH-000009
 */
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";

/**
 * Repository内容を副作用なしで観測する公開境界。
 *
 * @responsibility 検証済みRoot内のEntryとFile内容を構造化して返す。
 * @trace ARCH-000008
 * @shape RepositoryEntryKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryEntryKindで宣言した値と責務の対応を維持する。
 * @boundary Version Control AdapterとDomain利用側の間の観測境界。
 * @security N/A: RepositoryEntryKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryEntryKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryEntryKind =
  | "file"
  | "directory"
  | "symbolic-link"
  | "other";

/**
 * indexで使用するRepository Directory Entryの値契約を定義する。
 *
 * @responsibility Repository Directory EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryDirectoryEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryDirectoryEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryDirectoryEntryの宣言は外部境界を開かない。
 * @security N/A: RepositoryDirectoryEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryDirectoryEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryDirectoryEntry = Readonly<{
  name: string;
  kind: RepositoryEntryKind;
}>;

/**
 * indexで使用するRepository File Observationの値契約を定義する。
 *
 * @responsibility Repository File ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryFileObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryFileObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryFileObservationの宣言は外部境界を開かない。
 * @security N/A: RepositoryFileObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryFileObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryFileObservation = Readonly<
  | {
      status: "resolved";
      repositoryRelativePath: string;
      targetPath: string;
      source: string;
    }
  | {
      status: "invalid" | "unobservable";
      repositoryRelativePath: string;
      reason: string;
    }
>;

/**
 * indexで使用するRepository Directory Observationの値契約を定義する。
 *
 * @responsibility Repository Directory ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryDirectoryObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryDirectoryObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryDirectoryObservationの宣言は外部境界を開かない。
 * @security N/A: RepositoryDirectoryObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryDirectoryObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryDirectoryObservation = Readonly<
  | {
      status: "resolved";
      repositoryRelativePath: string;
      targetPath: string;
      entries: readonly RepositoryDirectoryEntry[];
    }
  | {
      status: "invalid" | "unobservable";
      repositoryRelativePath: string;
      reason: string;
    }
>;

/**
 * indexで使用するRepository Observation Portの値契約を定義する。
 *
 * @responsibility Repository Observation PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryObservationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryObservationPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryObservationPortの宣言は外部境界を開かない。
 * @security N/A: RepositoryObservationPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryObservationPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryObservationPort = Readonly<{
  observeFile: (repositoryRelativePath: string) => RepositoryFileObservation;
  observeDirectory: (
    repositoryRelativePath: string,
  ) => RepositoryDirectoryObservation;
}>;

/**
 * indexで使用するRepository Root Capabilityの値契約を定義する。
 *
 * @responsibility Repository Root CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryRootCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRootCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRootCapabilityの宣言は外部境界を開かない。
 * @security N/A: RepositoryRootCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRootCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRootCapability = VerifiedRepositoryRoot;
import type { REPOSITORY_AREAS } from "../configuration/storage-paths.ts";

/**
 * runtime-data-path-resolverで使用するRepository Runtime Areaの値契約を定義する。
 *
 * @responsibility Repository Runtime AreaのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape RepositoryRuntimeAreaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRuntimeAreaで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRuntimeAreaの宣言は外部境界を開かない。
 * @security N/A: RepositoryRuntimeAreaはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRuntimeAreaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRuntimeArea = (typeof REPOSITORY_AREAS)[number];

/**
 * 既存Runtime領域の読取り専用観測結果を定義する。
 * @responsibility 不存在、境界不正、観測不能、検証済み既存領域を区別する。
 * @trace ARCH-000011
 * @shape readyは名前付きareaと不透明な境界Identity、他状態は閉じたreasonを持つ。
 * @invariant private Runtime RootのPathや書込みAuthorityを公開しない。
 * @boundary Runtime Data Ownerと名前付き領域の利用側。
 * @security boundaryIdentityは置換検知用の非Authority参照である。
 * @compatibility areaの作成入口とは独立した読取り専用APIである。
 */
export type RepositoryRuntimeDataAreaObservation =
  | Readonly<{
      status: "ready";
      repositoryRoot: string;
      directory: string;
      boundaryIdentity: string;
      effectIssued: false;
    }>
  | Readonly<{
      status: "not_observed";
      reason: "repository_runtime_data_area_absent";
      effectIssued: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "repository_runtime_data_root_capability_invalid"
        | "repository_runtime_data_area_boundary_invalid"
        | "repository_runtime_data_area_observation_failed";
      effectIssued: false;
    }>;

/**
 * runtime-data-path-resolverで使用するCros Root 入力の値契約を定義する。
 *
 * @responsibility Cros Root 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape CrosRootInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CrosRootInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CrosRootInputの宣言は外部境界を開かない。
 * @security N/A: CrosRootInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CrosRootInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CrosRootInput = Readonly<{
  platform: "win32" | "linux";
  trustDomainId: string;
  publisher: string;
  application: "cros";
  localAppData?: string;
  xdgConfigHome?: string;
  xdgStateHome?: string;
  xdgRuntimeDirectory?: string;
  homeDirectory?: string;
}>;
