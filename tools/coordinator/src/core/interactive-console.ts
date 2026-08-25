import fs from "node:fs";

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 1;

type InteractiveConsoleHandles = Readonly<{
  input: number;
  output: number;
}>;

function consoleDeviceNames() {
  return process.platform === "win32"
    ? Object.freeze({ input: "CONIN$", output: "CONOUT$" })
    : Object.freeze({ input: "/dev/tty", output: "/dev/tty" });
}

export function withInteractiveConsole<T>(
  operation: (handles: InteractiveConsoleHandles) => T,
): T | null {
  const names = consoleDeviceNames();
  let input: number | null = null;
  let output: number | null = null;
  try {
    input = fs.openSync(names.input, "r");
    output = fs.openSync(names.output, "w");
    return operation(Object.freeze({ input, output }));
  } catch {
    return null;
  } finally {
    if (input !== null) fs.closeSync(input);
    if (output !== null) fs.closeSync(output);
  }
}

export function interactiveConsoleAvailable() {
  return withInteractiveConsole(() => true) === true;
}

export function describeInteractiveConsoleContract() {
  return Object.freeze({
    contract: INTERACTIVE_CONSOLE_CONTRACT,
    contractRevision: INTERACTIVE_CONSOLE_CONTRACT_REVISION,
    windowsDevices: Object.freeze(["CONIN$", "CONOUT$"]),
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });
}
