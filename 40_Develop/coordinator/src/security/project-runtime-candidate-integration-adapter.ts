import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  persistRuntimeOwnedCandidateBundle,
  publishRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "./candidate-bundle-store.ts";
import { materializeGitCommitTreeCandidate } from "./git-object-reader.ts";
import type { ProjectRuntimeIntegrationDependencies } from "./project-runtime-integration.ts";
import type { ProjectRuntimeState } from "./project-runtime-state.ts";
import { resolveRepositoryGitLayout } from "./repository-git-layout-internal.ts";
import { inspectRepositoryIdentityCandidate } from "./repository-operation-runtime.ts";

export const PROJECT_RUNTIME_CANDIDATE_INTEGRATION_ADAPTER_CONTRACT =
  "crdd-coordinator/project-runtime-candidate-integration-adapter/v1" as const;

type Entry = Readonly<{
  relativePath: string;
  operation: "upsert" | "delete";
  byteLength: number;
  sha256: string | null;
  contentBase64: string | null;
}>;
type Bundle = Readonly<{
  schema: "crdd-coordinator-candidate-bundle/v1";
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  patchHash: string;
  contentManifestHash: string;
  allowedPathsHash: string;
  changedPaths: readonly string[];
  entries: readonly Entry[];
}>;

function digest(...values: readonly (string | Buffer)[]) {
  const hash = createHash("sha256");
  for (const value of values) hash.update(value).update("\0");
  return hash.digest("hex");
}

type CandidateStore = Readonly<{
  read: (
    candidateId: string,
  ) => ReturnType<typeof readRuntimeOwnedCandidateBundle>;
  persist: typeof persistRuntimeOwnedCandidateBundle;
  publish: typeof publishRuntimeOwnedCandidateBundle;
}>;

const productionCandidateStore: CandidateStore = Object.freeze({
  read: readRuntimeOwnedCandidateBundle,
  persist: persistRuntimeOwnedCandidateBundle,
  publish: publishRuntimeOwnedCandidateBundle,
});

function exported(candidateStore: CandidateStore, candidateId: string) {
  const value = candidateStore.read(candidateId);
  if (
    value?.status !== "exported" ||
    !value.bundle ||
    value.bundle.schema !== "crdd-coordinator-candidate-bundle/v1"
  )
    return null;
  return Object.freeze({
    candidateId,
    classification: value.informationClassification,
    bundle: value.bundle as Bundle,
  });
}

function highestClassification(
  values: readonly ("public" | "internal" | "confidential")[],
) {
  return values.includes("confidential")
    ? "confidential"
    : values.includes("internal")
      ? "internal"
      : "public";
}

function sameEntry(left: Entry, right: Entry) {
  return (
    left.operation === right.operation &&
    left.byteLength === right.byteLength &&
    left.sha256 === right.sha256 &&
    left.contentBase64 === right.contentBase64
  );
}

function merge(
  candidateStore: CandidateStore,
  state: ProjectRuntimeState,
  candidateIds: readonly string[],
) {
  const sources = candidateIds.map((candidateId) =>
    exported(candidateStore, candidateId),
  );
  if (
    sources.some((source) => !source) ||
    sources.some(
      (source) => source?.bundle.baseCommit !== state.repositoryRevision,
    )
  )
    return null;
  const complete = sources as readonly NonNullable<
    ReturnType<typeof exported>
  >[];
  const baseTree = complete[0]?.bundle.baseTree;
  const baseManifestHash = complete[0]?.bundle.baseManifestHash;
  if (
    !baseTree ||
    !baseManifestHash ||
    complete.some(
      (source) =>
        source.bundle.baseTree !== baseTree ||
        source.bundle.baseManifestHash !== baseManifestHash,
    )
  )
    return null;
  const entries = new Map<string, Entry>();
  const conflicts = new Set<string>();
  for (const source of complete) {
    for (const entry of source.bundle.entries) {
      const existing = entries.get(entry.relativePath);
      if (existing && !sameEntry(existing, entry))
        conflicts.add(`path-${digest(entry.relativePath).slice(0, 32)}`);
      else entries.set(entry.relativePath, Object.freeze({ ...entry }));
    }
  }
  const sortedEntries = [...entries.values()].sort((left, right) =>
    Buffer.from(left.relativePath).compare(Buffer.from(right.relativePath)),
  );
  const changedPaths = Object.freeze(
    sortedEntries.map((entry) => entry.relativePath),
  );
  const contentManifestHash = digest(
    ...sortedEntries.map((entry) =>
      JSON.stringify({
        relativePath: entry.relativePath,
        operation: entry.operation,
        byteLength: entry.byteLength,
        sha256: entry.sha256,
      }),
    ),
  );
  const allowedPathsHash = digest(...changedPaths);
  const patchHash = digest(
    state.repositoryRevision,
    baseTree,
    baseManifestHash,
    contentManifestHash,
    allowedPathsHash,
  );
  const bundle: Bundle = Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit: state.repositoryRevision,
    baseTree,
    baseManifestHash,
    patchHash,
    contentManifestHash,
    allowedPathsHash,
    changedPaths,
    entries: Object.freeze(sortedEntries),
  });
  return Object.freeze({
    bundle,
    conflicts: Object.freeze([...conflicts]),
    classification: highestClassification(
      complete.map((source) => source.classification),
    ),
  });
}

