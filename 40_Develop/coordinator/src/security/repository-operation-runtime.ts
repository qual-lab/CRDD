import fs from "node:fs";
import path from "node:path";
import { observeFixedRevisionIdentity } from "../../../version-control/src/fixed-revision.ts";
import {
  gitFixedRevisionIdentityAdapter,
  gitRepositoryFormatAdapter,
  gitRepositoryRevisionAdapter,
} from "../../../version-control/src/git/fixed-revision-adapter.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import {
  inspectRepositoryFormat,
  observeRepositoryRevision,
} from "../../../version-control/src/repository-revision.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { isSupportedCrddRuntimeGitObjectId } from "./release-identity-grammar.ts";

export const REPOSITORY_OPERATION_RUNTIME_CONTRACT =
  "crdd-coordinator/repository-operation-runtime";
export const REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION = 2;

type Binding = Readonly<{
  managementCapability: object;
  operationId: string;
  repositoryRoot: string;
  repositoryKind: string;
  logicalRepositoryIdentity: string;
  repositoryInstanceIdentity: string;
  revision: string;
}>;

const bindings = new WeakMap<object, Binding>();
const capabilities = new WeakMap<object, Binding>();

function observe(repositoryRoot: string) {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("repository_root_invalid");
  const observed = observeRepositoryRevision(
    verified.capability,
    gitRepositoryRevisionAdapter,
  );
  if (!observed) throw new Error("repository_revision_invalid");
  return Object.freeze({
    repositoryKind: observed.repositoryForm,
    logicalRepositoryIdentity: observed.repositoryIdentity,
    repositoryInstanceIdentity: observed.repositoryInstanceIdentity,
    revision: observed.revisionIdentity,
  });
}

export function inspectRepositoryObjectFormatCandidate(
  repositoryRoot: unknown,
) {
  try {
    if (
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    const format = inspectRepositoryFormat(
      repositoryRoot,
      gitRepositoryFormatAdapter,
    );
    if (!format) return null;
    return Object.freeze({
      status: "candidate" as const,
      objectFormat: format.objectFormat,
      runtimeSupported: format.objectFormat === "sha1",
      revisionReported: false,
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

export function inspectRepositoryRevisionCandidate(repositoryRoot: unknown) {
  try {
    if (
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    const verified = verifyRepositoryRoot(repositoryRoot);
    if (verified.status !== "completed") return null;
    const identity = observeFixedRevisionIdentity(
      verified.capability,
      gitFixedRevisionIdentityAdapter,
    );
    return identity
      ? Object.freeze({
          status: "candidate" as const,
          commit: identity.revisionIdentity,
          tree: identity.snapshotIdentity,
          repositoryKind: identity.repositoryForm,
          externalGitCliUsed: false,
          repositoryPathReported: false,
        })
      : null;
  } catch {
    return null;
  }
}

/** Read-only identity and HEAD/tree observation for bounded admission. */
export function inspectRepositoryIdentityCandidate(repositoryRoot: unknown) {
  try {
    if (typeof repositoryRoot !== "string") return null;
    const before = observe(repositoryRoot);
    const revision = inspectRepositoryRevisionCandidate(repositoryRoot);
    const after = observe(repositoryRoot);
    if (
      !revision ||
      revision.commit !== before.revision ||
      JSON.stringify(before) !== JSON.stringify(after)
    )
      return null;
    return Object.freeze({ ...before, ...revision });
  } catch {
    return null;
  }
}

export function bindRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
  repositoryRoot: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    if (bindings.has(managementCapability)) return null;
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const observation = observe(repositoryRoot);
    if (!isSupportedCrddRuntimeGitObjectId(observation.revision)) return null;
    const binding = Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      repositoryRoot: fs.realpathSync.native(repositoryRoot),
      ...observation,
    });
    const capability = Object.freeze({});
    bindings.set(managementCapability, binding);
    capabilities.set(capability, binding);
    return Object.freeze({
      operationId: binding.operationId,
      revision: binding.revision,
      repositoryBindingCapability: capability,
      repositoryBound: true as const,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

function currentBinding(managementCapability: unknown) {
  if (!managementCapability || typeof managementCapability !== "object")
    return null;
  const binding = bindings.get(managementCapability);
  if (!binding) return null;
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  if (operation.operationId !== binding.operationId) return null;
  const current = observe(binding.repositoryRoot);
  return current.repositoryKind === binding.repositoryKind &&
    current.logicalRepositoryIdentity === binding.logicalRepositoryIdentity &&
    current.repositoryInstanceIdentity === binding.repositoryInstanceIdentity &&
    current.revision === binding.revision
    ? binding
    : null;
}

export function verifyRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
) {
  try {
    const binding = currentBinding(managementCapability);
    return binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

export function verifyRuntimeOwnedRepositoryBindingCapability(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    return binding?.managementCapability === managementCapability &&
      currentBinding(managementCapability) === binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

export function borrowRuntimeOwnedRepositorySource(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    if (
      !binding ||
      binding.managementCapability !== managementCapability ||
      currentBinding(managementCapability) !== binding ||
      binding.revision.length !== 40
    ) {
      return null;
    }
    return Object.freeze({
      operationId: binding.operationId,
      repositoryRoot: binding.repositoryRoot,
      revision: binding.revision,
    });
  } catch {
    return null;
  }
}

export function describeRepositoryOperationRuntimeContract() {
  return Object.freeze({
    contract: REPOSITORY_OPERATION_RUNTIME_CONTRACT,
    contractRevision: REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION,
    repositoryIdentity:
      "logical_common_git_metadata_plus_worktree_instance_filesystem_identity",
    revision: "exact_head_object_id_reobserved_before_effect_and_result",
    supportedRefs: Object.freeze([
      "loose_heads_tags",
      "packed_heads_tags",
      "detached_head",
    ]),
    pathReported: false,
    callerRevisionAccepted: false,
    internalSourceBorrow:
      "same_runtime_owned_binding_and_current_revision_only",
    runtimeSupportedObjectFormats: Object.freeze(["sha1"]),
    unsupportedObjectFormatResult: "fail_closed_before_operation_effect",
    providerEffectAllowed: false,
  });
}
