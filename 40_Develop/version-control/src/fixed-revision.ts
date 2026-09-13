import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export const FIXED_REVISION_IDENTITY_CONTRACT =
  "crdd-version-control/fixed-revision-identity/v1";
export const FIXED_REVISION_IDENTITY_CONTRACT_REVISION = 1;

export type FixedRevisionIdentity = Readonly<{
  contract: typeof FIXED_REVISION_IDENTITY_CONTRACT;
  contractRevision: typeof FIXED_REVISION_IDENTITY_CONTRACT_REVISION;
  status: "observed";
  repositoryIdentity: string;
  repositoryInstanceIdentity: string;
  repositoryForm: "primary" | "linked" | "embedded";
  revisionIdentity: string;
  snapshotIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

export type FixedRevisionIdentityAdapter = (
  repositoryRoot: string,
) => FixedRevisionIdentity | null;

export function observeFixedRevisionIdentity(
  capability: VerifiedRepositoryRoot,
  adapter: FixedRevisionIdentityAdapter,
): FixedRevisionIdentity | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null ? null : adapter(repositoryRoot);
}