function stableFile(target: string) {
  try {
    const before = fs.lstatSync(target, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) return null;
    const bytes = fs.readFileSync(target);
    const after = fs.lstatSync(target, { bigint: true });
    return before.dev === after.dev &&
      before.ino === after.ino &&
      before.birthtimeNs === after.birthtimeNs &&
      before.size === after.size &&
      before.mtimeNs === after.mtimeNs
      ? bytes
      : null;
  } catch (error) {
    return error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
      ? false
      : null;
  }
}

function materializeBase(
  repositoryRoot: string,
  revision: string,
  paths: readonly string[],
) {
  const parent = path.join(repositoryRoot, ".crdd", "project-runtime");
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const workspace = fs.mkdtempSync(path.join(parent, "adoption-base-"));
  const layout = resolveRepositoryGitLayout(repositoryRoot);
  const result = materializeGitCommitTreeCandidate({
    commonDirectory: layout.commonDirectory.realPath,
    revision,
    workspace,
    readPaths: paths,
  });
  return result?.status === "materialized" ? workspace : null;
}

function currentMatchesBase(
  repositoryRoot: string,
  base: string,
  entries: readonly Entry[],
) {
  for (const entry of entries) {
    const current = stableFile(
      path.join(repositoryRoot, ...entry.relativePath.split("/")),
    );
    const original = stableFile(
      path.join(base, ...entry.relativePath.split("/")),
    );
    if (current === null || original === null) return false;
    if (current === false || original === false) {
      if (current !== original) return false;
    } else if (!current.equals(original)) return false;
  }
  return true;
}

function applyBundle(repositoryRoot: string, bundle: Bundle) {
  const transactionRoot = path.join(
    repositoryRoot,
    ".crdd",
    "project-runtime",
    "adoption",
    randomUUID(),
  );
  fs.mkdirSync(transactionRoot, { recursive: true, mode: 0o700 });
  const applied: Array<Readonly<{ target: string; backup: string | null }>> =
    [];
  try {
    for (let index = 0; index < bundle.entries.length; index += 1) {
      const entry = bundle.entries[index];
      if (!entry) throw new Error("candidate_entry_missing");
      const target = path.join(
        repositoryRoot,
        ...entry.relativePath.split("/"),
      );
      const parent = path.dirname(target);
      fs.mkdirSync(parent, { recursive: true });
      const relativeParent = path.relative(
        repositoryRoot,
        fs.realpathSync.native(parent),
      );
      if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent))
        throw new Error("candidate_parent_escape");
      const current = stableFile(target);
      if (current === null) throw new Error("candidate_target_unknown");
      const backup =
        current === false
          ? null
          : path.join(transactionRoot, `${index}.backup`);
      if (backup) fs.renameSync(target, backup);
      applied.push(Object.freeze({ target, backup }));
      if (entry.operation === "upsert") {
        if (entry.contentBase64 === null)
          throw new Error("candidate_content_missing");
        const content = Buffer.from(entry.contentBase64, "base64");
        const temporary = path.join(parent, `.crdd-adopt-${randomUUID()}.tmp`);
        fs.writeFileSync(temporary, content, { flag: "wx", mode: 0o600 });
        fs.renameSync(temporary, target);
        const observed = stableFile(target);
        if (
          observed === false ||
          observed === null ||
          createHash("sha256").update(observed).digest("hex") !== entry.sha256
        )
          throw new Error("candidate_apply_readback_failed");
      }
    }
    fs.rmSync(transactionRoot, { recursive: true });
    return true;
  } catch {
    let recovered = true;
    for (const item of [...applied].reverse()) {
      try {
        const current = stableFile(item.target);
        if (current !== false) fs.rmSync(item.target);
        if (item.backup) fs.renameSync(item.backup, item.target);
      } catch {
        recovered = false;
      }
    }
    if (recovered) fs.rmSync(transactionRoot, { recursive: true, force: true });
    return false;
  }
}

