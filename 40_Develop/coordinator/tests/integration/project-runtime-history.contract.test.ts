/**
 * Project Runtimeの履歴保存試行を実Filesystemで確認する。
 *
 * @packageDocumentation
 * @responsibility 30日保持と保存中断の再入場を反証する。
 * @trace PRL-IT-012
 * @trace PRL-IT-005
 * @level IT
 * @scope Project Runtime履歴保存。
 * @boundary PRL-IT-012=Direct Boundary: 履歴Adapter→Repository Filesystem。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../../domain-model/src/storage/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../../domain-model/src/repository/index.ts";
import {
  acquireProjectRuntimeSnapshotPilotLock,
  readProjectRuntimeSnapshot,
  transferProjectRuntimeSnapshotHistory,
  writeProjectRuntimeSnapshot,
} from "../../../orchestrator/src/storage/current-state-store.ts";
import {
  inspectProjectRuntimeHistorySettlement,
  updateProjectRuntimeHistoryOwned,
  updateProjectRuntimeHistoryPilot,
} from "../../../orchestrator/src/storage/history-store.ts";

const DAY = 24 * 60 * 60 * 1000;
const referenceTime = Date.parse("2026-10-05T00:00:00.000Z");

/**
 * 設定期間と保存時の期限根拠を確認する。
 * @responsibility 追加、清掃、未搬送証明へ一つの保持方針を接続する。
 * @trace PRL-IT-012
 * @precondition 自己所有Repositoryを使用する。
 * @stimulus 7日、90日への変更と不正設定、旧Headerを与える。
 * @observation JSONL行とsettlement結果を確認する。
 * @oracle 設定変更が過去の期限処置を捏造せず旧形式を拒否する。
 * @cleanup fixtureがexact Rootを回収する。
 * @boundary PRL-IT-012=Direct Boundary: 履歴Adapter→Repository設定とJSONL。
 */
