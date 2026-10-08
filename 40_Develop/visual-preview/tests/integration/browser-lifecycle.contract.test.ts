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
  closeOwnedBrowserProcessTree,
  observeLocalListener,
  runVisualCleanupStages,
  stopOwnedBrowser,
  terminateRemainingOwnedBrowserProcesses,
} from "../../src/browser/verify-visual.ts";

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
 * @boundary ERB-IT-020=Direct Boundary: visual-preview Test Source→対象契約
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
 * @boundary ERB-IT-020=Direct Boundary: visual-preview Test Source→対象契約
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

/**
 * 世代Identity不一致時にPIDが同じでも終了Signalを発行しないことを検証する。
 *
 * @responsibility PID再利用相当の反例でVisual検証外ProcessへのEffect 0を保証する。
 * @trace ERB-IT-020
 * @precondition 現在Node.jsで専用子Processを開始し、OSから世代Identityを観測できる。
 * @stimulus 実在PIDへ一致しない世代Identityを組み合わせて限定Fallbackへ渡す。
 * @observation 終了要求数と対象Processの継続存在を取得する。
 * @oracle 終了要求数は0で、対象ProcessはFallback後も存在する。
 * @cleanup 試験自身が所有する子ProcessをstopOwnedBrowserで終了する。
 * @boundary ERB-IT-020=Direct Boundary: 世代Identity Snapshot→OS Process Signal
 */
test("世代Identity不一致ではPID一致だけで終了しない", async () => {
  const terminationRequests: number[] = [];
  const terminationCount = await terminateRemainingOwnedBrowserProcesses(
    [
      Object.freeze({
        pid: 100,
        identity: "100:generation-a",
        terminationIdentityVerified: true,
        depth: 0,
      }),
    ],
    {
      readCurrentProcesses: async () => [
        Object.freeze({
          pid: 100,
          parentPid: 1,
          identity: "100:generation-b",
          terminationIdentityVerified: true,
        }),
      ],
      terminateProcess: (pid) => terminationRequests.push(pid),
    },
  );
  assert.equal(terminationCount, 0);
  assert.deepEqual(terminationRequests, []);
});

/**
 * 世代Identityを安全に検証できない一致ProcessへSignalを送らないことを検証する。
 *
 * @responsibility その他POSIX相当の未検証Identityを明示失敗とEffect 0へ閉じる。
 * @trace ERB-IT-020
 * @precondition 固定Process SnapshotとSignal記録器を注入できる。
 * @stimulus 同じPIDとIdentityだがterminationIdentityVerified=falseのProcessを渡す。
 * @observation 送信記録と拒否理由を取得する。
 * @oracle visual_zoom_owned_process_identity_unverifiedで拒否し、送信記録は0件である。
 * @cleanup N/A: 実Processを開始しない。
 * @boundary ERB-IT-020=Direct Boundary: Identity Verification→Process Signal Authority
 */
test("未検証の世代Identityでは一致ProcessにもSignalを送らない", async () => {
  const terminationRequests: number[] = [];
  await assert.rejects(
    terminateRemainingOwnedBrowserProcesses(
      [
        Object.freeze({
          pid: 200,
          identity: "200",
          terminationIdentityVerified: false,
          depth: 0,
        }),
      ],
      {
        readCurrentProcesses: async () => [
          Object.freeze({
            pid: 200,
            parentPid: 1,
            identity: "200",
            terminationIdentityVerified: false,
          }),
        ],
        terminateProcess: (pid) => terminationRequests.push(pid),
      },
    ),
    /visual_zoom_owned_process_identity_unverified/u,
  );
  assert.deepEqual(terminationRequests, []);
});

/**
 * 所有ProcessをOS列挙順ではなく親子Graphの深い順に終了することを検証する。
 *
 * @responsibility 親より先に全子孫へSignalを送る限定Fallback順序を固定する。
 * @trace ERB-IT-020
 * @precondition 深度を持つ固定所有Identityと現在Snapshotを注入できる。
 * @stimulus 親・子・孫を意図的に順不同で渡す。
 * @observation Signal対象PIDの順序を記録する。
 * @oracle 孫、子、親の深度降順となり、全件が一回ずつ処置される。
 * @cleanup N/A: 実Processを開始しない。
 * @boundary ERB-IT-020=Direct Boundary: Owned Process Graph→Process Signal Order
 */
