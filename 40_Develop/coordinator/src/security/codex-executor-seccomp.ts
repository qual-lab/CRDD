import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const EXECUTOR_SECCOMP_PROFILE_PATH = fileURLToPath(
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
    const before = fs.lstatSync(EXECUTOR_SECCOMP_PROFILE_PATH, {
      bigint: true,
    });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size !== BigInt(expectedBytes) ||
      fs.realpathSync.native(EXECUTOR_SECCOMP_PROFILE_PATH) !==
        EXECUTOR_SECCOMP_PROFILE_PATH
    ) {
      return null;
    }
    const bytes = fs.readFileSync(EXECUTOR_SECCOMP_PROFILE_PATH);
    const after = fs.lstatSync(EXECUTOR_SECCOMP_PROFILE_PATH, {
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
    return EXECUTOR_SECCOMP_PROFILE_PATH;
  } catch {
    return null;
  }
}
