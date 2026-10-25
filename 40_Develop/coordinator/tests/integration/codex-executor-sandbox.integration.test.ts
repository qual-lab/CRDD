/**
 * Codex ExecutorのFilesystem制限を実Containerで確認する。
 * @packageDocumentation
 * @responsibility Codex固有sandboxとseccompの検証をCoordinator側へ保持する。
 * @trace ERB-IT-002
 * @level IT
 * @scope Codex CLI sandbox。汎用Process所有試験とは分離する。
 * @boundary Host→固定Codex Image→試験Workspace。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "../../../docker-isolation/src/index.ts";
import { planProviderExecution } from "../../../ai-adapter/src/index.ts";
const codex = describeDockerProviderAssets("codex");
const CODEX_IMAGE_DIGEST = codex.fixedImageDigest;
const codexSeccompProfile = fileURLToPath(
  new URL(
    "../../../docker-isolation/src/execution/codex-executor-seccomp.json",
    import.meta.url,
  ),
);
/**
 * Host Windows: Codex Executor SandboxはWorkspaceだけを書込み可能にするを検証する。
 *
 * @responsibility Host Windows: Codex Executor SandboxはWorkspaceだけを書込み可能にするの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Windows: Codex Executor SandboxはWorkspaceだけを書込み可能にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Windows: Codex Executor SandboxはWorkspaceだけを書込み可能にする", {
  skip: process.platform !== "win32",
  timeout: 60_000,
}, (t) => {
  const testsRoot = fileURLToPath(
    new URL("../../../../.crdd/tests/", import.meta.url),
  );
  fs.mkdirSync(testsRoot, { recursive: true });
  assert.equal(fs.lstatSync(testsRoot).isSymbolicLink(), false);
  const root = fs.mkdtempSync(path.join(testsRoot, "crdd-codex-sandbox-"));
  const rootIdentity = fs.lstatSync(root, { bigint: true });
  let containerId: string | null = null;
  let createIssued = false;
  let cleanupConfirmed = false;
  t.after(() => {
    try {
      if (containerId !== null) {
        const inspected = childProcess.spawnSync(
          "docker",
          ["inspect", "--format", "{{.State.Running}}", containerId],
          { encoding: "utf8", windowsHide: true },
        );
        assert.equal(inspected.status, 0);
        if (inspected.stdout.trim() === "true") {
          assert.equal(
            childProcess.spawnSync(
              "docker",
              ["stop", "--time", "5", containerId],
              { windowsHide: true },
            ).status,
            0,
          );
        }
        assert.equal(
          childProcess.spawnSync("docker", ["rm", containerId], {
            windowsHide: true,
          }).status,
          0,
        );
        const remaining = childProcess.spawnSync(
          "docker",
          [
            "ps",
            "-a",
            "--no-trunc",
            "--filter",
            `id=${containerId}`,
            "--format",
            "{{.ID}}",
          ],
          { encoding: "utf8", windowsHide: true },
        );
        assert.equal(remaining.status, 0);
        assert.equal(remaining.stdout.trim(), "");
        cleanupConfirmed = true;
      }
    } finally {
      if (!createIssued || cleanupConfirmed) {
        assert.equal(fs.realpathSync.native(root), path.resolve(root));
        const current = fs.lstatSync(root, { bigint: true });
        assert.equal(current.isSymbolicLink(), false);
        assert.equal(current.dev, rootIdentity.dev);
        assert.equal(current.ino, rootIdentity.ino);
        assert.equal(path.dirname(path.resolve(root)), path.resolve(testsRoot));
        fs.rmSync(root, { force: true, recursive: true });
        assert.equal(fs.existsSync(root), false);
      } else {
        t.diagnostic(
          JSON.stringify({
            reason: "sandbox_fixture_cleanup_unconfirmed",
            root,
            containerId,
            cleanupConfirmed: false,
            reevaluateAfterDays: 7,
          }),
        );
      }
    }
  });
  const workspace = path.join(root, "workspace");
  const providerHome = path.join(root, "provider-home");
  const temporaryDirectory = path.join(root, "tmp");
  fs.mkdirSync(workspace);
  fs.mkdirSync(providerHome);
  fs.mkdirSync(temporaryDirectory);
  fs.writeFileSync(
    path.join(workspace, "probe.py"),
    [
      "from pathlib import Path",
      'Path("/work/workspace-result.txt").write_text("WORKSPACE_WRITE_OK\\n", encoding="utf-8")',
      "try:",
      '    Path("/provider-home/sentinel.txt").read_text(encoding="utf-8")',
      "except Exception:",
      '    Path("/work/provider-home-read-result.txt").write_text("DENIED\\n", encoding="utf-8")',
      "else:",
      '    Path("/work/provider-home-read-result.txt").write_text("READABLE\\n", encoding="utf-8")',
      "try:",
      '    Path("/provider-home/sentinel.txt").write_text("CHANGED\\n", encoding="utf-8")',
      "except Exception:",
      '    Path("/work/provider-home-write-result.txt").write_text("DENIED\\n", encoding="utf-8")',
      "else:",
      '    Path("/work/provider-home-write-result.txt").write_text("WRITABLE\\n", encoding="utf-8")',
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(providerHome, "sentinel.txt"),
    "PROVIDER_HOME_SENTINEL\n",
    "utf8",
  );
  const containerName = `crdd-codex-sandbox-${path
    .basename(root)
    .slice(-12)
    .toLowerCase()}`;
  const plan = planProviderExecution(
    {
      provider: "codex",
      purpose: "task",
      modelSelection: {
        provider: "codex",
        modelIdentifier: "gpt-6.1-sol",
        identifierKind: "exact",
        reasoningEffort: "medium",
      },
      input: {
        provider: "codex",
        mode: "isolated_task",
        effort: "medium",
        taskRole: "executor",
      },
    },
    describeDockerProviderExecutionLocations("codex", "task"),
  );
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") throw new Error("fixture_plan_blocked");
  const permissions: string[] = [];
  for (let index = 0; index < plan.plan.argv.length; index++) {
    if (
      plan.plan.argv[index] === "--config" &&
      /^(default_permissions|permissions\.)/u.test(
        plan.plan.argv[index + 1] ?? "",
      )
    )
      permissions.push("--config", plan.plan.argv[index + 1] as string);
  }
  assert.equal(plan.plan.exactModel, "gpt-6.1-sol");
  assert.ok(
    plan.plan.argv.includes(
      "features.code_mode_host={enabled=true,disable_in_process_fallback=true}",
    ),
  );

  createIssued = true;
  const result = childProcess.spawnSync(
    "docker",
    [
      "create",
      "--name",
      containerName,
      "--pull=never",
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      `--security-opt=seccomp=${codexSeccompProfile}`,
      "--user=65534:65534",
      "--workdir=/work",
      "--mount",
      `type=bind,src=${temporaryDirectory},dst=/tmp`,
      "--mount",
      `type=bind,src=${workspace},dst=/work`,
      "--mount",
      `type=bind,src=${providerHome},dst=/provider-home`,
      "--entrypoint=/bin/sh",
      CODEX_IMAGE_DIGEST,
      "-c",
      '/opt/crdd/providers/codex/0.164.0/codex-code-mode-host --help >/tmp/host-help.txt 2>&1; host_status=$?; printf "%s" "$host_status" > /work/host-exit.txt; exec "$@"',
      "--",
      codex.identity.executablePath,
      "sandbox",
      "--permission-profile",
      "crdd-executor",
      "--include-managed-config",
      ...permissions,
      "--cd",
      "/work",
      "python3",
      "/work/probe.py",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  const createdId = result.stdout.trim();
  assert.match(createdId, /^[a-f0-9]{64}$/u);
  containerId = createdId;
  const started = childProcess.spawnSync(
    "docker",
    ["start", "-a", containerId],
    { encoding: "utf8", windowsHide: true, timeout: 40_000 },
  );
  assert.equal(started.error, undefined);
  assert.equal(started.status, 0, started.stderr);
  const final = childProcess.spawnSync(
    "docker",
    [
      "inspect",
      "--format",
      "{{.State.Running}} {{.State.ExitCode}} {{.HostConfig.NetworkMode}} {{.HostConfig.ReadonlyRootfs}}",
      containerId,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(final.status, 0);
  assert.equal(final.stdout.trim(), "false 0 none true");
  assert.equal(
    fs.readFileSync(path.join(workspace, "host-exit.txt"), "utf8"),
    "0",
  );
  assert.equal(
    fs.readFileSync(path.join(workspace, "workspace-result.txt"), "utf8"),
    "WORKSPACE_WRITE_OK\n",
  );
  assert.equal(
    fs.readFileSync(
      path.join(workspace, "provider-home-read-result.txt"),
      "utf8",
    ),
    "DENIED\n",
  );
  assert.equal(
    fs.readFileSync(
      path.join(workspace, "provider-home-write-result.txt"),
      "utf8",
    ),
    "DENIED\n",
  );
  assert.equal(
    fs.readFileSync(path.join(providerHome, "sentinel.txt"), "utf8"),
    "PROVIDER_HOME_SENTINEL\n",
  );
});

/**
 * 試験自体の早期失敗でも未検証IDを使わず、清掃又は明示保持へ閉じる。
 * @responsibility 実Dockerを使わず試験入口の失敗後処理を反証する。
 * @trace ERB-IT-002
 * @precondition 現在の試験Sourceとメモリ内Filesystem・Process代役だけを使う。
 * @stimulus 作成前失敗、create非0、不正stdout、inspect失敗を注入する。
 * @observation Docker操作列、Rootの存在、保持診断。
 * @oracle 要求前はRoot回収、結果不明はRoot明示保持、未検証IDや名前による削除0。
 * @cleanup N/A: メモリ代役だけで実資源を作らない。
 * @boundary 試験後処理の局所反証。実Containerの保証は上の実境界試験で確認する。
 */
