/**
 * Docker子Processの共通結果と有界出力の判定を所有する。
 * @responsibility OSやAIに依存せず、観測結果と技術的失敗を分類する。
 * @trace ARCH-000008
 */
export const STDOUT_LIMIT_BYTES = 1_048_576;
export const STDERR_LIMIT_BYTES = 262_144;

/**
 * 子Processの完了時に得られた共通観測値。
 * @responsibility 終了値、Signal、捕捉出力と出力超過を分離して搬送する。
 * @trace ARCH-000008
 * @shape 終了値、Signalまたはnull、stdout、stderr、出力超過。
 * @invariant nullを終了成功やProcess不存在へ変換しない。
 * @boundary 子Processの観測と技術結果判定。
 * @security 出力本文を診断へ公開する権限は含まない。
 * @compatibility 既存Process Handleの結果fieldを維持する。
 */
export type CommandObservation = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  outputExceeded: boolean;
}>;

/**
 * Node Process APIが返す終了結果の型を保持する。
 * @responsibility 共通観測値にNode標準のSignal型を結合する。
 * @trace ARCH-000008
 * @shape 共通の完了観測。SignalだけNode APIの型へ限定する。
 * @invariant OS別の手順・Path・権限を含めない。
 * @boundary Node Process APIと共通観測値。
 * @security 型から実行許可や不存在を発行しない。
 * @compatibility 元のCommand Handle返却型を維持する。
 */
export type CommandExecution = Omit<CommandObservation, "signal"> &
  Readonly<{ signal: NodeJS.Signals | null }>;

/**
 * 完了観測を共通の終了値分類へ投影する。
 * @responsibility Signalと未観測を数値終了から区別する。
 * @trace ARCH-000008
 * @input execution: 元の完了観測。未観測はnull。
 * @returns 出力本文を含まない終了値分類。
 * @precondition 実行Ownerが元のProcess結果を取得している。
 * @postcondition 同じ分類を通知と最終結果へ利用できる。
 * @effect N/A: 入力値だけを読む。
 * @failure N/A: 未観測はnot_observedとして返す。
 * @invariant 既存の終了値分類語彙とSignal優先順を保持する。
 * @boundary Process結果と機密を含まない技術投影。
 * @security 出力本文、OS Path、実行許可を公開しない。
 * @concurrency N/A: 同期の純粋判定。
 */
export function classifyDockerProcessExit(
  execution: CommandObservation | null,
) {
  if (!execution) return "not_observed" as const;
  if (execution.signal !== null) return "signal" as const;
  if (execution.status === 0) return "zero" as const;
  if (execution.status === 1) return "one" as const;
  if (execution.status === 126) return "one_two_six" as const;
  if (execution.status === 127) return "one_two_seven" as const;
  return execution.status === null
    ? ("not_observed" as const)
    : ("other_nonzero" as const);
}

/**
 * Dockerコマンドの完了と技術的失敗を分類する。
 * @responsibility 期限、出力上限、Signal、非0終了を別の事実として返す。
 * @trace ARCH-000008
 * @input execution: 元のProcess結果。期限内未完了はnull。
 * @returns 技術分類と捕捉出力のUTF-8 byte数。
 * @precondition 出力は同じ所有Processが取得した値である。
 * @postcondition AI固有の理由や業務上の成功を生成しない。
 * @effect N/A: byte数の計算と入力値の読取りだけ。
 * @failure 出力超過をSignalや非0終了より先に保持する。
 * @invariant 技術完了は資源清掃・認証・AI結果成立を意味しない。
 * @boundary Process観測と上位の目的別解釈。
 * @security 本文を結果へ複製せず、許可や再試行を決めない。
 * @concurrency N/A: 同期の純粋判定。
 */
export function classifyDockerCommandExecution(
  execution: CommandObservation | null,
) {
  if (execution === null)
    return Object.freeze({ category: "deadline_exceeded" as const });
  const stdoutBytes = Buffer.byteLength(execution.stdout, "utf8");
  const stderrBytes = Buffer.byteLength(execution.stderr, "utf8");
  const category =
    execution.outputExceeded ||
    stdoutBytes > STDOUT_LIMIT_BYTES ||
    stderrBytes > STDERR_LIMIT_BYTES
      ? ("output_limit_exceeded" as const)
      : execution.signal !== null
        ? ("signalled" as const)
        : execution.status !== 0
          ? ("nonzero_exit" as const)
          : ("completed" as const);
  return Object.freeze({ category, stdoutBytes, stderrBytes });
}

/**
 * 例外を秘密値のない固定分類へ変換する。
 *
 * @responsibility 既知の内部拒否とOS失敗だけを診断へ残す。
 * @trace ARCH-000008
 * @input error: 捕捉した未知の例外。
 * @returns 固定分類またはunclassified_exception。
 * @precondition N/A: 任意の例外値を受け取る。
 * @postcondition 自由文とstackを返さない。
 * @effect N/A: own data propertyだけを読む。
 * @failure 不正値やProxyの例外はunclassified_exceptionへ閉じる。
 * @invariant getterを呼ばず、未知の文字列を公開しない。
 * @boundary 内部例外から受動診断への変換。
 * @security Path、秘密値やProvider出力を複製しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function classifyDockerCommandException(error: unknown): string {
  const allowed = new Set([
    "ENOENT",
    "EACCES",
    "EPERM",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EPIPE",
    "docker_effect_management_required",
    "docker_effect_plan_invalid",
    "docker_effect_plan_replaced",
    "docker_effect_command_not_owned",
    "docker_effect_platform_unsupported",
    "docker_effect_cli_untrusted",
    "docker_effect_cli_replaced",
    "docker_effect_path_invalid",
    "docker_effect_config_invalid",
    "docker_effect_config_replaced",
    "docker_effect_filesystem_identity_invalid",
    "owned_operation_management_binding_required",
    "owned_operation_unknown_child",
    "owned_operation_child_replaced",
    "owned_operation_mount_replaced",
  ]);
  try {
    if (!error || typeof error !== "object") return "unclassified_exception";
    for (const key of ["code", "message"]) {
      const descriptor = Object.getOwnPropertyDescriptor(error, key);
      if (
        descriptor &&
        Object.hasOwn(descriptor, "value") &&
        allowed.has(descriptor.value)
      )
        return descriptor.value;
    }
  } catch {
    // A hostile error object is not a source of diagnostic text.
  }
  return "unclassified_exception";
}
