/**
 * 現在状態の入場観測を実Repositoryと保存Readerへ接続する。
 * @packageDocumentation
 * @responsibility 初回不存在と観測不能を区別し、安定本文を全域拒否しない。
 * @trace PRL-IT-013
 * @trace ERB-IT-014
 * @level IT
 * @scope 実Git・Filesystem・現在Reader。Kernel排他と境界切断だけを模擬する。
 * @boundary PRL-IT-013=Task入場→現在Reader→Repository。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mock, test } from "node:test";
import { runInNewContext } from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import * as domain from "../../../domain-model/src/index.ts";
import { coordinatorDataBoundaryBlocked } from "../../src/state/result.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { resolveVerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import * as locks from "../../src/execution/kernel-lock.ts";
import { borrowRuntimeOwnedCoordinatorRecoveryRepository } from "../../src/execution/operation.ts";
import {
  COORDINATOR_STATE_SCHEMA,
  encodeCoordinatorStateValue,
} from "../../src/storage/model.ts";

/**
 * 現在Readerの初回・部分保存・排他終了と入場投影を検証する。
 * @responsibility 旧AppData参照なしの実Root搬送と値相関を確認する。
 * @trace PRL-IT-013
 * @trace ERB-IT-014
 * @precondition 自己生成Git Repositoryだけを利用する。
 * @stimulus 不在、空領域、正規本文、不正本文、pending、未知物、Root差、境界出現と排他故障。
 * @observation 実Reader結果、Root引数、排他回数、本文とDirectory残存。
 * @oracle 通常Readerは不在拒否、専用入場だけ厳密不存在を許し、全故障は拒否する。
 * @cleanup 全mockを復元し自己生成Rootだけを回収する。
 * @boundary 実Filesystemと模擬Kernel排他。Docker・Provider要求は0。
 */
