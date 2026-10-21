/**
 * Windows端末出力の技術的な完了を観測する。
 * @responsibility TTY書込み、callback、errorと終了不明の相関を所有する。
 * @trace ARCH-000008
 */
export const WINDOWS_TERMINAL_WRITE_TIMEOUT_MS = 1_000;

/**
 * interactive-consoleで使用するInteractive Console Text Write Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Text Write OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleTextWriteOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleTextWriteOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleTextWriteOutcomeの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleTextWriteOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleTextWriteOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleTextWriteOutcome = Readonly<{
  status: "completed" | "write_failed" | "cleanup_unknown";
}>;
/**
 * interactive-consoleで使用するWindows Terminal Streamの値契約を定義する。
 *
 * @responsibility Windows Terminal StreamのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape WindowsTerminalStreamが表すProperty、識別子およびRelationを型として固定する。
 * @invariant WindowsTerminalStreamで宣言した値と責務の対応を維持する。
 * @boundary N/A: WindowsTerminalStreamの宣言は外部境界を開かない。
 * @security N/A: WindowsTerminalStreamはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility WindowsTerminalStreamの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type WindowsTerminalStream = Readonly<{
  isTTY?: boolean;
  destroyed: boolean;
  writable: boolean;
  once: (event: "error", listener: () => void) => unknown;
  removeListener: (event: "error", listener: () => void) => unknown;
  write: (value: string, callback: (error?: Error | null) => void) => boolean;
}>;

/**
 * Windows Terminal Text Outcome Using Streamを書き込む。
 *
 * @responsibility Windows Terminal Text Outcome Using Streamの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input value: string、stream: WindowsTerminalStream
 * @returns Promise<InteractiveConsoleTextWriteOutcome>を返す。
 * @precondition 「value: string、stream: WindowsTerminalStream」がwriteWindowsTerminalTextOutcomeUsingStreamの入力契約を満たす。
 * @postcondition writeWindowsTerminalTextOutcomeUsingStreamの責務を完了した結果だけを返す。
 * @effect 渡されたstreamへ書き込み、error listener、Timer／Immediateとcallbackの完了を所有する。
 * @failure writeWindowsTerminalTextOutcomeUsingStreamは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 同意・poison・Authorityは判断しない。Timeout後のerror sinkを保持し、返却を全listener回収済みとは扱わない。
 * @boundary Node streamのwrite／callback／errorと有界Timerの技術境界。
 * @security N/A: writeWindowsTerminalTextOutcomeUsingStreamはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeWindowsTerminalTextOutcomeUsingStreamは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function writeWindowsTerminalTextOutcomeUsingStream(
  value: string,
  stream: WindowsTerminalStream,
): Promise<InteractiveConsoleTextWriteOutcome> {
  if (stream.isTTY !== true || stream.destroyed || !stream.writable) {
    return Promise.resolve(Object.freeze({ status: "write_failed" }));
  }
  return new Promise((resolve) => {
    let isSettled = false;
    let deferredCompletion: NodeJS.Immediate | null = null;
    const timeout = setTimeout(
      () => settle("cleanup_unknown", true),
      WINDOWS_TERMINAL_WRITE_TIMEOUT_MS,
    );
    timeout.unref();
    const settle = (
      status: InteractiveConsoleTextWriteOutcome["status"],
      shouldRetainLateErrorSink = false,
    ) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      if (deferredCompletion) clearImmediate(deferredCompletion);
      if (!shouldRetainLateErrorSink) {
        try {
          stream.removeListener("error", onError);
        } catch {
          status = "cleanup_unknown";
        }
      }
      resolve(Object.freeze({ status }));
    };
    const deferSettlement = (
      status: InteractiveConsoleTextWriteOutcome["status"],
    ) => {
      if (isSettled || deferredCompletion) return;
      deferredCompletion = setImmediate(() => settle(status));
    };
    const onError = () => settle("write_failed");
    stream.once("error", onError);
    try {
      stream.write(value, (error) =>
        deferSettlement(error ? "write_failed" : "completed"),
      );
    } catch {
      deferSettlement("write_failed");
    }
  });
}
/**
 * 現在のWindows stdoutへ端末文字列を書き込む。
 * @responsibility 固定stdoutと既存有界writerを接続する。
 * @trace ARCH-000008
 * @input value: 書き込む文字列。
 * @returns completed、write_failed、cleanup_unknownの結果。
 * @precondition 利用側が表示内容と実行可否を判断する。
 * @postcondition 同じstreamのcallback・error・終了不明を区別する。
 * @effect 現在のstdoutへ書込み、イベントと有界待機を所有する。
 * @failure 失敗や不明を成功へ補完しない。
 * @invariant Runtime停止・同意成立は判断しない。
 * @boundary Node TTY stdout境界。
 * @security 任意streamや実行Authorityは公開しない。
 * @concurrency 呼出しごとの完了を一度に限定する。
 */
export function writeWindowsTerminalTextOutcome(
  value: string,
): Promise<InteractiveConsoleTextWriteOutcome> {
  return writeWindowsTerminalTextOutcomeUsingStream(value, process.stdout);
}
