/**
 * 未署名のProduction Moduleを実Checkoutから分離して検証する。
 *
 * @packageDocumentation
 * @responsibility 署名不存在の負例だけをRepository-local試験領域で構築する。
 * @trace PRL-IT-012
 * @trace PRL-ST-001
 * @trace PPR-UT-014
 * @trace PRL-UT-006
 * @scope unsigned、runtime、fixture
 * @boundary 未署名配布fixture→Production CLI／Module。
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * 明示未署名のSource配布を構築し、検証後に所有Rootを回収する。
 *
 * @responsibility 実Checkoutの署名・Native・実状態を変更せず負例の前提を固定する。
 * @trace PRL-IT-012
 * @trace PRL-ST-001
 * @trace PPR-UT-014
 * @trace PRL-UT-006
 * @precondition 現Repository Rootと追跡Sourceの実体を確認できる。
 * @stimulus 未署名fixture自身のhelpを実行してから呼出し元の判定を実行する。
 * @observation manifest不存在、help終了、呼出し元結果、終了後Root不存在を観測する。
 * @oracle helpはexit0、各負例は呼出し元のexact Oracleを維持する。
 * @cleanup finallyで確定した専用Rootだけを回収して不存在を確認する。
 * @boundary 試験準備と子Processは発行するが、Task／Provider／Docker処置を許可しない。
 */
export function withUnsignedRuntimeFixture<T>(verify: (root: string) => T): T {
  const repositoryRoot = fs.realpathSync.native(
    path.resolve(import.meta.dirname, "../../../.."),
  );
  const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  assert.equal(fs.realpathSync.native(gitRoot), repositoryRoot);
  const temporaryRoot = path.join(repositoryRoot, ".crdd", "tmp");
  fs.mkdirSync(temporaryRoot, { recursive: true });
  assert.equal(fs.realpathSync.native(temporaryRoot), temporaryRoot);
  const root = fs.mkdtempSync(path.join(temporaryRoot, "unsigned-runtime-"));
  try {
    const components = new Set([
      "ai-runtime",
      "artifact-signing",
      "coordinator",
      "crdd-domain-library",
      "cros",
      "mcp",
      "project-operation",
      "project-runtime",
      "execution-intelligence",
      "runtime-data",
      "version-control",
    ]);
    const entries = execFileSync("git", ["ls-files", "-z", "40_Develop"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    })
      .split("\0")
      .filter(Boolean);
    for (const relative of entries) {
      const parts = relative.split("/");
      if (
        !components.has(parts[1] ?? "") ||
        parts.some((part) =>
          ["tests", "node_modules", "target"].includes(part),
        ) ||
        !/\.(?:ts|tsx|json)$/u.test(relative)
      )
        continue;
      const source = path.join(repositoryRoot, ...parts);
      assert.equal(fs.lstatSync(source).isSymbolicLink(), false);
      assert.equal(fs.realpathSync.native(source), source);
      const destination = path.join(root, ...parts);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
    assert.equal(
      fs.existsSync(
        path.join(
          root,
          "template",
          "tools",
          "coordinator",
          "coordinator-package-manifest.json",
        ),
      ),
      false,
    );
    const help = spawnSync(
      process.execPath,
      [
        path.join(root, "40_Develop", "coordinator", "bin", "coordinator.ts"),
        "help",
      ],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        timeout: 15_000,
      },
    );
    assert.equal(help.error, undefined);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /coordinator task --request-stdin/u);
    return verify(root);
  } finally {
    assert.equal(path.dirname(root), temporaryRoot);
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: false });
    assert.equal(fs.existsSync(root), false);
  }
}
