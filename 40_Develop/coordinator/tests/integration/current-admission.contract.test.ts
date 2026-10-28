/**
 * 現在状態の入場観測を実Repositoryと保存Readerへ接続する。
 * @packageDocumentation
 * @responsibility 初回不存在と観測不能を区別し、安定本文を全域拒否しない。
 * @trace PRL-IT-013
 * @trace ERB-IT-014
 * @level IT
 * @scope 実Git・Filesystem・正式Readerとの結合と有限結果の公開投影。
 * @boundary PRL-IT-013=Task入場→現在Reader→Repository。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { mock, test } from "node:test";
import { runInNewContext } from "node:vm";
import * as domain from "../../../domain-model/src/index.ts";
import {
  COORDINATOR_STATE_SCHEMA,
  encodeRuntimeStateValue,
} from "../../../domain-model/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { borrowRuntimeOwnedCoordinatorRecoveryRepository } from "../../src/execution/operation.ts";
import { coordinatorDataBoundaryBlocked } from "../../src/state/result.ts";

/**
 * 本番Host入場から正式Domain Readerへの接続を確認する。
 * @responsibility Root現在性と正常・不正本文を公開DTOへ搬送する。
 * @trace PRL-IT-013
 * @trace ERB-IT-014
 * @precondition 自己生成Gitと新codec合法な状態を使う。
 * @stimulus 不存在・正常・不正本文・未検証Root・HEAD変更を与える。
 * @observation 固定DTO、本文とDirectory残存。
 * @oracle 初回不存在と正常だけavailable、拒否時も本文不変。
 * @cleanup 自己生成Rootだけを回収する。
 * @boundary 正式Root APIとHost Inspector。保存内部の故障はDomainが所有する。
 */
