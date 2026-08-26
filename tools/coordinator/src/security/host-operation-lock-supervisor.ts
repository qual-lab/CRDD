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
let state: "starting" | "acquired" | "ready" | "closing" | "release_pending" =
  "starting";
let closeStarted = false;
let closeExitCode = 0;
let shouldReportRelease = false;
let finishScheduled = false;
let disconnectCommitted = false;

function send(
  status: "acquired" | "ready" | "release-ready" | "released" | "unavailable",
) {
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
  if (process.connected) {
    disconnectCommitted = true;
    process.disconnect();
  }
}

function scheduleFinalExit() {
  if (finishScheduled) return;
  finishScheduled = true;
  setImmediate(() => {
    setImmediate(() => {
      finishScheduled = false;
      if (closeExitCode === 0 && shouldReportRelease && state === "closing") {
        if (!send("released")) {
          closeExitCode = 70;
          shouldReportRelease = false;
        }
      }
      disconnectAndExit(closeExitCode);
    });
  });
}

function closeAndExit(reportRelease: boolean, exitCode: number) {
  if (exitCode !== 0) {
    closeExitCode = exitCode;
    shouldReportRelease = false;
  } else if (!closeStarted) {
    closeExitCode = 0;
    shouldReportRelease = reportRelease;
  }
  if (closeStarted) {
    if (state === "release_pending" && closeExitCode !== 0)
      disconnectAndExit(closeExitCode);
    return;
  }
  closeStarted = true;
  state = "closing";
  const finish = scheduleFinalExit;
  if (server.listening) server.close(finish);
  else finish();
}

function beginRelease() {
  if (closeStarted) return closeAndExit(false, 65);
  closeStarted = true;
  closeExitCode = 0;
  shouldReportRelease = false;
  state = "closing";
  const prepared = () => {
    setImmediate(() => {
      if (closeExitCode !== 0) return disconnectAndExit(closeExitCode);
      state = "release_pending";
      if (!send("release-ready")) closeAndExit(false, 70);
    });
  };
  if (server.listening) server.close(prepared);
  else prepared();
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
    beginRelease();
    return;
  }
  if (message === "confirm-release" && state === "release_pending") {
    state = "closing";
    closeExitCode = 0;
    shouldReportRelease = true;
    scheduleFinalExit();
    return;
  }
  closeAndExit(false, 65);
});
process.once("disconnect", () => {
  if (!disconnectCommitted) closeAndExit(false, 66);
});
server.once("error", () => {
  send("unavailable");
  closeAndExit(false, 67);
});
server.listen(pipeName, () => {
  if (state !== "starting" || !send("acquired")) return closeAndExit(false, 70);
  state = "acquired";
});