export function createRuntimeOwnedProjectCandidateIntegrationAdapter(
  repositoryRoot: string,
  candidateStore: CandidateStore = productionCandidateStore,
): ProjectRuntimeIntegrationDependencies {
  const integrated = new Map<string, Bundle>();
  let pendingObservationBundle: Bundle | null = null;
  return Object.freeze({
    async createCandidate({ state, taskCandidateIds }) {
      const merged = merge(candidateStore, state, taskCandidateIds);
      if (!merged) return null;
      let candidateId = `integration-${merged.bundle.patchHash}`;
      if (merged.conflicts.length === 0) {
        const staged = candidateStore.persist(merged.bundle, {
          candidatePersistenceAllowed: true,
          candidateRetentionHours: 24,
          informationClassification: merged.classification,
        });
        if (staged?.status !== "staged") return null;
        const published = candidateStore.publish(staged.candidateRecoveryId);
        if (published?.status !== "published") return null;
        candidateId = published.candidateId;
        integrated.set(candidateId, merged.bundle);
      }
      pendingObservationBundle = merged.bundle;
      const evidence = Object.fromEntries(
        state.objectives.map((objective) => [
          objective.definition.id,
          Object.freeze(
            objective.definition.acceptanceCriteria.map(
              (_, index) =>
                `evidence-${digest(candidateId, objective.definition.id, String(index)).slice(0, 40)}`,
            ),
          ),
        ]),
      );
      return Object.freeze({
        status: "candidate",
        candidateId,
        candidateHash: merged.bundle.contentManifestHash,
        baseRevision: state.repositoryRevision,
        changedPaths: merged.bundle.changedPaths,
        objectiveEvidence: Object.freeze(evidence),
        milestoneEvidence: Object.freeze(
          state.milestone.acceptanceCriteria.map(
            (_, index) =>
              `evidence-${digest(candidateId, state.milestoneId, String(index)).slice(0, 40)}`,
          ),
        ),
        conflicts: merged.conflicts,
        cleanupConfirmed: true,
      });
    },
    observeCanonicalRepository() {
      const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
      const bundle = pendingObservationBundle;
      if (!identity || !bundle || identity.commit !== bundle.baseCommit)
        return null;
      const base = materializeBase(
        repositoryRoot,
        bundle.baseCommit,
        bundle.changedPaths,
      );
      if (!base) return null;
      try {
        const clean = currentMatchesBase(repositoryRoot, base, bundle.entries);
        return Object.freeze({
          status: "observed",
          repositoryRevision: identity.commit,
          dirty: !clean,
          observedPaths: Object.freeze(clean ? [] : [...bundle.changedPaths]),
        });
      } finally {
        fs.rmSync(base, { recursive: true, force: true });
      }
    },
    async adoptCandidate(candidate) {
      const bundle =
        integrated.get(candidate.candidateId) ??
        exported(candidateStore, candidate.candidateId)?.bundle;
      if (
        !bundle ||
        bundle.baseCommit !== candidate.baseRevision ||
        bundle.contentManifestHash !== candidate.candidateHash ||
        JSON.stringify(bundle.changedPaths) !==
          JSON.stringify(candidate.changedPaths)
      )
        return null;
      const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
      if (!identity || identity.commit !== bundle.baseCommit) return null;
      const base = materializeBase(
        repositoryRoot,
        bundle.baseCommit,
        bundle.changedPaths,
      );
      if (!base) return null;
      try {
        if (!currentMatchesBase(repositoryRoot, base, bundle.entries))
          return null;
        if (!applyBundle(repositoryRoot, bundle)) return null;
      } finally {
        fs.rmSync(base, { recursive: true, force: true });
      }
      return Object.freeze({
        status: "completed",
        receiptId: `adoption-${digest(candidate.candidateId, bundle.patchHash).slice(0, 40)}`,
        beforeRevision: bundle.baseCommit,
        afterRevision: bundle.baseCommit,
        changedPaths: bundle.changedPaths,
        cleanupConfirmed: true,
      });
    },
  });
}

export function describeProjectRuntimeCandidateIntegrationAdapterContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_CANDIDATE_INTEGRATION_ADAPTER_CONTRACT,
    source: "runtime_owned_candidate_store",
    conflictDetection: "same_path_different_operation_or_content",
    adoption: "fresh_base_match_atomic_per_path_with_bounded_rollback",
    canonicalCommitCreated: false,
  });
}
