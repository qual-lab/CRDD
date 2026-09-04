import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createScanner, SyntaxKind } from "typescript/unstable/ast";
import type { RepairHistoryPublicationFaultPoint } from "../src/security/docker-desktop-repair-history-publication.ts";
import { createRepairHistoryPublicationTestingAdapter } from "./helpers/docker-desktop-repair-history-publication-testing.ts";
import {
  assertRuntimeTraceCase,
  assertRuntimeTraceExecutionCoverage,
} from "./runtime-trace-case.ts";

const TARGET = "historical-adoption.json";
const PREPARE = ".crdd-history-adoption.prepare";
const BYTES = Buffer.from('{"schema":"test","value":"a"}\n', "utf8");
const OTHER = Buffer.from('{"schema":"test","value":"b"}\n', "utf8");
const publicationTraceAssertions: Readonly<
  Record<string, typeof assertRuntimeTraceCase>
> = Object.freeze({
  "CASE-REPAIR-HISTORY-PUBLICATION-ABSENT": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-PREPARE-ONLY": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-PUBLISHED-RESIDUE": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FOREIGN-PREPARE": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-NO-PREPARE":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-WITH-PREPARE":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-LINK": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-FIRST-COMMIT":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-UNLINK": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-SAME-BYTE-RACE": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE": assertRuntimeTraceCase,
});
const executedPublicationTraceCases = new Set<string>();

function observePublicationCase(
  caseId: string,
  taken: boolean,
  rejectedPostcondition: "absent" | "preserved" = "preserved",
) {
  const transitionId = `TRANS-${caseId.slice("CASE-".length)}`;
  publicationTraceAssertions[caseId]?.(caseId, {
    id: caseId,
    transitionId,
    fromState: "STATE-REPAIR-HISTORY-PREPARED",
    outcome: taken ? "taken" : "rejected",
    expectedEndState: taken
      ? "STATE-REPAIR-HISTORY-PUBLISHED"
      : "STATE-REPAIR-HISTORY-PREPARED",
    effectObservations: { provider: 0, host: 0, cleanup: taken ? 1 : 0 },
    expectedStatus: taken ? "completed" : "recovery_required",
    resourcePostconditions: {
      "RES-REPAIR-HISTORY-PREPARE": taken ? "absent" : rejectedPostcondition,
    },
  });
  executedPublicationTraceCases.add(caseId);
}

function relativeImports(source: string) {
  const scanner = createScanner(true, undefined, source);
  const tokens: Array<{ kind: SyntaxKind; value: string }> = [];
  for (;;) {
    const kind = scanner.scan();
    if (kind === SyntaxKind.EndOfFile) break;
    tokens.push({ kind, value: scanner.getTokenValue() });
  }
  const result: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (
      tokens[index]?.kind !== SyntaxKind.ImportKeyword &&
      tokens[index]?.kind !== SyntaxKind.ExportKeyword
    )
      continue;
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      if (tokens[cursor]?.kind === SyntaxKind.SemicolonToken) break;
      if (tokens[cursor]?.kind !== SyntaxKind.StringLiteral) continue;
      const value = tokens[cursor]?.value ?? "";
      if (value.startsWith(".")) result.push(value);
      break;
    }
  }
  return result;
}

function productionDependencyClosure(entry: string) {
  const visited = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const source = fs.readFileSync(current, "utf8");
    for (const specifier of relativeImports(source)) {
      const resolved = path.resolve(path.dirname(current), specifier);
      if (fs.existsSync(resolved) && !visited.has(resolved))
        pending.push(resolved);
    }
  }
  return visited;
}

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
  observePublicationCase("CASE-REPAIR-HISTORY-PUBLICATION-ABSENT", true);
});

