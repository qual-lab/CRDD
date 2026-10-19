/**
 * verification-runner:integration:regression-runnerの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility verification-runner:integration:regression-runnerが所有する検証責務を実行する。
 * @trace CQS-IT-011
 * @trace CQS-IT-012
 * @trace CQS-IT-013
 * @trace RCM-IT-007
 * @level IT
 * @scope regression、runner、performance、longevity、authority
 * @boundary CQS-IT-011=Adjacent 1 Block: Test Catalog→Owner Runner / CQS-IT-012=Related 2 Blocks: Verification Runner→段階実行→結果集約 / CQS-IT-013=Direct Boundary: 検証要求→人間許可→Runner / RCM-IT-007=Adjacent 1 Block: 開発試験runner→子Process→fixture
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  loadTestCatalog,
  selectRegressionTests,
  type TestCatalog,
} from "../../src/catalog/inspect.ts";
import {
  aggregateRegressionStageResults,
  buildRegressionStagePlan,
  createRegressionStageExecutor,
  collectChangedPaths,
  executeRegressionStages,
} from "../../src/regression/stages.ts";

const verificationRunnerRoot = path.resolve(import.meta.dirname, "../..");
const runner = path.join(
  verificationRunnerRoot,
  "bin",
  "verification-runner.ts",
);

/**
 * 通常段階の旧検査除外をWindows専用段階の有無と分離する。
 * @responsibility Windows未選択時に旧全Tool固定検査を暗黙再実行しない。
 * @trace CQS-IT-011
 * @trace CQS-IT-012
 * @precondition 実RunnerをProcess要求記録fixtureへ接続する。
 * @stimulus Windows専用試験を含む選択と含まない選択を与える。
 * @observation 実Node argvのskip指定と試験File集合。
 * @oracle 通常試験は旧署名専用の除外を持たず、Windows専用段階だけを既存二接頭辞で分離する。
 * @cleanup 同期fixture子をjoin。試験本体・Docker・Providerは起動しない。
 * @boundary Runnerから模擬spawnへの実搬送。
 */
test("通常試験の除外はWindows専用段階だけに限定する", () => {
  for (const mode of ["host", "portable_only", "platform"]) {
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        path.join(
          verificationRunnerRoot,
          "tests/fixtures/platform-access-dispatch.ts",
        ),
        "none",
        mode,
      ],
      {
        cwd: verificationRunnerRoot,
        encoding: "utf8",
        timeout: 15_000,
        windowsHide: true,
        maxBuffer: 512 * 1024,
      },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout) as {
      result: { exitCode: number };
      requests: {
        kind: string;
        owner: string;
        files: string[];
        skip: string | null;
      }[];
    };
    assert.equal(observed.result.exitCode, 0);
    const normal = observed.requests.filter(
      (request) => request.kind === "node_test",
    );
    assert.ok(normal.length > 0);
    for (const request of normal) {
      const pattern = request.skip
        ? new RegExp(request.skip.replace("--test-skip-pattern=", ""))
        : /(?!) /u;
      assert.equal(pattern.test("Legacy Verification Tools: fixed"), false);
      assert.equal(
        pattern.test("Legacy Verification Tools: foreign case"),
        false,
      );
      assert.equal(
        pattern.test(
          "Script公開Process入口は相対・Repository基準Pathで同じOwnerへ解決する",
        ),
        false,
      );
      assert.equal(pattern.test("通常Artifact出所検査"), false);
    }
    assert.equal(
      observed.requests.some((request) => request.kind === "windows_test"),
      mode !== "portable_only",
    );
    if (mode === "portable_only")
      assert.ok(
        normal.some((request) =>
          request.files.includes(
            "./tests/integration/runtime-retirement.contract.test.ts",
          ),
        ),
      );
  }
});

/**
 * Host記録の変更で選択した試験Fileが実spawn argvへ全数搬送される。
 * @responsibility 計画側の集合だけで実dispatch成功を推定しない。
 * @trace CQS-IT-011
 * @trace CQS-IT-012
 * @precondition 実Catalog・本番Runnerと要求argvを保存する無Effect fixtureを使う。
 * @stimulus Host Reader変更の計画だけを取得し、直接試験Path変更時の実搬送と欠落・余分・誤Owner・重複搬送の報告を照合する。
 * @observation 通常NodeとWindows専用段階の実argv File集合。
 * @oracle 各実集合が選択計画とexact一致し、新Host試験の省略を拒否する。
 * @cleanup 同期子Process終了を確認。Docker・Provider・実試験本体は起動しない。
 * @boundary Source変更は未許可Provider試験を含むため計画限定。直接試験Path変更の本番Runner→spawn argvを別確認し、実Host試験は専用実行で確認する。
 */
