import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { RepairHistoryPublicationFaultPoint } from "../src/security/docker-desktop-repair-history-publication.ts";
import { createRepairHistoryPublicationTestingAdapter } from "./helpers/docker-desktop-repair-history-publication-testing.ts";

const TARGET = "historical-adoption.json";
const PREPARE = ".crdd-history-adoption.prepare";
const BYTES = Buffer.from('{"schema":"test","value":"a"}\n', "utf8");
const OTHER = Buffer.from('{"schema":"test","value":"b"}\n', "utf8");

function fixture(t: test.TestContext) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-history-publish-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return {
    directory,
    target: path.join(directory, TARGET),
    preparation: path.join(directory, PREPARE),
  };
}

function sameFile(left: string, right: string) {
  const a = fs.statSync(left, { bigint: true });
  const b = fs.statSync(right, { bigint: true });
  return a.dev === b.dev && a.ino === b.ino && a.birthtimeNs === b.birthtimeNs;
}

test("耐久公開: absent target + absent prepareはexact targetへ公開してprepareを残さない", (t) => {
  const value = fixture(t);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
});

test("耐久公開: prepare-onlyは同byteの対象限定再入場で収束する", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.preparation, BYTES);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
});

test("耐久公開: targetと同一fileのprepare residueだけを収束する", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.preparation, BYTES);
  fs.linkSync(value.preparation, value.target);
  assert.equal(sameFile(value.target, value.preparation), true);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
});

test("耐久公開: same-byte foreign prepareは双方を変更せず拒否する", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.target, BYTES);
  fs.writeFileSync(value.preparation, BYTES);
  assert.equal(sameFile(value.target, value.preparation), false);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), false);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.readFileSync(value.preparation).equals(BYTES), true);
});

for (const prepare of [false, true]) {
  test(`耐久公開: different-byte targetはprepare=${prepare}でも既存実体を変更しない`, (t) => {
    const value = fixture(t);
    fs.writeFileSync(value.target, OTHER);
    if (prepare) fs.writeFileSync(value.preparation, BYTES);
    const adapter = createRepairHistoryPublicationTestingAdapter(
      value.directory,
    );
    assert.equal(adapter.publish(TARGET, PREPARE, BYTES), false);
    assert.equal(fs.readFileSync(value.target).equals(OTHER), true);
    assert.equal(fs.existsSync(value.preparation), prepare);
    if (prepare)
      assert.equal(fs.readFileSync(value.preparation).equals(BYTES), true);
  });
}

for (const point of [
  "after_link_before_directory_commit",
  "after_first_directory_commit_before_unlink",
  "after_unlink_before_directory_commit",
] as const) {
  test(`耐久公開: ${point}の中断を成功にせずfresh再入場で収束する`, (t) => {
    const value = fixture(t);
    let injected = false;
    const first = createRepairHistoryPublicationTestingAdapter(
      value.directory,
      {
        injectFault: (candidate: RepairHistoryPublicationFaultPoint) => {
          if (candidate === point && !injected) {
            injected = true;
            throw new Error(`injected_${point}`);
          }
        },
      },
    );
    assert.equal(first.publish(TARGET, PREPARE, BYTES), false);
    assert.equal(injected, true);
    assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
    assert.equal(
      fs.existsSync(value.preparation),
      point !== "after_unlink_before_directory_commit",
    );
    let commits = 0;
    const retry = createRepairHistoryPublicationTestingAdapter(
      value.directory,
      {
        observeDirectoryCommit: () => commits++,
      },
    );
    assert.equal(retry.publish(TARGET, PREPARE, BYTES), true);
    assert.equal(commits >= 1, true);
    assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
    assert.equal(fs.existsSync(value.preparation), false);
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("race fixture timeout");
}

async function runRace(t: test.TestContext, contents: readonly Buffer[]) {
  const value = fixture(t);
  const start = path.join(value.directory, "start");
  const release = path.join(value.directory, "release");
  const children = contents.map((bytes, index) => {
    const ready = path.join(value.directory, `ready-${index}`);
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "./fixtures/repair-history-publication-race-worker.ts",
            import.meta.url,
          ),
        ),
        value.directory,
        TARGET,
        PREPARE,
        bytes.toString("base64"),
        start,
        ready,
        release,
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    const completion = new Promise<{
      status: number | null;
      stdout: string;
      stderr: string;
    }>((resolve) =>
      child.once("close", (status) => resolve({ status, stdout, stderr })),
    );
    return { child, ready, completion };
  });
  fs.writeFileSync(start, "start\n", { flag: "wx" });
  await waitUntil(
    () =>
      children.some(({ ready }) => fs.existsSync(ready)) ||
      children.some(({ child }) => child.exitCode !== null),
  );
  fs.writeFileSync(release, "release\n", { flag: "wx" });
  const results = await Promise.all(
    children.map(({ completion }) => completion),
  );
  for (const result of results) {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  }
  return { ...value, results };
}

test("耐久公開: 同byteの実別Process競合は有限再入場後に同じtargetへ収束する", async (t) => {
  const value = await runRace(t, [BYTES, BYTES]);
  const retry = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(retry.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
});

test("耐久公開: 異byteの実別Process競合は単一winnerを上書きしない", async (t) => {
  const value = await runRace(t, [BYTES, OTHER]);
  const winner = fs.readFileSync(value.target);
  assert.equal(winner.equals(BYTES) || winner.equals(OTHER), true);
  const loser = winner.equals(BYTES) ? OTHER : BYTES;
  const retry = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(retry.publish(TARGET, PREPARE, loser), false);
  assert.equal(fs.readFileSync(value.target).equals(winner), true);
});

test("耐久公開のtesting adapterは本番entrypointから到達せず試験Rootだけを変更する", () => {
  const productionEntry = fs.readFileSync(
    new URL("../bin/coordinator.ts", import.meta.url),
    "utf8",
  );
  const productionStore = fs.readFileSync(
    new URL(
      "../src/security/docker-desktop-repair-record-store.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(productionEntry, /history-publication-testing/u);
  assert.doesNotMatch(productionStore, /history-publication-testing/u);
  assert.match(productionStore, /productionHistoryPublicationOperations/u);
});
