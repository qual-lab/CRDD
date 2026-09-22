/**
 * 署名Route Matrixが公開し得る固定診断理由を定義する。
 *
 * @responsibility ProducerとVerification Recordが共有するexact vocabularyを所有する。
 * @trace ARCH-000003
 * @input N/A: 固定語彙だけを定義するModuleである。
 * @returns N/A: 関数を公開せず、読取り専用の固定値だけを公開する。
 * @precondition N/A: 初期化前に満たす外部条件はない。
 * @postcondition Route Matrixの公開理由が単一の固定Registryから参照可能になる。
 * @effect N/A: 外部Effectを発行しない。
 * @failure N/A: Runtime入力を処理しない。
 * @invariant 未知値、自由文およびProvider生出力をRegistryへ含めない。
 * @boundary 署名Route Matrix ProducerとVerification Record投影の共有境界。
 * @security exactな固定値だけを公開し、prefixまたは正規表現による許可へ拡張しない。
 * @concurrency N/A: 不変の固定値だけを公開する。
 */
export const SIGNED_ROUTE_MATRIX_REASONS = Object.freeze({
  completed: "signed_route_matrix_completed",
  incomplete: "signed_route_matrix_incomplete",
  failedClosed: "signed_route_matrix_failed_closed",
  argumentsInvalid: "signed_route_matrix_arguments_invalid",
  routeRunnerFailedClosed: "signed_route_matrix_route_runner_failed_closed",
  processRestartRequired: "signed_route_matrix_process_restart_required",
} as const);