test("Host記録試験の実argv搬送は欠落と誤Ownerを拒否する", () => {
  const fixture = path.join(
    verificationRunnerRoot,
    "tests/fixtures/platform-access-dispatch.ts",
  );
  const sourcePlan = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", fixture, "none", "host_source"],
    {
      cwd: verificationRunnerRoot,
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 512 * 1024,
    },
  );
  assert.equal(sourcePlan.error, undefined);
  assert.equal(sourcePlan.status, 0, sourcePlan.stderr);
  const planned = JSON.parse(sourcePlan.stdout);
  assert.equal(planned.result.exitCode, 0);
  assert.deepEqual(planned.requests, []);
  assert.ok(
    planned.final.selected.includes(
      "40_Develop/coordinator/tests/integration/host-recovery-record.contract.test.ts",
    ),
  );
  const child = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", fixture, "none", "host"],
    {
      cwd: verificationRunnerRoot,
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 512 * 1024,
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  const observed = JSON.parse(child.stdout) as {
    result: { exitCode: number };
    requests: { kind: string; owner: string; files: string[] }[];
    final: { stages: { stage: string; selected: string[] }[] };
  };
  assert.equal(observed.result.exitCode, 0);
  const hostPath =
    "40_Develop/coordinator/tests/integration/host-recovery-record.contract.test.ts";
  /**
   * 実搬送報告を同じ固定計画の完全集合と照合する。
   * @responsibility ファイル欠落・余分・誤Owner・重複を件数一致で見逃さない。
   * @trace CQS-IT-011
   * @trace CQS-IT-012
   * @precondition 本番Runnerが返した段階計画を固定する。
   * @stimulus spawnの実要求報告またはその反例を入力する。
   * @observation Owner付き相対File集合。
   * @oracle 通常NodeとWindowsの二集合が各計画と完全一致する。
   * @cleanup N/A: メモリ内比較のみ。
   * @boundary 実argv報告と選択計画の照合。
   */
  const assertDispatch = (requests: typeof observed.requests) => {
    for (const [kind, levels] of [
      ["node_test", ["unit", "integration"]],
      ["windows_test", ["windows_process_control"]],
    ] as const) {
      const expected = observed.final.stages
        .filter((stage) => (levels as readonly string[]).includes(stage.stage))
        .flatMap((stage) => stage.selected)
        .sort();
      assert.ok(expected.includes(hostPath));
      const actual = requests
        .filter((request) => request.kind === kind)
        .flatMap((request) =>
          request.files.map(
            (file) =>
              `40_Develop/${request.owner}/${file.replace(/^\.\//u, "")}`,
          ),
        )
        .sort();
      assert.deepEqual(actual, expected);
    }
  };
  assertDispatch(observed.requests);
  const windows = observed.requests.find(
    (request) =>
      request.kind === "windows_test" && request.owner === "coordinator",
  );
  assert.ok(windows);
  const relative = "./tests/integration/host-recovery-record.contract.test.ts";
  assert.ok(windows.files.includes(relative));
  for (const altered of [
    { ...windows, files: windows.files.filter((file) => file !== relative) },
    {
      ...windows,
      files: [
        ...windows.files,
        "./tests/integration/nonexistent.contract.test.ts",
      ],
    },
    { ...windows, owner: "docker-isolation" },
  ])
    assert.throws(() =>
      assertDispatch(
        observed.requests.map((request) =>
          request === windows ? altered : request,
        ),
      ),
    );
  assert.throws(() => assertDispatch([...observed.requests, windows]));
});

/**
 * 同じOwnerのNodeとRustを本番Runnerが搬送し片系失敗で停止する。
 * @responsibility 名前上の登録だけで実dispatchが抜ける反例を検出する。
 * @trace CQS-IT-011
 * @trace CQS-IT-012
 * @precondition 実台帳と本番Runnerを使い、spawnだけを別Processで差し替える。
 * @stimulus Node／Cargo static、Cargo UT、Node IT、Cargo IT、Windows専用段階の六失敗点と正常対照を実行する。
 * @observation 固定要求順、Owner、終了結果と後段未要求。
 * @oracle 正常はnpm＋Cargo staticと両言語testへ到達し、各失敗は後段を発行しない。
 * @cleanup 同期fixture子Processの終了を確認。Compiler・Docker・Provider開始0。
 * @boundary 本番Runnerの段階搬送。実Rust試験全体の成立ではない。
 */
