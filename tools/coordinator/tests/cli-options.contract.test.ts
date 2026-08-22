import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseActivateArguments,
  parseDisableArguments,
  parseDoctorArguments,
  parseProvisionArguments,
} from "../src/core/cli-options.ts";
import { assertPresent } from "./test-support.ts";

const coordinatorExecutable = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../bin/coordinator.ts",
);

test("doctor CLIはruntime enable要求とCLI優先を一度だけ正規化する", () => {
  const cliRoot = path.resolve("cli-root");
  const environmentRoot = path.resolve("environment-root");
  const parsed = parseDoctorArguments(
    ["--json", "--enable-runtime", "--runtime-root", cliRoot],
    environmentRoot,
  );
  assert.equal(parsed.status, "ok");
  assertPresent(parsed.value);
  assertPresent(parsed.value.runtimeRootRequest);
  assert.equal(parsed.value.json, true);
  assert.equal(parsed.value.runtimeRootRequest.cliOverride, cliRoot);
  assert.equal(
    parsed.value.runtimeRootRequest.environmentOverride,
    environmentRoot,
  );
  assert.equal(
    parsed.value.runtimeRootRequest.activationIntent,
    "explicit_enable_request",
  );
});

test("環境Rootは非opt-in時に検査入力へ渡さない", () => {
  const parsed = parseDoctorArguments(
    [],
    "relative-or-invalid-environment-value",
  );
  assert.equal(parsed.status, "ok");
  assertPresent(parsed.value);
  assert.equal(parsed.value.runtimeRootRequest, null);
});

test("runtime-root単独、重複、未知、値欠落および余剰tokenを拒否する", () => {
  const absolute = path.resolve("runtime-root");
  for (const argumentValues of [
    ["--runtime-root", absolute],
    ["--json", "--json"],
    ["--enable-runtime", "--enable-runtime"],
    [
      "--enable-runtime",
      "--runtime-root",
      absolute,
      "--runtime-root",
      absolute,
    ],
    ["--runtime-root"],
    ["--runtime-root", "--json"],
    ["--unknown"],
    ["extra"],
  ])
    assert.equal(
      parseDoctorArguments(argumentValues, undefined).status,
      "blocked",
    );
});

test("recoveryはjson以外のisolationまたはRuntime処置と混在させない", () => {
  assert.equal(
    parseDoctorArguments(
      ["--recover-isolation", "host.safe", "--json"],
      undefined,
    ).status,
    "ok",
  );
  for (const argumentValues of [
    ["--recover-isolation", "host.safe", "--isolation"],
    ["--recover-isolation", "host.safe", "--enable-runtime"],
    [
      "--recover-isolation",
      "host.safe",
      "--runtime-root",
      path.resolve("runtime-root"),
    ],
    ["--recover-isolation", "host.safe", "--recover-isolation", "host.other"],
  ])
    assert.equal(
      parseDoctorArguments(argumentValues, undefined).status,
      "blocked",
    );
});

test("実CLIはenable要求を候補診断へ接続しPathを表示しない", (t) => {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-cli-root-"),
  );
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  const environment = { ...process.env };
  delete environment.CRDD_COORDINATOR_ROOT;
  const executable = coordinatorExecutable;
  const result = spawnSync(
    process.execPath,
    [executable, "doctor", "--enable-runtime", "--json"],
    {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.runtimeRootEvaluation.status, "candidate");
  assert.equal(
    report.runtimeRootEvaluation.summary.location,
    "repository_default_location",
  );
  assert.equal(report.status, "blocked");
  assert.equal(JSON.stringify(report).includes(repositoryRoot), false);
});

