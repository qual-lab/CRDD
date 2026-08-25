import fs from "node:fs";

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 3;

type InteractiveConsoleHandles = Readonly<{
  input: number;
  output: number;
}>;

type InteractiveConsoleAdapter = Readonly<{
  open: (path: string, flags: "r" | "w") => number;
  close: (descriptor: number) => void;
}>;

type InteractiveConsoleTextAdapter = Readonly<{
  isWindowsTerminal: boolean;
  writeWindowsTerminal: (value: string) => void;
  writeDescriptor: (descriptor: number, value: string) => void;
}>;

export function withInteractiveConsoleUsingAdapter<T>(
  platform: NodeJS.Platform,
  adapter: InteractiveConsoleAdapter,
  operation: (handles: InteractiveConsoleHandles) => T,
): T | null {
  const names =
    platform === "win32"
      ? Object.freeze({ input: "\\\\.\\CONIN$", output: "\\\\.\\CONOUT$" })
      : Object.freeze({ input: "/dev/tty", output: "/dev/tty" });
  let input: number | null = null;
  let output: number | null = null;
  let result: Readonly<{ value: T }> | null = null;
  try {
    input = adapter.open(names.input, "r");
    output = adapter.open(names.output, "w");
    result = Object.freeze({
      value: operation(Object.freeze({ input, output })),
    });
  } catch {
    result = null;
  }
  let isCleanupSuccessful = true;
  if (input !== null) {
    try {
      adapter.close(input);
    } catch {
      isCleanupSuccessful = false;
    }
  }
  if (output !== null) {
    try {
      adapter.close(output);
    } catch {
      isCleanupSuccessful = false;
    }
  }
  return isCleanupSuccessful && result ? result.value : null;
}

export function withInteractiveConsole<T>(
  operation: (handles: InteractiveConsoleHandles) => T,
): T | null {
  return withInteractiveConsoleUsingAdapter(
    process.platform,
    Object.freeze({ open: fs.openSync, close: fs.closeSync }),
    operation,
  );
}

export function writeInteractiveConsoleTextUsingAdapter(
  platform: NodeJS.Platform,
  outputDescriptor: number,
  value: string,
  adapter: InteractiveConsoleTextAdapter,
) {
  try {
    if (platform === "win32") {
      if (!adapter.isWindowsTerminal) return false;
      adapter.writeWindowsTerminal(value);
    } else {
      adapter.writeDescriptor(outputDescriptor, value);
    }
    return true;
  } catch {
    return false;
  }
}

export function writeInteractiveConsoleText(
  outputDescriptor: number,
  value: string,
) {
  return writeInteractiveConsoleTextUsingAdapter(
    process.platform,
    outputDescriptor,
    value,
    Object.freeze({
      isWindowsTerminal: process.stdout.isTTY === true,
      writeWindowsTerminal: (text: string) => {
        process.stdout.write(text);
      },
      writeDescriptor: (descriptor: number, text: string) => {
        fs.writeSync(descriptor, text, null, "utf8");
      },
    }),
  );
}

export function interactiveConsoleAvailable() {
  return withInteractiveConsole(() => true) === true;
}

export function describeInteractiveConsoleContract() {
  return Object.freeze({
    contract: INTERACTIVE_CONSOLE_CONTRACT,
    contractRevision: INTERACTIVE_CONSOLE_CONTRACT_REVISION,
    windowsDevices: Object.freeze(["\\\\.\\CONIN$", "\\\\.\\CONOUT$"]),
    windowsUnicodeOutput: "node_unicode_tty_output_required",
    windowsRedirectedOutput: "fail_closed",
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });
}