test("Platform AccessのNode／Cargo両dispatchと片系失敗停止を確認する", () => {
  const fixture = path.join(
    verificationRunnerRoot,
    "tests/fixtures/platform-access-dispatch.ts",
  );
  const expectedCalls = [
    { kind: "node_static", owner: "coordinator" },
    { kind: "node_static", owner: "docker-isolation" },
    { kind: "node_static", owner: "platform-access" },
    { kind: "rust_static", owner: "platform-access" },
    { kind: "rust_unit", owner: "platform-access" },
    { kind: "node_test", owner: "coordinator" },
    { kind: "node_test", owner: "docker-isolation" },
    { kind: "node_test", owner: "platform-access" },
    { kind: "rust_integration", owner: "platform-access" },
    { kind: "windows_test", owner: "coordinator" },
    { kind: "windows_test", owner: "docker-isolation" },
    { kind: "windows_test", owner: "platform-access" },
  ];
  for (const failure of [
    "none",
    "node_static",
    "rust_static",
    "rust_unit",
    "node_test",
    "rust_integration",
    "windows_test",
  ]) {
    const child = spawnSync(
      process.execPath,
      ["--experimental-test-module-mocks", fixture, failure],
      {
        cwd: verificationRunnerRoot,
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 128 * 1024,
        windowsHide: true,
      },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout) as {
      result: { exitCode: number };
      calls: { kind: string; owner: string }[];
      final: {
        selectedCount: number;
        stages: {
          stage: string;
          selected: string[];
          status: string;
          exitCode: number | null;
        }[];
      };
    };
    if (failure === "none") {
      assert.equal(observed.result.exitCode, 0);
      assert.deepEqual(observed.calls, expectedCalls);
      const selected = selectRegressionTests(
        loadTestCatalog(
          path.resolve(
            verificationRunnerRoot,
            "../../07_Quality/Registry/test-catalog.json",
          ),
        ) as TestCatalog,
        ["40_Develop/platform-access/src/artifact/identity-observation.ts"],
      ).filter((entry) => ["unit", "integration"].includes(entry.level));
      assert.equal(observed.final.selectedCount, selected.length);
      for (const level of ["unit", "integration"]) {
        assert.deepEqual(
          observed.final.stages.find((stage) => stage.stage === level)
            ?.selected,
          selected
            .filter((entry) => entry.level === level)
            .map((entry) => entry.path),
        );
      }
      assert.deepEqual(
        observed.final.stages.map((stage) => [
          stage.stage,
          stage.selected.length,
          stage.status,
          stage.exitCode,
        ]),
        [
          ["static", 0, "completed", 0],
          [
            "unit",
            selected.filter((entry) => entry.level === "unit").length,
            "completed",
            0,
          ],
          [
            "integration",
            selected.filter((entry) => entry.level === "integration").length,
            "completed",
            0,
          ],
          ["windows_process_control", 5, "completed", 0],
          ["system", 0, "completed", 0],
          ["acceptance", 0, "completed", 0],
        ],
      );
    } else {
      assert.notEqual(observed.result.exitCode, 0);
      const failureIndex = expectedCalls.findIndex(
        (call) =>
          (call.owner === "platform-access" || failure === "windows_test") &&
          call.kind === failure,
      );
      assert.notEqual(failureIndex, -1);
      assert.deepEqual(
        observed.calls,
        expectedCalls.slice(0, failureIndex + 1),
      );
    }
  }
  const multiOwnerCalls = [
    { kind: "node_static", owner: "coordinator" },
    { kind: "node_static", owner: "docker-isolation" },
    { kind: "node_test", owner: "docker-isolation" },
    { kind: "node_test", owner: "coordinator" },
    { kind: "node_test", owner: "docker-isolation" },
    { kind: "windows_test", owner: "coordinator" },
    { kind: "windows_test", owner: "docker-isolation" },
  ];
  for (const failure of ["none", "windows_coordinator", "windows_docker"]) {
    const child = spawnSync(
      process.execPath,
      ["--experimental-test-module-mocks", fixture, failure, "multi"],
      {
        cwd: verificationRunnerRoot,
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 128 * 1024,
        windowsHide: true,
      },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout) as {
      result: { exitCode: number };
      calls: { kind: string; owner: string }[];
    };
    const last = failure === "windows_coordinator" ? 6 : 7;
    assert.deepEqual(observed.calls, multiOwnerCalls.slice(0, last));
    assert.equal(observed.result.exitCode, failure === "none" ? 0 : 1);
  }
});

/**
 * 新隔離Packageの静的検査と段階実行を実CLIから確認する。
 *
 * @responsibility Ownerを登録しただけで実行dispatchが抜ける反例を検出する。
 * @trace CQS-IT-011
 * @trace CQS-IT-012
 * @precondition 下位の局所UT／ITだけを選択し、DockerやProviderを開始しない。
 * @stimulus 試験File指定でRunnerを二回実行する。
 * @observation staticと各levelの終了結果を取得する。
 * @oracle 下位Ownerで静的検査を先に完了し、同じFileを段階実行する。
 * @cleanup N/A: 選択した試験は自己生成資源を既存hookで回収する。
 * @boundary 公開Runner CLI→Package静的検査・試験Process。
 */
