import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseDoctorArguments } from "../src/core/cli-options.mjs";

const COORDINATOR_EXECUTABLE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), "../bin/coordinator.mjs"
);

test("doctor CLIはruntime enable要求とCLI優先を一度だけ正規化する", () => {
  const cliRoot = path.resolve("cli-root");
  const environmentRoot = path.resolve("environment-root");
  const parsed = parseDoctorArguments([
    "--json", "--enable-runtime", "--runtime-root", cliRoot
  ], environmentRoot);
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.value.json, true);
  assert.equal(parsed.value.runtimeRootRequest.cliOverride, cliRoot);
  assert.equal(parsed.value.runtimeRootRequest.environmentOverride, environmentRoot);
  assert.equal(parsed.value.runtimeRootRequest.activationIntent, "explicit_enable_request");
});

test("環境Rootは非opt-in時に検査入力へ渡さない", () => {
  const parsed = parseDoctorArguments([], "relative-or-invalid-environment-value");
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.value.runtimeRootRequest, null);
});

test("runtime-root単独、重複、未知、値欠落および余剰tokenを拒否する", () => {
  const absolute = path.resolve("runtime-root");
  for (const argumentsList of [
    ["--runtime-root", absolute],
    ["--json", "--json"],
    ["--enable-runtime", "--enable-runtime"],
    ["--enable-runtime", "--runtime-root", absolute, "--runtime-root", absolute],
    ["--runtime-root"],
    ["--runtime-root", "--json"],
    ["--unknown"],
    ["extra"]
  ]) assert.equal(parseDoctorArguments(argumentsList, undefined).status, "blocked");
});

test("recoveryはjson以外のisolationまたはRuntime処置と混在させない", () => {
  assert.equal(parseDoctorArguments(["--recover-isolation", "host.safe", "--json"], undefined).status, "ok");
  for (const argumentsList of [
    ["--recover-isolation", "host.safe", "--isolation"],
    ["--recover-isolation", "host.safe", "--enable-runtime"],
    ["--recover-isolation", "host.safe", "--runtime-root", path.resolve("runtime-root")],
    ["--recover-isolation", "host.safe", "--recover-isolation", "host.other"]
  ]) assert.equal(parseDoctorArguments(argumentsList, undefined).status, "blocked");
});

test("実CLIはenable要求を候補診断へ接続しPathを表示しない", (t) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cli-root-"));
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  const environment = { ...process.env };
  delete environment.CRDD_COORDINATOR_ROOT;
  const executable = COORDINATOR_EXECUTABLE;
  const result = spawnSync(process.execPath, [executable, "doctor", "--enable-runtime", "--json"], {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.runtimeRootEvaluation.status, "candidate");
  assert.equal(report.runtimeRootEvaluation.summary.location, "repository_default_location");
  assert.equal(report.status, "blocked");
  assert.equal(JSON.stringify(report).includes(repositoryRoot), false);
});

test("actual CLI applies environment override and CLI precedence without exposing paths", (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cli-precedence-"));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const repositoryRoot = path.join(fixtureRoot, "repository");
  const environmentRoot = path.join(fixtureRoot, "environment-runtime");
  const cliRoot = path.join(fixtureRoot, "cli-runtime");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(environmentRoot);
  fs.mkdirSync(cliRoot);
  const executable = COORDINATOR_EXECUTABLE;
  const environment = { ...process.env, CRDD_COORDINATOR_ROOT: environmentRoot };

  const environmentResult = spawnSync(process.execPath, [
    executable, "doctor", "--enable-runtime", "--json"
  ], { cwd: repositoryRoot, env: environment, encoding: "utf8", windowsHide: true });
  assert.equal(environmentResult.status, 2);
  const environmentReport = JSON.parse(environmentResult.stdout);
  assert.equal(environmentReport.runtimeRootEvaluation.summary.source, "environment_override");
  assert.equal(environmentReport.runtimeRootEvaluation.summary.location, "repository_external_override");

  const cliResult = spawnSync(process.execPath, [
    executable, "doctor", "--enable-runtime", "--runtime-root", cliRoot, "--json"
  ], { cwd: repositoryRoot, env: environment, encoding: "utf8", windowsHide: true });
  assert.equal(cliResult.status, 2);
  const cliReport = JSON.parse(cliResult.stdout);
  assert.equal(cliReport.runtimeRootEvaluation.summary.source, "cli_override");
  assert.equal(cliReport.runtimeRootEvaluation.summary.location, "repository_external_override");
  const serializedReports = `${environmentResult.stdout}\n${cliResult.stdout}`;
  assert.equal(serializedReports.includes(environmentRoot), false);
  assert.equal(serializedReports.includes(cliRoot), false);
  assert.equal(serializedReports.includes(repositoryRoot), false);
});

test("実CLIは不正grammarを処置前に安全なusage errorへ閉じる", () => {
  const executable = COORDINATOR_EXECUTABLE;
  const secretLikePath = path.resolve("do-not-report-this-path");
  const result = spawnSync(process.execPath, [
    executable, "doctor", "--runtime-root", secretLikePath, "--json"
  ], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 64);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "blocked",
    reason: "runtime_root_requires_enable_request"
  });
  assert.equal(result.stdout.includes(secretLikePath), false);
});
