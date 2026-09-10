import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const executorSeccompProfilePath = fileURLToPath(
  new URL("../../runtime/codex-executor-seccomp.json", import.meta.url),
);

/**
 * Resolve the one fixed Codex Executor seccomp artifact after verifying the
 * exact file identity and contents. Consumers receive the canonical absolute
 * path and must not reconstruct it independently.
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
