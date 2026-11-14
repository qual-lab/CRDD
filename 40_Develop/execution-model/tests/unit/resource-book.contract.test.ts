/**
 * 元Snapshotと記録checkpointの相関を有限値で確認する。
 * @responsibility Intent・Receipt・不存在を混同せず旧保存形式を拒否する。
 * @trace ERB-UT-023
 * @level UT
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @packageDocumentation
 * @scope 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { compileFunction } from "node:vm";
import { createHash } from "node:crypto";
import { sourceDeclaration } from "../support/source-declaration.ts";
import {
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
} from "../../src/state/operations.ts";
import {
  applyResourceCleanup,
  applyResourceEvent,
  validateResourceBook,
  validateResourceBookTransition,
} from "../../src/attempt/operations.ts";
import type { OperationResources } from "../../src/attempt/types.ts";
import {
  areTaskResourcesSettled,
  validateOperationIdentity,
} from "../../src/attempt/validation.ts";
import { decodeStateSnapshot } from "../../src/state/validation.ts";

import { createResourceOperationFixture } from "../support/resource-operation.ts";

const ID = "a".repeat(64);
const EVIDENCE = {
  recoveryId: "same-operation",
  previousPayloadSha256: "b".repeat(64),
};
const CLEANUP = {
  cleanupOrder: ["first", "second"],
  setupTimeoutMs: 1000,
  unreceiptedAbsence: "observe",
  verifyLabelAbsence: true,
} as const;

/**
 * 資源更新の次値検査を遷移検査へ一体化する。
 * @responsibility previousと次値を各一回検査し、不正候補を引き続き拒否する。
 * @trace ERB-UT-023
 * @precondition 実検査と製品の更新・遷移宣言を使う。
 * @stimulus Intent・回収観測、不正次値、不正previousを与える。
 * @observation 検査回数と更新／拒否結果。
 * @oracle 正常更新はpreviousと次値の二検査。不正形状はnullで保存しない。
 * @cleanup メモリ内だけ。Docker・Filesystem Effectなし。
 * @boundary 未信頼資源通知と保存値の更新。
 */
test("資源更新は次Bookの検査を遷移と一体で一回だけ行う", () => {
  const source = fs.readFileSync(
    new URL("../../src/attempt/operations.ts", import.meta.url),
    "utf8",
  );
  const body = [
    "applyResourceEvent",
    "applyResourceCleanup",
    "validateResourceBookTransition",
  ]
    .map((name) => stripTypeScriptTypes(sourceDeclaration(source, name)))
    .join("\n");
  let validations = 0;
  const update = compileFunction(
    `${body}\nreturn { applyResourceEvent, applyResourceCleanup };`,
    [
      "validateResourceBook",
      "encodeStateValue",
      "hasExecutionStateRecordKeys",
      "isSha256Hex",
      "createHash",
    ],
  )(
    (value: unknown) => {
      validations += 1;
      return validateResourceBook(value);
    },
    encodeStateValue,
    hasExecutionStateRecordKeys,
    isSha256Hex,
    createHash,
  ) as {
    applyResourceEvent: typeof applyResourceEvent;
    applyResourceCleanup: typeof applyResourceCleanup;
  };
  const event = {
    event: "submission",
    key: "first",
    snapshot: snapshot(),
    cleanup: CLEANUP,
  };
  const book = update.applyResourceEvent(null, event);
  assert.deepEqual(book, initial());
  assert.ok(book);
  assert.equal(validations, 2);
  validations = 0;
  const observed = [
    { key: "first", observation: "absent" },
    { key: "second", observation: "not_requested" },
  ];
  assert.deepEqual(
    update.applyResourceCleanup(book, snapshot(), observed, EVIDENCE),
    applyResourceCleanup(book, snapshot(), observed, EVIDENCE),
  );
  assert.equal(validations, 2);
  assert.equal(
    update.applyResourceEvent(null, { ...event, cleanup: {} }),
    null,
  );
  assert.equal(
    update.applyResourceEvent({} as OperationResources, event),
    null,
  );
  assert.equal(validateResourceBookTransition(null, { invalid: true }), false);
});

