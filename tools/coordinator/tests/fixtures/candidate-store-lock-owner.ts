import { acquireRuntimeOwnedCandidateStoreKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";

const protectionHash = process.argv[2];
const lock = acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash);
if (!lock) process.exit(2);
process.stdout.write("READY\n");
setInterval(() => {}, 1_000);
