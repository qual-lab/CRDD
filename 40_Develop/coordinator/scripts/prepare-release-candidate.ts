import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveRepositoryRuntimeDataPathsFromValidatedRoot } from "../../runtime-data/src/index.ts";

import {
  inspectGitCommitTreeCandidate,
  materializeGitReleaseCandidateTree,
} from "../src/security/git-object-reader.ts";
import { resolveRepositoryGitLayout } from "../src/security/repository-git-layout-internal.ts";

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

function blocked(reason: string, residuePresent = false) {
  return Object.freeze({
    contract: RELEASE_CANDIDATE_PREPARATION_CONTRACT,
    contractRevision: RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    residuePresent,
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

function createOrVerifyDirectory(target: string, parent: string) {
  try {
    fs.mkdirSync(target);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "EEXIST"
    ) {
      throw error;
    }
  }
  const actual = stableDirectory(target);
  if (actual !== path.join(parent, path.basename(target))) {
    throw new Error("release_candidate_directory_alias_rejected");
  }
  return actual;
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
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const inspected = inspectGitCommitTreeCandidate({
      commonDirectory: layout.commonDirectory.realPath,
      revision: input.revision,
    });
    if (inspected?.status !== "candidate") {
      return blocked("release_candidate_revision_invalid");
    }

    const runtimePaths =
      resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
    if (!runtimePaths)
      return blocked("release_candidate_runtime_data_path_invalid");
    const runtimeRoot = createOrVerifyDirectory(
      runtimePaths.root,
      repositoryRoot,
    );
    const stagingRoot = createOrVerifyDirectory(
      runtimePaths.release,
      runtimeRoot,
    );
    const candidateRoot = path.join(stagingRoot, input.candidateName);
    preparingRoot = path.join(stagingRoot, `${input.candidateName}.preparing`);
    if (fs.existsSync(candidateRoot) || fs.existsSync(preparingRoot)) {
      return blocked("release_candidate_destination_exists");
    }

    fs.mkdirSync(preparingRoot);
    if (stableDirectory(preparingRoot) !== preparingRoot) {
      throw new Error("release_candidate_preparing_alias_rejected");
    }
    const materialized = materializeGitReleaseCandidateTree({
      commonDirectory: layout.commonDirectory.realPath,
      revision: input.revision,
      workspace: preparingRoot,
    });
    if (materialized?.status !== "materialized") {
      return blocked("release_candidate_materialization_failed", true);
    }
    if (
      materialized.baseCommit !== inspected.commit ||
      materialized.baseTree !== inspected.tree
    ) {
      return blocked("release_candidate_identity_mismatch", true);
    }

    fs.renameSync(preparingRoot, candidateRoot);
    preparingRoot = null;
    if (stableDirectory(candidateRoot) !== candidateRoot) {
      return blocked("release_candidate_publication_unconfirmed", true);
    }
    const layoutAfter = resolveRepositoryGitLayout(repositoryRoot);
    const inspectedAfter = inspectGitCommitTreeCandidate({
      commonDirectory: layoutAfter.commonDirectory.realPath,
      revision: input.revision,
    });
    if (
      inspectedAfter?.status !== "candidate" ||
      inspectedAfter.commit !== inspected.commit ||
      inspectedAfter.tree !== inspected.tree
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
      commit: inspected.commit,
      tree: inspected.tree,
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
