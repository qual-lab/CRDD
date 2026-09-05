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
  "CASE-REPAIR-HISTORY-PUBLICATION-UNKNOWN-OBSERVATION": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-LINK-FIRST":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-LINK-RETRY":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-FIRST-COMMIT-FIRST":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-FIRST-COMMIT-RETRY":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AT-UNLINK-FIRST":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AT-UNLINK-RETRY":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-UNLINK-FIRST":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-UNLINK-RETRY":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-SAME-BYTE-RACE": assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE-WINNER":
    assertRuntimeTraceCase,
  "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE-LOSER":
    assertRuntimeTraceCase,
});
const executedPublicationTraceCases = new Set<string>();

function observePublicationCase(
  caseId: string,
  observed: Parameters<typeof assertRuntimeTraceCase>[1],
) {
  publicationTraceAssertions[caseId]?.(caseId, observed);
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
      if (
        fs.existsSync(resolved) &&
        fs.statSync(resolved).isFile() &&
        !visited.has(resolved)
      )
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

function observeFinalGlobalPublication(
  value: Readonly<{ target: string; preparation: string }>,
  attempts: readonly Readonly<{ input: Buffer; result: boolean }>[],
) {
  const successfulAttempts = attempts.filter(({ result }) => result);
  assert.equal(
    successfulAttempts.length,
    1,
    "the race must have exactly one successful publication attempt",
  );
  const expectedTarget = successfulAttempts[0]?.input;
  assert.ok(expectedTarget);
  let target: Buffer | null = null;
  let preparation: boolean | null = null;
  try {
    target = fs.readFileSync(value.target);
  } catch {
    target = null;
  }
  try {
    fs.lstatSync(value.preparation);
    preparation = true;
  } catch (error) {
    preparation =
      error &&
      typeof error === "object" &&
      Reflect.get(error, "code") === "ENOENT"
        ? false
        : null;
  }
  const state =
    target?.equals(expectedTarget) === true && preparation === false
      ? ("STATE-REPAIR-HISTORY-PUBLISHED" as const)
      : null;
  const preparationPostcondition =
    preparation === false
      ? ("absent" as const)
      : preparation === true
        ? ("present" as const)
        : null;
  assert.equal(
    state,
    "STATE-REPAIR-HISTORY-PUBLISHED",
    "the final global state must be observed from the exact target and absent preparation",
  );
  assert.equal(
    preparationPostcondition,
    "absent",
    "the final preparation absence must come from the filesystem observation",
  );
  return Object.freeze({ state, preparationPostcondition });
}

test("回復可能な公開: absent target + absent prepareはexact targetへ公開してprepareを残さない", (t) => {
  const value = fixture(t);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase("CASE-REPAIR-HISTORY-PUBLICATION-ABSENT", {
    id: "CASE-REPAIR-HISTORY-PUBLICATION-ABSENT",
    transitionId: "TRANS-REPAIR-HISTORY-ABSENT-TO-PUBLISHED",
    fromState: "STATE-REPAIR-HISTORY-ABSENT",
    outcome: "taken",
    expectedEndState: "STATE-REPAIR-HISTORY-PUBLISHED",
    effectObservations: { provider: 0, host: 0, cleanup: 1 },
    expectedStatus: "completed",
    resourcePostconditions: { "RES-REPAIR-HISTORY-PREPARE": "absent" },
  });
});

test("回復可能な公開: prepare-onlyは同byteの対象限定再入場で収束する", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.preparation, BYTES);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase("CASE-REPAIR-HISTORY-PUBLICATION-PREPARE-ONLY", {
    id: "CASE-REPAIR-HISTORY-PUBLICATION-PREPARE-ONLY",
    transitionId: "TRANS-REPAIR-HISTORY-PREPARE-ONLY-TO-PUBLISHED",
    fromState: "STATE-REPAIR-HISTORY-PREPARE-ONLY",
    outcome: "taken",
    expectedEndState: "STATE-REPAIR-HISTORY-PUBLISHED",
    effectObservations: { provider: 0, host: 0, cleanup: 1 },
    expectedStatus: "completed",
    resourcePostconditions: { "RES-REPAIR-HISTORY-PREPARE": "absent" },
  });
});