test("Host Windows: 保持期間は設定可能で保存時の期限根拠を維持する", (t) => {
  const f = fixture(t);
  const config = path.join(f.root, ".crdd", "config");
  fs.mkdirSync(config, { recursive: true });
  const file = path.join(config, "orchestrator.json");
  fs.writeFileSync(
    path.join(config, "execution-intelligence.json"),
    "invalid_other_tool",
  );
  const policy = {
    schemaRevision: 1,
    historyRetentionDays: 7,
  };
  fs.writeFileSync(file, JSON.stringify(policy));
  assert.equal(
    updateProjectRuntimeHistoryPilot(
      f.root,
      row("eight", referenceTime - 8 * DAY),
      referenceTime,
    ).status,
    "completed",
  );
  assert.equal(
    updateProjectRuntimeHistoryPilot(
      f.root,
      row("seven", referenceTime - 7 * DAY),
      referenceTime,
    ).status,
    "completed",
  );
  const acquired = acquireProjectRuntimeSnapshotPilotLock(f.root);
  if (acquired.status !== "completed") throw new Error("owner");
  try {
    fs.writeFileSync(
      file,
      JSON.stringify({
        ...policy,
        historyRetentionDays: 90,
      }),
    );
    assert.equal(
      inspectProjectRuntimeHistorySettlement(
        acquired.value,
        JSON.parse(row("eight", referenceTime - 8 * DAY)),
        referenceTime,
      ),
      "expired",
    );
    assert.equal(
      inspectProjectRuntimeHistorySettlement(
        acquired.value,
        JSON.parse(row("seven", referenceTime - 7 * DAY)),
        referenceTime,
      ),
      "recorded",
    );
    assert.equal(
      updateProjectRuntimeHistoryOwned(
        acquired.value,
        row("thirty-one", referenceTime - 31 * DAY),
        referenceTime,
      ).status,
      "completed",
    );
    assert.equal(
      inspectProjectRuntimeHistorySettlement(
        acquired.value,
        JSON.parse(row("thirty-one", referenceTime - 31 * DAY)),
        referenceTime,
      ),
      "recorded",
    );
    fs.writeFileSync(file, "{}");
    const bytes = fs.readFileSync(f.current, "utf8");
    assert.equal(
      updateProjectRuntimeHistoryOwned(
        acquired.value,
        row("invalid"),
        referenceTime,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(f.current, "utf8"), bytes);
    assert.equal(
      inspectProjectRuntimeHistorySettlement(
        acquired.value,
        JSON.parse(row("seven", referenceTime - 7 * DAY)),
        referenceTime,
      ),
      null,
    );
    fs.writeFileSync(file, JSON.stringify(policy));
    const lines = bytes.trimEnd().split("\n");
    const header = JSON.parse(lines[0] ?? "{}");
    delete header.historyRetentionDays;
    header.contract = "crdd-coordinator/project-runtime-history-pilot/v1";
    fs.writeFileSync(
      f.current,
      `${JSON.stringify(header)}\n${lines.slice(1).join("\n")}\n`,
    );
    assert.equal(
      updateProjectRuntimeHistoryOwned(acquired.value, null, referenceTime)
        .status,
      "blocked",
    );
  } finally {
    assert.equal(acquired.value.release(), true);
  }
});

/**
 * 現在状態から履歴への二段確定を確認する。
 * @responsibility 未搬送要約を消さず、確定後の再送を重複させない。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryの固定Snapshotを使用する。
 * @stimulus 偽造Owner、未搬送削除、履歴と現在状態の途中置換失敗を与える。
 * @observation 正確な行、pending、現在状態と再送後の件数を確認する。
 * @oracle 履歴確定前には現在値を残し、期限処置と保存済みを区別する。
 * @cleanup exact fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: Snapshot搬送→JSONLと固定pending。
 */
test("Host Windows: 終了要約搬送は同じOwnerで二段確定する", (t) => {
  for (const failure of ["none", "history", "snapshot"] as const) {
    const f = fixture(t);
    const acquired = acquireProjectRuntimeSnapshotPilotLock(f.root);
    assert.equal(acquired.status, "completed");
    if (acquired.status !== "completed")
      throw new Error("owner_fixture_failed");
    const owner = acquired.value;
    assert.equal(
      updateProjectRuntimeHistoryOwned(
        { ...owner },
        row("forged"),
        referenceTime,
      ).status,
      "blocked",
    );
    assert.equal(owner.release(), true);
    assert.equal(
      updateProjectRuntimeHistoryOwned(owner, row("released"), referenceTime)
        .status,
      "blocked",
    );
    assert.equal(fs.existsSync(f.directory), false);
    const rows = [
      JSON.parse(row("one")),
      JSON.parse(row("boundary", referenceTime - 30 * DAY)),
      JSON.parse(row("expired", referenceTime - 31 * DAY)),
    ];
    const payload = {
      schema: "crdd-coordinator/project-runtime-snapshot/v2",
      schemaRevision: 2,
      repositoryRootHash: owner.repositoryRootHash,
      repositoryBindingId: "binding-a",
      snapshotRevision: 1,
      intakeEpoch: "epoch-a",
      intakeBindings: [],
      projects: [],
      queueEntries: [],
      leaseEvidence: [],
      leaseIntents: [],
      results: [],
      historyPending: rows,
      acceptanceDecisions: [],
      decisionRecoveries: [],
    };
    assert.equal(
      writeProjectRuntimeSnapshot(
        f.root,
        "binding-a",
        JSON.stringify(payload),
        0,
      ).status,
      "completed",
    );
    const statePath = path.join(f.directory, "state.json");
    const before = fs.readFileSync(statePath, "utf8");
    assert.equal(
      writeProjectRuntimeSnapshot(
        f.root,
        "binding-a",
        JSON.stringify({ ...payload, snapshotRevision: 2, historyPending: [] }),
        1,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(statePath, "utf8"), before);
    const rename = fs.renameSync;
    let historyCalls = 0;
    const mock = t.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof rename>) => {
        if (
          (failure === "history" &&
            String(args[1]) === f.current &&
            ++historyCalls === 2) ||
          (failure === "snapshot" && String(args[1]) === statePath)
        )
          throw new Error("injected_transfer_failure");
        return Reflect.apply(rename, fs, args);
      },
    );
    let transferred: ReturnType<typeof transferProjectRuntimeSnapshotHistory>;
    try {
      transferred = transferProjectRuntimeSnapshotHistory(
        f.root,
        "binding-a",
        referenceTime,
      );
    } finally {
      mock.mock.restore();
    }
    if (failure !== "none") {
      assert.equal(transferred.status, "blocked");
      assert.equal(fs.readFileSync(statePath, "utf8"), before);
      if (failure === "snapshot") {
        const pending = JSON.parse(
          fs.readFileSync(path.join(f.directory, "state.pending.json"), "utf8"),
        );
        assert.equal(
          writeProjectRuntimeSnapshot(
            f.root,
            "binding-a",
            JSON.stringify(pending.payload),
            pending.baseRevision,
          ).status,
          "completed",
        );
      }
      transferred = transferProjectRuntimeSnapshotHistory(
        f.root,
        "binding-a",
        referenceTime,
      );
    }
    assert.equal(transferred.status, "completed");
    if (failure === "none")
      assert.deepEqual(transferred.value, { recorded: 2, expired: 1 });
    assert.equal(
      readProjectRuntimeSnapshot(f.root, "binding-a").value?.historyPending
        .length,
      0,
    );
    assert.equal(
      fs.readFileSync(f.current, "utf8").trimEnd().split("\n").length,
      3,
    );
    const check = acquireProjectRuntimeSnapshotPilotLock(f.root);
    if (check.status !== "completed") throw new Error("owner_fixture_failed");
    try {
      assert.equal(
        inspectProjectRuntimeHistorySettlement(
          check.value,
          rows[0],
          referenceTime,
        ),
        "recorded",
      );
      assert.equal(
        inspectProjectRuntimeHistorySettlement(
          check.value,
          rows[2],
          referenceTime,
        ),
        "expired",
      );
      assert.equal(
        inspectProjectRuntimeHistorySettlement(
          check.value,
          { ...rows[0], outcome: "failed", primaryFailure: "execution" },
          referenceTime,
        ),
        null,
      );
    } finally {
      assert.equal(check.value.release(), true);
    }
    assert.equal(fs.existsSync(f.pending), false);
    assert.equal(
      fs.existsSync(path.join(f.directory, "state.pending.json")),
      false,
    );
  }
});

