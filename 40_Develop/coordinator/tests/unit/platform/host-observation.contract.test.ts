/**
 * 実行環境の観測を既存の技術Ownerで検証する。
 *
 * @packageDocumentation
 * @responsibility Repository Root、Provider Home、Lease ownerの実観測と拒否を確認する。
 * @trace PRL-UT-014
 * @level UT
 * @scope Coordinatorの実行環境観測。実AI・Docker・既存Provider Homeは対象外。
 * @boundary 検証済みRepositoryと、用途固定のNode.js観測。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "@qual-lab/crdd-version-control";
import { inspectWindowsProviderHomeCandidate } from "../../../src/lifecycle/environment.ts";
import { observeLeaseOwner } from "../../../src/lifecycle/host.ts";

/**
 * Rootは既存VCの操作で確定し、不正入力を別のRootへ補完しない。
 * @responsibility 本番のRoot観測の受理・拒否を直接確認する。
 * @trace PRL-UT-014
 * @stimulus 実RepositoryのサブDirectoryと、不正なPath・型を渡す。
 * @oracle 検証済みRootだけが得られ、不正値は既存理由で拒否する。
 * @cleanup 読取りのみ。
 */
test("Repository Rootは直下の実体に解決し不正入力を拒否する", () => {
  const packageRoot = path.resolve(import.meta.dirname, "../../..");
  assert.equal(
    resolveVerifiedRepositoryRootFromWorkingDirectory(packageRoot),
    path.resolve(packageRoot, "../.."),
  );
  for (const invalid of ["relative/path", "", 7, null, "C:\\path\u0000"])
    assert.throws(
      () => resolveVerifiedRepositoryRootFromWorkingDirectory(invalid),
      /^Error: repository_working_directory_invalid$/u,
    );
});

/**
 * 不正Providerと非対応・観測不能なOSではHomeを探さない。
 * @responsibility fallbackなし・Provider Homeの観測前拒否を検証する。
 * @trace PRL-UT-014
 * @stimulus Windows上の不正Provider、非対応・欠測のOS値で有効なProviderを渡す。
 * @oracle 候補なしの閉じた拒否、Filesystem観測0。
 * @cleanup 変更したOS値とFilesystemの代役を復元する。
 */
test("非対応・欠測のOSと不正ProviderではHomeを観測しない", (t) => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  assert.ok(platform?.configurable);
  const fail = () => {
    throw Error("provider_home_io_forbidden");
  };
  const lstat = t.mock.method(fs, "lstatSync", fail);
  const readdir = t.mock.method(fs, "readdirSync", fail);
  const realpath = t.mock.method(fs.realpathSync, "native", fail);
  try {
    for (const [given, providers] of [
      ["win32", [42, "unknown-provider", null]],
      ["linux", ["codex", "claude"]],
      ["darwin", ["codex", "claude"]],
      [undefined, ["codex", "claude"]],
    ] as const) {
      Object.defineProperty(process, "platform", { ...platform, value: given });
      for (const provider of providers) {
        const observed = inspectWindowsProviderHomeCandidate(provider);
        assert.equal(observed.status, "blocked");
        assert.equal(observed.reason, "provider_home_node_input_invalid");
        assert.equal(observed.providerHome, null);
      }
    }
  } finally {
    Object.defineProperty(process, "platform", platform);
  }
  assert.equal(lstat.mock.callCount(), 0);
  assert.equal(readdir.mock.callCount(), 0);
  assert.equal(realpath.mock.callCount(), 0);
});

/**
 * 実Processの生存観測が現在PIDと不存在を区別する。
 * @trace PRL-UT-014
 * @stimulus 現在PIDと通常利用されない高位PIDをSignal 0で読む。
 * @oracle 現在PIDはalive、不在PIDはabsent。
 * @cleanup 読取りのみ。Processは起動・停止しない。
 */
test("実Processの生存観測で現在PIDと不存在を区別する", () => {
  assert.equal(
    observeLeaseOwner({
      ownerProcessId: process.pid,
      ownerGeneration: "owner-a",
    }).status,
    "alive",
  );
  assert.equal(
    observeLeaseOwner({
      ownerProcessId: 2_147_483_647,
      ownerGeneration: "owner-a",
    }).status,
    "absent",
  );
});

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
    assert.equal(
      observeLeaseOwner({ ownerProcessId: pid, ownerGeneration: "owner-a" })
        .status,
      "unknown",
    );
  assert.equal(kill.mock.callCount(), 0);
  assert.equal(
    observeLeaseOwner({
      ownerProcessId: process.pid,
      ownerGeneration: "owner-a",
    }).status,
    "alive",
  );
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
    assert.equal(
      observeLeaseOwner({
        ownerProcessId: process.pid,
        ownerGeneration: "owner-a",
      }).status,
      expected,
    );
  }
});
