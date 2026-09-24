/**
 * terminal-secret-inputに属する責務をまとめる。
 *
 * @responsibility HiddenLineTerminalを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
/**
 * 秘密入力に必要な対話端末操作だけを表す。
 *
 * @responsibility 実端末と試験端末を同じ最小Capability境界で扱う。
 * @trace ARCH-000014
 * @shape HiddenLineTerminalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant 秘密入力に必要な端末操作だけを公開する。
 * @boundary TTY input／outputと秘密入力処理の境界。
 * @security 入力値のEchoまたは永続化Capabilityを公開しない。
 * @compatibility HiddenLineTerminalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HiddenLineTerminal = Readonly<{
  inputIsTTY: boolean;
  outputIsTTY: boolean;
  write: (value: string) => void;
  setRawMode: (isEnabled: boolean) => void;
  resume: () => void;
  pause: () => void;
  setEncoding: (encoding: BufferEncoding) => void;
  onData: (listener: (chunk: string) => void) => void;
  offData: (listener: (chunk: string) => void) => void;
  onceEnd: (listener: () => void) => void;
  offEnd: (listener: () => void) => void;
}>;

/**
 * 指定した対話端末からEchoせず一行を読み取る。
 *
 * @responsibility raw mode、入力Event、取消、終了と全cleanupを一つのLifecycleとして所有する。
 * @trace ARCH-000014
 * @input 表示PromptとHiddenLineTerminal Capability。
 * @returns Echoせず取得した一行の秘密文字列。
 * @precondition 入出力の両方が対話TTYである。
 * @postcondition 成否にかかわらずListener、raw modeおよび入力pauseのcleanupを試行する。
 * @effect 端末へPromptと改行だけを書き、入力modeとListenerを一時変更する。
 * @failure 非TTY、取消、入力終了、端末設定またはcleanup失敗を区別して返す。
 * @invariant 入力文字列を端末出力へ書かず、最初の終端事象だけで完了する。
 * @boundary 対話TTYと秘密入力値の境界。
 * @security 入力文字を端末へ再表示しない。
 * @concurrency 最初の完了・取消・終了だけでsettleし、Listenerを全経路で解除する。
 */
export async function readHiddenLineFromTerminal(
  prompt: string,
  terminal: HiddenLineTerminal,
) {
  if (!terminal.inputIsTTY || !terminal.outputIsTTY) {
    throw new Error("artifact_signing_interactive_terminal_required");
  }
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    let settled = false;
    let didAttemptRawMode = false;
    let didAttemptResume = false;
    let didAttachData = false;
    let didAttachEnd = false;
    const finish = (result: string | Error) => {
      if (settled) return;
      settled = true;
      const cleanupFailures: unknown[] = [];
      for (const cleanup of [
        () => {
          if (didAttachData) terminal.offData(onData);
        },
        () => {
          if (didAttachEnd) terminal.offEnd(onEnd);
        },
        () => {
          if (didAttemptRawMode) terminal.setRawMode(false);
        },
        () => {
          if (didAttemptResume) terminal.pause();
        },
      ]) {
        try {
          cleanup();
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
      if (cleanupFailures.length > 0) {
        reject(
          new AggregateError(
            result instanceof Error
              ? [result, ...cleanupFailures]
              : cleanupFailures,
            "artifact_signing_terminal_cleanup_failed",
          ),
        );
      } else if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const onEnd = () => finish(new Error("artifact_signing_input_closed"));
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("artifact_signing_cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          try {
            terminal.write("\n");
            finish(value);
          } catch (error) {
            finish(
              new Error("artifact_signing_terminal_output_failed", {
                cause: error,
              }),
            );
          }
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };
    try {
      terminal.write(prompt);
      didAttemptRawMode = true;
      terminal.setRawMode(true);
      didAttemptResume = true;
      terminal.resume();
      terminal.setEncoding("utf8");
      didAttachData = true;
      terminal.onData(onData);
      didAttachEnd = true;
      terminal.onceEnd(onEnd);
    } catch (error) {
      finish(
        new Error("artifact_signing_terminal_setup_failed", { cause: error }),
      );
    }
  });
}

/**
 * 現在Processの標準端末から秘密の一行を読み取る。
 *
 * @responsibility Node.js標準入出力をHiddenLineTerminal契約へ限定して接続する。
 * @trace ARCH-000014
 * @input 端末へ表示するPrompt。
 * @returns 標準端末からEchoせず取得した一行の秘密文字列。
 * @precondition 現在Processのstdinとstdoutが対話TTYである。
 * @postcondition readHiddenLineFromTerminalのcleanup条件を維持する。
 * @effect 標準端末のraw mode、Listenerおよびpause状態を一時変更する。
 * @failure 非対話端末、取消、入出力またはcleanup失敗を呼出し側へ返す。
 * @invariant 秘密入力を標準出力へEchoしない。
 * @boundary Process標準入出力と署名Applicationの境界。
 * @security redirectされた非対話入力を許可しない。
 * @concurrency 一回の呼出しを一つの端末入力Lifecycleとして扱う。
 */
export async function readHiddenLine(prompt: string) {
  return await readHiddenLineFromTerminal(prompt, {
    inputIsTTY: process.stdin.isTTY === true,
    outputIsTTY: process.stdout.isTTY === true,
    write: (value) => process.stdout.write(value),
    setRawMode: (isEnabled) => process.stdin.setRawMode(isEnabled),
    resume: () => process.stdin.resume(),
    pause: () => process.stdin.pause(),
    setEncoding: (encoding) => process.stdin.setEncoding(encoding),
    onData: (listener) => process.stdin.on("data", listener),
    offData: (listener) => process.stdin.off("data", listener),
    onceEnd: (listener) => process.stdin.once("end", listener),
    offEnd: (listener) => process.stdin.off("end", listener),
  });
}
