import {
  resumeTemporaryOperation,
  verifyRepositoryRoot,
  type TemporaryOperationRecoveryReference,
} from "../../src/index.ts";
import { resumeTemporaryOperationWithInterruptionForVerification } from "../../src/store/temporary-operation-store.ts";

const [repositoryRoot, encodedReference, nextIdentity, mode] =
  process.argv.slice(2);
if (!repositoryRoot || !encodedReference || !nextIdentity || !mode)
  throw new Error("temporary_operation_fixture_arguments_invalid");
const root = verifyRepositoryRoot(repositoryRoot);
if (root.status !== "completed")
  throw new Error("temporary_operation_fixture_root_invalid");
const reference = JSON.parse(
  Buffer.from(encodedReference, "base64url").toString("utf8"),
) as TemporaryOperationRecoveryReference;
const resumed =
  mode === "before-return" ||
  mode === "after-lock-staging" ||
  mode === "after-lock-linked" ||
  mode === "after-lock-staging-created"
    ? resumeTemporaryOperationWithInterruptionForVerification(
        root.capability,
        reference,
        nextIdentity,
        mode === "after-lock-staging-created"
          ? "after_lock_staging_created"
          : mode === "after-lock-staging"
            ? "after_lock_staging"
            : mode === "after-lock-linked"
              ? "after_lock_linked"
              : "after_generation",
        () => process.exit(84),
      )
    : resumeTemporaryOperation(root.capability, reference, nextIdentity);
if (resumed.status !== "completed")
  throw new Error("temporary_operation_fixture_resume_failed");
process.stdout.write(`${JSON.stringify(resumed.recoveryReference)}\n`);
