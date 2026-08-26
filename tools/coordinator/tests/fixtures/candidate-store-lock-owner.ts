import {
  acquireRuntimeOwnedCandidateStoreKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedHostOperationSupervisorLock,
} from "../../src/security/candidate-store-kernel-lock.ts";

const mode = process.argv[2];
const lock =
  mode === "host-supervisor"
    ? await acquireRuntimeOwnedHostOperationSupervisorLock(
        process.argv[3],
        process.argv[4],
      )
    : mode === "host"
      ? acquireRuntimeOwnedHostOperationKernelLock(
          process.argv[3],
          process.argv[4],
        )
      : acquireRuntimeOwnedCandidateStoreKernelLock(mode);
if (!lock) process.exit(2);
process.stdout.write("READY\n");
setInterval(() => {}, 1_000);