test("Sandbox試験の故障は未検証IDで処置せずRoot清掃又は保持を明示する", () => {
  const [prefix] = fs
    .readFileSync(fileURLToPath(import.meta.url), "utf8")
    .replace(/\r\n/gu, "\n")
    .split("/**\n * 試験自体");
  assert.ok(prefix);
  const source = prefix
    .replace(/^import[\s\S]*?;\r?$/gmu, "")
    .replaceAll("import.meta.url", JSON.stringify(import.meta.url));
  for (const fault of [
    "before_create",
    "create_failed",
    "invalid_stdout",
    "inspect_failed",
  ] as const) {
    const prepared = planProviderExecution(
      {
        provider: "codex",
        purpose: "task",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-6.1-sol",
          identifierKind: "exact",
          reasoningEffort: "medium",
        },
        input: {
          provider: "codex",
          mode: "isolated_task",
          effort: "medium",
          taskRole: "executor",
        },
      },
      describeDockerProviderExecutionLocations("codex", "task"),
    );
    const hooks: (() => void)[] = [];
    const calls: string[][] = [];
    const diagnostics: string[] = [];
    let callback:
      | ((t: {
          after: (fn: () => void) => void;
          diagnostic: (value: string) => void;
        }) => void)
      | null = null;
    let rootExists = true;
    const virtualRoot = path.join(
      fileURLToPath(new URL("../../../../.crdd/tests/", import.meta.url)),
      "crdd-codex-sandbox-fault",
    );
    runInNewContext(stripTypeScriptTypes(source), {
      assert,
      path,
      fileURLToPath,
      URL,
      process: { platform: "win32" },
      describeDockerProviderAssets,
      describeDockerProviderExecutionLocations,
      planProviderExecution: () =>
        fault === "before_create" ? { status: "blocked" } : prepared,
      test: (name: string, _options: unknown, fn: unknown) => {
        if (name.startsWith("Host Windows:")) callback = fn as typeof callback;
      },
      childProcess: {
        spawnSync: (_name: string, argv: string[]) => {
          calls.push(argv);
          if (argv[0] === "create")
            return {
              status: fault === "create_failed" ? 1 : 0,
              stdout:
                fault === "invalid_stdout" ? "invalid-id" : "a".repeat(64),
              stderr: "",
              error: undefined,
            };
          return {
            status: argv[0] === "inspect" ? 1 : 0,
            stdout: "",
            stderr: "",
            error: undefined,
          };
        },
      },
      fs: {
        mkdirSync: () => undefined,
        mkdtempSync: () => virtualRoot,
        lstatSync: () => ({ isSymbolicLink: () => false, dev: 1n, ino: 2n }),
        realpathSync: { native: (value: string) => path.resolve(value) },
        writeFileSync: () => undefined,
        rmSync: () => {
          rootExists = false;
        },
        existsSync: () => rootExists,
      },
    });
    assert.ok(callback);
    assert.throws(() =>
      (callback as NonNullable<typeof callback>)({
        after: (fn) => hooks.push(fn),
        diagnostic: (value) => diagnostics.push(value),
      }),
    );
    for (const hook of hooks) {
      try {
        hook();
      } catch {
        assert.equal(fault, "inspect_failed");
      }
    }
    assert.equal(
      calls.some((argv) => argv[0] === "rm" || argv[0] === "stop"),
      false,
    );
    assert.equal(rootExists, fault !== "before_create");
    assert.equal(diagnostics.length, fault === "before_create" ? 0 : 1);
    if (fault === "create_failed" || fault === "invalid_stdout")
      assert.deepEqual(
        calls.map((argv) => argv[0]),
        ["create"],
      );
  }
});