/**
 * 履歴試験専用のRepositoryを準備する。
 *
 * @responsibility 親Repository内のexact一時Rootだけを作成・回収する。
 * @trace PRL-IT-012
 * @precondition 親Repositoryが検証できる。
 * @stimulus 一時Rootを初期化する。
 * @observation Rootと固定履歴Pathを返す。
 * @oracle 終了後にexact Rootが存在しない。
 * @cleanup 検証したRootだけを再帰回収する。
 * @boundary PRL-IT-012=Direct Boundary: fixture→Filesystem。
 */
function fixture(t: test.TestContext) {
  const temporary = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      fileURLToPath(new URL("../../../../", import.meta.url)),
      "tmp",
    ),
    "fixture_root_invalid",
  ).directory;
  const root = fs.mkdtempSync(path.join(temporary, "crdd-project-history-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => {
    assert.equal(path.dirname(root), temporary);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  const directory = path.join(root, ".crdd", "orchestrator");
  return {
    root,
    directory,
    current: path.join(directory, "history.jsonl"),
    pending: path.join(directory, "history.pending.jsonl"),
  };
}

/**
 * 固定終了要約を作成する。
 *
 * @responsibility 秘密・自由本文を含まない入力を準備する。
 * @trace PRL-IT-012
 * @precondition IDとUTC終了時刻を指定する。
 * @stimulus 固定分類のJSONを生成する。
 * @observation JSON文字列。
 * @oracle Testが時刻とIdentityを変更できる。
 * @cleanup N/A: 局所値のみ。
 * @boundary PRL-IT-012=Direct Boundary: 入力→履歴Adapter。
 */
function row(id: string, occurredAt = referenceTime) {
  return JSON.stringify({
    id,
    occurredAt: new Date(occurredAt).toISOString(),
    outcome: "completed",
    primaryFailure: null,
    cleanup: "confirmed",
  });
}

/**
 * 保持期間と数量制限がないことを確認する。
 *
 * @responsibility 30日ちょうどを保持し、期限外だけを除く。
 * @trace PRL-IT-012
 * @precondition 101行と期限外・境界の行を持つ正規履歴。
 * @stimulus 履歴を更新する。
 * @observation 行数、保持Identity、pending不存在。
 * @oracle 件数で削除せず30日境界を正しく判定する。
 * @cleanup exact fixture Rootを回収する。
 * @boundary PRL-IT-012=Direct Boundary: Adapter→Windows Filesystem。
 */
test("Host Windows: 履歴は30日だけで回収し件数で削除しない", (t) => {
  const f = fixture(t);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
    "completed",
  );
  const header = JSON.parse(
    fs.readFileSync(f.current, "utf8").split("\n")[0] ?? "",
  );
  const rows = [
    row("expired", referenceTime - 30 * DAY - 1),
    row("boundary", referenceTime - 30 * DAY),
    ...Array.from({ length: 101 }, (_unusedValue, i) => row(`job-${i}`)),
  ];
  const body = `${rows.join("\n")}\n`;
  header.rowsHash = createHash("sha256").update(body).digest("hex");
  fs.writeFileSync(f.current, `${JSON.stringify(header)}\n${body}`);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
    "completed",
  );
  const savedRows = fs
    .readFileSync(f.current, "utf8")
    .trimEnd()
    .split("\n")
    .slice(1)
    .map((line) => JSON.parse(line));
  assert.equal(savedRows.length, 102);
  assert.equal(
    savedRows.some((item) => item.id === "expired"),
    false,
  );
  assert.equal(
    savedRows.some((item) => item.id === "boundary"),
    true,
  );
  assert.equal(fs.existsSync(f.pending), false);
  assert.deepEqual(fs.readdirSync(f.directory), ["history.jsonl"]);
});

