/**
 * Process生存とPlatform観測の技術境界を検証する。
 * @packageDocumentation
 * @responsibility PIDの三状態、Signal 0、非対応Platformの拒否を確認する。
 * @trace PRL-UT-014
 * @level UT
 * @scope PID生存、OS失敗、Platform family。
 * @boundary PRL-UT-014=Direct Boundary: Platform Access公開観測→Node Process API。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  observePlatformFamily,
  observeProcessLiveness,
} from "../../../src/index.ts";

/**
 * 不正PIDはOS要求を発行しない。
 * @responsibility 入力拒否をProcess観測前に固定する。
 * @trace PRL-UT-014
 * @precondition Process.killを呼出し記録へ置換する。
 * @stimulus 不正PIDと正のPIDを渡す。
 * @observation 返却状態、呼出し回数とsignal。
 * @oracle 不正値はunknown・0要求、正のPIDはSignal 0だけ。
 * @cleanup Test mockを復元する。
 * @boundary PRL-UT-014=Direct Boundary: PID入力→Process API。
 */
test("PID検査は不正値でOS観測0、正常値でSignal 0だけを発行する", (t) => {
  const kill = t.mock.method(process, "kill", () => true);
  for (const pid of [null, undefined, "1", 0, -1, 1.5, NaN, Infinity, {}])
    assert.equal(observeProcessLiveness(pid), "unknown");
  assert.equal(kill.mock.callCount(), 0);
  assert.equal(observeProcessLiveness(process.pid), "alive");
  assert.deepEqual(kill.mock.calls[0]?.arguments, [process.pid, 0]);
});

/**
 * 不存在と観測不能を分ける。
 * @responsibility OS失敗の閉じた分類を維持する。
 * @trace PRL-UT-014
 * @precondition Process.killを固定失敗へ置換する。
 * @stimulus ESRCH、EPERM、その他の失敗を注入する。
 * @observation 各状態。
 * @oracle ESRCHだけabsent、他はunknown。
 * @cleanup Test mockを復元する。
 * @boundary PRL-UT-014=Direct Boundary: OS失敗→観測結果。
 */
test("ESRCHだけを不存在としEPERMと未知の失敗をunknownへ残す", (t) => {
  let failure: unknown;
  t.mock.method(process, "kill", () => {
    throw failure;
  });
  for (const [error, expected] of [
    [{ code: "ESRCH" }, "absent"],
    [{ code: "EPERM" }, "unknown"],
    [{ code: "EACCES" }, "unknown"],
    [new Error("synthetic"), "unknown"],
    [null, "unknown"],
  ] as const) {
    failure = error;
    assert.equal(observeProcessLiveness(process.pid), expected);
  }
});

/**
 * Platform観測を上位保証と分離する。
 * @responsibility 現OSの閉じた対応範囲を固定する。
 * @trace PRL-UT-014
 * @precondition 現在RuntimeのPlatformを使用する。
 * @stimulus Platform観測を呼ぶ。
 * @observation 観測値またはblocked。
 * @oracle Windowsだけobserved、その他は従来の未対応結果。
 * @cleanup N/A: 外部資源は作成しない。
 * @boundary PRL-UT-014=Direct Boundary: 現Runtime→Platform観測。
 */
test("Platform family観測は現在のWindows対応範囲だけを返す", () => {
  assert.deepEqual(
    observePlatformFamily(),
    process.platform === "win32"
      ? { status: "observed", platformFamily: "windows" }
      : { status: "blocked", reason: "platform_identity_unknown" },
  );
});