test("残存Processを親子Graphの深い順に終了する", async () => {
  const terminationRequests: number[] = [];
  const identities = [
    Object.freeze({
      pid: 301,
      identity: "301:parent",
      terminationIdentityVerified: true,
      depth: 0,
    }),
    Object.freeze({
      pid: 303,
      identity: "303:grandchild",
      terminationIdentityVerified: true,
      depth: 2,
    }),
    Object.freeze({
      pid: 302,
      identity: "302:child",
      terminationIdentityVerified: true,
      depth: 1,
    }),
  ];
  const currentProcesses = [
    Object.freeze({
      pid: 301,
      parentPid: 1,
      identity: "301:parent",
      terminationIdentityVerified: true,
    }),
    Object.freeze({
      pid: 302,
      parentPid: 301,
      identity: "302:child",
      terminationIdentityVerified: true,
    }),
    Object.freeze({
      pid: 303,
      parentPid: 302,
      identity: "303:grandchild",
      terminationIdentityVerified: true,
    }),
  ];
  assert.equal(
    await terminateRemainingOwnedBrowserProcesses(identities, {
      readCurrentProcesses: async () => currentProcesses,
      terminateProcess: (pid) => terminationRequests.push(pid),
    }),
    3,
  );
  assert.deepEqual(terminationRequests, [303, 302, 301]);
});

/**
 * 親の正常終了後に残る所有子Processをexact Identity限定Fallbackで回収することを検証する。
 *
 * @responsibility 終了直前Tree Snapshot、正常終了猶予、子孫Fallbackおよび最終不存在の実経路を証明する。
 * @trace ERB-IT-020
 * @precondition 現在Node.jsで子Processを持つ専用親Processを開始できる。
 * @stimulus 独立して残る子Processを開始した親だけを正常終了要求で停止する。
 * @observation 正常終了受理、子孫Fallback有無、Tree不存在およびcleanup Errorを取得する。
 * @oracle 正常終了要求は受理され、子孫Fallbackが一回以上必要となり、最終Treeは0件である。
 * @cleanup 対象TreeはcloseOwnedBrowserProcessTreeが回収し、失敗時は親Processを追加停止する。
 * @boundary ERB-IT-020=Direct Boundary: Owned Node Process Tree→exact Identity限定Fallback
 */
test("親終了後に残る所有子Processを限定Fallbackで回収する", async () => {
  const owner = spawn(
    process.execPath,
    [
      "--eval",
      'const { spawn } = require("node:child_process"); spawn(process.execPath, ["--eval", "setInterval(() => undefined, 1000)"], { detached: true, stdio: "ignore", windowsHide: true }); process.stdout.write("ready\\n"); setInterval(() => undefined, 1000);',
    ],
    { stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
  );
  assert.ok(owner.stdout !== null);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("owned_process_tree_fixture_timeout")),
      5_000,
    );
    owner.stdout?.once("data", () => {
      clearTimeout(timeout);
      resolve();
    });
    owner.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 750));
  try {
    const result = await closeOwnedBrowserProcessTree(owner, async () => {
      owner.kill("SIGTERM");
    });
    assert.equal(result.normalCloseAccepted, true);
    assert.equal(result.descendantTerminationRequired, true);
    assert.equal(result.processTreeExitConfirmed, true);
    assert.equal(result.cleanupErrors.length, 0);
  } finally {
    if (owner.exitCode === null) await stopOwnedBrowser(owner);
  }
});

/**
 * cleanup前段が失敗しても後続段を全実行しErrorを集約することを検証する。
 *
 * @responsibility Process清掃失敗からDevTools確認とProfile削除を独立させる。
 * @trace ERB-IT-020
 * @precondition 三つの固定cleanup段へ成功または失敗を注入できる。
 * @stimulus Process段とDevTools段を失敗させ、Profile段を成功させる。
 * @observation 実行順、各段の実行回数および集約Error数を取得する。
 * @oracle 三段すべてが一回ずつ順に実行され、二つのErrorを返して成功へ畳まない。
 * @cleanup N/A: 実資源を作成しない。
 * @boundary ERB-IT-020=Direct Boundary: Cleanup Stage Failure→Subsequent Cleanup
 */
test("cleanup前段の失敗後も後続段を実行してErrorを集約する", async () => {
  const calls: string[] = [];
  const errors = await runVisualCleanupStages({
    closeProcessTree: async () => {
      calls.push("process");
      throw new Error("process_cleanup_failed");
    },
    confirmDevToolsClosed: async () => {
      calls.push("devtools");
      throw new Error("devtools_cleanup_failed");
    },
    removeProfile: async () => {
      calls.push("profile");
    },
  });
  assert.deepEqual(calls, ["process", "devtools", "profile"]);
  assert.equal(errors.length, 2);
  assert.match(String(errors[0]), /process_cleanup_failed/u);
  assert.match(String(errors[1]), /devtools_cleanup_failed/u);
});