test("Docker IsolationのstaticとUT／ITを新Ownerへ実dispatchする", () => {
  for (const [level, file] of [
    ["unit", "command-plan"],
    ["integration", "command-runtime"],
  ] as const) {
    const target = `40_Develop/docker-isolation/tests/${level}/${file}.contract.test.ts`;
    const result = invokeRunner(["--changed", target, "--levels", level]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const finalStart = result.stdout.lastIndexOf("\n{\n") + 1;
    const completed = JSON.parse(result.stdout.slice(finalStart)) as {
      status: string;
      selectedCount: number;
      stages: {
        stage: string;
        owners: string[];
        selected: string[];
        status: string;
        exitCode: number;
      }[];
    };
    assert.equal(completed.status, "completed");
    assert.equal(completed.selectedCount, 1);
    assert.deepEqual(
      completed.stages.find((entry) => entry.stage === "static")?.owners,
      ["docker-isolation"],
    );
    const executed = completed.stages.find((entry) => entry.stage === level);
    assert.equal(executed?.status, "completed");
    assert.equal(executed?.exitCode, 0);
    assert.deepEqual(executed?.owners, ["docker-isolation"]);
    assert.deepEqual(executed?.selected, [target]);
  }
});

/**
 * 実Docker試験を通常計画と実環境実行許可に分離する。
 *
 * @responsibility 新隔離Ownerの変更でも未承認の実環境処置を発行しない。
 * @trace CQS-IT-013
 * @trace RCM-IT-007
 * @precondition 現行台帳と実環境profileを使用する。
 * @stimulus 下位変更を計画し、WindowsではHost試験を許可なしで要求する。
 * @observation 実環境stageへの選択と実行前拒否を確認する。
 * @oracle planはEffect 0、許可なしでは試験Processを開始しない。
 * @cleanup N/A: planまたは実行前拒否だけ。
 * @boundary Package変更選択→実Docker試験の許可境界。
 */
test("Docker Isolationの実Host試験は専用profileで計画し許可前に停止する", () => {
  const target =
    "40_Develop/coordinator/tests/integration/docker-isolation-host.integration.test.ts";
  const planned = invokeRunner([
    "--changed",
    "40_Develop/docker-isolation/src/execution/command-runtime.ts",
    "--plan",
  ]);
  assert.equal(planned.status, 0, planned.stderr);
  const plan = JSON.parse(planned.stdout) as {
    effectIssued: boolean;
    stages: { stage: string; selected: string[] }[];
  };
  assert.equal(plan.effectIssued, false);
  assert.ok(
    plan.stages
      .find((entry) => entry.stage === "windows_process_control")
      ?.selected.includes(target),
  );
  if (process.platform === "win32") {
    const blocked = invokeRunner(["--changed", target]);
    assert.equal(blocked.status, 2);
    assert.deepEqual(JSON.parse(blocked.stdout), {
      status: "blocked",
      reason: "windows_process_control_authority_required",
      requiredExecutionProfile: "windows_process_control",
      effectIssued: false,
    });
  }
});

/**
 * 検証済みRootの直下で試験領域を準備する。
 *
 * @responsibility 各祖先の実体を作成前に確認し、リンク先への作成を拒否する。
 * @trace CQS-IT-011
 * @precondition Rootは実体確認済みのRepositoryまたは自己生成fixtureである。
 * @stimulus .crddとtestsを順に検査し、欠測した一段だけを作成する。
 * @observation lstat、realpath、返却Pathを確認する。
 * @oracle 各段は非リンクDirectoryで宣言Pathと実体が一致する。
 * @cleanup 作成した一回性領域は呼出し元のfinallyで回収する。
 * @boundary CQS-IT-011=Direct Boundary: 検証済みRoot→試験Filesystem
 */
function prepareGitTestRoot(root: string): string {
  for (const relative of [".crdd", ".crdd/tests"]) {
    const directory = path.join(root, relative);
    let observed: fs.Stats;
    try {
      observed = fs.lstatSync(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      fs.mkdirSync(directory);
      observed = fs.lstatSync(directory);
    }
    assert.equal(observed.isSymbolicLink(), false);
    assert.equal(observed.isDirectory(), true);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  return path.join(root, ".crdd", "tests");
}

/**
 * 試験領域の祖先リンクを作成前に拒否する。
 *
 * @responsibility .crddとtestsのリンク先へDirectoryを作らない反例を確認する。
 * @trace CQS-IT-011
 * @precondition 検証済みRepository内に自己生成fixtureを置く。
 * @stimulus 各祖先をfixture内の別Directoryへリンクして準備を要求する。
 * @observation 拒否とリンク先の子Directory数を確認する。
 * @oracle 各リンクは拒否され、リンク先の子Directory作成は0となる。
 * @cleanup finallyでexact fixtureを回収し不存在を確認する。
 * @boundary CQS-IT-011=Direct Boundary: 試験領域準備→Filesystem祖先
 */
test(".crddまたはtestsがリンクならリンク先への作成0で拒否する", () => {
  const repositoryRoot = fs.realpathSync.native(
    path.resolve(verificationRunnerRoot, "../.."),
  );
  const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  assert.equal(fs.realpathSync.native(gitRoot), repositoryRoot);
  const testRoot = prepareGitTestRoot(repositoryRoot);
  const fixture = fs.mkdtempSync(path.join(testRoot, "runner-root-link-"));
  try {
    for (const name of ["crdd", "tests"]) {
      const root = path.join(fixture, name);
      const target = path.join(fixture, `${name}-target`);
      fs.mkdirSync(root);
      fs.mkdirSync(target);
      if (name === "tests") fs.mkdirSync(path.join(root, ".crdd"));
      const link =
        name === "crdd"
          ? path.join(root, ".crdd")
          : path.join(root, ".crdd", "tests");
      fs.symlinkSync(target, link, "junction");
      assert.throws(() => prepareGitTestRoot(root));
      assert.deepEqual(fs.readdirSync(target), []);
    }
  } finally {
    assert.equal(fs.lstatSync(fixture).isSymbolicLink(), false);
    assert.equal(path.dirname(fs.realpathSync.native(fixture)), testRoot);
    fs.rmSync(fixture, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixture), false);
  }
});

/**
 * invokeRunnerのTest準備責務を実行する。
 *
 * @responsibility invokeRunnerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CQS-IT-011
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus invokeRunnerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
function invokeRunner(runnerArguments: readonly string[]) {
  return spawnSync(process.execPath, [runner, ...runnerArguments], {
    cwd: verificationRunnerRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

/**
 * PT／LTは全Authority条件が揃う前に試験Processを開始しないを検証する。
 *
 * @responsibility PT／LTは全Authority条件が揃う前に試験Processを開始しないの合否判定を所有する。
 * @trace CQS-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PT／LTは全Authority条件が揃う前に試験Processを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-013=Direct Boundary: verification-runner Test Source→対象契約
 */
test("PT／LTは全Authority条件が揃う前に試験Processを開始しない", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/inspect.ts",
    "--levels",
    "performance",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(outcome.status, "not_authorized");
  assert.equal(outcome.reason, "resource_intensive_test_authority_required");
  assert.equal(outcome.effectIssued, false);
});

/**
 * Credit 0を含む明示AuthorityはPTの計画だけを許可するを検証する。
 *
 * @responsibility Credit 0を含む明示AuthorityはPTの計画だけを許可するの合否判定を所有する。
 * @trace CQS-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Credit 0を含む明示AuthorityはPTの計画だけを許可するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-013=Direct Boundary: verification-runner Test Source→対象契約
 */
test("Credit 0を含む明示AuthorityはPTの計画だけを許可する", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/inspect.ts",
    "--levels",
    "performance",
    "--resource-intensive-authorized",
    "--purpose",
    "bounded local measurement",
    "--environment",
    "fixed local fixture",
    "--max-duration-minutes",
    "5",
    "--max-invocations",
    "10",
    "--max-credits",
    "0",
    "--cleanup",
    "remove generated fixture data",
    "--stop-condition",
    "stop on first failure",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    status?: unknown;
    levels?: unknown;
    selected?: unknown;
  };
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.levels, ["performance"]);
  assert.deepEqual(plan.selected, []);
});

