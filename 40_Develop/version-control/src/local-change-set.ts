import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export const LOCAL_CHANGE_SET_CONTRACT =
  "crdd-version-control/local-change-set/v1";
export const LOCAL_CHANGE_SET_CONTRACT_REVISION = 1;

export type LocalChangeSet = Readonly<{
  contract: typeof LOCAL_CHANGE_SET_CONTRACT;
  contractRevision: typeof LOCAL_CHANGE_SET_CONTRACT_REVISION;
  revisionChanges: readonly string[];
  preparedChanges: readonly string[];
  workingChanges: readonly string[];
  unregisteredPaths: readonly string[];
  observationComplete: true;
  repositoryPathReported: false;
}>;

export type LocalChangeSetObservation = Readonly<{
  revisionChanges: readonly string[];
  preparedChanges: readonly string[];
  workingChanges: readonly string[];
  unregisteredPaths: readonly string[];
}>;

export type LocalChangeSetAdapter = (
  repositoryRoot: string,
  comparisonBase: string,
) => LocalChangeSetObservation;

function validateComparisonBase(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_024 ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    value.startsWith("-")
  )
    throw new Error("change_comparison_base_invalid");
}

function validatePaths(paths: readonly string[], phase: string): void {
  if (
    paths.some(
      (entry) =>
        entry.length === 0 ||
        entry.includes("\\") ||
        entry.startsWith("/") ||
        /^[A-Za-z]:/u.test(entry) ||
        entry
          .split("/")
          .some(
            (segment) => segment === "" || segment === "." || segment === "..",
          ),
    )
  )
    throw new Error(`local_change_set_observation_invalid:${phase}`);
}

function uniqueSorted(
  groups: readonly (readonly string[])[],
): readonly string[] {
  return Object.freeze(
    [...new Set(groups.flat())].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

export function observeLocalChangeSet(
  capability: VerifiedRepositoryRoot,
  comparisonBase: unknown,
  adapter: LocalChangeSetAdapter,
): LocalChangeSet {
  validateComparisonBase(comparisonBase);
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("verified_repository_root_required");
  const observed = adapter(repositoryRoot, comparisonBase);
  validatePaths(observed.revisionChanges, "revision_changes");
  validatePaths(observed.preparedChanges, "prepared_changes");
  validatePaths(observed.workingChanges, "working_changes");
  validatePaths(observed.unregisteredPaths, "unregistered_paths");
  return Object.freeze({
    contract: LOCAL_CHANGE_SET_CONTRACT,
    contractRevision: LOCAL_CHANGE_SET_CONTRACT_REVISION,
    revisionChanges: uniqueSorted([observed.revisionChanges]),
    preparedChanges: uniqueSorted([observed.preparedChanges]),
    workingChanges: uniqueSorted([observed.workingChanges]),
    unregisteredPaths: uniqueSorted([observed.unregisteredPaths]),
    observationComplete: true,
    repositoryPathReported: false,
  });
}

export function changedPaths(changeSet: LocalChangeSet): readonly string[] {
  return uniqueSorted([
    changeSet.revisionChanges,
    changeSet.preparedChanges,
    changeSet.workingChanges,
    changeSet.unregisteredPaths,
  ]);
}
