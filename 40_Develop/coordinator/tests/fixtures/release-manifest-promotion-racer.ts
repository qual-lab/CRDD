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
fs.writeFileSync(path.join(barrierRoot, `${id}.ready`), "ready", {
  flag: "wx",
});
const waiter = new Int32Array(new SharedArrayBuffer(4));
while (!fs.existsSync(path.join(barrierRoot, "go")))
  Atomics.wait(waiter, 0, 0, 10);
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
