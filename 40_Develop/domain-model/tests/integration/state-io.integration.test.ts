/**
 * 既存Writerから移した固定ファイルI/Oの失敗境界を検証する。
 * @packageDocumentation
 * @responsibility 実体置換、Owner失効、I/O故障と発行記録を実Filesystemで反証する。
 * @trace PRL-IT-013
 * @level IT
 * @scope 固定現在状態ファイルの物理I/Oだけ。
 * @boundary 合成のRepository-local試験領域。AI・Docker・保持物なし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  readRuntimeStateFile,
  createRuntimeStatePendingFile,
  flushRuntimeStateFile,
  type RuntimeStateFileName,
  type RuntimeStatePendingFileName,
  type StableFileIdentity,
} from "../../src/index.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";

/**
 * 三つの出版前flushの評価順と失敗時descriptor終了を確認する。
 * @responsibility Owner・実体・Effect記録の対象別順序を抽出前と比較する。
 * @trace PRL-IT-013
 * @precondition 自己生成領域の同期I/Oだけを差し替える。
 * @stimulus 正常・実体欠測・open時Map変更・各I/O故障を固定対象へ与える。
 * @observation 呼出し順、例外、Effect件数とclose件数。
 * @oracle 正本履歴だけopen前Identity、状態pendingは追加発行記録なし。
 * @cleanup mockを復元して自己生成Rootだけを清掃する。
 * @boundary 外部AI・Docker・保持物は使用しない。
 */
test("出版前flushは対象別の実体・Owner・Effect照合順と失敗を保持する", (t) => {
  const fixture = createRepositoryTestDirectory("domain-state-flush-");
  const names = [
    "history.pending.jsonl",
    "history.jsonl",
    "state.pending.json",
  ] as const;
  try {
    for (const name of names) {
      const file = path.join(fixture.path, name);
      fs.writeFileSync(file, "snapshot");
      const observed = new Map<string, StableFileIdentity>();
      readRuntimeStateFile(fixture.path, name, observed, 1024, () => {});
      for (const fault of [
        "none",
        "missing",
        "map_changed_at_open",
        "openSync",
        "fstatSync",
        "fsyncSync",
        "closeSync",
        "boundary",
      ] as const) {
        const identities = new Map(observed);
        if (fault === "missing") identities.clear();
        const events: string[] = [];
        for (const operation of [
          "openSync",
          "fstatSync",
          "fsyncSync",
          "closeSync",
        ] as const) {
          const original = fs[operation] as (...args: unknown[]) => unknown;
          t.mock.method(fs, operation, (...args: unknown[]) => {
            events.push(operation);
            if (fault === operation) {
              if (operation === "closeSync") original(...args);
              throw new Error(`fault_${operation}`);
            }
            const result = original(...args);
            if (operation === "openSync" && fault === "map_changed_at_open")
              identities.clear();
            return result;
          });
        }
        let failure: unknown;
        try {
          flushRuntimeStateFile(
            fixture.path,
            name,
            identities,
            () => {
              events.push("boundary");
              if (fault === "boundary") throw new Error("owner_expired");
            },
            () => {
              events.push("effect");
            },
          );
        } catch (error) {
          failure = error;
        } finally {
          t.mock.restoreAll();
        }
        const canonical = name === "history.jsonl";
        const statePending = name === "state.pending.json";
        const prefix = canonical ? [] : ["boundary"];
        const replaced = canonical
          ? "history_canonical_replaced"
          : statePending
            ? "pending_replaced"
            : "history_pending_replaced";
        const normal = [
          ...prefix,
          "openSync",
          "fstatSync",
          ...(canonical ? ["boundary"] : []),
          ...(statePending ? [] : ["effect"]),
          "fsyncSync",
          "closeSync",
        ];
        if (
          fault === "none" ||
          (fault === "map_changed_at_open" && canonical)
        ) {
          assert.equal(failure, undefined);
          assert.deepEqual(events, normal);
        } else {
          assert.ok(failure instanceof Error);
          if (fault === "missing" || fault === "map_changed_at_open") {
            assert.equal(failure.message, replaced);
            assert.deepEqual(events, [...prefix, "openSync", "closeSync"]);
          } else if (fault === "boundary") {
            assert.equal(failure.message, "owner_expired");
            assert.deepEqual(
              events,
              canonical
                ? ["openSync", "fstatSync", "boundary", "closeSync"]
                : ["boundary"],
            );
          } else {
            assert.equal(failure.message, `fault_${fault}`);
            const index = normal.indexOf(fault);
            assert.deepEqual(events, [
              ...normal.slice(0, index + 1),
              ...(fault === "openSync" || fault === "closeSync"
                ? []
                : ["closeSync"]),
            ]);
          }
        }
        assert.equal(fs.readFileSync(file, "utf8"), "snapshot");
      }
      fs.unlinkSync(file);
    }
    assert.throws(
      () =>
        flushRuntimeStateFile(
          fixture.path,
          "../outside" as "history.jsonl",
          new Map(),
          () => assert.fail("invalid name must not reach boundary"),
          () => assert.fail("invalid name must not issue effect"),
        ),
      /state_flush_file_name_invalid/,
    );
  } finally {
    t.mock.restoreAll();
    fixture.cleanup();
  }
});

