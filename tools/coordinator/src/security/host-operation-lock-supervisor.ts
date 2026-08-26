import { createServer } from "node:net";

const pipeName = process.argv[2];
if (
  process.argv.length !== 3 ||
  !process.connected ||
  typeof process.send !== "function" ||
  !/^\\\\\.\\pipe\\CRDD\.Coordinator\.HostOperation\.[0-9a-f]{32}$/u.test(
    pipeName ?? "",
  )
)
  process.exit(64);

const server = createServer();
let state: "starting" | "acquired" | "ready" | "closing" = "starting";

function send(status: "acquired" | "ready" | "released" | "unavailable") {
  if (!process.connected || typeof process.send !== "function") return false;
  try {
    process.send(Object.freeze({ status }));
    return true;
  } catch {
    return false;
  }
}

function disconnectAndExit(exitCode: number) {
  process.exitCode = exitCode;
  if (process.connected) process.disconnect();
}

function closeAndExit(reportRelease: boolean, exitCode: number) {
  if (state === "closing") return;
  state = "closing";
  const finish = () => {
    if (reportRelease && !send("released")) return disconnectAndExit(70);
    disconnectAndExit(exitCode);
  };
  if (server.listening) server.close(finish);
  else finish();
}

process.on("message", (message: unknown) => {
  if (message === "confirm-ready" && state === "acquired") {
    state = "ready";
    setImmediate(() => {
      if (state === "ready" && !send("ready")) closeAndExit(false, 70);
    });
    return;
  }
  if (message === "release" && (state === "acquired" || state === "ready")) {
    closeAndExit(true, 0);
    return;
  }
  closeAndExit(false, 65);
});
process.once("disconnect", () => closeAndExit(false, 66));
server.once("error", () => {
  send("unavailable");
  closeAndExit(false, 67);
});
server.listen(pipeName, () => {
  if (state !== "starting" || !send("acquired")) return closeAndExit(false, 70);
  state = "acquired";
});
