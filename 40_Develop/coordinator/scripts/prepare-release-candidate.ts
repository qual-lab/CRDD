import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ensureRepositoryRuntimeDataArea } from "../../runtime-data/src/index.ts";
import {
  inspectFixedSnapshot,
  materializeFixedSnapshotCandidate,
  verifyCandidateOutputDirectory,
} from "../../version-control/src/fixed-snapshot.ts";
import { gitFixedSnapshotAdapter } from "../../version-control/src/git/fixed-snapshot-adapter.ts";
import { verifyRepositoryRoot } from "../../version-control/src/repository-location.ts";

export const RELEASE_CANDIDATE_PREPARATION_CONTRACT =
  "crdd-coordinator/release-candidate-preparation";
export const RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION = 1;

const REVISION = /^[a-f0-9]{40}$/u;
const CANDIDATE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/u;

type PreparationInput = Readonly<{
  repositoryRoot: string;
  revision: string;
  candidateName: string;
}>;

function blocked(
  reason: string,
  residuePresent = false,
  materialization: Readonly<{
    effectIssued: boolean;
    effectStateUnknown: boolean;
    cleanupConfirmed: boolean;
    retryAllowed: boolean;
    recoveryReference: string | null;
  }> = Object.freeze({
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed: true,
    retryAllowed: false,
    recoveryReference: null,
  }),
) {
  return Object.freeze({
    contract: RELEASE_CANDIDATE_PREPARATION_CONTRACT,
    contractRevision: RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    residuePresent,
    ...materialization,
    candidateCreated: false,
    externalGitCliUsed: false,
    shellUsed: false,
    repositoryPathReported: false,
    candidatePathReported: false,
  });
}

function stableDirectory(target: string) {
  const metadata = fs.lstatSync(target);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("release_candidate_directory_invalid");
  }
  return fs.realpathSync.native(target);
}

