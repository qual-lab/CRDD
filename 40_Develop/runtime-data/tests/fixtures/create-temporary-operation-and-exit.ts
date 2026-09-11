import {
  createTemporaryOperation,
  verifyRepositoryRoot,
} from "../../src/index.ts";
import { createTemporaryOperationWithInterruptionForVerification } from "../../src/store/temporary-operation-store.ts";

const repositoryRoot = process.argv[2];
const operationId = process.argv[3];
const identity = process.argv[4];
const mode = process.argv[5] ?? "after-return";
const root = verifyRepositoryRoot(repositoryRoot);
if (root.status !== "completed" || !operationId || !identity)
  throw new Error("temporary_operation_fixture_input_invalid");
const input = {
  operationId,
  owner: "runtime-data-test",
  identity,
  purpose: "process loss recovery verification",
  allowedContent: ["fixture"],
  evidencePromotion: "not_required",
} as const;
const opened =
  mode === "after-control"
    ? createTemporaryOperationWithInterruptionForVerification(
        root.capability,
        input,
        () => process.exit(83),
      )
    : createTemporaryOperation(root.capability, input);
if (opened.status !== "completed")
  throw new Error("temporary_operation_fixture_creation_failed");
process.stdout.write(`${JSON.stringify(opened.recoveryReference)}\n`);