test("回復可能な公開: targetと同一fileのprepare residueだけを収束する", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.preparation, BYTES);
  fs.linkSync(value.preparation, value.target);
  assert.equal(sameFile(value.target, value.preparation), true);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase("CASE-REPAIR-HISTORY-PUBLICATION-PUBLISHED-RESIDUE", {
    id: "CASE-REPAIR-HISTORY-PUBLICATION-PUBLISHED-RESIDUE",
    transitionId: "TRANS-REPAIR-HISTORY-SAME-FILE-PREPARE-TO-PUBLISHED",
    fromState: "STATE-REPAIR-HISTORY-TARGET-WITH-SAME-FILE-PREPARE",
    outcome: "taken",
    expectedEndState: "STATE-REPAIR-HISTORY-PUBLISHED",
    effectObservations: { provider: 0, host: 0, cleanup: 1 },
    expectedStatus: "completed",
    resourcePostconditions: { "RES-REPAIR-HISTORY-PREPARE": "absent" },
  });
});

test("回復可能な公開: same-byte foreign prepareは双方を変更せず拒否する", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.target, BYTES);
  fs.writeFileSync(value.preparation, BYTES);
  assert.equal(sameFile(value.target, value.preparation), false);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), false);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.readFileSync(value.preparation).equals(BYTES), true);
  observePublicationCase("CASE-REPAIR-HISTORY-PUBLICATION-FOREIGN-PREPARE", {
    id: "CASE-REPAIR-HISTORY-PUBLICATION-FOREIGN-PREPARE",
    attemptClassificationId: "ATTEMPT-REPAIR-HISTORY-FOREIGN-PREPARE",
    fromState: "STATE-REPAIR-HISTORY-FOREIGN-PREPARE",
    outcome: "rejected",
    expectedEndState: "STATE-REPAIR-HISTORY-FOREIGN-PREPARE",
    effectObservations: { provider: 0, host: 0, cleanup: 0 },
    expectedStatus: "recovery_required",
    resourcePostconditions: {
      "RES-REPAIR-HISTORY-PREPARE": "preserved",
    },
  });
});

function verifyDifferentTarget(t: test.TestContext, prepare: boolean) {
  const value = fixture(t);
  fs.writeFileSync(value.target, OTHER);
  if (prepare) fs.writeFileSync(value.preparation, BYTES);
  const adapter = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), false);
  assert.equal(fs.readFileSync(value.target).equals(OTHER), true);
  assert.equal(fs.existsSync(value.preparation), prepare);
  if (prepare)
    assert.equal(fs.readFileSync(value.preparation).equals(BYTES), true);
  observePublicationCase(
    prepare
      ? "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-WITH-PREPARE"
      : "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-NO-PREPARE",
    prepare
      ? {
          id: "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-WITH-PREPARE",
          attemptClassificationId:
            "ATTEMPT-REPAIR-HISTORY-CONFLICT-TARGET-WITH-PREPARE",
          fromState: "STATE-REPAIR-HISTORY-CONFLICT-TARGET-WITH-PREPARE",
          outcome: "rejected",
          expectedEndState: "STATE-REPAIR-HISTORY-CONFLICT-TARGET-WITH-PREPARE",
          effectObservations: { provider: 0, host: 0, cleanup: 0 },
          expectedStatus: "recovery_required",
          resourcePostconditions: {
            "RES-REPAIR-HISTORY-PREPARE": "preserved",
          },
        }
      : {
          id: "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-TARGET-NO-PREPARE",
          attemptClassificationId: "ATTEMPT-REPAIR-HISTORY-CONFLICT-TARGET",
          fromState: "STATE-REPAIR-HISTORY-CONFLICT-TARGET",
          outcome: "rejected",
          expectedEndState: "STATE-REPAIR-HISTORY-CONFLICT-TARGET",
          effectObservations: { provider: 0, host: 0, cleanup: 0 },
          expectedStatus: "recovery_required",
          resourcePostconditions: {
            "RES-REPAIR-HISTORY-PREPARE": "absent",
          },
        },
  );
}

test("回復可能な公開: different-byte targetはprepare=falseでも既存実体を変更しない", (t) => {
  verifyDifferentTarget(t, false);
});

