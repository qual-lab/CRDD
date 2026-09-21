import net from "node:net";
import { parentPort, workerData } from "node:worker_threads";

/**
 * LockWorkerInputが扱う値の構造を表す。
 *
 * @responsibility LockWorkerInputに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape LockWorkerInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LockWorkerInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: LockWorkerInputの宣言は外部境界を開かない。
 * @security LockWorkerInputはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LockWorkerInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LockWorkerInput = Readonly<{
  pipeName: string;
  state: SharedArrayBuffer;
}>;

const input = workerData as LockWorkerInput;
const state = new Int32Array(input.state);
const server = net.createServer((socket) => socket.destroy());

/**
 * finishの処理を実行する。
 *
 * @responsibility finishに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: number
 * @returns N/A: finishは戻り値を返さない。
 * @precondition 「value: number」がfinishの入力契約を満たす。
 * @postcondition finishの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: finishは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finishは独自の失敗分岐を所有しない。
 * @invariant finishは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security finishはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishは共有非同期状態を持たない同期処理である。
 */
function finish(value: number) {
  Atomics.store(state, 0, value);
  Atomics.notify(state, 0);
}

server.once("error", () => finish(-1));
server.listen(input.pipeName, () => finish(1));
parentPort?.once("message", () => {
  server.close(() => finish(2));
});