/**
 * 明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとするを検証する。
 *
 * @responsibility 明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとするの合否判定を所有する。
 * @trace CQS-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-013=Direct Boundary: verification-runner Test Source→対象契約
 */
test("明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとする", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/inspect.ts",
    "--levels",
    "performance,unit",
    "--resource-intensive-authorized",
    "--purpose",
    "bounded local measurement",
    "--environment",
    "fixed local fixture",
    "--max-duration-minutes",
    "5",
    "--max-invocations",
    "10",
    "--max-credits",
    "0",
    "--cleanup",
    "remove generated fixture data",
    "--stop-condition",
    "stop on first failure",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(outcome.status, "planned_not_executable");
  assert.equal(
    outcome.resourceIntensiveExecution,
    "plan_only_until_runtime_limits_are_enforced",
  );
  assert.equal(outcome.effectIssued, false);
});

/**
 * 通常回帰はUT／IT／STだけを実行可能集合へ選ぶを検証する。
 *
 * @responsibility 通常回帰はUT／IT／STだけを実行可能集合へ選ぶの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常回帰はUT／IT／STだけを実行可能集合へ選ぶの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("通常回帰はUT／IT／STだけを実行可能集合へ選ぶ", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/inspect.ts",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    levels?: unknown;
    selected?: unknown;
  };
  assert.deepEqual(plan.levels, ["unit", "integration", "system"]);
  assert.ok(Array.isArray(plan.selected));
  assert.deepEqual(plan.selected, [
    "40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts",
    "40_Develop/verification-runner/tests/system/resource-intensive-gate.contract.test.ts",
    "40_Develop/verification-runner/tests/unit/catalog/inspect.contract.test.ts",
  ]);
});

/**
 * 外部Provider試験を含む変更でもEffect 0の計画表示は停止しないを検証する。
 *
 * @responsibility 外部Provider試験を含む変更でもEffect 0の計画表示は停止しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 外部Provider試験を含む変更でもEffect 0の計画表示は停止しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("外部Provider試験を含む変更でもEffect 0の計画表示は停止しない", () => {
  const changedPath = "40_Develop/coordinator/src/external-send/policy.ts";
  const planned = invokeRunner(["--changed", changedPath, "--plan"]);
  assert.equal(planned.error, undefined);
  assert.equal(planned.status, 0);
  assert.equal(planned.stderr, "");
  const plan = JSON.parse(planned.stdout) as {
    selected?: string[];
    effectIssued?: unknown;
  };
  assert.ok(
    plan.selected?.includes(
      "40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts",
    ),
  );
  assert.equal(plan.effectIssued, false);

  const execution = invokeRunner([
    "--changed",
    changedPath,
    "--windows-process-control-authorized",
  ]);
  assert.equal(execution.error, undefined);
  assert.equal(execution.status, 2);
  assert.deepEqual(JSON.parse(execution.stdout), {
    status: "blocked",
    reason: "interactive_or_provider_test_not_automatically_authorized",
    effectIssued: false,
  });
});

/**
 * Windows実Process試験は専用実行Profileを計画へ明示するを検証する。
 *
 * @responsibility Windows実Process試験は専用実行Profileを計画へ明示するの合否判定を所有する。
 * @trace RCM-IT-007
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows実Process試験は専用実行Profileを計画へ明示するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-007=Direct Boundary: verification-runner Test Source→対象契約
 */
