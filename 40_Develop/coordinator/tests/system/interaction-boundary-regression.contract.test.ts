/**
 * coordinator:system:interaction-boundary-regressionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:interaction-boundary-regressionが所有する検証責務を実行する。
 * @trace EST-ST-003
 * @level ST
 * @scope interaction、boundary、regression
 * @boundary EST-ST-003=System/E2E: 公開入口→同意Gate→Provider→結果帰還
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDockerCliEnvironment,
  createDesktopCommandEnvironment,
  createWindowsPowerShellAuthenticodeEnvironment,
} from "../../../docker-isolation/src/docker-cli/environment.ts";
import {
  describeCoordinatorNodeRuntimeVersionContract,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../../src/execution/diagnostics.ts";
import { getIsolationSettings } from "../../src/execution/configuration.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

/**
 * sourceFilesのTest準備責務を実行する。
 *
 * @responsibility sourceFilesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus sourceFilesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

/**
 * Windows内部子Processの実Environmentは用途別固定集合へ閉じるを検証する。
 *
 * @responsibility Windows内部子Processの実Environmentは用途別固定集合へ閉じるの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows内部子Processの実Environmentは用途別固定集合へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows内部子Processの実Environmentは用途別固定集合へ閉じる", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const dockerEnvironment = createDockerCliEnvironment(getIsolationSettings(), {
    dockerConfig: "C:\\runtime-owned\\docker-config",
    dockerHome: "C:\\runtime-owned\\docker-home",
  });
  assert.ok(dockerEnvironment);
  assert.equal(Object.getPrototypeOf(dockerEnvironment), null);
  for (const [dockerConfig, dockerHome] of [
    [null, "C:\\owned-home"],
    ["C:\\owned-config", null],
    ["relative", "C:\\owned-home"],
    ["C:\\owned-config", "relative"],
    ["C:\\owned-config\0invalid", "C:\\owned-home"],
    ["C:\\owned-config", "C:\\owned-home\0invalid"],
  ] as const) {
    assert.equal(
      createDockerCliEnvironment(getIsolationSettings(), {
        dockerConfig,
        dockerHome,
      }),
      null,
    );
  }
  const dockerResult = spawnSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(JSON.stringify({keys:Object.keys(process.env).sort(),pathNeutral:process.env.PATH==='',proxyNeutral:process.env.HTTPS_PROXY==='',homeOwned:process.env.HOME==='C:\\\\runtime-owned\\\\docker-home',configOwned:process.env.DOCKER_CONFIG==='C:\\\\runtime-owned\\\\docker-config',systemRoot:process.env.SystemRoot,windir:process.env.WINDIR}))",
    ],
    {
      shell: false,
      env: dockerEnvironment,
      encoding: "utf8",
      timeout: 5_000,
    },
  );
  assert.equal(dockerResult.status, 0, dockerResult.stderr);
  const observedDocker = JSON.parse(dockerResult.stdout);
  assert.equal(observedDocker.pathNeutral, true);
  assert.equal(observedDocker.proxyNeutral, true);
  assert.equal(observedDocker.homeOwned, true);
  assert.equal(observedDocker.configOwned, true);
  assert.equal(observedDocker.systemRoot, observedDocker.windir);
  assert.equal(typeof observedDocker.systemRoot, "string");

  const desktop = createDesktopCommandEnvironment(getIsolationSettings());
  assert.equal(desktop?.SystemRoot, getIsolationSettings().windowsDirectory);
  assert.equal(desktop?.USERPROFILE, getIsolationSettings().userHomeDirectory);
  assert.equal(desktop?.DOCKER_CLI_HINTS, "false");
});

/**
 * Authenticode検査用PowerShellは親環境を継承せず最小OS環境で起動するを検証する。
 *
 * @responsibility Authenticode検査用PowerShellは親環境を継承せず最小OS環境で起動するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Authenticode検査用PowerShellは親環境を継承せず最小OS環境で起動するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Authenticode検査用PowerShellは親環境を継承せず最小OS環境で起動する", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows contract");
    return;
  }
  const environment = createWindowsPowerShellAuthenticodeEnvironment(
    getIsolationSettings(),
  );
  assert.ok(environment);
  assert.deepEqual(Object.keys(environment).sort(), [
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "USERPROFILE",
    "WINDIR",
  ]);
  const systemRoot = environment.SystemRoot;
  if (typeof systemRoot !== "string" || systemRoot.length === 0) {
    assert.fail("SystemRoot must be present in the PowerShell environment");
  }
  assert.equal(systemRoot, environment.WINDIR);
  assert.equal(
    environment.USERPROFILE,
    path.win32.normalize(os.userInfo().homedir),
  );
  assert.equal(
    environment.PATH,
    [
      path.win32.join(systemRoot, "System32"),
      systemRoot,
      path.win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0"),
    ].join(";"),
  );
  const powershell = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const result = spawnSync(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-Command Get-AuthenticodeSignature | Out-Null; Write-Output 'CRDD_POWERSHELL_ENVIRONMENT_OK'",
    ],
    {
      cwd: systemRoot,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 5_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "CRDD_POWERSHELL_ENVIRONMENT_OK\r\n");
  assert.equal(result.stderr, "");
});

/**
 * Executable sourceとpackage commandへShell依存のJSON搬送を再導入しないを検証する。
 *
 * @responsibility Executable sourceとpackage commandへShell依存のJSON搬送を再導入しないの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Executable sourceとpackage commandへShell依存のJSON搬送を再導入しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Executable sourceとpackage commandへShell依存のJSON搬送を再導入しない", () => {
  const forbiddenPatterns = [
    /StandardInputEncoding/u,
    /Start-Process/u,
    /ConvertTo-Json/u,
    /shell\s*:\s*true/u,
  ];
  for (const directory of [
    ...["bin", "scripts", "src"].map((name) =>
      path.join(coordinatorRoot, name),
    ),
    path.resolve(coordinatorRoot, "../lock/src"),
    path.resolve(coordinatorRoot, "../docker-isolation/src"),
  ]) {
    for (const file of sourceFiles(directory)) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        assert.equal(pattern.test(source), false, `${file}: ${pattern.source}`);
      }
    }
  }

  const packageDocument = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  ) as { engines?: { node?: string }; scripts?: Record<string, string> };
  assert.equal(
    packageDocument.engines?.node,
    `>=${MINIMUM_COORDINATOR_NODE_VERSION}`,
  );
  const lockDocument = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package-lock.json"), "utf8"),
  ) as { packages?: { ""?: { engines?: { node?: string } } } };
  assert.equal(
    lockDocument.packages?.[""]?.engines?.node,
    packageDocument.engines?.node,
  );
  for (const [name, command] of Object.entries(packageDocument.scripts ?? {})) {
    assert.equal(
      /powershell|pwsh|cmd(?:\.exe)?\s+\/c/iu.test(command),
      false,
      name,
    );
  }
  assert.equal(packageDocument.scripts?.["release-key:generate"], undefined);
  assert.equal(packageDocument.scripts?.["release-manifest:sign"], undefined);
  assert.equal(packageDocument.scripts?.doctor, undefined);
  const developmentE2e = packageDocument.scripts?.["development-e2e:verify"];
  assert.equal(
    developmentE2e,
    "node --test --test-concurrency=1 ./tests/system/coordinator-launch.contract.test.ts ./tests/system/verification-result-record.contract.test.ts ./tests/system/interaction-boundary-regression.contract.test.ts ./tests/integration/claude-execution-plan.contract.test.ts ./tests/unit/execution/claude-preparation.contract.test.ts ./tests/unit/provider-authentication.contract.test.ts ./tests/integration/provider-authentication-recovery.integration.test.ts ./tests/integration/codex-execution-plan.contract.test.ts ./tests/unit/execution/codex-preparation.contract.test.ts ./tests/integration/coordinator-task-runtime.contract.test.ts ./tests/integration/coordinator-task-process.integration.test.ts ./tests/system/signed-general-task-verification.contract.test.ts ./tests/system/signed-reviewer-boundary-verification.contract.test.ts ./tests/system/signed-route-matrix-verification.contract.test.ts ./tests/system/signed-recovery-matrix-verification.contract.test.ts",
  );
  assert.equal(
    /sign-release|release-key|passphrase/u.test(developmentE2e),
    false,
  );

  for (const relative of ["src/execution/diagnostics.ts"]) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, relative),
      "utf8",
    );
    assert.equal(
      /(?:execFile|spawn)Sync\(\s*["']git["']/u.test(source),
      false,
      relative,
    );
  }

  // 型専用importも含むSource棚卸しであり、実Process発行・Authorityの証明ではない。
  const childProcessImportSources = [
    ...sourceFiles(path.join(coordinatorRoot, "src")),
    ...sourceFiles(path.resolve(coordinatorRoot, "../lock/src")),
    ...sourceFiles(path.resolve(coordinatorRoot, "../docker-isolation/src")),
  ]
    .filter((file) =>
      fs.readFileSync(file, "utf8").includes('from "node:child_process"'),
    )
    .map((file) => {
      const localPath = path
        .relative(coordinatorRoot, file)
        .replaceAll("\\", "/");
      return localPath.startsWith("../")
        ? `40_Develop/${path.relative(path.dirname(coordinatorRoot), file).replaceAll("\\", "/")}`
        : localPath;
    })
    .sort();
  assert.deepEqual(
    childProcessImportSources,
    [
      "40_Develop/docker-isolation/src/cleanup/execute.ts",
      "40_Develop/docker-isolation/src/cleanup/container.ts",
      "40_Develop/docker-isolation/src/docker-cli/trust.ts",
      "40_Develop/docker-isolation/src/process/start.ts",
      "40_Develop/docker-isolation/src/docker-desktop/backend.ts",
      "40_Develop/docker-isolation/src/docker-desktop/engine.ts",
      "40_Develop/docker-isolation/src/docker-desktop/restart-state.ts",
    ].sort(),
  );

  const productionFactorySeams = [
    /\bcreateChild\b/u,
    /\bworkerFactory\b/u,
    /\bchildFactory\b/u,
    /\bspawnFactory\b/u,
    /\bUsingFactory\b/u,
    /\bUsingChildFactory\b/u,
    /\bUsingChild\b/u,
    /\bUsingWorker\b/u,
    /\bcreateDockerDesktopRepairNativeHelperSessionUsingChild\b/u,
  ];
  for (const file of sourceFiles(path.join(coordinatorRoot, "src"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of productionFactorySeams) {
      assert.equal(pattern.test(source), false, `${file}: ${pattern.source}`);
    }
  }

  for (const directory of ["bin", "scripts", "src"]) {
    for (const file of sourceFiles(path.join(coordinatorRoot, directory))) {
      const source = fs.readFileSync(file, "utf8");
      assert.equal(
        /(?:execFile|spawn)(?:Sync)?\(\s*["']git["']/u.test(source),
        false,
        file,
      );
    }
  }
});

/**
 * 非同期の対話・正式Runner entrypointはtop-levelでmain完了を所有するを検証する。
 *
 * @responsibility 非同期の対話・正式Runner entrypointはtop-levelでmain完了を所有するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 非同期の対話・正式Runner entrypointはtop-levelでmain完了を所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("非同期の対話・正式Runner entrypointはtop-levelでmain完了を所有する", () => {
  const asynchronousEntrypoints = [
    "scripts/verify-general-task.ts",
    "scripts/verify-recovery-matrix.ts",
    "scripts/verify-route-matrix.ts",
  ];
  for (const relative of asynchronousEntrypoints) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, relative),
      "utf8",
    );
    assert.match(source, /\bawait main\(\);/u, relative);
    assert.equal(/\bmain\(\)\.catch\(/u.test(source), false, relative);
  }
});

/**
 * 保護操作は別名でも裸Runtimeのpackage aliasへ公開しないを検証する。
 *
 * @responsibility 保護操作は別名でも裸Runtimeのpackage aliasへ公開しないの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 保護操作は別名でも裸Runtimeのpackage aliasへ公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("保護操作は別名でも裸Runtimeのpackage aliasへ公開しない", () => {
  const protectedEntrypoints = [
    "bin/coordinator.ts",
    "src/cli/command.ts",
    "scripts/verify-general-task.ts",
    "scripts/verify-route-matrix.ts",
    "scripts/verify-recovery-matrix.ts",
    "scripts/revoke-external-send-consent.ts",
    "scripts/measure-development-providers.ts",
  ];
  const packageDocument = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  /**
   * invokesProtectedEntrypointのTest準備責務を実行する。
   *
   * @responsibility invokesProtectedEntrypointがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace EST-ST-003
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus invokesProtectedEntrypointを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
   */
  const invokesProtectedEntrypoint = (command: string) => {
    const normalizedCommand = command.replaceAll("\\", "/");
    if (
      !/(?:^|[\s;&|])(?:node(?:\.exe)?|npm(?:\.cmd)?|npx(?:\.cmd)?)(?=\s|$)/iu.test(
        normalizedCommand,
      )
    )
      return false;
    return protectedEntrypoints.some((entrypoint) =>
      normalizedCommand.split(/\s+/u).some((token) => {
        const argument = token.replace(/^["']|["']$/gu, "");
        return (
          !argument.startsWith("-") &&
          (argument === entrypoint || argument.endsWith(`/${entrypoint}`))
        );
      }),
    );
  };
  for (const command of [
    "node ./bin/coordinator.ts verify-recovery",
    "node ./bin/coordinator.ts auth login claude",
  ]) {
    assert.equal(invokesProtectedEntrypoint(command), true, command);
  }
  assert.equal(
    invokesProtectedEntrypoint(
      "node --test --test-coverage-include=bin/coordinator.ts ./tests/example.contract.test.ts",
    ),
    false,
  );
  for (const [name, command] of Object.entries(packageDocument.scripts)) {
    assert.equal(invokesProtectedEntrypoint(command), false, name);
  }
});

