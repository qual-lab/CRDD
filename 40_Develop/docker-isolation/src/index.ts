/**
 * Docker隔離の技術構成と実行資源操作の公開入口。
 *
 * @packageDocumentation
 * @responsibility 必要な技術APIを明示公開し、上位のTask・Provider判断を公開契約に含めない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 上位の検証済み技術投影とDocker・所有Processの実処置。
 * @effect 固定操作で使い捨て資源を開始・観測・終端し、元結果を返す。
 * @security Task・送信許可・Credential・永続Stateを所有せず、実ID／固定構成の照合前に削除しない。
 */

export { describeIsolationConfiguration } from "./configuration.ts";
export type {
  ResourceInspection,
  ResourceTarget,
  ResourceCleanupResult,
  ResourceSnapshot,
} from "./cleanup/types.ts";
export {
  inspectDockerEnvironment,
  restartDockerEnvironment,
} from "./docker-desktop/operations.ts";
export type { DockerEnvironmentRestartEvent } from "./docker-desktop/restart.ts";
export type {
  DockerEnvironmentRequest,
  DockerEnvironmentResult,
  DockerEnvironmentStatus,
} from "./docker-desktop/types.ts";
export {
  cleanupIsolation,
  executeIsolation,
  inspectIsolation,
  prepareIsolation,
} from "./execution/operations.ts";
export type { IsolationCommandResult } from "./execution/result.ts";
export type {
  IsolationCallbacks,
  IsolationExecution,
  IsolationExecutionResult,
  IsolationRequest,
  PreparedIsolation,
} from "./execution/types.ts";
export type { IsolationConfiguration } from "./image/types.ts";
