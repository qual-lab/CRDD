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
import { pathToFileURL } from "node:url";
import {
  createDockerCliEnvironment,
  createDockerDesktopRepairHelperEnvironment,
  createWindowsPowerShellAuthenticodeEnvironment,
} from "../../../docker-isolation/src/docker-cli/environment.ts";
import {
  createChildProcessEnvironment,
  deriveWindowsSystemDrive,
} from "../../../platform-access/src/index.ts";
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
  for (const [kind, environment] of [
    ["console", createChildProcessEnvironment({ platform: "win32" })],
    ["supervisor", createChildProcessEnvironment({ platform: "win32" })],
    [
      "native",
      createChildProcessEnvironment({ platform: "win32", userProfile: true }),
    ],
  ] as const) {
    assert.ok(environment);
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify({keys:Object.keys(process.env).sort(),neutral:Object.entries(process.env).filter(([k])=>!['SYSTEMROOT','WINDIR','USERPROFILE'].includes(k.toUpperCase())).every(([,v])=>v===''),systemRoot:process.env.SystemRoot,windir:process.env.WINDIR,userProfile:process.env.USERPROFILE}))",
      ],
      {
        shell: false,
        env: environment,
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.neutral, true);
    assert.deepEqual(
      [
        ...new Set(observed.keys.map((key: string) => key.toUpperCase())),
      ].sort(),
      [
        ...new Set(Object.keys(environment).map((key) => key.toUpperCase())),
      ].sort(),
    );
    assert.equal(
      observed.keys.length,
      new Set(observed.keys.map((key: string) => key.toUpperCase())).size,
    );
    assert.equal(typeof observed.systemRoot, "string");
    assert.equal(observed.systemRoot.length > 0, true);
    assert.equal(observed.windir, observed.systemRoot);
    assert.equal(
      observed.userProfile,
      kind === "native" ? path.win32.normalize(os.userInfo().homedir) : "",
    );
    assert.equal(
      observed.keys.includes("SystemRoot") ||
        observed.keys.includes("SYSTEMROOT"),
      true,
    );
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

  assert.deepEqual(
    createDockerDesktopRepairHelperEnvironment(getIsolationSettings()),
    {
      ...createChildProcessEnvironment({
        platform: "win32",
        userProfile: true,
      }),
      SYSTEMDRIVE: deriveWindowsSystemDrive(
        createChildProcessEnvironment({ platform: "win32", userProfile: true })
          ?.SystemRoot,
      ),
    },
  );
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
 * 中立化した親ProcessからもAuthenticode検査用PowerShellを初期化できるを検証する。
 *
 * @responsibility 中立化した親ProcessからもAuthenticode検査用PowerShellを初期化できるの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 中立化した親ProcessからもAuthenticode検査用PowerShellを初期化できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("中立化した親ProcessからもAuthenticode検査用PowerShellを初期化できる", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows contract");
    return;
  }
  const parentEnvironment = createChildProcessEnvironment();
  assert.ok(parentEnvironment);
  const profile = fs.realpathSync.native(os.userInfo().homedir);
  const temporary = fs.realpathSync.native(
    path.join(profile, "AppData", "Local", "Temp"),
  );
  const moduleUrl = pathToFileURL(
    path.join(
      coordinatorRoot,
      "../docker-isolation/src/docker-cli/environment.ts",
    ),
  ).href;
  const source = [
    'import { spawnSync } from "node:child_process";',
    'import path from "node:path";',
    `import { createWindowsPowerShellAuthenticodeEnvironment } from ${JSON.stringify(moduleUrl)};`,
    `const environment=createWindowsPowerShellAuthenticodeEnvironment(${JSON.stringify(getIsolationSettings())});`,
    "if(!environment)process.exit(3);",
    "const powershell=path.win32.join(environment.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');",
    "const result=spawnSync(powershell,['-NoLogo','-NoProfile','-NonInteractive','-Command',\"Get-Command Get-AuthenticodeSignature | Out-Null; Write-Output 'CRDD_NESTED_AUTHENTICODE_OK'\"],{cwd:environment.SystemRoot,env:environment,encoding:'utf8',windowsHide:true,timeout:5000});",
    "process.stdout.write(JSON.stringify({status:result.status,signal:result.signal,stdout:result.stdout,stderr:result.stderr,error:result.error?.message??null}));",
  ].join("");
  const nested = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    {
      cwd: coordinatorRoot,
      env: { ...parentEnvironment, TEMP: temporary, TMP: temporary },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    },
  );
  assert.equal(nested.status, 0, nested.stderr);
  assert.equal(nested.stderr, "");
  assert.deepEqual(JSON.parse(nested.stdout), {
    status: 0,
    signal: null,
    stdout: "CRDD_NESTED_AUTHENTICODE_OK\r\n",
    stderr: "",
    error: null,
  });
});

