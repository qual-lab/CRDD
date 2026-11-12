import { resumeTemporaryOperation } from "../../src/storage/store.ts";
import type { TemporaryOperationRecoveryReference } from "../../src/storage/store.ts";
import { resumeTemporaryOperationWithInterruptionForVerification } from "../../src/storage/store.ts";
import { getRepository } from "../../../version-control/src/index.ts";

const [repositoryRoot, encodedReference, nextIdentity, mode] =
  process.argv.slice(2);
if (!repositoryRoot || !encodedReference || !nextIdentity || !mode)
  throw new Error("temporary_operation_fixture_arguments_invalid");
const root = getRepository(repositoryRoot);
if (root.status !== "completed")
  throw new Error("temporary_operation_fixture_root_invalid");
const reference = JSON.parse(
  Buffer.from(encodedReference, "base64url").toString("utf8"),
) as TemporaryOperationRecoveryReference;
const resumed =
  mode === "before-return" || mode === "after-lock-acquired"
    ? resumeTemporaryOperationWithInterruptionForVerification(
        root.capability,
        reference,
        nextIdentity,
        mode === "after-lock-acquired"
          ? "after_lock_acquired"
          : "after_generation",
        () => process.exit(84),
      )
    : resumeTemporaryOperation(root.capability, reference, nextIdentity);
if (mode === "observe-result") {
  process.stdout.write(`${JSON.stringify(resumed)}\n`);
  process.exit(0);
}
if (resumed.status !== "completed")
  throw new Error("temporary_operation_fixture_resume_failed");
process.stdout.write(`${JSON.stringify(resumed.recoveryReference)}\n`);