/**
 * 同じ終了Identityの再搬送を確認する。
 *
 * @responsibility 重複を増やさず違う内容を上書きしない。
 * @trace PRL-IT-012
 * @precondition 同じIDの保存済み要約。
 * @stimulus 同一要約と異なる時刻の要約を渡す。
 * @observation 行数と拒否後の内容。
 * @oracle 一行のまま、衝突ではFile不変。
 * @cleanup exact fixture Rootを回収する。
 * @boundary PRL-IT-012=Direct Boundary: 再搬送→履歴保存。
 */
test("Host Windows: 履歴再搬送は重複せず内容衝突を拒否する", (t) => {
  const f = fixture(t);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("one"), referenceTime).status,
    "completed",
  );
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("one"), referenceTime).status,
    "completed",
  );
  const before = fs.readFileSync(f.current, "utf8");
  assert.equal(before.trimEnd().split("\n").length, 2);
  assert.equal(
    updateProjectRuntimeHistoryPilot(
      f.root,
      row("one", referenceTime - 1),
      referenceTime,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(f.current, "utf8"), before);
});

/**
 * 保存中断の二つの再入場を確認する。
 *
 * @responsibility 変更前一致と候補一致から安全に進む。
 * @trace PRL-IT-012
 * @precondition 正規保存から作った固定候補。
 * @stimulus rename前・後を再現して再入場する。
 * @observation 同じ二行とpending不存在。
 * @oracle 要約を欠落・二重化しない。
 * @cleanup exact fixture Rootを回収する。
 * @boundary PRL-IT-012=Direct Boundary: 保存中断→再入場。
 */
test("Host Windows: 履歴pendingは変更前または候補一致で再入場する", (t) => {
  const f = fixture(t);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("one"), referenceTime).status,
    "completed",
  );
  const base = fs.readFileSync(f.current);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("two"), referenceTime).status,
    "completed",
  );
  const candidate = fs.readFileSync(f.current);
  for (const current of [base, candidate]) {
    fs.writeFileSync(f.current, current);
    fs.writeFileSync(f.pending, candidate);
    assert.equal(
      updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
      "completed",
    );
    assert.equal(
      fs.readFileSync(f.current, "utf8").trimEnd().split("\n").length,
      3,
    );
    assert.equal(fs.existsSync(f.pending), false);
  }
});