test("現在入場: 実Readerの初回不存在・本文・故障と全域拒否の廃止", async () => {
  const area = domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "current_admission_test",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "current-admission-"));
  let domainMock: ReturnType<typeof mock.module> | null = null;
  let kernelMock: ReturnType<typeof mock.module> | null = null;
  let storeMock: ReturnType<typeof mock.module> | null = null;
  let releaseResult = true;
  let releaseThrows = false;
  let live = true;
  let acquisitions = 0;
  let releases = 0;
  let afterAbsent: (() => void) | null = null;
  let areaFailure: ReturnType<typeof domain.ensureRepositoryRuntimeDataArea> =
    null;
  let areaCreations = 0;
  let areaThrows = false;
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
    domainMock = mock.module(
      new URL("../../../domain-model/src/index.ts", import.meta.url).href,
      {
        namedExports: {
          ...domain,
          ensureRepositoryRuntimeDataArea: (
            ...args: Parameters<typeof domain.ensureRepositoryRuntimeDataArea>
          ) => {
            if (areaThrows) throw new Error("fixture_partial_area_creation");
            return (
              areaFailure ?? domain.ensureRepositoryRuntimeDataArea(...args)
            );
          },
          createCoordinatorRuntimeDataArea: (
            ...args: Parameters<typeof domain.createCoordinatorRuntimeDataArea>
          ) => {
            areaCreations++;
            return domain.createCoordinatorRuntimeDataArea(...args);
          },
          observeRepositoryRuntimeDataArea: (
            ...args: Parameters<typeof domain.observeRepositoryRuntimeDataArea>
          ) => {
            const value = domain.observeRepositoryRuntimeDataArea(...args);
            if (value.status === "not_observed" && afterAbsent) {
              const hook = afterAbsent;
              afterAbsent = null;
              hook();
            }
            return value;
          },
        },
      },
    );
    kernelMock = mock.module(
      new URL("../../src/execution/kernel-lock.ts", import.meta.url).href,
      {
        namedExports: {
          ...locks,
          acquireRuntimeOwnedCoordinatorStateKernelLock: () => {
            acquisitions++;
            return {
              assertLive: () => live,
              release: () => {
                releases++;
                if (releaseThrows) throw new Error("fixture_release");
                return releaseResult;
              },
            };
          },
        },
      },
    );
    const store = await import(
      new URL(
        "../../src/storage/settlement-store.ts?current-admission",
        import.meta.url,
      ).href
    );
    storeMock = mock.module(
      new URL("../../src/storage/settlement-store.ts", import.meta.url).href,
      { namedExports: { ...store } },
    );
    const taskStore = await import(
      new URL(
        "../../src/storage/current-state.ts?area-failure",
        import.meta.url,
      ).href
    );
    for (const fault of [
      "no_effect",
      "unknown",
      "cleanup_failed",
      "owner_release",
    ]) {
      const unknown = fault === "unknown";
      const cleanup = fault !== "cleanup_failed";
      areaFailure = {
        status: "blocked",
        reason: "repository_runtime_data_ignore_registration_blocked",
        effectIssued: unknown || !cleanup,
        effectStateUnknown: unknown,
        effectConfirmation: unknown ? "unknown" : "not_issued",
        cleanupConfirmed: cleanup,
        retryAllowed: !unknown && cleanup,
        recoveryReference: unknown ? "repository-local-ignore.exact" : null,
        repositoryPathReported: false,
      };
      releaseResult = fault !== "owner_release";
      const beforeReleases = releases;
      let failure: unknown;
      try {
        taskStore.initializeCoordinatorSnapshot(root, "binding-a");
      } catch (error) {
        failure = error;
      }
      assert.ok(
        failure instanceof domain.RepositoryRuntimeDataAreaBlockedError,
      );
      assert.equal(releases, beforeReleases + 1);
      assert.equal(areaCreations, 0);
      assert.equal(
        fs.existsSync(path.join(root, ".crdd", "coordinator")),
        false,
      );
      const projected = coordinatorDataBoundaryBlocked(failure);
      assert.equal(projected.reason, areaFailure.reason);
      assert.equal(projected.effectIssued, areaFailure.effectIssued);
      assert.equal(projected.effectStateUnknown, unknown);
      assert.equal(projected.cleanupConfirmed, cleanup && releaseResult);
      assert.equal(
        projected.retryAllowed,
        !unknown && cleanup && releaseResult,
      );
      assert.deepEqual(
        projected.recoveryIds,
        unknown ? ["repository-local-ignore.exact"] : [],
      );
    }
    areaFailure = null;
    releaseResult = true;
    areaThrows = true;
    const beforeExceptionalRelease = releases;
    const exceptional = taskStore.initializeCoordinatorSnapshot(
      root,
      "binding-a",
    );
    assert.equal(exceptional.status, "blocked");
    assert.equal(exceptional.manualRecoveryRequired, true);
    assert.equal(releases, beforeExceptionalRelease + 1);
    assert.equal(areaCreations, 0);
    areaThrows = false;
    const owner = await import(
      new URL(
        "../../src/execution/recovery.ts?current-admission",
        import.meta.url,
      ).href
    );
    const inspect = owner.inspectRuntimeOwnedDockerTaskAdmission as (
      root: unknown,
    ) => { status: string; reason: string; lockReleased: boolean };
    const current = path.join(root, ".crdd", "coordinator");
    assert.equal(
      store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability)
        .status,
      "blocked",
    );
    assert.deepEqual(inspect(root), {
      status: "available",
      reason: "coordinator_current_admission_available",
      lockReleased: true,
    });
    assert.equal(fs.existsSync(current), false);
    for (const fault of ["release_false", "release_throw", "not_live"]) {
      releaseResult = fault !== "release_false";
      releaseThrows = fault === "release_throw";
      live = fault !== "not_live";
      assert.deepEqual(inspect(root), {
        status: "blocked",
        reason: "coordinator_current_admission_unconfirmed",
        lockReleased: fault === "not_live",
      });
      assert.equal(fs.existsSync(current), false);
    }
    releaseResult = true;
    releaseThrows = false;
    live = true;
    /**
     * 入場拒否の完全DTOを照合する。
     * @responsibility 実Readerと最終生存条件変異に同じ拒否Oracleを使う。
     * @trace PRL-IT-013
     * @precondition 取得済み排他は正常解放する。
     * @stimulus 入場結果を渡す。
     * @observation 可否・固定理由・解放確認の全field。
     * @oracle 入場拒否かつ排他解放だけを受理する。
     * @cleanup N/A: 値比較だけ。
     * @boundary 現在入場DTO。
     */
    const assertRefused = (result: unknown) =>
      assert.deepEqual(JSON.parse(JSON.stringify(result)), {
        status: "blocked",
        reason: "coordinator_current_admission_unconfirmed",
        lockReleased: true,
      });
    const releaseBeforeLoss = releases;
    let invalidations = 0;
    afterAbsent = () => {
      live = false;
      invalidations++;
    };
    assertRefused(inspect(root));
    assert.equal(invalidations, 1);
    assert.equal(afterAbsent, null);
    assert.equal(releases, releaseBeforeLoss + 1);
    assert.equal(fs.existsSync(current), false);
    live = true;
    const readerSource = fs.readFileSync(
      new URL("../../src/storage/settlement-store.ts", import.meta.url),
      "utf8",
    );
    const branchStart = readerSource.indexOf(
      '    if (allowUninitialized && initial.status === "not_observed") {',
    );
    const branchEnd = readerSource.indexOf(
      '    if (\n      initial.status !== "ready"',
      branchStart,
    );
    assert.ok(branchStart > 0 && branchEnd > branchStart);
    const branch = readerSource.slice(branchStart, branchEnd);
    assert.equal(branch.split("lock.assertLive()").length, 2);
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
    for (const [candidate, mutated] of [
      [branch, false],
      [branch.replace("lock.assertLive()", "true"), true],
    ] as const) {
      const reason = runInNewContext(
        `let reason = "coordinator_state_read_unconfirmed"; try {${candidate}} catch {} reason;`,
        {
          allowUninitialized: true,
          initial: { status: "not_observed" },
          verified: { capability: {} },
          observeRepositoryRuntimeDataArea: () => ({ status: "not_observed" }),
          repository: { revalidate: () => true },
          lock: { assertLive: () => false },
        },
      );
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
    const headBeforeAbsence = fs.readFileSync(path.join(root, ".git", "HEAD"));
    try {
      afterAbsent = () =>
        fs.writeFileSync(
          path.join(root, ".git", "HEAD"),
          "ref: refs/heads/unborn-fixture\n",
        );
      assert.equal(inspect(root).status, "blocked");
      assert.equal(afterAbsent, null);
      assert.equal(fs.existsSync(current), false);
    } finally {
      afterAbsent = null;
      fs.writeFileSync(path.join(root, ".git", "HEAD"), headBeforeAbsence);
    }
    afterAbsent = () => fs.mkdirSync(current, { recursive: true });
    assert.equal(inspect(root).status, "blocked");
    assert.equal(afterAbsent, null);
    assert.equal(inspect(root).status, "blocked");
    assert.deepEqual(fs.readdirSync(current), []);
    const file = path.join(current, "state.json");
    const bytes = Buffer.from(
      `${encodeCoordinatorStateValue({
        schema: COORDINATOR_STATE_SCHEMA,
        revision: 1,
        previous: null,
        repositoryBinding: binding.repositoryBinding,
        repositoryBindingId: null,
        intakeEpoch: null,
        intakeBindings: [],
        projects: [],
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
    assert.equal(inspect(root).status, "available");
    for (const name of [
      "state.pending.json",
      "state.lock",
      "history.pending.jsonl",
      "unknown.json",
    ]) {
      const injected = path.join(current, name);
      fs.writeFileSync(injected, "foreign", { flag: "wx" });
      try {
        assert.equal(inspect(root).status, "blocked");
        assert.deepEqual(fs.readFileSync(file), bytes);
        assert.equal(fs.readFileSync(injected, "utf8"), "foreign");
      } finally {
        fs.unlinkSync(injected);
      }
    }
    fs.writeFileSync(file, "invalid");
    assert.equal(inspect(root).status, "blocked");
    assert.equal(fs.readFileSync(file, "utf8"), "invalid");
    fs.writeFileSync(file, bytes);
    assert.equal(inspect(path.join(root, "missing")).status, "blocked");
    const head = path.join(root, ".git", "HEAD");
    const originalHead = fs.readFileSync(head);
    try {
      fs.writeFileSync(head, "ref: refs/heads/unborn-fixture\n");
      assert.equal(inspect(root).status, "blocked");
    } finally {
      fs.writeFileSync(head, originalHead);
    }
    assert.equal(inspect(root).status, "available");
    assert.equal(acquisitions, releases);
    assert.deepEqual(fs.readdirSync(current), ["state.json"]);
    assert.deepEqual(fs.readFileSync(file), bytes);
  } finally {
    storeMock?.restore();
    kernelMock?.restore();
    domainMock?.restore();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 本番三入口のRoot搬送式を実行し差替え変異を拒否する。
 * @responsibility 通常Task・開発Task・CLIが同じRootを渡すことを確認する。
 * @trace PRL-IT-013
 * @precondition 対象Sourceの一意な構成式を使い下位観測だけを置き換える。
 * @stimulus 入力Root、別Root、引数差替え変異を構成式へ渡す。
 * @observation Inspectorへ到達した引数と開発側の別Root拒否を確認する。
 * @oracle 元式だけexact Rootが一致し、旧Inspector／投影の再参照はない。
 * @cleanup N/A: VM内の同期式評価だけで外部Effectを発行しない。
 * @boundary 本番構成式の入力搬送。Task全体の成立は別の実行試験が所有する。
 */
test("現在入場: Task通常・開発・CLIの本番構成式はexact Rootを搬送する", () => {
  const task = fs.readFileSync(
    new URL("../../src/execution/controller.ts", import.meta.url),
    "utf8",
  );
  const cli = fs.readFileSync(
    new URL("../../src/cli/command.ts", import.meta.url),
    "utf8",
  );
  const adapter = fs.readFileSync(
    new URL("../../src/execution/diagnostics.ts", import.meta.url),
    "utf8",
  );
  for (const source of [task, cli, adapter]) {
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
  const cliStart = cli.indexOf(": (() => {");
  const cliEnd = cli.indexOf("})();", cliStart);
  assert.ok(cliStart > 0 && cliEnd > cliStart);
  const doctor = `${cli.slice(cliStart + 2, cliEnd)}\n})()`;
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
      kind === "cli" ? snippet : `({${snippet}})`,
      {
        inspectRuntimeOwnedDockerTaskAdmission: (root: unknown) => {
          calls.push(root);
          return { status: "available" };
        },
        boundary: { repositoryRoot: expected },
        guard: (fn: (root: string) => unknown) => fn,
        process: { cwd: () => "C:\\fixture-root\\subfolder" },
        resolveVerifiedRepositoryRootFromWorkingDirectory: (cwd: string) => {
          assert.equal(cwd, "C:\\fixture-root\\subfolder");
          return ++resolutions === 1 ? expected : "C:\\other-root";
        },
        options: { activeIsolation: false },
        runDoctor: (options: { cwd: unknown }) => {
          doctorRoots.push(options.cwd);
          return { status: "observed" };
        },
      },
    );
    if (kind !== "cli") configured.prepareDockerRecoveryState(expected);
    assert.deepEqual(calls, [expected]);
    if (kind === "cli") {
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
  verify(doctor, "cli");
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
        "inspectRuntimeOwnedDockerTaskAdmission(currentRoot)",
        "inspectRuntimeOwnedDockerTaskAdmission(resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()))",
      ),
      "cli",
    ),
  );
  assert.throws(() =>
    verify(doctor.replace("cwd: currentRoot", "cwd: 'wrong'"), "cli"),
  );
  let requests = 0;
  assert.throws(() =>
    runInNewContext(doctor, {
      process: { cwd: () => "fixture" },
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => {
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
        manifest.symbols.find(
          (entry: { symbolId: string }) => entry.symbolId === id,
        )?.path,
    ),
    [
      "src/execution/recovery.ts",
      "src/storage/settlement-store.ts",
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
  const store = await import("../../src/storage/settlement-store.ts");
  const projection = await import("../../src/execution/result.ts");
  const repositoryRoot = fs.realpathSync(
    path.resolve(import.meta.dirname, "../../../.."),
  );
  let observed: unknown;
  const roots: (string | null)[] = [];
  const mocked = mock.module(
    new URL("../../src/storage/settlement-store.ts", import.meta.url).href,
    {
      namedExports: {
        ...store,
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