/**
 * 同じMapで読取り実体と排他的作成・読戻しを確認する。
 * @responsibility 不存在・置換・消失・上限・名前境界の拒否を検証する。
 * @trace PRL-IT-013
 * @precondition 試験自身が作成した領域のみ使用する。
 * @stimulus 固定ファイルを読み、作成し、置換又は削除する。
 * @observation 本文、例外、Effect記録とOwner照合回数。
 * @oracle 未観測不存在だけnull、同名置換と既観測消失は例外。
 * @cleanup 生成handleのexact Rootだけを清掃する。
 * @boundary 実Filesystemと保存部品。
 */
test("固定I/Oは同じMapと照合点を維持し、置換・消失・不正名を拒否する", () => {
  const fixture = createRepositoryTestDirectory("domain-state-io-");
  try {
    const identities = new Map<string, StableFileIdentity>();
    let checks = 0;
    let effects = 0;
    const check = () => {
      checks++;
    };
    assert.equal(
      readRuntimeStateFile(fixture.path, "state.json", identities, 1024, check),
      null,
    );
    assert.equal(checks, 2);
    createRuntimeStatePendingFile(
      fixture.path,
      "state.pending.json",
      Buffer.from("candidate\n"),
      identities,
      1024,
      check,
      () => {
        effects++;
      },
    );
    assert.equal(checks, 5);
    assert.equal(effects, 1);
    assert.equal(
      readRuntimeStateFile(
        fixture.path,
        "state.pending.json",
        identities,
        1024,
        check,
      )?.toString(),
      "candidate\n",
    );
    assert.throws(
      () =>
        createRuntimeStatePendingFile(
          fixture.path,
          "state.pending.json",
          Buffer.from("different\n"),
          identities,
          1024,
          check,
          () => {
            effects++;
          },
        ),
      { code: "EEXIST" },
    );
    assert.equal(effects, 2);
    const file = path.join(fixture.path, "state.pending.json");
    fs.renameSync(file, path.join(fixture.path, "original.json"));
    fs.writeFileSync(file, "replacement\n");
    assert.throws(
      () =>
        readRuntimeStateFile(
          fixture.path,
          "state.pending.json",
          identities,
          1024,
          check,
        ),
      /file_replaced/,
    );
    fs.unlinkSync(file);
    assert.throws(
      () =>
        readRuntimeStateFile(
          fixture.path,
          "state.pending.json",
          identities,
          1024,
          check,
        ),
      /file_disappeared/,
    );
    for (const name of [
      "../escaped.json",
      path.resolve(fixture.path, "absolute.json"),
      "other.json",
    ]) {
      assert.throws(
        () =>
          readRuntimeStateFile(
            fixture.path,
            name as RuntimeStateFileName,
            identities,
            1024,
            check,
          ),
        /state_file_name_invalid/,
      );
      assert.throws(
        () =>
          createRuntimeStatePendingFile(
            fixture.path,
            name as RuntimeStatePendingFileName,
            Buffer.from("bad"),
            identities,
            1024,
            check,
            () => {
              effects++;
            },
          ),
        /state_pending_file_name_invalid/,
      );
    }
    assert.equal(effects, 2);
    fs.writeFileSync(path.join(fixture.path, "state.json"), "large");
    assert.throws(() =>
      readRuntimeStateFile(fixture.path, "state.json", identities, 1, check),
    );
  } finally {
    fixture.cleanup();
  }
});

