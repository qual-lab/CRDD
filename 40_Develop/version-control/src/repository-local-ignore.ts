import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";
import { createHash } from "node:crypto";

export const REPOSITORY_LOCAL_IGNORE_CONTRACT =
  "crdd-version-control/repository-local-ignore/v1";
export const REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION = 1;

export type RepositoryLocalIgnoreAdapterResult =
  | Readonly<{
      status: "completed";
      changed: boolean;
      beforeContentIdentity: string;
      afterContentIdentity: string;
      effectIssued: boolean;
      effectConfirmation: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_local_ignore_update_blocked";
      effectIssued: boolean;
      effectConfirmation: "not_issued" | "unknown";
      cleanupConfirmed: boolean;
    }>;

export type RepositoryLocalIgnoreAdapter = (
  repositoryRoot: string,
  entry: string,
) => RepositoryLocalIgnoreAdapterResult;

export function registerRepositoryLocalIgnore(
  capability: VerifiedRepositoryRoot,
  entry: unknown,
  adapter: RepositoryLocalIgnoreAdapter,
) {
  if (
    typeof entry !== "string" ||
    entry.length === 0 ||
    entry.length > 1_024 ||
    entry.includes("\\") ||
    entry.startsWith("/") ||
    /[\u0000-\u001f\u007f]/u.test(entry) ||
    entry
      .split("/")
      .some(
        (segment, index, segments) =>
          (segment === "" && index !== segments.length - 1) ||
          segment === "." ||
          segment === "..",
      )
  )
    throw new Error("repository_local_ignore_entry_invalid");
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("verified_repository_root_required");
  const result = adapter(repositoryRoot, entry);
  return result.status === "completed"
    ? Object.freeze({
        contract: REPOSITORY_LOCAL_IGNORE_CONTRACT,
        contractRevision: REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION,
        status: "registered" as const,
        changed: result.changed,
        beforeContentIdentity: result.beforeContentIdentity,
        afterContentIdentity: result.afterContentIdentity,
        effectIssued: result.effectIssued,
        effectConfirmation: result.effectConfirmation,
        cleanupConfirmed: result.cleanupConfirmed,
        registrationVerified: true as const,
        repositoryPathReported: false as const,
      })
    : Object.freeze({
        contract: REPOSITORY_LOCAL_IGNORE_CONTRACT,
        contractRevision: REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION,
        status: "blocked" as const,
        reason: result.reason,
        effectIssued: result.effectIssued,
        effectConfirmation: result.effectConfirmation,
        effectStateUnknown: result.effectConfirmation === "unknown",
        cleanupConfirmed: result.cleanupConfirmed,
        retryAllowed:
          result.effectConfirmation === "not_issued" && result.cleanupConfirmed,
        recoveryReference:
          result.effectConfirmation === "unknown" || !result.cleanupConfirmed
            ? `repository-local-ignore.${createHash("sha256")
                .update(repositoryRoot)
                .update("\0")
                .update(entry)
                .digest("hex")}`
            : null,
        repositoryPathReported: false as const,
      });
}
