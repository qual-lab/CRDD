import { createHash, randomBytes } from "node:crypto";

import type { ProjectRuntimeDecisionCapabilityPort } from "../../../project-runtime/src/index.ts";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Supply cryptographic capability generation without exposing Node APIs to Project Runtime. */
export function createProjectRuntimeDecisionCapabilityAdapter(): ProjectRuntimeDecisionCapabilityPort {
  return Object.freeze({
    issue: () => {
      const secret = randomBytes(32).toString("base64url");
      return Object.freeze({ secret, hash: hash(secret) });
    },
    hash,
  });
}