test("actual CLI applies environment override and CLI precedence without exposing paths", (t) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-cli-precedence-"),
  );
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const repositoryRoot = path.join(fixtureRoot, "repository");
  const environmentRoot = path.join(fixtureRoot, "environment-runtime");
  const cliRoot = path.join(fixtureRoot, "cli-runtime");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(environmentRoot);
  fs.mkdirSync(cliRoot);
  const executable = coordinatorExecutable;
  const environment = {
    ...process.env,
    CRDD_COORDINATOR_ROOT: environmentRoot,
  };

  const environmentResult = spawnSync(
    process.execPath,
    [executable, "doctor", "--enable-runtime", "--json"],
    {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(environmentResult.status, 2);
  const environmentReport = JSON.parse(environmentResult.stdout);
  assert.equal(
    environmentReport.runtimeRootEvaluation.summary.source,
    "environment_override",
  );
  assert.equal(
    environmentReport.runtimeRootEvaluation.summary.location,
    "repository_external_override",
  );

  const cliResult = spawnSync(
    process.execPath,
    [
      executable,
      "doctor",
      "--enable-runtime",
      "--runtime-root",
      cliRoot,
      "--json",
    ],
    {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(cliResult.status, 2);
  const cliReport = JSON.parse(cliResult.stdout);
  assert.equal(cliReport.runtimeRootEvaluation.summary.source, "cli_override");
  assert.equal(
    cliReport.runtimeRootEvaluation.summary.location,
    "repository_external_override",
  );
  const serializedReports = `${environmentResult.stdout}\n${cliResult.stdout}`;
  assert.equal(serializedReports.includes(environmentRoot), false);
  assert.equal(serializedReports.includes(cliRoot), false);
  assert.equal(serializedReports.includes(repositoryRoot), false);
});

test("実CLIは不正grammarを処置前に安全なusage errorへ閉じる", () => {
  const executable = coordinatorExecutable;
  const secretLikePath = path.resolve("do-not-report-this-path");
  const result = spawnSync(
    process.execPath,
    [executable, "doctor", "--runtime-root", secretLikePath, "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 64);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "blocked",
    reason: "runtime_root_requires_enable_request",
  });
  assert.equal(result.stdout.includes(secretLikePath), false);
});

test("activateはRuntime RootとAuthority RootをCLI優先で正規化する", () => {
  const cliRuntime = path.resolve("cli-runtime");
  const envRuntime = path.resolve("env-runtime");
  const cliAuthority = path.resolve("cli-authority");
  const envAuthority = path.resolve("env-authority");
  const parsed = parseActivateArguments(
    ["--json", "--runtime-root", cliRuntime, "--authority-root", cliAuthority],
    envRuntime,
    envAuthority,
  );
  assert.equal(parsed.status, "ok");
  assertPresent(parsed.value);
  assertPresent(parsed.value.runtimeRootRequest);
  assertPresent(parsed.value.authorityRootRequest);
  assert.equal(parsed.value.runtimeRootRequest.cliOverride, cliRuntime);
  assert.equal(parsed.value.runtimeRootRequest.environmentOverride, null);
  assert.equal(parsed.value.authorityRootRequest.cliOverride, cliAuthority);
  assert.equal(parsed.value.authorityRootRequest.environmentOverride, null);
  assert.equal(
    parsed.value.authorityRootRequest.activationIntent,
    "explicit_activate_request",
  );
});

test("activateはAuthority Root欠落と不正環境値をusage errorと区別する", () => {
  const missing = parseActivateArguments([], undefined, undefined);
  assert.equal(missing.status, "blocked");
  assert.equal(missing.reason, "authority_root_explicit_path_required");
  assert.equal(missing.usageError, false);

  for (const parsed of [
    parseActivateArguments([], "relative-runtime", path.resolve("authority")),
    parseActivateArguments([], undefined, "relative-authority"),
  ]) {
    assert.equal(parsed.status, "blocked");
    assert.equal(parsed.usageError, false);
  }
});

test("activateとdisableはcommand固有grammarを厳密に分離する", () => {
  const root = path.resolve("runtime");
  const authority = path.resolve("authority");
  for (const args of [
    ["--json", "--json"],
    ["--runtime-root"],
    ["--runtime-root", "relative"],
    ["--runtime-root", root, "--runtime-root", root],
    ["--authority-root", authority, "--authority-root", authority],
    ["--enable-runtime"],
    ["--recover-isolation", "host.safe"],
    ["--runtime-root", path.resolve("bad\nroot")],
    [
      "--runtime-root",
      `${path.parse(path.resolve("root")).root}${"x".repeat(4_097)}`,
    ],
    ["extra"],
  ]) {
    const parsed = parseActivateArguments(args, undefined, authority);
    assert.equal(parsed.status, "blocked");
    assert.equal(parsed.usageError, true);
  }
  for (const args of [
    ["--authority-root", authority],
    ["--isolation"],
    ["--enable-runtime"],
    ["--runtime-root", root, "extra"],
  ]) {
    const parsed = parseDisableArguments(args, undefined);
    assert.equal(parsed.status, "blocked");
    assert.equal(parsed.usageError, true);
  }
});

test("disableはRuntime RootのCLI、環境、Repository既定候補を分離する", () => {
  const cliRoot = path.resolve("cli-runtime");
  const envRoot = path.resolve("env-runtime");
  const cli = parseDisableArguments(["--runtime-root", cliRoot], envRoot);
  assert.equal(cli.status, "ok");
  assertPresent(cli.value);
  assert.equal(cli.value.runtimeRootRequest.cliOverride, cliRoot);
  assert.equal(cli.value.runtimeRootRequest.environmentOverride, null);
  assert.equal(cli.value.authorityRootRequest, null);

  const fallback = parseDisableArguments([], undefined);
  assert.equal(fallback.status, "ok");
  assertPresent(fallback.value);
  assert.equal(fallback.value.runtimeRootRequest.cliOverride, null);
  assert.equal(fallback.value.runtimeRootRequest.environmentOverride, null);
});

test("CLI overrideは同じRoot軸の不正環境値だけを選択対象外にする", () => {
  const runtimeRoot = path.resolve("runtime");
  const authorityRoot = path.resolve("authority");

  const bothCli = parseActivateArguments(
    ["--runtime-root", runtimeRoot, "--authority-root", authorityRoot],
    "invalid-runtime",
    "invalid-authority",
  );
  assert.equal(bothCli.status, "ok");
  assertPresent(bothCli.value);
  assertPresent(bothCli.value.authorityRootRequest);
  assert.equal(bothCli.value.runtimeRootRequest.environmentOverride, null);
  assert.equal(bothCli.value.authorityRootRequest.environmentOverride, null);

  assert.equal(
    parseActivateArguments(
      ["--runtime-root", runtimeRoot],
      "invalid-runtime",
      "invalid-authority",
    ).reason,
    "authority_root_environment_invalid",
  );
  assert.equal(
    parseActivateArguments(
      ["--authority-root", authorityRoot],
      "invalid-runtime",
      "invalid-authority",
    ).reason,
    "runtime_root_environment_invalid",
  );

  const disable = parseDisableArguments(
    ["--runtime-root", runtimeRoot],
    "invalid-runtime",
  );
  assert.equal(disable.status, "ok");
  assertPresent(disable.value);
  assert.equal(disable.value.runtimeRootRequest.environmentOverride, null);
});

test("実activateとdisableはPathを表示せずEffect未実装でblockedにする", () => {
  const executable = coordinatorExecutable;
  const runtimeRoot = path.resolve("do-not-report-runtime");
  const authorityRoot = path.resolve("do-not-report-authority");
  const environment = {
    ...process.env,
    CRDD_COORDINATOR_ROOT: runtimeRoot,
    CRDD_COORDINATOR_AUTHORITY_ROOT: authorityRoot,
  };
  for (const command of ["activate", "disable"]) {
    const result = spawnSync(
      process.execPath,
      [executable, command, "--json"],
      {
        env: environment,
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "blocked");
    assert.equal(report.command, command);
    assert.equal(report.runtimeCapabilityIssued, false);
    assert.equal(result.stdout.includes(runtimeRoot), false);
    assert.equal(result.stdout.includes(authorityRoot), false);
  }
});

test("activateとdisableの妥当な要求はFilesystem内容を変更しない", (t) => {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-control-no-effect-"),
  );
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const repository = path.join(fixture, "repository");
  const runtimeRoot = path.join(repository, ".crdd-runtime");
  const authorityRoot = path.join(fixture, "authority");
  fs.mkdirSync(repository);
  const beforeEntries = fs.readdirSync(fixture).sort();
  const environment = {
    ...process.env,
    CRDD_COORDINATOR_AUTHORITY_ROOT: authorityRoot,
  };
  for (const command of ["activate", "disable"]) {
    const result = spawnSync(
      process.execPath,
      [coordinatorExecutable, command, "--runtime-root", runtimeRoot, "--json"],
      {
        cwd: repository,
        env: environment,
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(result.status, 2);
  }
  assert.deepEqual(fs.readdirSync(fixture).sort(), beforeEntries);
  assert.equal(fs.existsSync(runtimeRoot), false);
  assert.equal(fs.existsSync(authorityRoot), false);
});

test("実activateは選択不成立をexit 2、CLI誤用をexit 64で返す", () => {
  const executable = coordinatorExecutable;
  const environment = { ...process.env };
  delete environment.CRDD_COORDINATOR_ROOT;
  delete environment.CRDD_COORDINATOR_AUTHORITY_ROOT;
  const missing = spawnSync(
    process.execPath,
    [executable, "activate", "--json"],
    {
      env: environment,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(missing.status, 2);
  assert.equal(
    JSON.parse(missing.stdout).reason,
    "authority_root_explicit_path_required",
  );

  const invalid = spawnSync(
    process.execPath,
    [
      executable,
      "disable",
      "--authority-root",
      path.resolve("secret-authority"),
      "--json",
    ],
    { env: environment, encoding: "utf8", windowsHide: true },
  );
  assert.equal(invalid.status, 64);
  assert.equal(JSON.parse(invalid.stdout).reason, "disable_arguments_invalid");
  assert.equal(invalid.stdout.includes("secret-authority"), false);
});

test("実CLIはshadowed環境値を無視し選択対象の不正環境値だけをblockedにする", () => {
  const executable = coordinatorExecutable;
  const runtimeRoot = path.resolve("runtime-cli");
  const authorityRoot = path.resolve("authority-cli");
  const invalidEnvironment = {
    ...process.env,
    CRDD_COORDINATOR_ROOT: "invalid-runtime",
    CRDD_COORDINATOR_AUTHORITY_ROOT: "invalid-authority",
  };
  const activate = spawnSync(
    process.execPath,
    [
      executable,
      "activate",
      "--runtime-root",
      runtimeRoot,
      "--authority-root",
      authorityRoot,
      "--json",
    ],
    { env: invalidEnvironment, encoding: "utf8", windowsHide: true },
  );
  assert.equal(activate.status, 2);
  assert.equal(
    JSON.parse(activate.stdout).reason,
    "runtime_activation_effect_not_implemented",
  );

  const disable = spawnSync(
    process.execPath,
    [executable, "disable", "--runtime-root", runtimeRoot, "--json"],
    { env: invalidEnvironment, encoding: "utf8", windowsHide: true },
  );
  assert.equal(disable.status, 2);
  assert.equal(
    JSON.parse(disable.stdout).reason,
    "runtime_disable_effect_not_implemented",
  );

  const badAuthority = spawnSync(
    process.execPath,
    [executable, "activate", "--runtime-root", runtimeRoot, "--json"],
    { env: invalidEnvironment, encoding: "utf8", windowsHide: true },
  );
  assert.equal(badAuthority.status, 2);
  assert.equal(
    JSON.parse(badAuthority.stdout).reason,
    "authority_root_environment_invalid",
  );

  const badRuntime = spawnSync(
    process.execPath,
    [executable, "activate", "--authority-root", authorityRoot, "--json"],
    { env: invalidEnvironment, encoding: "utf8", windowsHide: true },
  );
  assert.equal(badRuntime.status, 2);
  assert.equal(
    JSON.parse(badRuntime.stdout).reason,
    "runtime_root_environment_invalid",
  );
});

test("安全にsnapshotできた不正tokenでもJSON要求と非漏洩を維持する", () => {
  const executable = coordinatorExecutable;
  const invalidValues = [
    "line\nbreak",
    `del${String.fromCharCode(0x7f)}value`,
    "x".repeat(4_097),
  ];
  for (const command of ["activate", "disable"]) {
    for (const value of invalidValues) {
      const result = spawnSync(
        process.execPath,
        [executable, command, "--json", "--runtime-root", value],
        { encoding: "utf8", windowsHide: true },
      );
      assert.equal(result.status, 64);
      assert.equal(
        JSON.parse(result.stdout).reason,
        `${command}_arguments_invalid`,
      );
      assert.equal(result.stdout.includes(value), false);
    }
  }
  const nonJson = spawnSync(
    process.execPath,
    [executable, "disable", "--runtime-root", "line\nbreak"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(nonJson.status, 64);
  assert.equal(nonJson.stdout.startsWith("Coordinator disable: blocked"), true);
  assert.equal(nonJson.stdout.includes("line\nbreak"), false);
});

test("provisionは明示commandだけを受理しローカルbuildではEffect前にblockedとなる", () => {
  assert.equal(parseProvisionArguments([]).status, "ok");
  const jsonProvision = parseProvisionArguments(["--json"]);
  assertPresent(jsonProvision.value);
  assert.equal(jsonProvision.value.json, true);
  assert.equal(
    parseProvisionArguments(["--runtime-root", path.resolve("runtime")]).status,
    "blocked",
  );

  const result = spawnSync(
    process.execPath,
    [coordinatorExecutable, "provision", "--json"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(
    report.reason,
    "pre_active_native_provision_supervisor_not_implemented",
  );
  assert.equal(report.crddDistributionConfirmed, false);
  assert.equal(report.qualLabManifestTrustConfirmed, false);
  assert.equal(report.filesystemEffectIssued, false);

  const invalid = spawnSync(
    process.execPath,
    [coordinatorExecutable, "provision", "--json", "--unknown"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(invalid.status, 64);
  assert.equal(
    JSON.parse(invalid.stdout).reason,
    "provision_arguments_invalid",
  );
});

test("helpはProvision Effect未実装と処置前blockedを一意に表示する", () => {
  const outputs = ["help", "--help", "-h"].map((argumentValue) => {
    const result = spawnSync(
      process.execPath,
      [coordinatorExecutable, argumentValue],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout.includes(
        "provision installs only a verified signed CRDD distribution",
      ),
      false,
    );
    const expected =
      "provision command grammar is an implementation candidate; the Provision Effect is not implemented and is blocked before distribution reads, time access, path resolution, or filesystem effects.";
    assert.equal(result.stdout.split(expected).length - 1, 1);
    return result.stdout;
  });
  assert.equal(outputs[1], outputs[0]);
  assert.equal(outputs[2], outputs[0]);
});
