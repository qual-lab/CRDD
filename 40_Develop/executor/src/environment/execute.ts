/**
 * Attemptとは独立したDocker実行環境の技術窓口。
 * @responsibility 既存Docker Isolationの観測・再起動へ薄く接続する。
 * @trace ARCH-000008
 * @boundary 上位の現在判断と下位の固定環境操作。
 */
import {
  observeDockerRuntimeBackendState,
  observeDockerRuntimeEngine,
  restartDockerRuntime,
  type DockerRuntimeRestartInput,
  type DockerRuntimeRestartResult,
} from "../../../docker-isolation/src/index.ts";
import type { DockerEnvironmentStatus } from "./types.ts";

/**
 * 現在のbackendとEngineを逐次観測する。
 * @responsibility 観測不能と観測資源の終了未確認を変換せず返す。
 * @trace ARCH-000008
 * @input N/A: 固定の現在環境を観測する。
 * @returns backendとEngineそれぞれの技術結果。
 * @precondition 呼出し元が環境読取りを許可している。
 * @postcondition 起動・再起動・修復・Container作成は発行しない。
 * @effect 既存DIの有界なOS一覧・Engine読取りとその観測資源の終了。
 * @failure 下位のunknown・cleanup未確認を保持する。
 * @invariant readyを全資源停止・過去要求の成功・操作許可へ昇格しない。
 * @boundary Host全体の環境観測と上位判断。
 * @security Repository・認証情報・任意コマンドを受け取らない。
 * @concurrency 逐次観測はatomicではない。新しい待機や再試行を追加しない。
 */
export function inspectDockerEnvironment(): DockerEnvironmentStatus {
  return Object.freeze({
    backend: observeDockerRuntimeBackendState(),
    engine: observeDockerRuntimeEngine(),
  });
}

/**
 * 上位が選んだ一要求を既存の環境再起動へ渡す。
 * @responsibility 現在許可・通知・取消・技術結果をそのまま搬送する。
 * @trace ARCH-000008
 * @input request: 同じ要求ID、Signal、現在境界確認と同期通知。
 * @returns DIの元Promiseと技術結果・通知配送結果。
 * @precondition 上位が影響・現在の許可・必要な排他と保存を所有する。
 * @postcondition 補助資源の終了を含む既存DIの一操作を返す。
 * @effect DIの固定Docker Desktop停止・起動・観測・回収。
 * @failure 未発行・unknown・取消・回収未確認・配送未確認を保持する。
 * @invariant 診断の先行実行を必須にせず、各Effect前の現在確認を省略しない。
 * @boundary 上位の判断・保存と下位技術操作。
 * @security IDだけで処置を許可せず、既存verifyBoundaryとIntent通知を維持する。
 * @concurrency 新しいOwner・Lock・State・自動再送は作らない。
 */
export function restartDockerEnvironment(
  request: DockerRuntimeRestartInput,
): Promise<DockerRuntimeRestartResult> {
  return restartDockerRuntime(request);
}