/**
 * 保存候補が現在値と不整合な場合を確認する。
 *
 * @responsibility 根拠が一致しない候補を保持する。
 * @trace PRL-IT-012
 * @precondition 別の更新後の履歴と古い候補。
 * @stimulus 再入場する。
 * @observation 両Fileの不変。
 * @oracle 上書きも削除もしない。
 * @cleanup exact fixture Rootを回収する。
 * @boundary PRL-IT-012=Direct Boundary: 不整合→拒否。
 */
test("Host Windows: 履歴pendingの不整合は両方を保持する", (t) => {
  const f = fixture(t);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("one"), referenceTime).status,
    "completed",
  );
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("two"), referenceTime).status,
    "completed",
  );
  const candidate = fs.readFileSync(f.current);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("three"), referenceTime)
      .status,
    "completed",
  );
  const before = fs.readFileSync(f.current);
  fs.writeFileSync(f.pending, candidate);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(f.current), before);
  assert.deepEqual(fs.readFileSync(f.pending), candidate);
});

/**
 * 期限外の破損と時計逆行を確認する。
 *
 * @responsibility 不正履歴を期限削除で隠さない。
 * @trace PRL-IT-012
 * @precondition 保存済み履歴。
 * @stimulus 破損行、部分行、未来入力、時計逆行を与える。
 * @observation blockedとFile不変。
 * @oracle 削除もpending作成もない。
 * @cleanup exact fixture Rootを回収する。
 * @boundary PRL-IT-012=Direct Boundary: 破損・時刻→拒否。
 */
test("Host Windows: 期限外の破損・部分行・時計逆行を削除へ畳まない", (t) => {
  const f = fixture(t);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("one"), referenceTime).status,
    "completed",
  );
  const valid = fs.readFileSync(f.current, "utf8");
  for (const broken of [
    `${valid}{"occurredAt":"2000-01-01T00:00:00.000Z"}\n`,
    `${valid}{`,
  ]) {
    fs.writeFileSync(f.current, broken);
    assert.equal(
      updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(f.current, "utf8"), broken);
    assert.equal(fs.existsSync(f.pending), false);
  }
  fs.writeFileSync(f.current, valid);
  assert.equal(
    updateProjectRuntimeHistoryPilot(
      f.root,
      row("future", referenceTime + 1),
      referenceTime,
    ).status,
    "blocked",
  );
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, null, referenceTime - 1).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(f.current, "utf8"), valid);
  fs.writeFileSync(f.pending, "{");
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(f.pending, "utf8"), "{");
});

/**
 * 排他取得後のRoot再解決を反証する。
 *
 * @responsibility 別Rootの排他で履歴を更新しない。
 * @trace PRL-IT-005
 * @precondition 二つの独立Repositoryに履歴がある。
 * @stimulus 排他取得後のRoot観測を別Rootへ差し替える。
 * @observation 拒否と両履歴・pendingの不変。
 * @oracle 別Rootへの書込み前に停止する。
 * @cleanup mockを戻しexact fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: Root再解決→排他結合。
 */
