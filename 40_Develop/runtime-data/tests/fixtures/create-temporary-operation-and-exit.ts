import {
  createTemporaryOperation,
  verifyRepositoryRoot,
} from "../../src/index.ts";

const repositoryRoot = process.argv[2];
const operationId = process.argv[3];
const root = verifyRepositoryRoot(repositoryRoot);
if (root.status !== "completed" || !operationId)
  throw new Error("temporary_operation_fixture_input_invalid");
const opened = createTemporaryOperation(root.capability, {
  operationId,
  owner: "runtime-data-test",
  purpose: "process loss recovery verification",
  allowedContent: ["fixture"],
  evidencePromotion: "not_required",
});
if (opened.status !== "completed")
  throw new Error("temporary_operation_fixture_creation_failed");
process.stdout.write(`${JSON.stringify(opened.recoveryReference)}\n`);
