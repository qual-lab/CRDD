import { isSupportedCoordinatorNodeRuntime } from "./node-runtime-version.ts";

export const COORDINATOR_LAUNCH_ENTRIES = Object.freeze({
  task: "./coordinator.ts",
  interactive: "./coordinator.ts",
  automation: "./coordinator.ts",
  "verify-routes": "../scripts/verify-signed-route-matrix.ts",
  "verify-recovery": "../scripts/verify-signed-recovery-matrix.ts",
  "sign-release": "../scripts/sign-release-manifest.ts",
});

type LaunchMode = keyof typeof COORDINATOR_LAUNCH_ENTRIES;
type LaunchObservation = Readonly<{
  nodeVersion: string;
  stdinIsTty: boolean;
  stdoutIsTty: boolean;
  stdoutWritable: boolean;
}>;

// A routing plan, not execution authority. Each target retains its own gates.
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