export function prepareReleaseCandidate(input: PreparationInput) {
  let preparingRoot: string | null = null;
  try {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Reflect.ownKeys(input).length !== 3 ||
      !Reflect.ownKeys(input).every(
        (key) =>
          typeof key === "string" &&
          ["repositoryRoot", "revision", "candidateName"].includes(key),
      ) ||
      typeof input.repositoryRoot !== "string" ||
      !path.isAbsolute(input.repositoryRoot) ||
      typeof input.revision !== "string" ||
      !REVISION.test(input.revision) ||
      typeof input.candidateName !== "string" ||
      !CANDIDATE_NAME.test(input.candidateName)
    ) {
      return blocked("release_candidate_input_invalid");
    }

    const repositoryRoot = stableDirectory(input.repositoryRoot);
    if (repositoryRoot !== path.resolve(input.repositoryRoot)) {
      return blocked("release_candidate_repository_alias_rejected");
    }
    const verifiedRuntimeRoot = verifyRepositoryRoot(repositoryRoot);
    if (verifiedRuntimeRoot.status !== "completed")
      return blocked("release_candidate_runtime_data_path_invalid");
    const inspected = inspectFixedSnapshot(
      verifiedRuntimeRoot.capability,
      input.revision,
      gitFixedSnapshotAdapter,
    );
    if (inspected?.status !== "observed") {
      return blocked("release_candidate_revision_invalid");
    }

    const releaseArea = ensureRepositoryRuntimeDataArea(
      verifiedRuntimeRoot.capability,
      "release",
    );
    if (releaseArea?.status === "blocked")
      return blocked(releaseArea.reason, false, {
        effectIssued: releaseArea.effectIssued,
        effectStateUnknown: releaseArea.effectStateUnknown,
        cleanupConfirmed: releaseArea.cleanupConfirmed,
        retryAllowed: releaseArea.retryAllowed,
        recoveryReference: releaseArea.recoveryReference,
      });
    if (
      releaseArea?.status !== "ready" ||
      releaseArea.repositoryRoot !== repositoryRoot
    )
      return blocked("release_candidate_runtime_data_path_invalid");
    const stagingRoot = releaseArea.directory;
    const candidateRoot = path.join(stagingRoot, input.candidateName);
    preparingRoot = path.join(stagingRoot, `${input.candidateName}.preparing`);
    if (fs.existsSync(candidateRoot) || fs.existsSync(preparingRoot)) {
      return blocked("release_candidate_destination_exists");
    }

    fs.mkdirSync(preparingRoot);
    if (stableDirectory(preparingRoot) !== preparingRoot) {
      throw new Error("release_candidate_preparing_alias_rejected");
    }
    const output = verifyCandidateOutputDirectory(
      preparingRoot,
      releaseArea,
      releaseArea.directory,
    );
    if (output.status !== "completed")
      return blocked("release_candidate_destination_invalid", true);
    const materialized = materializeFixedSnapshotCandidate(
      verifiedRuntimeRoot.capability,
      input.revision,
      releaseArea,
      output.capability,
      null,
      null,
      gitFixedSnapshotAdapter,
    );
    if (!materialized)
      return blocked("release_candidate_materialization_failed", true);
    if (materialized.status === "blocked")
      return blocked(
        materialized.reason,
        !materialized.cleanupConfirmed,
        Object.freeze({
          effectIssued: materialized.effectIssued,
          effectStateUnknown: materialized.effectStateUnknown,
          cleanupConfirmed: materialized.cleanupConfirmed,
          retryAllowed:
            !materialized.effectStateUnknown && materialized.cleanupConfirmed,
          recoveryReference:
            materialized.effectStateUnknown || !materialized.cleanupConfirmed
              ? `release-candidate.${input.candidateName}`
              : null,
        }),
      );
    if (
      materialized.baseRevisionIdentity !== inspected.revisionIdentity ||
      materialized.baseSnapshotIdentity !== inspected.snapshotIdentity
    ) {
      return blocked("release_candidate_identity_mismatch", true);
    }

    fs.renameSync(preparingRoot, candidateRoot);
    preparingRoot = null;
    if (stableDirectory(candidateRoot) !== candidateRoot) {
      return blocked("release_candidate_publication_unconfirmed", true);
    }
    const inspectedAfter = inspectFixedSnapshot(
      verifiedRuntimeRoot.capability,
      input.revision,
      gitFixedSnapshotAdapter,
    );
    if (
      inspectedAfter?.status !== "observed" ||
      inspectedAfter.revisionIdentity !== inspected.revisionIdentity ||
      inspectedAfter.snapshotIdentity !== inspected.snapshotIdentity
    ) {
      return blocked(
        "release_candidate_source_changed_after_publication",
        true,
      );
    }

    return Object.freeze({
      contract: RELEASE_CANDIDATE_PREPARATION_CONTRACT,
      contractRevision: RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION,
      status: "prepared" as const,
      reason: "release_candidate_prepared",
      commit: inspected.revisionIdentity,
      tree: inspected.snapshotIdentity,
      fileCount: materialized.fileCount,
      byteLength: materialized.byteLength,
      contentManifestHash: materialized.contentManifestHash,
      residuePresent: false,
      candidateCreated: true,
      externalGitCliUsed: false,
      shellUsed: false,
      repositoryPathReported: false,
      candidatePathReported: false,
    });
  } catch {
    return blocked(
      "release_candidate_preparation_failed_closed",
      preparingRoot !== null && fs.existsSync(preparingRoot),
    );
  }
}

function argumentValue(args: readonly string[], name: string) {
  const index = args.indexOf(name);
  if (
    index < 0 ||
    index + 1 >= args.length ||
    args.lastIndexOf(name) !== index
  ) {
    return null;
  }
  return args[index + 1] ?? null;
}

export function parseReleaseCandidateArguments(args: readonly string[]) {
  if (
    args.length !== 6 ||
    !["--repository-root", "--revision", "--candidate-name"].every((name) =>
      args.includes(name),
    )
  ) {
    return null;
  }
  const repositoryRoot = argumentValue(args, "--repository-root");
  const revision = argumentValue(args, "--revision");
  const candidateName = argumentValue(args, "--candidate-name");
  return repositoryRoot && revision && candidateName
    ? Object.freeze({ repositoryRoot, revision, candidateName })
    : null;
}

export function main(args = process.argv.slice(2)) {
  const input = parseReleaseCandidateArguments(args);
  const result = input
    ? prepareReleaseCandidate(input)
    : blocked("release_candidate_arguments_invalid");
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "prepared" ? 0 : 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
