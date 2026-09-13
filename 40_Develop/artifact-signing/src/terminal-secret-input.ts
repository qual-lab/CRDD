type HiddenLineTerminal = Readonly<{
  inputIsTTY: boolean;
  outputIsTTY: boolean;
  write: (value: string) => void;
  setRawMode: (enabled: boolean) => void;
  resume: () => void;
  pause: () => void;
  setEncoding: (encoding: BufferEncoding) => void;
  onData: (listener: (chunk: string) => void) => void;
  offData: (listener: (chunk: string) => void) => void;
  onceEnd: (listener: () => void) => void;
  offEnd: (listener: () => void) => void;
}>;

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
    let rawModeAttempted = false;
    let resumeAttempted = false;
    let dataAttachmentAttempted = false;
    let endAttachmentAttempted = false;
    const finish = (result: string | Error) => {
      if (settled) return;
      settled = true;
      const cleanupFailures: unknown[] = [];
      for (const cleanup of [
        () => {
          if (dataAttachmentAttempted) terminal.offData(onData);
        },
        () => {
          if (endAttachmentAttempted) terminal.offEnd(onEnd);
        },
        () => {
          if (rawModeAttempted) terminal.setRawMode(false);
        },
        () => {
          if (resumeAttempted) terminal.pause();
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
      rawModeAttempted = true;
      terminal.setRawMode(true);
      resumeAttempted = true;
      terminal.resume();
      terminal.setEncoding("utf8");
      dataAttachmentAttempted = true;
      terminal.onData(onData);
      endAttachmentAttempted = true;
      terminal.onceEnd(onEnd);
    } catch (error) {
      finish(
        new Error("artifact_signing_terminal_setup_failed", { cause: error }),
      );
    }
  });
}

export async function readHiddenLine(prompt: string) {
  return await readHiddenLineFromTerminal(prompt, {
    inputIsTTY: process.stdin.isTTY === true,
    outputIsTTY: process.stdout.isTTY === true,
    write: (value) => process.stdout.write(value),
    setRawMode: (enabled) => process.stdin.setRawMode(enabled),
    resume: () => process.stdin.resume(),
    pause: () => process.stdin.pause(),
    setEncoding: (encoding) => process.stdin.setEncoding(encoding),
    onData: (listener) => process.stdin.on("data", listener),
    offData: (listener) => process.stdin.off("data", listener),
    onceEnd: (listener) => process.stdin.once("end", listener),
    offEnd: (listener) => process.stdin.off("end", listener),
  });
}
