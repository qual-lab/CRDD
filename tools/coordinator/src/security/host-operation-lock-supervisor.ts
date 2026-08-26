import { createServer } from "node:net";

const pipeName = process.argv[2];
if (
  !/^\\\\\.\\pipe\\CRDD\.Coordinator\.HostOperation\.[0-9a-f]{32}$/u.test(
    pipeName ?? "",
  )
)
  process.exit(64);

const server = createServer();
let closing = false;

function send(status: "acquired" | "ready" | "released" | "unavailable") {
  if (process.connected) process.send?.(Object.freeze({ status }));
}

function closeAndExit(reportRelease: boolean) {
  if (closing) return;
  closing = true;
  server.close(() => {
    if (reportRelease) send("released");
    process.disconnect();
  });
}

process.on("message", (message: unknown) => {
  if (message === "confirm-ready" && !closing) {
    setImmediate(() => send("ready"));
    return;
  }
  if (message === "release") closeAndExit(true);
});
process.once("disconnect", () => closeAndExit(false));
server.once("error", () => {
  closing = true;
  send("unavailable");
  process.disconnect();
});
server.listen(pipeName, () => send("acquired"));