test("Windows実Process試験は専用実行Profileを計画へ明示する", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/docker-isolation/tests/integration/owned-process.integration.test.ts",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    requiredExecutionProfiles?: unknown;
    stages?: Array<{ stage?: string; selected?: string[] }>;
  };
  assert.deepEqual(plan.requiredExecutionProfiles, [
    "restricted_process",
    "windows_process_control",
  ]);
  const windowsStage = plan.stages?.find(
    (entry) => entry.stage === "windows_process_control",
  );
  assert.deepEqual(windowsStage?.selected, [
    "40_Develop/docker-isolation/tests/integration/owned-process.integration.test.ts",
  ]);
});

/**
 * Windows実Process試験は専用実行Authorityなしに試験Processを開始しないを検証する。
 *
 * @responsibility Windows実Process試験は専用実行Authorityなしに試験Processを開始しないの合否判定を所有する。
 * @trace RCM-IT-007
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows実Process試験は専用実行Authorityなしに試験Processを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-007=Direct Boundary: verification-runner Test Source→対象契約
 */
test("Windows実Process試験は専用実行Authorityなしに試験Processを開始しない", {
  skip: process.platform !== "win32",
}, () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/docker-isolation/tests/integration/owned-process.integration.test.ts",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "blocked",
    reason: "windows_process_control_authority_required",
    requiredExecutionProfile: "windows_process_control",
    effectIssued: false,
  });
});

/**
 * Tool配下MarkdownもCheckerとRepository静的検査へ接続するを検証する。
 *
 * @responsibility Tool配下MarkdownもCheckerとRepository静的検査へ接続するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Tool配下MarkdownもCheckerとRepository静的検査へ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("Tool配下MarkdownもCheckerとRepository静的検査へ接続する", () => {
  for (const changedPath of [
    "16_Quality_Assurance.md",
    "40_Develop/coordinator/README.md",
    "40_Develop/platform-access/README.md",
  ]) {
    const result = invokeRunner(["--changed", changedPath, "--plan"]);
    assert.equal(result.status, 0, changedPath);
    const plan = JSON.parse(result.stdout) as {
      selected?: string[];
      stages?: Array<{
        stage?: string;
        owners?: string[];
        selectionReason?: string;
      }>;
    };
    assert.ok(
      plan.selected?.every((entry) => entry.startsWith("40_Develop/checker/")),
      changedPath,
    );
    const staticStage = plan.stages?.find((entry) => entry.stage === "static");
    assert.deepEqual(staticStage?.owners, ["checker"]);
    assert.equal(
      staticStage?.selectionReason,
      "owner_static_checks_and_repository_check",
    );
  }
});

/**
 * 共通component変更は利用側契約と利用側静的検査を同じ計画へ含めるを検証する。
 *
 * @responsibility 共通component変更は利用側契約と利用側静的検査を同じ計画へ含めるの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共通component変更は利用側契約と利用側静的検査を同じ計画へ含めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("共通component変更は利用側契約と利用側静的検査を同じ計画へ含める", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/execution-intelligence/src/store/events.ts",
    "--plan",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    selected?: string[];
    stages?: Array<{ stage?: string; owners?: string[] }>;
  };
  assert.ok(
    plan.selected?.includes(
      "40_Develop/coordinator/tests/integration/orchestrator-composition-root.integration.test.ts",
    ),
  );
  const staticStage = plan.stages?.find((entry) => entry.stage === "static");
  assert.deepEqual(staticStage?.owners, [
    "coordinator",
    "execution-intelligence",
  ]);
});

/**
 * 利用側静的検査はunit限定でも残し、利用側ITは実行しないを検証する。
 *
 * @responsibility 利用側静的検査はunit限定でも残し、利用側ITは実行しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 利用側静的検査はunit限定でも残し、利用側ITは実行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("利用側静的検査はunit限定でも残し、利用側ITは実行しない", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/execution-intelligence/src/store/events.ts",
    "--levels",
    "unit",
    "--plan",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    selected?: string[];
    stages?: Array<{ stage?: string; owners?: string[] }>;
  };
  assert.ok((plan.selected?.length ?? 0) > 0);
  assert.ok(
    plan.selected?.every((entry) =>
      entry.includes("execution-intelligence/tests/unit/"),
    ),
  );
  assert.deepEqual(
    plan.stages?.find((entry) => entry.stage === "static")?.owners,
    ["coordinator", "execution-intelligence"],
  );
  assert.deepEqual(
    plan.stages?.find((entry) => entry.stage === "integration")?.owners,
    [],
  );
});

/**
 * 実行知の静的検査はCoordinatorのtoolchainを参照しないを検証する。
 *
 * @responsibility 実行知の静的検査はCoordinatorのtoolchainを参照しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行知の静的検査はCoordinatorのtoolchainを参照しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("実行知の静的検査はCoordinatorのtoolchainを参照しない", () => {
  const source = fs.readFileSync(
    path.join(verificationRunnerRoot, "src", "regression", "run.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /toolRoot|coordinator[\\/]+node_modules|node_modules[\\/]+typescript/u,
  );
  assert.match(source, /runNpmScript\("check", root\)/u);
});

const selectedRegressionEntries = [
  { owner: "checker", level: "unit", path: "checker.unit.test.ts" },
  {
    owner: "coordinator",
    level: "integration",
    path: "coordinator.integration.test.ts",
    executionProfiles: ["restricted_process", "windows_process_control"],
  },
  { owner: "checker", level: "system", path: "checker.system.test.ts" },
] as const;

const selectedRegressionEntriesWithHumanAcceptance = [
  ...selectedRegressionEntries,
  {
    owner: "verification-runner",
    level: "acceptance",
    path: "verification-runner.acceptance.md",
    humanInput: true,
  },
] as const;

/**
 * executeInjectedPlanのTest準備責務を実行する。
 *
 * @responsibility executeInjectedPlanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CQS-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus executeInjectedPlanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-012=Direct Boundary: verification-runner Test Source→対象契約
 */