test("現在入場: 正式Readerは真正Rootと現在本文だけを搬送する", async () => {
  const area = domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "current_admission_test",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "current-admission-"));
  try {
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { windowsHide: true },
    );
    const verified = verifyRepositoryRoot(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const binding = borrowRuntimeOwnedCoordinatorRecoveryRepository(
      verified.capability,
    );
    assert.ok(binding);
    const { inspectRuntimeOwnedDockerTaskAdmission: inspect } = await import(
      "../../src/execution/recovery.ts"
    );
    const current = path.join(root, ".crdd", "domain-model");
    const available = {
      status: "available",
      reason: "coordinator_current_admission_available",
      lockReleased: true,
    };
    assert.deepEqual(inspect(root), available);
    assert.equal(fs.existsSync(current), false);
    assert.equal(
      domain.readRuntimeOwnedCoordinatorAdmissionSnapshot({}).status,
      "blocked",
    );
    assert.equal(inspect(path.join(root, "missing")).status, "blocked");
    fs.mkdirSync(current, { recursive: true });
    const file = path.join(current, "state.json");
    const bytes = Buffer.from(
      `${encodeRuntimeStateValue({
        schema: COORDINATOR_STATE_SCHEMA,
        revision: 1,
        previous: null,
        repositoryBinding: binding.repositoryBinding,
        repositoryBindingId: null,
        intakeEpoch: null,
        intakeBindings: [],
        projects: [],
        managedExecutions: [],
        workspaces: [],
        queueEntries: [],
        leaseEvidence: [],
        leaseIntents: [],
        results: [],
        historyPending: [],
        acceptanceDecisions: [],
        decisionRecoveries: [],
        operations: [],
        unresolvedRecoveries: [],
        pendingDeliveries: [],
        resultReceipts: [],
      })}\n`,
    );

    fs.writeFileSync(file, bytes);
    assert.ok(
      domain.decodeRuntimeDomainSnapshot(bytes, binding.repositoryBinding),
    );
    assert.deepEqual(inspect(root), available);
    fs.writeFileSync(file, "invalid");
    assert.equal(inspect(root).status, "blocked");
    assert.equal(fs.readFileSync(file, "utf8"), "invalid");
    fs.writeFileSync(file, bytes);
    const head = path.join(root, ".git", "HEAD");
    const before = fs.readFileSync(head);
    try {
      fs.writeFileSync(head, "ref: refs/heads/unborn-fixture\n");
      assert.equal(inspect(root).status, "blocked");
    } finally {
      fs.writeFileSync(head, before);
    }
    assert.deepEqual(inspect(root), available);
    assert.deepEqual(fs.readdirSync(current), ["state.json"]);
    assert.deepEqual(fs.readFileSync(file), bytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Domainの有限結果と領域失敗をHostの公開結果へ投影する。
 * @responsibility 内部故障を再現せず、解放・Effect三値とexact参照を保持する。
 * @trace PRL-IT-013
 * @trace ERB-IT-014
 * @precondition 有限の正式結果と実Error型だけを使う。
 * @stimulus 読取り未確認・初回不存在、四つの領域失敗を与える。
 * @observation DTO全fieldと回復参照。
 * @oracle 失敗をavailableへ補完せず、一回のOwner解放不明も公開する。
 * @cleanup 値だけで外部資源なし。
 * @boundary Host結果投影。Domain Readerの物理故障はDomain試験が所有する。
 */
test("現在入場: 有限Domain結果と領域失敗を公開DTOへ投影する", () => {
  const assertRefused = (value: unknown) =>
    assert.deepEqual(JSON.parse(JSON.stringify(value)), {
      status: "blocked",
      reason: "coordinator_current_admission_unconfirmed",
      lockReleased: true,
    });
  const ownerSource = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const inspectorStart = ownerSource.indexOf(
    "export function inspectRuntimeOwnedDockerTaskAdmission(",
  );
  const inspectorEnd = ownerSource.indexOf(
    "function canonical(",
    inspectorStart,
  );
  assert.ok(inspectorStart > 0 && inspectorEnd > inspectorStart);
  const inspector = stripTypeScriptTypes(
    ownerSource.slice(inspectorStart, inspectorEnd),
  ).replace("export function", "function");
  // Domain Readerの二つの固定結果に対するHost DTO投影だけを確認する。
  for (const [reason, mutated] of [
    ["coordinator_state_read_unconfirmed", false],
    ["coordinator_state_uninitialized", true],
  ] as const) {
    const result = runInNewContext(
      `${inspector}\ninspectRuntimeOwnedDockerTaskAdmission("fixture");`,
      {
        verifyRepositoryRoot: () => ({ status: "completed", capability: {} }),
        readRuntimeOwnedCoordinatorAdmissionSnapshot: () => ({
          status: "blocked",
          reason,
          lockReleased: true,
          value: null,
        }),
      },
    );
    if (mutated) assert.throws(() => assertRefused(result));
    else assertRefused(result);
  }

  for (const fault of [
    "no_effect",
    "unknown",
    "cleanup_failed",
    "owner_release",
  ]) {
    const unknown = fault === "unknown",
      cleanup = fault !== "cleanup_failed",
      released = fault !== "owner_release";
    const error = new domain.RepositoryRuntimeDataAreaBlockedError({
      status: "blocked",
      reason: "repository_runtime_data_ignore_registration_blocked",
      effectIssued: unknown || !cleanup,
      effectStateUnknown: unknown,
      effectConfirmation: unknown ? "unknown" : "not_issued",
      cleanupConfirmed: cleanup,
      retryAllowed: !unknown && cleanup,
      recoveryReference: unknown ? "repository-local-ignore.exact" : null,
      repositoryPathReported: false,
    });
    if (!released)
      error.cause = "coordinator_snapshot_lock_release_unconfirmed";
    const projected = coordinatorDataBoundaryBlocked(error);
    assert.equal(projected.reason, error.reason);
    assert.equal(projected.effectIssued, error.effectIssued);
    assert.equal(projected.effectStateUnknown, unknown);
    assert.equal(projected.cleanupConfirmed, cleanup && released);
    assert.equal(projected.retryAllowed, !unknown && cleanup && released);
    assert.deepEqual(
      projected.recoveryIds,
      unknown ? ["repository-local-ignore.exact"] : [],
    );
  }
});

/**
 * 本番三入口のRoot搬送式を実行し差替え変異を拒否する。
 * @responsibility 通常Task・開発Task・正式診断APIが同じRootを渡すことを確認する。
 * @trace PRL-IT-013
 * @precondition 対象Sourceの一意な構成式を使い下位観測だけを置き換える。
 * @stimulus 入力Root、別Root、引数差替え変異を構成式へ渡す。
 * @observation Inspectorへ到達した引数と開発側の別Root拒否を確認する。
 * @oracle 元式だけexact Rootが一致し、旧Inspector／投影の再参照はない。
 * @cleanup N/A: VM内の同期式評価だけで外部Effectを発行しない。
 * @boundary 本番構成式の入力搬送。Task全体の成立は別の実行試験が所有する。
 */
test("現在入場: Task通常・開発・正式診断APIの本番構成式はexact Rootを搬送する", () => {
  const task = fs.readFileSync(
    new URL("../../src/execution/controller.ts", import.meta.url),
    "utf8",
  );
  const api = fs.readFileSync(
    new URL("../../src/api.ts", import.meta.url),
    "utf8",
  );
  const adapter = fs.readFileSync(
    new URL("../../src/execution/diagnostics.ts", import.meta.url),
    "utf8",
  );
  for (const source of [task, api, adapter]) {
    assert.equal(
      source.includes("inspectRuntimeOwnedDockerTaskRecoveryState"),
      false,
    );
    assert.equal(source.includes("projectDockerRecoveryAdmission"), false);
  }
  const normal =
    "prepareDockerRecoveryState: inspectRuntimeOwnedDockerTaskAdmission,";
  assert.equal(task.split(normal).length, 2);
  const start = task.indexOf("prepareDockerRecoveryState: guard((root)");
  const end = task.indexOf("observeProviderHome:", start);
  assert.ok(start > 0 && end > start);
  const development = task.slice(start, end);
  const apiStart = api.indexOf("export function diagnoseEnvironment(");
  const bodyStart = api.indexOf(
    "  const root = executionRoot(context);",
    apiStart,
  );
  const apiEnd = api.indexOf("\n}", bodyStart);
  assert.ok(apiStart > 0 && bodyStart > apiStart && apiEnd > bodyStart);
  const doctor = `(() => {\n${api.slice(bodyStart, apiEnd)}\n})()`;
  const expected = "C:\\fixture-root";
  /**
   * 本番構成式を同じRoot相関Oracleへ接続する。
   * @responsibility 元式と差替え変異を同じ観測条件で評価する。
   * @trace PRL-IT-013
   * @precondition 対象Sourceから抽出した単一property式を使う。
   * @stimulus 同Root・別Rootを渡す。
   * @observation 下位呼出しのRoot列。
   * @oracle 正常一回だけ同Rootに到達し別Rootを許可しない。
   * @cleanup N/A: 局所VMだけ。
   * @boundary 構成式→Inspectorの引数。
   */
  const verify = (snippet: string, kind: string) => {
    const calls: unknown[] = [];
    const doctorRoots: unknown[] = [];
    let resolutions = 0;
    const configured = runInNewContext(
      kind === "api" ? snippet : `({${snippet}})`,
      {
        inspectRuntimeOwnedDockerTaskAdmission: (root: unknown) => {
          calls.push(root);
          return { status: "available" };
        },
        boundary: { repositoryRoot: expected },
        guard: (fn: (root: string) => unknown) => fn,
        context: "expected-context",
        value: { activeIsolation: false },
        executionRoot: (context: unknown) => {
          assert.equal(context, "expected-context");
          return ++resolutions === 1 ? expected : "C:\\other-root";
        },
        runDoctor: (options: { cwd: unknown }) => {
          doctorRoots.push(options.cwd);
          return { status: "observed" };
        },
      },
    );
    if (kind !== "api") configured.prepareDockerRecoveryState(expected);
    assert.deepEqual(calls, [expected]);
    if (kind === "api") {
      assert.equal(resolutions, 1);
      assert.deepEqual(doctorRoots, [expected]);
    }
    if (kind === "development") {
      assert.equal(
        configured.prepareDockerRecoveryState("C:\\other-root").status,
        "blocked",
      );
      assert.deepEqual(calls, [expected]);
    }
  };
  verify(normal, "normal");
  verify(development, "development");
  verify(doctor, "api");
  assert.throws(() =>
    verify(
      normal.replace(
        ": inspectRuntimeOwnedDockerTaskAdmission",
        ": () => inspectRuntimeOwnedDockerTaskAdmission('wrong')",
      ),
      "normal",
    ),
  );
  assert.throws(() =>
    verify(
      development.replace("root === boundary.repositoryRoot", "true"),
      "development",
    ),
  );
  assert.throws(() =>
    verify(
      development.replace("Admission(root)", "Admission('wrong')"),
      "development",
    ),
  );
  assert.throws(() =>
    verify(
      doctor.replace(
        "inspectRuntimeOwnedDockerTaskAdmission(root)",
        "inspectRuntimeOwnedDockerTaskAdmission(executionRoot(context))",
      ),
      "api",
    ),
  );
  assert.throws(() =>
    verify(doctor.replace("cwd: root", "cwd: 'wrong'"), "api"),
  );
  let requests = 0;
  assert.throws(() =>
    runInNewContext(doctor, {
      context: {},
      value: {},
      executionRoot: () => {
        throw new Error("resolver_failed");
      },
      runDoctor: () => {
        requests++;
      },
      inspectRuntimeOwnedDockerTaskAdmission: () => {
        requests++;
      },
    }),
  );
  assert.equal(requests, 0);
  const manifest = JSON.parse(
    fs.readFileSync(new URL("../../symbol.json", import.meta.url), "utf8"),
  );
  const domainManifest = JSON.parse(
    fs.readFileSync(
      new URL("../../../domain-model/symbol.json", import.meta.url),
      "utf8",
    ),
  );
  const suite = manifest.symbols.find(
    (entry: { symbolId: string }) =>
      entry.symbolId === "coordinator.test.integration.current-admission",
  );
  assert.ok(suite);
  assert.equal(
    suite.path,
    "tests/integration/current-admission.contract.test.ts",
  );
  assert.deepEqual(suite.qaIds, ["QA-000003", "QA-000006"]);
  assert.deepEqual(suite.localTestIds, ["ERB-IT-014", "PRL-IT-013"]);
  assert.deepEqual(
    suite.verifies.map(
      (id: string) =>
        [...manifest.symbols, ...domainManifest.symbols].find(
          (entry: { symbolId: string }) => entry.symbolId === id,
        )?.path,
    ),
    [
      "src/execution/recovery.ts",
      "src/storage/runtime-store.ts",
      "src/execution/result.ts",
    ],
  );
});

/**
 * 安定Snapshotの内容を全域拒否せず、入場DTOの相関だけを検査する。
 * @responsibility Reader責務とHome衝突判定を混同しないことを反証する。
 * @trace PRL-IT-013
 * @precondition Reader返却だけを模擬し実Repository Rootを固定する。
 * @stimulus active Task、配送待ち、修復配送待ち、未初期化、観測故障を返す。
 * @observation Readerへ渡る真正Rootと公開DTO、入力不変を確認する。
 * @oracle 安定本文は内容に依存せずavailable、不正な可否・解放相関は拒否。
 * @cleanup module mockをfinallyで復元する。
 * @boundary 入場Inspector→Reader。本文codecの成立は前Caseと既存保存試験が所有する。
 */
test("現在入場: 安定本文の部分義務を全域拒否せず固定DTOだけを搬送する", async () => {
  const projection = await import("../../src/execution/result.ts");
  const repositoryRoot = fs.realpathSync(
    path.resolve(import.meta.dirname, "../../../.."),
  );
  let observed: unknown;
  const roots: (string | null)[] = [];
  const mocked = mock.module(
    new URL("../../../domain-model/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...domain,
        readRuntimeOwnedCoordinatorAdmissionSnapshot: (
          root: Parameters<typeof resolveVerifiedRepositoryRoot>[0],
        ) => {
          roots.push(resolveVerifiedRepositoryRoot(root));
          return observed;
        },
      },
    },
  );
  try {
    const owner = await import(
      new URL(
        "../../src/execution/recovery.ts?current-admission-values",
        import.meta.url,
      ).href
    );
    for (const snapshot of [
      {
        operations: [{ kind: "docker_task", phase: "active" }],
        unresolvedRecoveries: [{ kind: "resource" }],
        pendingDeliveries: [],
      },
      {
        operations: [{ kind: "docker_task", phase: "awaiting_delivery" }],
        unresolvedRecoveries: [],
        pendingDeliveries: [{ kind: "result_delivery" }],
      },
      {
        operations: [{ kind: "runtime_repair", phase: "awaiting_delivery" }],
        unresolvedRecoveries: [],
        pendingDeliveries: [],
      },
    ]) {
      observed = {
        status: "completed",
        lockReleased: true,
        value: { snapshot },
      };
      const before = JSON.stringify(observed);
      const result =
        owner.inspectRuntimeOwnedDockerTaskAdmission(repositoryRoot);
      assert.deepEqual(result, {
        status: "available",
        reason: "coordinator_current_admission_available",
        lockReleased: true,
      });
      assert.deepEqual(projection.projectCurrentDockerAdmission(result), {
        status: "completed",
      });
      assert.equal(JSON.stringify(observed), before);
      assert.equal(roots.at(-1), repositoryRoot);
    }
    for (const result of [
      {
        status: "available",
        reason: "coordinator_current_admission_available",
        lockReleased: false,
      },
      {
        status: "available",
        reason: "coordinator_current_admission_unconfirmed",
        lockReleased: true,
      },
      {
        status: "blocked",
        reason: "coordinator_current_admission_available",
        lockReleased: true,
      },
      { status: "blocked", reason: "secret", lockReleased: true },
      {
        status: "available",
        reason: "coordinator_current_admission_available",
        lockReleased: true,
        extra: true,
      },
      new Proxy(
        {},
        {
          get() {
            throw new Error("not_called");
          },
        },
      ),
    ])
      assert.equal(
        projection.projectCurrentDockerAdmission(result).status,
        "blocked",
      );
    for (const result of [
      { status: "completed", lockReleased: false, value: { snapshot: {} } },
      {
        status: "blocked",
        lockReleased: false,
        reason: "coordinator_state_uninitialized",
        value: null,
      },
      {
        status: "blocked",
        lockReleased: true,
        reason: "coordinator_state_read_unconfirmed",
        value: null,
      },
    ]) {
      observed = result;
      assert.equal(
        owner.inspectRuntimeOwnedDockerTaskAdmission(repositoryRoot).status,
        "blocked",
      );
    }
    assert.equal(roots.length, 6);
  } finally {
    mocked.restore();
  }
});