/** 未発行の技術終端と、Host・Lease・結果の確定を混同しない。 */
test("要求前の切断は資源終端だけを満たし、単独条件の欠測・不明を拒否する", () => {
  const fixture = createResourceOperationFixture();
  const decoded = decodeStateSnapshot(fixture.bytes, fixture.binding);
  assert.ok(decoded);
  const original = decoded.snapshot.operations[0];
  assert.ok(original?.kind === "docker_task");
  const stopped = {
    ...original,
    phase: "settling" as const,
    execution: { ...original.execution, ownerEffect: "disabled" as const },
  };
  assert.equal(areTaskResourcesSettled(stopped), true);
  assert.equal(stopped.host.cleanup, "not_requested");
  assert.equal(stopped.lease, "held");
  assert.equal(stopped.outcome, null);
  for (const [label, change] of [
    ["phase", { phase: "executing" }],
    ["lease", { lease: "released" }],
    ["resources_missing", { resources: undefined }],
    [
      "outcome",
      {
        outcome: { status: "blocked", reason: "test", cleanupConfirmed: false },
      },
    ],
    ["primaryFailure", { primaryFailure: { reason: "test" } }],
    ["summary", { summarySha256: "a".repeat(64) }],
    ["history", { history: {} }],
    ["restart", { dockerRestart: {} }],
    ...["ownerEffect", "providerStart", "externalSend", "sharedWrite"].map(
      (key) =>
        [
          key,
          { execution: { ...stopped.execution, [key]: "unknown" } },
        ] as const,
    ),
  ] as const) {
    const value = { ...stopped, ...change } as unknown as typeof stopped;
    assert.equal(areTaskResourcesSettled(value), false, String(label));
  }
});

/**
 * 初回Intent前のEM保存Snapshotだけを構成する。
 * @responsibility 固定Identityの非秘密ResourceSnapshotを構築する
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus 固定Identityの非秘密ResourceSnapshotを構築する。
 * @observation 構築した候補、有限応答または検出した例外。
 * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
 * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
function snapshot(
  id: string | null = null,
  request: "not_issued" | "unknown" | "issued" = "not_issued",
): OperationResources["snapshot"] {
  return {
    resources: ["first", "second"].map((key, index) => ({
      key,
      identity: {
        kind: "container",
        name: `crdd-${key}`,
        ownershipLabel: "crdd.owner=fixture",
        dockerId: index === 0 ? id : null,
      },
      request: index === 0 ? request : "not_issued",
      configuration: {
        image: null,
        command: null,
        environmentNames: null,
        mounts: null,
        networks: null,
        internal: null,
      },
    })),
  };
}

/**
 * 必須通知の保存候補が成立した場合だけ次試験へ進む。
 * @responsibility 元Snapshotに結合した初期資源記録を構築する
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus 元Snapshotに結合した初期資源記録を構築する。
 * @observation 構築した候補、有限応答または検出した例外。
 * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
 * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
function initial(): OperationResources {
  const book = applyResourceEvent(null, {
    event: "submission",
    key: "first",
    snapshot: snapshot(),
    cleanup: CLEANUP,
  });
  assert.ok(book);
  return book;
}

/**
 * 既存Host契約を満たす自己生成Operationを、製品codecで初期化する。
 * @responsibility Operation Identityはv3だけを受理し旧資源名・Imageコピーを保存しない
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus Operation Identityはv3だけを受理し旧資源名・Imageコピーを保存しないの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle Operation Identityはv3だけを受理し旧資源名・Imageコピーを保存しないという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */

