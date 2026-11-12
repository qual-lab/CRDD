/**
 * 実行モデル自身の固定保存領域と観測結果を定義する。
 * @responsibility domain-modelとtmpだけを対象とし、他モデルの保存先を選択しない。
 * @trace ARCH-000011
 * @boundary 実行保存の私有技術型。Pathや値一致からAuthorityを付与しない。
 */
export type RepositoryRuntimeArea = "domain-model" | "tmp";

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