test("回復可能な公開: different-byte targetはprepare=trueでも既存実体を変更しない", (t) => {
  verifyDifferentTarget(t, true);
});

test("回復可能な公開: 状態観測不能はUNKNOWNとしてEffect 0で拒否する", (t) => {
  const value = fixture(t);
  const adapter = createRepairHistoryPublicationTestingAdapter(
    value.directory,
    {
      overridePresent: () => null,
    },
  );
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), false);
  assert.equal(fs.existsSync(value.target), false);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase(
    "CASE-REPAIR-HISTORY-PUBLICATION-UNKNOWN-OBSERVATION",
    {
      id: "CASE-REPAIR-HISTORY-PUBLICATION-UNKNOWN-OBSERVATION",
      attemptClassificationId: "ATTEMPT-REPAIR-HISTORY-UNKNOWN",
      fromState: "STATE-REPAIR-HISTORY-UNKNOWN",
      outcome: "rejected",
      expectedEndState: "STATE-REPAIR-HISTORY-UNKNOWN",
      effectObservations: { provider: 0, host: 0, cleanup: 0 },
      expectedStatus: "recovery_required",
      resourcePostconditions: { "RES-REPAIR-HISTORY-PREPARE": "unacquired" },
    },
  );
});

test("回復可能な公開: 既存targetのPlatform確認中にprepareが現れた場合は成功にしない", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.target, BYTES);
  const adapter = createRepairHistoryPublicationTestingAdapter(
    value.directory,
    {
      observePlatformConfirmation: () => {
        if (!fs.existsSync(value.preparation))
          fs.writeFileSync(value.preparation, OTHER);
      },
    },
  );
  assert.equal(adapter.publish(TARGET, PREPARE, BYTES), false);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.readFileSync(value.preparation).equals(OTHER), true);
});

test("回復可能な公開: Platform確認または最終shape観測が不明なら成功にしない", (t) => {
  const platformUnknown = fixture(t);
  fs.writeFileSync(platformUnknown.target, BYTES);
  assert.equal(
    createRepairHistoryPublicationTestingAdapter(platformUnknown.directory, {
      overridePlatformConfirmation: () => false,
    }).publish(TARGET, PREPARE, BYTES),
    false,
  );

  const prepareUnknown = fixture(t);
  fs.writeFileSync(prepareUnknown.target, BYTES);
  let preparationObservations = 0;
  assert.equal(
    createRepairHistoryPublicationTestingAdapter(prepareUnknown.directory, {
      overridePresent: (target) => {
        if (target !== prepareUnknown.preparation) return undefined;
        preparationObservations += 1;
        return preparationObservations === 2 ? null : undefined;
      },
    }).publish(TARGET, PREPARE, BYTES),
    false,
  );

  const targetUnknown = fixture(t);
  fs.writeFileSync(targetUnknown.target, BYTES);
  assert.equal(
    createRepairHistoryPublicationTestingAdapter(targetUnknown.directory, {
      observePlatformConfirmation: () => fs.rmSync(targetUnknown.target),
    }).publish(TARGET, PREPARE, BYTES),
    false,
  );
});