test("Host Windows: 履歴保存先は取得済み排他のRootから変更できない", (t) => {
  const a = fixture(t);
  const b = fixture(t);
  assert.equal(
    updateProjectRuntimeHistoryPilot(a.root, row("a"), referenceTime).status,
    "completed",
  );
  assert.equal(
    updateProjectRuntimeHistoryPilot(b.root, row("b"), referenceTime).status,
    "completed",
  );
  const beforeA = fs.readFileSync(a.current);
  const beforeB = fs.readFileSync(b.current);
  const original = fs.realpathSync.native;
  let calls = 0;
  let hasChanged = false;
  const mocked = t.mock.method(
    fs.realpathSync,
    "native",
    (...args: Parameters<typeof original>) => {
      if (String(args[0]) === a.root) {
        calls += 1;
        if (calls >= 3) {
          hasChanged = true;
          return b.root;
        }
      }
      return Reflect.apply(original, fs.realpathSync, args);
    },
  );
  try {
    assert.equal(
      updateProjectRuntimeHistoryPilot(a.root, row("new"), referenceTime)
        .status,
      "blocked",
    );
    assert.equal(hasChanged, true);
  } finally {
    mocked.mock.restore();
  }
  assert.deepEqual(fs.readFileSync(a.current), beforeA);
  assert.deepEqual(fs.readFileSync(b.current), beforeB);
  assert.equal(fs.existsSync(a.pending), false);
  assert.equal(fs.existsSync(b.pending), false);
});

/**
 * 保存途中の障害と再入場を反証する。
 *
 * @responsibility fsync・renameの失敗を成功にせず候補を保つ。
 * @trace PRL-IT-012
 * @precondition 正規履歴と次の終了要約。
 * @stimulus 保存境界を一回失敗させて再入場する。
 * @observation 初回停止、旧履歴不変、次回保存とpending不存在。
 * @oracle 内容を失わず同じ候補から再開する。
 * @cleanup mockを戻しexact fixtureを回収する。
 * @boundary PRL-IT-012=Direct Boundary: fsync・rename→再入場。
 */
test("Host Windows: fsyncとrename失敗後も履歴候補から再入場できる", (t) => {
  for (const method of ["fsyncSync", "renameSync"] as const) {
    const f = fixture(t);
    assert.equal(
      updateProjectRuntimeHistoryPilot(f.root, row("one"), referenceTime)
        .status,
      "completed",
    );
    const before = fs.readFileSync(f.current);
    let hits = 0;
    const mocked = t.mock.method(fs, method, () => {
      hits += 1;
      throw new Error("injected");
    });
    try {
      assert.equal(
        updateProjectRuntimeHistoryPilot(f.root, row("two"), referenceTime)
          .status,
        "blocked",
      );
      assert.equal(hits, 1);
    } finally {
      mocked.mock.restore();
    }
    assert.deepEqual(fs.readFileSync(f.current), before);
    assert.equal(fs.existsSync(f.pending), true);
    assert.equal(
      updateProjectRuntimeHistoryPilot(f.root, row("two"), referenceTime)
        .status,
      "completed",
    );
    assert.equal(
      fs.readFileSync(f.current, "utf8").trimEnd().split("\n").length,
      3,
    );
    assert.equal(fs.existsSync(f.pending), false);
  }
});

/**
 * 非単一Fileと観測不能を反証する。
 *
 * @responsibility alias・読取り失敗を不存在へ畳まない。
 * @trace PRL-IT-012
 * @precondition 正規履歴。
 * @stimulus hard linkとEACCESを注入する。
 * @observation blockedと元File不変。
 * @oracle 不存在として新規履歴へ置換しない。
 * @cleanup mockとlinkを戻しexact fixtureを回収する。
 * @boundary PRL-IT-012=Direct Boundary: File観測→拒否。
 */
test("Host Windows: 履歴のaliasと観測不能を不存在へ畳まない", (t) => {
  const f = fixture(t);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, row("one"), referenceTime).status,
    "completed",
  );
  const before = fs.readFileSync(f.current);
  const alias = path.join(f.directory, "alias.jsonl");
  fs.linkSync(f.current, alias);
  assert.equal(
    updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(f.current), before);
  fs.unlinkSync(alias);
  const original = fs.lstatSync;
  const mocked = t.mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof original>) => {
      if (String(args[0]) === f.current)
        throw Object.assign(new Error("injected"), { code: "EACCES" });
      return Reflect.apply(original, fs, args);
    },
  );
  try {
    assert.equal(
      updateProjectRuntimeHistoryPilot(f.root, null, referenceTime).status,
      "blocked",
    );
  } finally {
    mocked.mock.restore();
  }
  assert.deepEqual(fs.readFileSync(f.current), before);
  assert.equal(fs.existsSync(f.pending), false);
});