function executeInjectedPlan(
  failedStep: string | null = null,
  windowsProcessControlRequired = true,
  humanAcceptanceRequired = false,
) {
  const observedSteps: string[] = [];
  const plans = buildRegressionStagePlan(
    humanAcceptanceRequired
      ? selectedRegressionEntriesWithHumanAcceptance
      : selectedRegressionEntries,
    ["40_Develop/coordinator/src/coordinator.ts"],
    windowsProcessControlRequired,
  );
  const executeStage = createRegressionStageExecutor({
    runStatic: () => {
      observedSteps.push("static");
      return failedStep === "static" ? 1 : 0;
    },
    runLevel: (stage) => {
      observedSteps.push(stage);
      return failedStep === stage ? 1 : 0;
    },
    runWindowsProcess: () => {
      observedSteps.push("windows_process_control");
      return failedStep === "windows_process_control" ? 1 : 0;
    },
  });
  const results = executeRegressionStages(plans, executeStage);
  return { observedSteps, plans, results };
}

/**
 * 実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行するを検証する。
 *
 * @responsibility 実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行するの合否判定を所有する。
 * @trace CQS-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-012=Direct Boundary: verification-runner Test Source→対象契約
 */
test("実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行する", () => {
  const { observedSteps, plans, results } = executeInjectedPlan();
  assert.deepEqual(
    plans.map((entry) => entry.stage),
    observedSteps,
  );
  assert.deepEqual(observedSteps, [
    "static",
    "unit",
    "integration",
    "windows_process_control",
    "system",
    "acceptance",
  ]);
  assert.ok(results.every((entry) => entry.status === "completed"));
  assert.deepEqual(
    results.map((result) => ({
      stage: result.stage,
      owners: result.owners,
      selected: result.selected,
      selectionReason: result.selectionReason,
      execution: result.execution,
    })),
    plans,
  );
});

/**
 * 同じ計画の各工程失敗は後続levelとWindows Gateを開始しないを検証する。
 *
 * @responsibility 同じ計画の各工程失敗は後続levelとWindows Gateを開始しないの合否判定を所有する。
 * @trace CQS-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同じ計画の各工程失敗は後続levelとWindows Gateを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-012=Direct Boundary: verification-runner Test Source→対象契約
 */
test("同じ計画の各工程失敗は後続levelとWindows Gateを開始しない", () => {
  for (const failedStep of [
    "static",
    "unit",
    "integration",
    "windows_process_control",
    "system",
    "acceptance",
  ]) {
    const { observedSteps, plans, results } = executeInjectedPlan(failedStep);
    assert.equal(observedSteps.at(-1), failedStep);
    const failureIndex = plans.findIndex((entry) => entry.stage === failedStep);
    assert.ok(
      results
        .slice(failureIndex + 1)
        .every((entry) => entry.status === "not_run_due_to_prior_stage"),
    );
  }
});

/**
 * Windows Gate不要時は表示計画にも実行記録にも現れないを検証する。
 *
 * @responsibility Windows Gate不要時は表示計画にも実行記録にも現れないの合否判定を所有する。
 * @trace CQS-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows Gate不要時は表示計画にも実行記録にも現れないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-012=Direct Boundary: verification-runner Test Source→対象契約
 */
test("Windows Gate不要時は表示計画にも実行記録にも現れない", () => {
  const { plans, observedSteps, results } = executeInjectedPlan(null, false);
  assert.deepEqual(
    plans.map((entry) => entry.stage),
    ["static", "unit", "integration", "system", "acceptance"],
  );
  assert.deepEqual(
    observedSteps,
    plans.map((entry) => entry.stage),
  );
  assert.ok(results.every((entry) => entry.status === "completed"));
});

