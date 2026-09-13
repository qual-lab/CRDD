import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export type RepositoryRevisionObservation = Readonly<{
  repositoryIdentity: string;
  repositoryInstanceIdentity: string;
  repositoryForm: "primary" | "linked" | "embedded";
  revisionIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

export type RepositoryRevisionAdapter = (
  repositoryRoot: string,
) => RepositoryRevisionObservation | null;

export type RepositoryFormatAdapter = (
  repositoryRoot: string,
) => Readonly<{ objectFormat: "sha1" | "sha256" }> | null;

export function observeRepositoryRevision(
  capability: VerifiedRepositoryRoot,
  adapter: RepositoryRevisionAdapter,
): RepositoryRevisionObservation | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null ? null : adapter(repositoryRoot);
}

export function inspectRepositoryFormat(
  repositoryRoot: unknown,
  adapter: RepositoryFormatAdapter,
) {
  return typeof repositoryRoot === "string" ? adapter(repositoryRoot) : null;
}