test("Operation Identityはv3だけを受理し旧資源名・Imageコピーを保存しない", () => {
  const { identity, binding } = createResourceOperationFixture();
  assert.equal(
    validateOperationIdentity(identity, identity.operationNonce, binding),
    true,
  );
  for (const invalid of [
    { ...identity, schema: "crdd-coordinator/operation-identity/v2" },
    { ...identity, resources: {} },
    { ...identity, images: {} },
  ])
    assert.equal(
      validateOperationIdentity(invalid, identity.operationNonce, binding),
      false,
    );
});

/**
 * 保存codecは初回Snapshot＋Intentを同じ改訂へ結合し別OperationのLabelを拒否する。
 * @responsibility 保存codecは初回Snapshot＋Intentを同じ改訂へ結合し別OperationのLabelを拒否する
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus 保存codecは初回Snapshot＋Intentを同じ改訂へ結合し別OperationのLabelを拒否するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 保存codecは初回Snapshot＋Intentを同じ改訂へ結合し別OperationのLabelを拒否するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
test("保存codecは初回Snapshot＋Intentを同じ改訂へ結合し別OperationのLabelを拒否する", () => {
  const f = createResourceOperationFixture();
  for (const foreign of ["none", "all", "mixed"]) {
    const original = snapshot();
    const resources = {
      resources: original.resources.map((r, i) => ({
        ...r,
        identity: {
          ...r.identity,
          ownershipLabel:
            foreign === "all" || (foreign === "mixed" && i === 1)
              ? "crdd.coordinator.runtime=fedcba9876543210"
              : f.ownershipLabel,
        },
      })),
    };
    const next = prepareStateResourceSnapshot(
      f.bytes,
      f.recoveryId,
      {
        event: "submission",
        key: "first",
        snapshot: resources,
        cleanup: CLEANUP,
      },
      f.binding,
    );
    if (foreign !== "none") {
      assert.equal(next, null);
      continue;
    }
    assert.ok(next);
    const read = decodeStateSnapshot(next, f.binding);
    assert.ok(read);
    assert.equal(read.snapshot.revision, 2);
    const operation = read.snapshot.operations[0];
    assert.ok(operation?.kind === "docker_task" && operation.resources);
    assert.deepEqual(operation.resources.snapshot, resources);
    assert.equal(
      operation.resources.checkpoints[0]?.submission,
      "intent_saved",
    );
    assert.equal(
      prepareStateResourceSnapshot(
        f.bytes,
        "other-operation",
        {
          event: "submission",
          key: "first",
          snapshot: resources,
          cleanup: CLEANUP,
        },
        f.binding,
      ),
      null,
    );
  }
});

/**
 * 初期Snapshotと最初のIntentは一つの記録として成立しIdentityを複製しない。
 * @responsibility 初期Snapshotと最初のIntentは一つの記録として成立しIdentityを複製しない
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus 初期Snapshotと最初のIntentは一つの記録として成立しIdentityを複製しないの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 初期Snapshotと最初のIntentは一つの記録として成立しIdentityを複製しないという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
test("初期Snapshotと最初のIntentは一つの記録として成立しIdentityを複製しない", () => {
  const book = initial();
  assert.deepEqual(
    book.checkpoints.map((c) => c.submission),
    ["intent_saved", "none"],
  );
  assert.equal(Object.hasOwn(book.checkpoints[0] ?? {}, "dockerId"), false);
  assert.equal(validateResourceBook(null), true);
  assert.equal(validateResourceBook([]), false);
  assert.equal(
    applyResourceEvent(null, {
      event: "receipt",
      key: "first",
      snapshot: snapshot(ID, "issued"),
      cleanup: CLEANUP,
    }),
    null,
  );
});

import { prepareStateResourceSnapshot } from "../../src/state/validation.ts";

/**
 * Receipt又は発見通知だけが実IDを確定しCleanupでは補完しない。
 * @responsibility Receipt又は発見通知だけが実IDを確定しCleanupでは補完しない
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus Receipt又は発見通知だけが実IDを確定しCleanupでは補完しないの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle Receipt又は発見通知だけが実IDを確定しCleanupでは補完しないという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
test("Receipt又は発見通知だけが実IDを確定しCleanupでは補完しない", () => {
  const before = initial();
  const observed = [
    { key: "first", observation: "absent" },
    { key: "second", observation: "not_requested" },
  ];
  assert.equal(
    applyResourceCleanup(before, snapshot(ID, "issued"), observed, EVIDENCE),
    null,
  );
  for (const event of ["receipt", "identified"]) {
    const recorded = applyResourceEvent(before, {
      event,
      key: "first",
      snapshot: snapshot(ID, "issued"),
      cleanup: CLEANUP,
    });
    assert.ok(recorded);
    assert.equal(
      recorded.checkpoints[0]?.receiptSource,
      event === "receipt" ? "docker_create_result" : "runtime_reconciliation",
    );
    const closed = applyResourceCleanup(
      recorded,
      recorded.snapshot,
      observed,
      EVIDENCE,
    );
    assert.ok(closed);
    assert.equal(closed.checkpoints[0]?.observation, "absent");
    const evidence = closed.checkpoints[0]?.absenceEvidenceSha256;
    assert.ok(evidence);
    assert.match(evidence, /^[a-f0-9]{64}$/u);
    const repeated = applyResourceCleanup(closed, closed.snapshot, observed, {
      ...EVIDENCE,
      previousPayloadSha256: "c".repeat(64),
    });
    assert.deepEqual(
      repeated,
      closed,
      "同じ不存在の再導出で最初の証拠を変更しない",
    );
    assert.equal(
      applyResourceCleanup(
        recorded,
        snapshot("c".repeat(64), "issued"),
        observed,
        EVIDENCE,
      ),
      null,
    );
    assert.equal(
      applyResourceCleanup(recorded, snapshot(), observed, EVIDENCE),
      null,
    );
  }
});

/**
 * 未発行は元Snapshotが未発行の場合だけ記録でき、ID欠測から推測しない。
 * @responsibility 未発行は元Snapshotが未発行の場合だけ記録でき、ID欠測から推測しない
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus 未発行は元Snapshotが未発行の場合だけ記録でき、ID欠測から推測しないの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 未発行は元Snapshotが未発行の場合だけ記録でき、ID欠測から推測しないという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
test("未発行は元Snapshotが未発行の場合だけ記録でき、ID欠測から推測しない", () => {
  const before = initial();
  assert.ok(
    applyResourceEvent(before, {
      event: "not_issued",
      key: "first",
    }),
  );
  const unknown = { ...before, snapshot: snapshot(null, "unknown") };
  assert.equal(validateResourceBook(unknown), true);
  assert.equal(
    applyResourceEvent(unknown, {
      event: "not_issued",
      key: "first",
    }),
    null,
  );
  assert.equal(
    applyResourceCleanup(
      before,
      snapshot(),
      [
        { key: "first", observation: "not_requested" },
        { key: "second", observation: "not_requested" },
      ],
      EVIDENCE,
    ),
    null,
  );
});

/**
 * 構成観測の更新は許可するが実ID・名前・所有Label・回収契約の差替えを拒否する。
 * @responsibility 構成観測の更新は許可するが実ID・名前・所有Label・回収契約の差替えを拒否する
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus 構成観測の更新は許可するが実ID・名前・所有Label・回収契約の差替えを拒否するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 構成観測の更新は許可するが実ID・名前・所有Label・回収契約の差替えを拒否するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
test("構成観測の更新は許可するが実ID・名前・所有Label・回収契約の差替えを拒否する", () => {
  const before = initial();
  const next = structuredClone(before);
  const changed = {
    ...next,
    snapshot: {
      resources: next.snapshot.resources.map((r) => ({
        ...r,
        configuration: { ...r.configuration, image: "observed-image" },
      })),
    },
  };
  assert.equal(validateResourceBookTransition(before, changed), true);
  for (const field of ["name", "ownershipLabel"] as const) {
    const invalid = {
      ...before,
      snapshot: {
        resources: before.snapshot.resources.map((r) => ({
          ...r,
          identity: { ...r.identity, [field]: "different" },
        })),
      },
    };
    assert.equal(validateResourceBookTransition(before, invalid), false);
  }
  assert.equal(
    validateResourceBookTransition(before, {
      ...before,
      cleanup: { ...before.cleanup, setupTimeoutMs: 2000 },
    }),
    false,
  );
  assert.equal(validateResourceBookTransition(before, null), false);
});

/**
 * 欠測・重複key・未正規化Command・環境値を保存しない。
 * @responsibility 欠測・重複key・未正規化Command・環境値を保存しない
 * @trace ERB-UT-023
 * @precondition 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 * @stimulus 欠測・重複key・未正規化Command・環境値を保存しないの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 欠測・重複key・未正規化Command・環境値を保存しないという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
test("欠測・重複key・未正規化Command・環境値を保存しない", () => {
  const book = initial();
  assert.equal(
    validateResourceBook({
      ...book,
      checkpoints: [book.checkpoints[0], book.checkpoints[0]],
    }),
    false,
  );
  assert.equal(
    validateResourceBook({
      ...book,
      cleanup: { ...book.cleanup, cleanupOrder: ["first", "first"] },
    }),
    false,
  );
  for (const configuration of [
    { command: ["raw-value"] },
    { environmentNames: ["TOKEN=value"] },
  ]) {
    const invalid = {
      ...book,
      snapshot: {
        resources: book.snapshot.resources.map((r) => ({
          ...r,
          configuration: { ...r.configuration, ...configuration },
        })),
      },
    };
    assert.equal(validateResourceBook(invalid), false);
  }
  assert.equal(
    applyResourceCleanup(
      book,
      book.snapshot,
      [
        { key: "first", observation: "unknown" },
        { key: "first", observation: "unknown" },
      ],
      EVIDENCE,
    ),
    null,
  );
});

/**
 * 同じBook受付で、元値指定時だけ遷移も検査する。
 * @responsibility 独立した公開比較入口なしで既知Identityの差替えを拒否する。
 * @trace ERB-UT-023
 * @precondition 正規の資源Bookを使用する。
 * @stimulus 元値省略・正規元値・欠測・不正比較Object・Getterを渡す。
 * @observation 受付結果とGetter実行数。
 * @oracle 形だけの受付と遷移受付を区別し、不正元値から成功を生成しない。
 * @cleanup N/A: メモリ値のみ。
 * @boundary 資源記録の純粋な受付。
 */
test("Book受付は元値指定で同じ遷移正本を使い比較入力の欠測を拒否する", () => {
  const before = initial();
  assert.ok(before.snapshot.resources[0]);
  const changed = {
    ...before,
    snapshot: {
      resources: before.snapshot.resources.map((resource, index) =>
        index === 0
          ? {
              ...resource,
              identity: { ...resource.identity, name: "different" },
            }
          : resource,
      ),
    },
  };
  assert.equal(validateResourceBook(changed), true);
  assert.equal(validateResourceBook(changed, { before }), false);
  assert.equal(validateResourceBook(before, { before }), true);
  assert.equal(validateResourceBook(null, { before }), false);
  assert.equal(validateResourceBook(null, { before: null }), true);
  assert.equal(validateResourceBook(before, { before: undefined }), false);
  assert.equal(validateResourceBook(before, {} as { before: unknown }), false);
  let reads = 0;
  const getter = Object.defineProperty({}, "before", {
    enumerable: true,
    get() {
      reads++;
      return before;
    },
  });
  assert.equal(
    validateResourceBook(before, getter as { before: unknown }),
    false,
  );
  assert.equal(reads, 0);
});
