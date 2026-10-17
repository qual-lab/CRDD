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
const CODEX_IMAGE_DIGEST =
  "sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c";
const codexSeccompProfile = fileURLToPath(
  new URL(
    "../../../docker-isolation/runtime/codex-executor-seccomp.json",
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
  t.after(() => {
    childProcess.spawnSync("docker", ["rm", "--force", containerName], {
      encoding: "utf8",
      windowsHide: true,
    });
    fs.rmSync(root, { force: true, recursive: true });
  });

  const result = childProcess.spawnSync(
    "docker",
    [
      "run",
      "--name",
      containerName,
      "--rm",
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
      `--entrypoint=/opt/crdd/providers/codex/0.149.1/codex`,
      CODEX_IMAGE_DIGEST,
      "sandbox",
      "--permission-profile",
      "crdd-executor",
      "--include-managed-config",
      "--config",
      'default_permissions="crdd-executor"',
      "--config",
      'permissions.crdd-executor.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="write"},"/opt/crdd/providers/codex/0.149.1/codex"="read"}',
      "--config",
      "permissions.crdd-executor.network.enabled=false",
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
