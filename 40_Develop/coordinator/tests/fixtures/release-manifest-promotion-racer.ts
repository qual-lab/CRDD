/**
 * Release Manifest昇格の競合Workerを実行する。
 *
 * @packageDocumentation
 * @responsibility 固定試験Sessionに結合して昇格操作を交錯させ、確定と競合拒否を観測する。
 * @trace AIT-IT-008
 * @level IT
 * @scope Manifest昇格・確定の競合
 * @boundary 固定Worker→試験用Manifest配置。Release署名や本番Manifest採用は行わない。
 */
import fs from "node:fs";
import path from "node:path";

import {
  beginReleaseManifestPromotionSession,
  promoteReleaseManifestBytes,
  ReleaseManifestPromotionError,
} from "../../scripts/release-manifest-promotion.ts";

const [id, sourceRoot, destinationRoot, sha256, barrierRoot] =
  process.argv.slice(2);
if (!id || !sourceRoot || !destinationRoot || !sha256 || !barrierRoot)
  throw new Error("release_manifest_promotion_racer_arguments_invalid");
const session = beginReleaseManifestPromotionSession(
  sourceRoot,
  destinationRoot,
  sha256,
);
if (!session)
  throw new Error("release_manifest_promotion_racer_precheck_failed");
const waiter = new Int32Array(new SharedArrayBuffer(4));
if (id === "hang-before-ready") while (true) Atomics.wait(waiter, 0, 0, 1_000);
fs.writeFileSync(path.join(barrierRoot, `${id}.ready`), "ready", {
  flag: "wx",
});
while (!fs.existsSync(path.join(barrierRoot, "go")))
  Atomics.wait(waiter, 0, 0, 10);
if (id === "malformed") {
  process.stdout.write("{");
  process.exit(0);
}
if (id === "hang-after-ready") while (true) Atomics.wait(waiter, 0, 0, 1_000);
try {
  const result = promoteReleaseManifestBytes(session.token);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  if (!(error instanceof ReleaseManifestPromotionError)) throw error;
  process.stdout.write(
    `${JSON.stringify({
      status: "blocked",
      repositoryFilesystemEffectIssued: error.repositoryFilesystemEffectIssued,
      cleanupConfirmed: error.cleanupConfirmed,
      reentryRequired: error.reentryRequired,
    })}\n`,
  );
}
