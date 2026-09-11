import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../runtime-data/src/index.ts";

export type VerifiedExecutionRepositoryRoot = VerifiedRepositoryRoot;

export function verifyExecutionIntelligenceRepositoryRoot(candidate: string):
  | Readonly<{
      status: "completed";
      reason: "execution_repository_root_verified";
      root: VerifiedExecutionRepositoryRoot;
    }>
  | Readonly<{
      status: "blocked";
      reason: "execution_repository_root_invalid";
    }> {
  const verified = verifyRepositoryRoot(candidate);
  if (verified.status === "blocked")
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_repository_root_invalid" as const,
    });
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_repository_root_verified" as const,
    root: verified.capability,
  });
}

export function resolveVerifiedExecutionRepositoryRoot(
  capability: VerifiedExecutionRepositoryRoot,
): string | null {
  return resolveVerifiedRepositoryRoot(capability);
}