test("耐久公開: prepare-onlyは同byteの対象限定再入場で収束する", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.preparation, BYTES);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase("CASE-REPAIR-HISTORY-PUBLICATION-PREPARE-ONLY", true);
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
  observePublicationCase(
    "CASE-REPAIR-HISTORY-PUBLICATION-PUBLISHED-RESIDUE",
    true,
  );
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
  observePublicationCase(
    "CASE-REPAIR-HISTORY-PUBLICATION-FOREIGN-PREPARE",
    false,
  );
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
    observePublicationCase(
      prepare
        ? "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-WITH-PREPARE"
        : "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-NO-PREPARE",
      false,
      prepare ? "preserved" : "absent",
    );
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
    observePublicationCase(
      point === "after_link_before_directory_commit"
        ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-LINK"
        : point === "after_first_directory_commit_before_unlink"
          ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-FIRST-COMMIT"
          : "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-UNLINK",
      true,
    );
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
  await waitUntil(() =>
    children.every(
      ({ ready, child }) => fs.existsSync(ready) || child.exitCode !== null,
    ),
  );
  const readyBeforeRelease = children.map(({ ready }) => fs.existsSync(ready));
  const [firstContents] = contents;
  assert.ok(firstContents);
  if (contents.every((bytes) => bytes.equals(firstContents)))
    assert.equal(
      readyBeforeRelease.every(Boolean),
      true,
      "same-byte race must hold every child at the publication barrier",
    );
  fs.writeFileSync(release, "release\n", { flag: "wx" });
  const results = await Promise.all(
    children.map(({ completion }) => completion),
  );
  for (const result of results) {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      result: JSON.parse(result.stdout).result,
    });
    assert.equal(typeof JSON.parse(result.stdout).result, "boolean");
  }
  return { ...value, results, readyBeforeRelease };
}

test("耐久公開: 同byteの実別Process競合は有限再入場後に同じtargetへ収束する", async (t) => {
  const value = await runRace(t, [BYTES, BYTES]);
  assert.equal(
    value.results.some(({ stdout }) => JSON.parse(stdout).result === true),
    true,
  );
  const retry = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(retry.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase(
    "CASE-REPAIR-HISTORY-PUBLICATION-SAME-BYTE-RACE",
    true,
  );
});

test("耐久公開: 異byteの実別Process競合は単一winnerを上書きしない", async (t) => {
  const value = await runRace(t, [BYTES, OTHER]);
  assert.equal(
    value.results.filter(({ stdout }) => JSON.parse(stdout).result === true)
      .length,
    1,
  );
  assert.equal(
    value.results.filter(({ stdout }) => JSON.parse(stdout).result === false)
      .length,
    1,
  );
  const winner = fs.readFileSync(value.target);
  assert.equal(winner.equals(BYTES) || winner.equals(OTHER), true);
  const loser = winner.equals(BYTES) ? OTHER : BYTES;
  const preparationBeforeRetry = fs.existsSync(value.preparation)
    ? fs.readFileSync(value.preparation)
    : null;
  const retry = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(retry.publish(TARGET, PREPARE, loser), false);
  assert.equal(fs.readFileSync(value.target).equals(winner), true);
  if (preparationBeforeRetry)
    assert.equal(
      fs.readFileSync(value.preparation).equals(preparationBeforeRetry),
      true,
      "foreign preparation residue must not be deleted or rewritten",
    );
  observePublicationCase(
    "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE",
    false,
  );
});

test("耐久公開Traceの全caseは正本・registry・実行集合が一致する", () => {
  assertRuntimeTraceExecutionCoverage(
    "40_Develop/coordinator/tests/docker-desktop-repair-history-publication.contract.test.ts",
    Object.keys(publicationTraceAssertions),
    executedPublicationTraceCases,
  );
});

test("耐久公開のtesting adapterは本番entrypointから到達せず試験Rootだけを変更する", () => {
  const closure = productionDependencyClosure(
    fileURLToPath(new URL("../bin/coordinator.ts", import.meta.url)),
  );
  const testingAdapter = fileURLToPath(
    new URL(
      "./helpers/docker-desktop-repair-history-publication-testing.ts",
      import.meta.url,
    ),
  );
  assert.equal(closure.has(testingAdapter), false);
  assert.throws(
    () => createRepairHistoryPublicationTestingAdapter(process.cwd()),
    /testing_root_invalid/u,
  );
});