/**
 * UATを含む固定計画は自動段階を実行し、人間入力待ちを未実行理由付きで保持するを検証する。
 *
 * @responsibility UATを自動Passへ畳まず、先行自動段階と人間入力待ちを同じ結果集合へ保持する。
 * @trace CQS-IT-012
 * @precondition Static、UT、IT、STおよびhumanInputを必要とするUATを含む固定計画を使用する。
 * @stimulus 固定計画を段階実行する。
 * @observation 実行した段階、UATの未実行理由、各段階の終了状態を観測する。
 * @oracle UAT以外だけを順序実行し、UATをnot_run_due_to_human_inputとして保持する。
 * @cleanup 外部Process、一時資源および人間入力を発行しない。
 * @boundary CQS-IT-012=Direct Boundary: verification-runner Test Source→対象契約
 */
test("UATを含む固定計画は自動段階を実行し、人間入力待ちを未実行理由付きで保持する", () => {
  const { observedSteps, plans, results } = executeInjectedPlan(
    null,
    false,
    true,
  );
  assert.deepEqual(observedSteps, ["static", "unit", "integration", "system"]);
  assert.deepEqual(
    plans.map((entry) => [entry.stage, entry.execution]),
    [
      ["static", "automatic"],
      ["unit", "automatic"],
      ["integration", "automatic"],
      ["system", "automatic"],
      ["acceptance", "human_input_required"],
    ],
  );
  assert.deepEqual(
    results.map((entry) => [entry.stage, entry.status, entry.exitCode]),
    [
      ["static", "completed", 0],
      ["unit", "completed", 0],
      ["integration", "completed", 0],
      ["system", "completed", 0],
      ["acceptance", "not_run_due_to_human_input", null],
    ],
  );
  assert.deepEqual(aggregateRegressionStageResults(results), {
    status: "blocked",
    reason: "regression_human_input_required",
    exitCode: 2,
  });
});

/**
 * 明示変更PathはRepository内の正規化相対Pathだけを受理するを検証する。
 *
 * @responsibility 明示変更PathはRepository内の正規化相対Pathだけを受理するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示変更PathはRepository内の正規化相対Pathだけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("明示変更PathはRepository内の正規化相対Pathだけを受理する", () => {
  for (const changedPath of [
    "../outside.ts",
    "C:/outside.ts",
    "/outside.ts",
    "40_Develop\\verification-runner\\src\\catalog\\test-catalog.ts",
    "./40_Develop/verification-runner/src/catalog/test-catalog.ts",
  ]) {
    const result = invokeRunner(["--changed", changedPath, "--plan"]);
    assert.equal(result.status, 2, changedPath);
    const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
    assert.equal(outcome.status, "blocked");
    assert.equal(outcome.reason, "regression_runner_observation_failed");
    assert.equal(outcome.detail, "regression_runner_changed_path_invalid");
    assert.equal(outcome.effectIssued, false);
  }
});

/**
 * Git変更集合はcommit・index・worktree・未追跡とrename両側を合成するを検証する。
 *
 * @responsibility Git変更集合はcommit・index・worktree・未追跡とrename両側を合成するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Git変更集合はcommit・index・worktree・未追跡とrename両側を合成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
 */
test("Git変更集合はcommit・index・worktree・未追跡とrename両側を合成する", () => {
  const repositoryRoot = fs.realpathSync.native(
    path.resolve(verificationRunnerRoot, "../.."),
  );
  const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  assert.equal(fs.realpathSync.native(gitRoot), repositoryRoot);
  const testRoot = prepareGitTestRoot(repositoryRoot);
  const root = fs.mkdtempSync(path.join(testRoot, "crdd-regression-git-"));
  /**
   * gitのTest準備責務を実行する。
   *
   * @responsibility gitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace CQS-IT-011
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus gitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary CQS-IT-011=Direct Boundary: verification-runner Test Source→対象契約
   */
  const git = (...gitArguments: string[]) =>
    execFileSync("git", gitArguments, { cwd: root, stdio: "pipe" });
  try {
    git("init", "--quiet");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "CRDD Test");
    fs.writeFileSync(path.join(root, "committed.txt"), "base\n");
    fs.writeFileSync(path.join(root, "renamed-old.txt"), "rename\n");
    fs.writeFileSync(path.join(root, "worktree.txt"), "base\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "base");
    const base = git("rev-parse", "HEAD").toString().trim();
    fs.writeFileSync(path.join(root, "committed.txt"), "commit\n");
    git("add", "committed.txt");
    git("commit", "--quiet", "-m", "change");
    git("mv", "renamed-old.txt", "renamed-new.txt");
    fs.writeFileSync(path.join(root, "worktree.txt"), "worktree\n");
    fs.writeFileSync(path.join(root, "untracked.txt"), "untracked\n");
    const observedPaths = collectChangedPaths(root, base);
    for (const expected of [
      "committed.txt",
      "renamed-old.txt",
      "renamed-new.txt",
      "worktree.txt",
      "untracked.txt",
    ])
      assert.ok(observedPaths.includes(expected), expected);
  } finally {
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    assert.equal(path.dirname(fs.realpathSync.native(root)), testRoot);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  }
});
