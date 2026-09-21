/**
 * coordinator-launchに属する責務をまとめる。
 *
 * @responsibility LaunchModeを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { isSupportedCoordinatorNodeRuntime } from "./node-runtime-version.ts";

export const COORDINATOR_LAUNCH_ENTRIES = Object.freeze({
  task: "./coordinator.ts",
  interactive: "./coordinator.ts",
  automation: "./coordinator.ts",
  "verify-routes": "../scripts/verify-signed-route-matrix.ts",
  "verify-recovery": "../scripts/verify-signed-recovery-matrix.ts",
  "sign-release": "../scripts/sign-release-manifest.ts",
  "promote-release": "../scripts/promote-release-manifest.ts",
});

/**
 * coordinator-launchで使用するLaunch Modeの値契約を定義する。
 *
 * @responsibility Launch ModeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LaunchModeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LaunchModeで宣言した値と責務の対応を維持する。
 * @boundary N/A: LaunchModeの宣言は外部境界を開かない。
 * @security N/A: LaunchModeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LaunchModeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LaunchMode = keyof typeof COORDINATOR_LAUNCH_ENTRIES;
/**
 * coordinator-launchで使用するLaunch Observationの値契約を定義する。
 *
 * @responsibility Launch ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LaunchObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LaunchObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: LaunchObservationの宣言は外部境界を開かない。
 * @security N/A: LaunchObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LaunchObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LaunchObservation = Readonly<{
  nodeVersion: string;
  stdinIsTty: boolean;
  stdoutIsTty: boolean;
  stdoutWritable: boolean;
}>;

// A routing plan, not execution authority. Each target retains its own gates.
/**
 * Coordinator Launchを一意に解決する。
 *
 * @responsibility Coordinator Launchの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]、observation: LaunchObservation
 * @returns resolveCoordinatorLaunchの計算結果を返す。
 * @precondition 「args: readonly string[]、observation: LaunchObservation」がresolveCoordinatorLaunchの入力契約を満たす。
 * @postcondition resolveCoordinatorLaunchの責務を完了した結果だけを返す。
 * @effect N/A: resolveCoordinatorLaunchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveCoordinatorLaunchは独自の失敗分岐を所有しない。
 * @invariant resolveCoordinatorLaunchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveCoordinatorLaunchはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveCoordinatorLaunchはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveCoordinatorLaunchは共有非同期状態を持たない同期処理である。
 */
export function resolveCoordinatorLaunch(
  args: readonly string[],
  observation: LaunchObservation,
) {
  const blocked = (reason: string) =>
    Object.freeze({ status: "blocked" as const, reason });
  if (!isSupportedCoordinatorNodeRuntime(observation.nodeVersion)) {
    return blocked("coordinator_node_version_unsupported");
  }
  const mode = args[0];
  if (!mode || !Object.hasOwn(COORDINATOR_LAUNCH_ENTRIES, mode)) {
    return blocked("coordinator_launch_mode_invalid");
  }
  const suppliedArgs = args.slice(1);
  const forwardedArgs =
    mode === "task" ? ["task", ...suppliedArgs] : suppliedArgs;
  if (
    forwardedArgs.some((arg) => arg.includes("\0")) ||
    ((mode === "verify-routes" || mode === "verify-recovery") &&
      forwardedArgs.length !== 0) ||
    (mode === "promote-release" && forwardedArgs.length !== 0) ||
    (mode === "automation" && !forwardedArgs.includes("--json")) ||
    (mode === "task" &&
      (!suppliedArgs.includes("--request-stdin") ||
        !suppliedArgs.includes("--json")))
  ) {
    return blocked("coordinator_launch_arguments_invalid");
  }
  if (
    (mode === "interactive" ||
      mode === "verify-routes" ||
      mode === "sign-release") &&
    (!observation.stdoutIsTty || !observation.stdoutWritable)
  ) {
    return blocked("coordinator_launch_terminal_output_required");
  }
  if (mode === "sign-release" && !observation.stdinIsTty) {
    return blocked("coordinator_launch_terminal_input_required");
  }
  if ((mode === "automation" || mode === "task") && observation.stdoutIsTty) {
    return blocked("coordinator_launch_machine_output_required");
  }
  return Object.freeze({
    status: "ready" as const,
    mode: mode as LaunchMode,
    entryRelativePath: COORDINATOR_LAUNCH_ENTRIES[mode as LaunchMode],
    forwardedArgs: Object.freeze(forwardedArgs),
  });
}

/**
 * coordinator Launch 失敗 Messageを決定する。
 *
 * @responsibility coordinator Launch 失敗 Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns coordinatorLaunchFailureMessageの計算結果を返す。
 * @precondition 「reason: string」がcoordinatorLaunchFailureMessageの入力契約を満たす。
 * @postcondition coordinatorLaunchFailureMessageの責務を完了した結果だけを返す。
 * @effect N/A: coordinatorLaunchFailureMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: coordinatorLaunchFailureMessageは独自の失敗分岐を所有しない。
 * @invariant coordinatorLaunchFailureMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: coordinatorLaunchFailureMessageはProcess内の同一Subsystemで完結する。
 * @security N/A: coordinatorLaunchFailureMessageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: coordinatorLaunchFailureMessageは共有非同期状態を持たない同期処理である。
 */
export function coordinatorLaunchFailureMessage(reason: string) {
  switch (reason) {
    case "coordinator_node_version_unsupported":
      return "対応するNode.jsで起動してください。実処理は開始していません。";
    case "coordinator_launch_mode_invalid":
      return "起動用途を確認してください。--helpで一覧を表示できます。";
    case "coordinator_launch_arguments_invalid":
      return "起動用途と引数が一致しません。実処理は開始していません。";
    case "coordinator_launch_terminal_output_required":
      return "画面へ表示できる端末から直接起動してください。出力のファイル転送やパイプ接続は使えません。実処理は開始していません。";
    case "coordinator_launch_terminal_input_required":
      return "秘密入力を受け付ける端末から直接起動してください。実処理は開始していません。";
    case "coordinator_launch_machine_output_required":
      return "自動処理の結果は機械向けの接続へ渡してください。端末で操作する場合はinteractiveを使ってください。実処理は開始していません。";
    default:
      return "実行入口で予期しない失敗が発生しました。実行状態と資源回収は未確認です。自動再試行せず、対象の記録を確認してください。";
  }
}