/**
 * Node版GateはPATHをAuthorityにせずEffect前に停止するを検証する。
 *
 * @responsibility Node版GateはPATHをAuthorityにせずEffect前に停止するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Node版GateはPATHをAuthorityにせずEffect前に停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Node版GateはPATHをAuthorityにせずEffect前に停止する", () => {
  assert.deepEqual(describeCoordinatorNodeRuntimeVersionContract(), {
    contract: "crdd-coordinator/node-runtime-version",
    contractRevision: 1,
    minimumVersion: "24.12.0",
    checkTiming: "before_interactive_input_release_verification_or_effect",
    pathLookupAuthority: false,
    unsupportedRuntimeFallbackAllowed: false,
  });

  const guardedEntrypoints = [
    [
      "src/cli/command.ts",
      /if \(!isSupportedNodeRuntime\(observation\.nodeVersion\)\)/u,
      /import\s*\{[^}]*\bisSupportedNodeRuntime\b[^}]*\}\s*from "\.\.\/api\.ts"/u,
    ],
    [
      "scripts/verify-general-task.ts",
      /isSupportedNodeRuntime\(\s*dependencies\.runtimeVersion\(\),?\s*\)/u,
      /import\s*\{[^}]*\bisSupportedNodeRuntime\b[^}]*\}\s*from "\.\.\/src\/execution\/diagnostics\.ts"/u,
    ],
  ] as const;
  for (const [relative, call, imported] of guardedEntrypoints) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, relative),
      "utf8",
    );
    assert.match(source, imported, relative);
    assert.match(source, call, relative);
  }

  const readme = fs.readFileSync(
    path.join(
      coordinatorRoot,
      "..",
      "..",
      "19_Workflows",
      "01_Coordinator_Runtime.md",
    ),
    "utf8",
  );
  assert.match(
    readme,
    /"<absolute-preverified-node-24\.12\+-executable>" "<absolute-crdd-source-root>\\40_Develop\\coordinator\\bin\\coordinator\.ts" doctor/u,
  );
  assert.equal(readme.includes("$CRDD_NODE"), false);
  assert.equal(readme.includes("$CRDD_COORDINATOR"), false);
  assert.equal(
    /<absolute-preverified-node-24\.12\+-executable> 40_Develop\/coordinator\/scripts\/(?:generate-release-key|sign-release-manifest)\.ts/u.test(
      readme,
    ),
    false,
  );
  assert.equal(readme.includes("--runtime-root"), false);
  assert.match(readme, /coordinator\.ts" capabilities --json/u);
  assert.match(
    readme,
    /"<selected-verified-checkout-root>\\40_Develop\\coordinator\\scripts\\verify-general-task\.ts"/u,
  );
  assert.match(
    readme,
    /Coordinator固有のRelease鍵生成、Manifest準備・署名・昇格と配布Tree固定検査は撤去した/u,
  );
  assert.doesNotMatch(
    readme,
    /scripts\\\\(?:generate-release-key|sign-release-manifest)\.ts/u,
  );
  assert.equal(
    /```powershell\r?\n& <absolute-preverified-node/u.test(readme),
    false,
  );
});
