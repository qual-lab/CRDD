/**
 * visual-preview:integration:browser-lifecycleの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Listener不存在の三値観測とBrowser正常終了・Fallback分離を直接境界で検証する。
 * @trace ERB-IT-020
 * @level IT
 * @scope visual-preview、listener-observation、browser-close、cleanup
 * @boundary ERB-IT-020=Direct Boundary: localhost Listener／Owned Child Process→Visual Browser lifecycle観測結果
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";

import {
  observeLocalListener,
  stopOwnedBrowser,
} from "../../src/browser-zoom-verifier.ts";

/**
 * Listenerの接続成立・明示的拒否・不正入力を三値で区別することを検証する。
 *
 * @responsibility 応答本文を返さないListenerも不存在へ畳まずpresentと判定する。
 * @trace ERB-IT-020
 * @precondition localhost上で一時TCP Listenerを開始できる。
 * @stimulus 接続を受理するが応答しないPort、close後の同Portおよび不正Portを観測する。
 * @observation present、absent、unknownの分類値を取得する。
 * @oracle 応答停止中はpresent、明示的接続拒否はabsent、不正入力はunknownになる。
 * @cleanup Serverを閉じ、Connection Socketを破棄する。
 * @boundary ERB-IT-020=Direct Boundary: localhost TCP Listener→終了後観測
 */
test("Listenerの存在・不存在・観測不能を三値で区別する", async () => {
  const server = createServer((socket) => {
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const port = address.port;
  assert.equal(await observeLocalListener(port), "present");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );
  assert.equal(await observeLocalListener(port), "absent");
  assert.equal(await observeLocalListener(0), "unknown");
});

/**
 * 正常終了待機後だけ強制終了Fallbackを使い、実経路を記録することを検証する。
 *
 * @responsibility Browser.close相当後の遅延終了と残存ProcessのFallbackを分離する。
 * @trace ERB-IT-020
 * @precondition 現在Node.jsで子Processを開始・終了できる。
 * @stimulus 100ms後に自然終了するProcessと終了要求まで残るProcessを渡す。
 * @observation stopOwnedBrowserが返す終了経路を取得する。
 * @oracle 遅延自然終了はnormal、残存Processはsigtermになり、前者へSignalを送らない。
 * @cleanup 両Processの終了をstopOwnedBrowserが確認する。
 * @boundary ERB-IT-020=Direct Boundary: Owned Child Process→正常終了／Fallback分類
 */
test("正常終了待機と強制終了Fallbackを分離する", async () => {
  const delayedExit = spawn(
    process.execPath,
    ["--eval", "setTimeout(() => process.exit(0), 100)"],
    { stdio: "ignore", windowsHide: true },
  );
  assert.equal(await stopOwnedBrowser(delayedExit), "normal");

  const persistent = spawn(
    process.execPath,
    ["--eval", "setInterval(() => undefined, 1000)"],
    { stdio: "ignore", windowsHide: true },
  );
  assert.equal(await stopOwnedBrowser(persistent), "sigterm");
});
