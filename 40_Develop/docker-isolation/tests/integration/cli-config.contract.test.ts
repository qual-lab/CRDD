/**
 * 借用管理領域での実config作成・照合・回収を確認する。
 * @packageDocumentation
 * @responsibility 同じPackageのFilesystem Ownerを直接検証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実Filesystem、Docker/Provider要求なし。
 * @boundary Repository-local試験Rootと空CLI config。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createDockerCliConfig,
  verifyDockerCliConfig,
} from "../../src/execution/cli-config.ts";

/**
 * 実config回収後に同じ借用管理領域へ空configを再作成できることを確認する。
 *
 * @responsibility 旧単発診断の実Filesystem境界と計画の終了前差替え拒否を正式試験へ保持する。
 * @trace ERB-IT-004
 * @precondition Repository-local tests内に自己生成した空領域を使用する。
 * @stimulus 下位Ownerの固定Sourceから実configを二度作成・検証・回収する。
 * @observation configの実作成・Identity検証・削除回数と試験領域の空を読む。
 * @oracle 既存configの重複作成を拒否し、回収後の再作成と二回の実回収が成立する。Provider計画相関は別Caseで確認する。
 * @cleanup 自己生成した一意な試験領域だけをfinallyで回収する。
 * @boundary ERB-IT-004=Direct Boundary: 実Filesystem。CLI信頼とProcessは差替え、Docker/Provider要求は0。
 */
test("実config清掃後は同じ管理領域を再利用できる", () => {
  const configFunctions = { createDockerCliConfig, verifyDockerCliConfig };
  const testsRoot = fileURLToPath(
    new URL("../../../../.crdd/tests/", import.meta.url),
  );
  const directory = fs.mkdtempSync(
    path.join(testsRoot, "docker-config-sequential-"),
  );
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const config = configFunctions.createDockerCliConfig(directory);
      configFunctions.verifyDockerCliConfig(config.directory, config.identity);
      assert.throws(() => configFunctions.createDockerCliConfig(directory));
      fs.rmdirSync(config.directory);
      assert.deepEqual(fs.readdirSync(directory), []);
    }
  } finally {
    assert.equal(fs.realpathSync(directory), directory);
    fs.rmdirSync(directory);
  }
});
