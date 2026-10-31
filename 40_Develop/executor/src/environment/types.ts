/**
 * HostのDocker実行環境に関する一時点の技術観測を定義する。
 * @responsibility 下位所有の観測型を再利用し、許可・保存状態を含めない。
 * @trace ARCH-000008
 * @boundary Executorの環境診断と利用側。
 */
import type {
  DockerRuntimeBackendState,
  DockerRuntimeEngineObservation,
} from "../../../docker-isolation/src/index.ts";

/**
 * backendとEngineの逐次観測結果。
 * @responsibility 不明と観測資源の終了確認を独立して保持する。
 * @trace ARCH-000008
 * @shape backendの稼働分類とEngineの状態・cleanup。
 * @invariant atomicなSnapshotや再起動許可として扱わない。
 * @boundary 技術観測から上位判断への値搬送。
 * @security Path・認証情報・操作権限を含めない。
 * @compatibility 各観測の意味と期限はDocker Isolationの契約に従う。
 */
export type DockerEnvironmentStatus = Readonly<{
  backend: DockerRuntimeBackendState;
  engine: DockerRuntimeEngineObservation;
}>;
