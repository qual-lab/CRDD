import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const executorSeccompProfilePath = fileURLToPath(
  new URL("../../runtime/codex-executor-seccomp.json", import.meta.url),
);

/**
 * Resolve the one fixed Codex Executor seccomp artifact after verifying the
 *
 * @responsibility resolveFixedCodexExecutorSeccompProfileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input expectedSha256: string、expectedBytes: number
 * @returns resolveFixedCodexExecutorSeccompProfileの計算結果を返す。
 * @precondition 「expectedSha256: string、expectedBytes: number」がresolveFixedCodexExecutorSeccompProfileの入力契約を満たす。
 * @postcondition resolveFixedCodexExecutorSeccompProfileの責務を完了した結果だけを返す。
 * @effect resolveFixedCodexExecutorSeccompProfileはFilesystemの読取りまたは書込みを実行する。
 * @failure resolveFixedCodexExecutorSeccompProfileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveFixedCodexExecutorSeccompProfileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resolveFixedCodexExecutorSeccompProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveFixedCodexExecutorSeccompProfileは共有非同期状態を持たない同期処理である。
 */
export function resolveFixedCodexExecutorSeccompProfile(
  expectedSha256: string,
  expectedBytes: number,
) {
  try {
    const before = fs.lstatSync(executorSeccompProfilePath, {
      bigint: true,
    });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size !== BigInt(expectedBytes) ||
      fs.realpathSync.native(executorSeccompProfilePath) !==
        executorSeccompProfilePath
    ) {
      return null;
    }
    const bytes = fs.readFileSync(executorSeccompProfilePath);
    const after = fs.lstatSync(executorSeccompProfilePath, {
      bigint: true,
    });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      createHash("sha256").update(bytes).digest("hex") !== expectedSha256
    ) {
      return null;
    }
    return executorSeccompProfilePath;
  } catch {
    return null;
  }
}
