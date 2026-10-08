/**
 * Filesystem StoreのOS Kernel LockをWorker lifetimeへ結合する。
 *
 * @packageDocumentation
 * @responsibility 一つのEndpointを排他的にlistenし、親からの解放要求後にだけ閉じる。
 * @trace ARCH-000009
 * @boundary Worker Thread→OS Named Pipe／Abstract Unix Socket。
 * @effect Endpointのlistenとcloseを実行する。
 * @security 親から渡されたHash導出Endpoint以外を探索しない。
 */
import net from "node:net";
import { parentPort, workerData } from "node:worker_threads";

/**
 * Kernel Lock Workerへ渡す固定入力を定義する。
 *
 * @responsibility OS Endpointと親子間の同期状態だけをWorkerへ渡す。
 * @trace ARCH-000009
 * @shape Endpoint文字列と共有状態Bufferを持つ読取り専用値である。
 * @invariant stateの先頭整数だけを取得・解放状態に使用する。
 * @boundary 親Thread→Kernel Lock Worker。
 * @security Endpointは親側で検証済みRootからHash導出される。
 * @compatibility 状態値0、1、2、-1、-2の意味を親Worker間で固定する。
 */
type KernelLockWorkerInput = Readonly<{
  endpoint: string;
  state: SharedArrayBuffer;
}>;

const input = workerData as KernelLockWorkerInput;
const state = new Int32Array(input.state);
const server = net.createServer((socket) => socket.destroy());

/**
 * Kernel Lock Workerの状態変化を親Threadへ通知する。
 *
 * @responsibility 取得・競合・失敗・解放完了を共有状態へ一度に反映する。
 * @trace ARCH-000009
 * @input value: 親Worker間で定義した状態値。
 * @returns N/A: 共有状態を更新して終了する。
 * @precondition valueは0以外の定義済み状態値である。
 * @postcondition 待機中の親Threadが最新状態を観測できる。
 * @effect SharedArrayBufferを更新して待機者を通知する。
 * @failure Atomics操作が利用不能なRuntimeではWorkerが異常終了する。
 * @invariant Endpoint取得前の0を完了状態として通知しない。
 * @boundary Kernel Lock Worker→親Thread同期境界。
 * @security EndpointやRoot情報を共有状態へ書き込まない。
 * @concurrency Atomics.store後にAtomics.notifyする順序を固定する。
 */
function finish(value: number): void {
  Atomics.store(state, 0, value);
  Atomics.notify(state, 0);
}

server.once("error", (error: NodeJS.ErrnoException) =>
  finish(error.code === "EADDRINUSE" ? -1 : -2),
);
server.listen(input.endpoint, () => finish(1));
parentPort?.once("message", () => {
  server.close(() => finish(2));
});