/**
 * Docker修復専用のOS driveは非C driveを受理し曖昧Pathを拒否するを検証する。
 *
 * @responsibility Docker修復専用のOS driveは非C driveを受理し曖昧Pathを拒否するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker修復専用のOS driveは非C driveを受理し曖昧Pathを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker修復専用のOS driveは非C driveを受理し曖昧Pathを拒否する", () => {
  assert.equal(deriveWindowsSystemDrive("D:\\Windows"), "D:");
  assert.equal(deriveWindowsSystemDrive("c:\\Windows"), "c:");
  for (const value of [
    null,
    "",
    "C:",
    "C:\\",
    "C:Windows",
    "\\Windows",
    "\\\\host\\Windows",
    "C:\\a\\..\\Windows",
    "C:/Windows",
    "C:\\Windows\0",
  ]) {
    assert.equal(deriveWindowsSystemDrive(value), null);
  }
});

/**
 * Docker修復の実子は親のSYSTEMDRIVEを継承せず他用途はneutralを維持するを検証する。
 *
 * @responsibility Docker修復の実子は親のSYSTEMDRIVEを継承せず他用途はneutralを維持するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker修復の実子は親のSYSTEMDRIVEを継承せず他用途はneutralを維持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker修復の実子は親のSYSTEMDRIVEを継承せず他用途はneutralを維持する", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows contract");
    return;
  }
  const before = process.env.SYSTEMDRIVE;
  try {
    process.env.SYSTEMDRIVE = "Z:";
    const environment = createDockerDesktopRepairHelperEnvironment(
      getIsolationSettings(),
    );
    assert.ok(environment);
    assert.equal(
      environment.SYSTEMDRIVE,
      deriveWindowsSystemDrive(environment.SystemRoot),
    );
    assert.equal(
      createChildProcessEnvironment({ platform: "win32", userProfile: true })
        ?.SYSTEMDRIVE,
      "",
    );
    assert.equal(
      (
        createChildProcessEnvironment({ platform: "win32" }) as Readonly<
          Record<string, string>
        >
      )?.SYSTEMDRIVE,
      "",
    );
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify({drive:process.env.SYSTEMDRIVE,neutral:Object.entries(process.env).filter(([k])=>!['SYSTEMROOT','WINDIR','USERPROFILE','SYSTEMDRIVE'].includes(k.toUpperCase())).every(([,v])=>v==='')}))",
      ],
      {
        env: environment,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 5000,
      },
    );
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      drive: environment.SYSTEMDRIVE,
      neutral: true,
    });
  } finally {
    if (before === undefined) delete process.env.SYSTEMDRIVE;
    else process.env.SYSTEMDRIVE = before;
  }
});

/**
 * Windows directoryの親環境差替えを子Environment Authorityにしないを検証する。
 *
 * @responsibility Windows directoryの親環境差替えを子Environment Authorityにしないの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows directoryの親環境差替えを子Environment Authorityにしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows directoryの親環境差替えを子Environment Authorityにしない", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-fake-windows-"));
  const system32 = path.join(root, "System32");
  fs.mkdirSync(system32);
  fs.copyFileSync(
    path.join(String(process.env.SystemRoot), "System32", "kernel32.dll"),
    path.join(system32, "kernel32.dll"),
  );
  const originalSystemRoot = process.env.SystemRoot;
  const originalWindir = process.env.WINDIR;
  const originalUserProfile = process.env.USERPROFILE;
  try {
    process.env.SystemRoot = root;
    process.env.WINDIR = root;
    process.env.USERPROFILE = root;
    const consoleEnvironment = createChildProcessEnvironment({
      platform: "win32",
    });
    const nativeEnvironment = createChildProcessEnvironment({
      platform: "win32",
      userProfile: true,
    });
    assert.ok(consoleEnvironment);
    assert.ok(nativeEnvironment);
    const consoleValues = consoleEnvironment as Readonly<
      Record<string, string>
    >;
    const nativeValues = nativeEnvironment as Readonly<Record<string, string>>;
    assert.equal(consoleValues.SystemRoot, originalSystemRoot);
    assert.equal(consoleValues.WINDIR, originalSystemRoot);
    assert.equal(consoleValues.USERPROFILE, "");
    assert.equal(nativeValues.SystemRoot, originalSystemRoot);
    assert.equal(nativeValues.WINDIR, originalSystemRoot);
    assert.equal(
      nativeValues.USERPROFILE,
      path.win32.normalize(os.userInfo().homedir),
    );
    assert.notEqual(
      nativeValues.USERPROFILE.toLocaleLowerCase("en-US"),
      root.toLocaleLowerCase("en-US"),
    );
    const result = spawnSync(
      process.execPath,
      ["-e", "process.stdout.write(String(process.env.SystemRoot))"],
      {
        shell: false,
        env: consoleEnvironment,
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(
      result.stdout.toLocaleLowerCase("en-US"),
      root.toLocaleLowerCase("en-US"),
    );
  } finally {
    if (originalSystemRoot === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = originalSystemRoot;
    if (originalWindir === undefined) delete process.env.WINDIR;
    else process.env.WINDIR = originalWindir;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    fs.rmSync(path.join(system32, "kernel32.dll"));
    fs.rmdirSync(system32);
    fs.rmdirSync(root);
  }
});

/**
 * Windows OS Profile判定不能は親Profileへfallbackしないを検証する。
 *
 * @responsibility Windows OS Profile判定不能は親Profileへfallbackしないの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows OS Profile判定不能は親Profileへfallbackしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows OS Profile判定不能は親Profileへfallbackしない", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const fixture = path.join(
    coordinatorRoot,
    "tests",
    "fixtures",
    "windows-native-helper-profile-fault.ts",
  );
  for (const mode of [
    "user_info_error",
    "missing",
    "link",
    "realpath_mismatch",
  ]) {
    const result = spawnSync(process.execPath, [fixture, mode], {
      shell: false,
      encoding: "utf8",
      timeout: 5_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      mode,
      environmentIsNull: true,
      parentEnvironmentFallbackUsed: false,
      cleanupConfirmed: true,
    });
  }
});

/**
 * Native Helper環境不成立は全利用側をspawn・Effect・Authority 0へ閉じるを検証する。
 *
 * @responsibility Native Helper環境不成立は全利用側をspawn・Effect・Authority 0へ閉じるの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Native Helper環境不成立は全利用側をspawn・Effect・Authority 0へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Native Helper環境不成立は全利用側をspawn・Effect・Authority 0へ閉じる", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const fixture = path.join(
    coordinatorRoot,
    "tests",
    "fixtures",
    "windows-native-helper-environment-unavailable.ts",
  );
  const result = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--no-warnings", fixture],
    {
      shell: false,
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    outcomes: 3,
    spawnCalls: 0,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    authorityIssued: false,
    capabilityIssued: false,
    manualRecoveryRequired: false,
  });
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
    path.resolve(coordinatorRoot, "../platform-access/src"),
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
    ...sourceFiles(path.resolve(coordinatorRoot, "../platform-access/src")),
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
      "40_Develop/platform-access/src/filesystem/root.ts",
      "40_Develop/platform-access/src/filesystem/system-directory.ts",
      "40_Develop/platform-access/src/filesystem/entry.ts",
      "40_Develop/platform-access/src/filesystem/local-app-data.ts",
      "40_Develop/docker-isolation/src/cleanup/execute.ts",
      "40_Develop/docker-isolation/src/cleanup/container.ts",
      "40_Develop/docker-isolation/src/docker-cli/trust.ts",
      "40_Develop/docker-isolation/src/process/start.ts",
      "40_Develop/docker-isolation/src/docker-desktop/backend.ts",
      "40_Develop/docker-isolation/src/docker-desktop/engine.ts",
      "40_Develop/platform-access/src/docker-desktop/protocol.ts",
      "40_Develop/platform-access/src/docker-desktop/native-process.ts",
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