test("回復可能な公開: 全成功分岐は共通の最終確定述語だけを通る", () => {
  const source = fs.readFileSync(
    fileURLToPath(
      new URL(
        "../src/security/docker-desktop-repair-history-publication.ts",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  assert.equal(source.match(/return completed\(\);/gu)?.length, 3);
  assert.equal(
    /return\s+operations\.stableBytes\([^;]+===\s*true;/gu.test(source),
    false,
  );
});

function verifyFaultRecovery(
  t: test.TestContext,
  point: RepairHistoryPublicationFaultPoint,
) {
  const value = fixture(t);
  let injected = false;
  const first = createRepairHistoryPublicationTestingAdapter(value.directory, {
    injectFault: (candidate: RepairHistoryPublicationFaultPoint) => {
      if (candidate === point && !injected) {
        injected = true;
        throw new Error(`injected_${point}`);
      }
    },
  });
  assert.equal(first.publish(TARGET, PREPARE, BYTES), false);
  assert.equal(injected, true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(
    fs.existsSync(value.preparation),
    point !== "after_unlink_before_platform_confirmation",
  );
  const firstCaseId =
    point === "after_link_before_platform_confirmation"
      ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-LINK-FIRST"
      : point === "after_first_platform_confirmation_before_unlink"
        ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-FIRST-COMMIT-FIRST"
        : point === "at_unlink"
          ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AT-UNLINK-FIRST"
          : "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-UNLINK-FIRST";
  const firstEndState =
    point === "after_unlink_before_platform_confirmation"
      ? "STATE-REPAIR-HISTORY-TARGET-ONLY"
      : "STATE-REPAIR-HISTORY-TARGET-WITH-SAME-FILE-PREPARE";
  observePublicationCase(firstCaseId, {
    id: firstCaseId,
    transitionId:
      point === "after_unlink_before_platform_confirmation"
        ? "TRANS-REPAIR-HISTORY-ABSENT-TO-TARGET-ONLY"
        : "TRANS-REPAIR-HISTORY-ABSENT-TO-SAME-FILE-PREPARE",
    fromState: "STATE-REPAIR-HISTORY-ABSENT",
    outcome: "taken",
    expectedEndState: firstEndState,
    effectObservations: { provider: 0, host: 0, cleanup: 0 },
    expectedStatus: "recovery_required",
    resourcePostconditions: {
      "RES-REPAIR-HISTORY-PREPARE":
        point === "after_unlink_before_platform_confirmation"
          ? "absent"
          : "present",
    },
  });
  let commits = 0;
  const retry = createRepairHistoryPublicationTestingAdapter(value.directory, {
    observePlatformConfirmation: () => commits++,
  });
  assert.equal(retry.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(commits >= 1, true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
  const retryCaseId =
    point === "after_link_before_platform_confirmation"
      ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-LINK-RETRY"
      : point === "after_first_platform_confirmation_before_unlink"
        ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-FIRST-COMMIT-RETRY"
        : point === "at_unlink"
          ? "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AT-UNLINK-RETRY"
          : "CASE-REPAIR-HISTORY-PUBLICATION-FAULT-AFTER-UNLINK-RETRY";
  observePublicationCase(retryCaseId, {
    id: retryCaseId,
    transitionId:
      point === "after_unlink_before_platform_confirmation"
        ? "TRANS-REPAIR-HISTORY-TARGET-ONLY-TO-PUBLISHED"
        : "TRANS-REPAIR-HISTORY-SAME-FILE-PREPARE-TO-PUBLISHED",
    fromState: firstEndState,
    outcome: "taken",
    expectedEndState: "STATE-REPAIR-HISTORY-PUBLISHED",
    effectObservations: { provider: 0, host: 0, cleanup: 1 },
    expectedStatus: "completed",
    resourcePostconditions: { "RES-REPAIR-HISTORY-PREPARE": "absent" },
  });
}

test("回復可能な公開: link後のPlatform確認前中断を成功にせずfresh再入場で収束する", (t) => {
  verifyFaultRecovery(t, "after_link_before_platform_confirmation");
});

test("回復可能な公開: 最初のPlatform確認後かつunlink前の中断を成功にせずfresh再入場で収束する", (t) => {
  verifyFaultRecovery(t, "after_first_platform_confirmation_before_unlink");
});

test("回復可能な公開: unlink要求時の中断を成功にせずfresh再入場で収束する", (t) => {
  verifyFaultRecovery(t, "at_unlink");
});

test("回復可能な公開: unlink後のPlatform確認前中断を成功にせずfresh再入場で収束する", (t) => {
  verifyFaultRecovery(t, "after_unlink_before_platform_confirmation");
});

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
    const input = Buffer.from(bytes);
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
    return { child, ready, completion, input };
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
  const attempts = results.map((result, index) => {
    const input = children[index]?.input;
    assert.ok(input);
    return Object.freeze({
      input,
      result: JSON.parse(result.stdout).result as boolean,
    });
  });
  return { ...value, results, attempts, readyBeforeRelease };
}

test("回復可能な公開: 同byteの実別Process競合は有限再入場後に同じtargetへ収束する", async (t) => {
  const value = await runRace(t, [BYTES, BYTES]);
  assert.equal(
    value.results.some(({ stdout }) => JSON.parse(stdout).result === true),
    true,
  );
  const retry = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(retry.publish(TARGET, PREPARE, BYTES), true);
  assert.equal(fs.readFileSync(value.target).equals(BYTES), true);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase("CASE-REPAIR-HISTORY-PUBLICATION-SAME-BYTE-RACE", {
    id: "CASE-REPAIR-HISTORY-PUBLICATION-SAME-BYTE-RACE",
    transitionId: "TRANS-REPAIR-HISTORY-CONCURRENT-SAME-BYTE-TO-PUBLISHED",
    fromState: "STATE-REPAIR-HISTORY-ABSENT",
    outcome: "taken",
    expectedEndState: "STATE-REPAIR-HISTORY-PUBLISHED",
    effectObservations: { provider: 0, host: 0, cleanup: 1 },
    expectedStatus: "completed",
    resourcePostconditions: { "RES-REPAIR-HISTORY-PREPARE": "absent" },
  });
});

test("回復可能な公開: 異byteの実別Process競合は局所結果と最終共有状態を分離する", async (t) => {
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
  const finalGlobalObservation = observeFinalGlobalPublication(
    value,
    value.attempts,
  );
  const successfulAttempt = value.attempts.find(({ result }) => result);
  assert.ok(successfulAttempt);
  const winner = successfulAttempt.input;
  const loser = winner.equals(BYTES) ? OTHER : BYTES;
  const retry = createRepairHistoryPublicationTestingAdapter(value.directory);
  assert.equal(retry.publish(TARGET, PREPARE, loser), false);
  assert.equal(fs.readFileSync(value.target).equals(winner), true);
  assert.equal(fs.existsSync(value.preparation), false);
  observePublicationCase(
    "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE-WINNER",
    {
      id: "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE-WINNER",
      transitionId:
        "TRANS-REPAIR-HISTORY-CONCURRENT-DIFFERENT-BYTE-WINNER-TO-PUBLISHED",
      fromState: "STATE-REPAIR-HISTORY-ABSENT",
      outcome: "taken",
      expectedEndState: finalGlobalObservation.state,
      effectObservations: { provider: 0, host: 0, cleanup: 1 },
      expectedStatus: "completed",
      resourcePostconditions: {
        "RES-REPAIR-HISTORY-PREPARE":
          finalGlobalObservation.preparationPostcondition,
      },
    },
  );
  observePublicationCase(
    "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE-LOSER",
    {
      id: "CASE-REPAIR-HISTORY-PUBLICATION-DIFFERENT-BYTE-RACE-LOSER",
      attemptClassificationId:
        "ATTEMPT-REPAIR-HISTORY-CONCURRENT-DIFFERENT-BYTE-LOSER",
      localAttemptObservation: "different_byte_prepublication_rejection",
      finalGlobalObservation: { state: finalGlobalObservation.state },
      outcome: "rejected",
      effectObservations: { provider: 0, host: 0, cleanup: 0 },
      expectedStatus: "recovery_required",
      resourcePostconditions: {
        "RES-REPAIR-HISTORY-PREPARE":
          finalGlobalObservation.preparationPostcondition,
      },
    },
  );
});

test("回復可能な公開: 異byte競合後の準備file残存を最終共有状態の成立根拠にしない", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.target, BYTES);
  fs.writeFileSync(value.preparation, OTHER);
  assert.throws(
    () =>
      observeFinalGlobalPublication(value, [
        { input: BYTES, result: true },
        { input: OTHER, result: false },
      ]),
    /final global state must be observed/,
  );
});

test("回復可能な公開: true側の入力と異なる最終targetをwinner成立へ流用しない", (t) => {
  const value = fixture(t);
  fs.writeFileSync(value.target, OTHER);
  assert.throws(
    () =>
      observeFinalGlobalPublication(value, [
        { input: BYTES, result: true },
        { input: OTHER, result: false },
      ]),
    /final global state must be observed/,
  );
});

test("回復可能な公開Traceの全caseは正本・registry・実行集合が一致する", () => {
  assertRuntimeTraceExecutionCoverage(
    "40_Develop/coordinator/tests/docker-desktop-repair-history-publication.contract.test.ts",
    Object.keys(publicationTraceAssertions),
    executedPublicationTraceCases,
  );
});

test("回復可能な公開のtesting adapterは本番entrypointから到達せず試験Rootだけを変更する", () => {
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
