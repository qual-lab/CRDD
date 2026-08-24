import net from "node:net";
import { parentPort, workerData } from "node:worker_threads";

type LockWorkerInput = Readonly<{
  pipeName: string;
  state: SharedArrayBuffer;
}>;

const input = workerData as LockWorkerInput;
const state = new Int32Array(input.state);
const server = net.createServer((socket) => socket.destroy());

function finish(value: number) {
  Atomics.store(state, 0, value);
  Atomics.notify(state, 0);
}

server.once("error", () => finish(-1));
server.listen(input.pipeName, () => finish(1));
parentPort?.once("message", () => {
  server.close(() => finish(2));
});