/**
 * Owner失効と各I/O故障でも発行事実・残存を失わない。
 * @responsibility 作成前照合と発行記録の順序、closeと失敗伝播を検証する。
 * @trace PRL-IT-013
 * @precondition 同期I/Oだけを局所差替えし、終了時に必ず復元する。
 * @stimulus 前後のOwner失効、open・write・fsync・closeの故障を発生させる。
 * @observation Effect記録、残存、例外とdescriptor終了。
 * @oracle 開始前失効だけEffectなし。発行後故障は成功とせず残存を自動削除しない。
 * @cleanup mock復元後に生成handleだけを清掃する。
 * @boundary 同期低水準I/O。上位Snapshotの回復判断は行わない。
 */
test("固定I/OはOwner失効とI/O故障を伝播し、作成前にEffectを記録する", (t) => {
  const fixture = createRepositoryTestDirectory("domain-state-io-fault-");
  try {
    for (const failAt of [1, 2]) {
      let checks = 0;
      let issued = false;
      assert.throws(
        () =>
          createRuntimeStatePendingFile(
            fixture.path,
            "state.pending.json",
            Buffer.from("candidate"),
            new Map(),
            1024,
            () => {
              if (++checks === failAt) throw new Error("owner_expired");
            },
            () => {
              issued = true;
            },
          ),
        /owner_expired/,
      );
      assert.equal(issued, failAt === 2);
      const file = path.join(fixture.path, "state.pending.json");
      assert.equal(fs.existsSync(file), failAt === 2);
      if (failAt === 2) fs.unlinkSync(file);
    }
    for (const operation of [
      "openSync",
      "writeFileSync",
      "fsyncSync",
      "closeSync",
    ] as const) {
      let issued = false;
      const originalClose = fs.closeSync;
      t.mock.method(fs, operation, (...args: unknown[]) => {
        assert.equal(issued, true);
        if (operation === "closeSync") originalClose(args[0] as number);
        throw new Error("fixed_io_fault");
      });
      try {
        assert.throws(
          () =>
            createRuntimeStatePendingFile(
              fixture.path,
              "state.pending.json",
              Buffer.from("candidate"),
              new Map(),
              1024,
              () => {},
              () => {
                issued = true;
              },
            ),
          /fixed_io_fault/,
        );
        assert.equal(issued, true);
      } finally {
        t.mock.restoreAll();
      }
      const file = path.join(fixture.path, "state.pending.json");
      assert.equal(fs.existsSync(file), operation !== "openSync");
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    t.mock.method(fs, "writeFileSync", () => {});
    assert.throws(() =>
      createRuntimeStatePendingFile(
        fixture.path,
        "state.pending.json",
        Buffer.from("candidate"),
        new Map(),
        1024,
        () => {},
        () => {},
      ),
    );
    t.mock.restoreAll();
    assert.equal(
      fs.existsSync(path.join(fixture.path, "state.pending.json")),
      true,
    );
    fs.unlinkSync(path.join(fixture.path, "state.pending.json"));
    fs.writeFileSync(path.join(fixture.path, "state.json"), "current");
    const originalLstat = fs.lstatSync;
    t.mock.method(
      fs,
      "lstatSync",
      (...args: Parameters<typeof fs.lstatSync>) => {
        const metadata = originalLstat(...args);
        Object.defineProperty(metadata, "nlink", { value: 2 });
        return metadata;
      },
    );
    assert.throws(
      () =>
        readRuntimeStateFile(
          fixture.path,
          "state.json",
          new Map(),
          1024,
          () => {},
        ),
      /file/,
    );
    t.mock.restoreAll();
  } finally {
    t.mock.restoreAll();
    fixture.cleanup();
  }
});
