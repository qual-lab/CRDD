/**
 * 公式Codexの配置用Docker Contextを用意する。
 *
 * @responsibility 検証済み公式実行物だけをコピーしCodex本体のBuildを行わない。
 * @trace ARCH-000010
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
} from "../../runtime-data/src/index.ts";
import { verifyRepositoryRoot } from "../../version-control/src/repository-location.ts";

/**
 * 明示した公式CLIとHostから有限のImage入力を作成する。
 *
 * @responsibility 入力の実体・サイズ・Hashと書込みRootを検証する。
 * @trace ARCH-000010
 * @input codexPath: 公式CLI、hostPath: 公式HostのRepository内Path。
 * @returns 二公式実行物とDockerfileだけを持つ一時ContextのPath。
 * @precondition 公式配布の取得検証済み実行物を明示する。
 * @postcondition 既存Context、採用Imageと署名Manifestを変更しない。
 * @effect Repository-local tmpへ新規Contextと三Fileを作成する。
 * @failure Root・Path・サイズ・Hash不一致を作成前に拒否する。
 * @invariant Source Archive、Patch、認証情報、Repository本文をコピーしない。
 * @boundary 取得済み公式配布物とDocker Image入力の境界。
 * @security 任意実行物をCLIやHostとして採用しない。
 * @concurrency 新しいContextを排他的に作り既存入力を上書きしない。
 */
export function prepareCodexAdviceImage(codexPath: string, hostPath: string) {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const verified = verifyRepositoryRoot(root);
  if (verified.status !== "completed") throw new Error(verified.reason);
  const inputs = [
    {
      name: "codex",
      source: codexPath,
      size: 286754152,
      hash: "1748767b230ebfc3d4ab7e4e254920d0c0ad9691fd8c11f190e7d44511a4a92e",
    },
    {
      name: "codex-code-mode-host",
      source: hostPath,
      size: 74068880,
      hash: "5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03",
    },
  ].map((input) => {
    const source = path.resolve(input.source);
    const relative = path.relative(root, source);
    if (
      relative === "" ||
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      fs.realpathSync.native(source) !== source
    )
      throw new Error("codex_advice_image_input_scope_invalid");
    const metadata = fs.lstatSync(source);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size !== input.size
    )
      throw new Error("codex_advice_image_input_invalid");
    const bytes = fs.readFileSync(source);
    if (createHash("sha256").update(bytes).digest("hex") !== input.hash)
      throw new Error("codex_advice_image_input_hash_mismatch");
    return { name: input.name, bytes };
  });
  const dockerfile = fs.readFileSync(
    path.join(
      root,
      "40_Develop/coordinator/runtime/codex-advice-provider.Dockerfile",
    ),
  );
  const temporary = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(verified.capability, "tmp"),
    "codex_advice_image_root_invalid",
  );
  const context = fs.mkdtempSync(
    path.join(temporary.directory, "codex-advice-image-"),
  );
  for (const input of inputs)
    fs.writeFileSync(path.join(context, input.name), input.bytes, {
      flag: "wx",
    });
  fs.writeFileSync(path.join(context, "Dockerfile"), dockerfile, {
    flag: "wx",
  });
  return {
    context,
    officialCliUnmodified: true,
    codexCompilationPerformed: false,
    dockerBuildPerformed: false,
    providerRequestIssued: false,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 4)
    throw new Error("codex_advice_image_requires_cli_and_host_paths");
  process.stdout.write(
    `${JSON.stringify(prepareCodexAdviceImage(process.argv[2] as string, process.argv[3] as string))}\n`,
  );
}
