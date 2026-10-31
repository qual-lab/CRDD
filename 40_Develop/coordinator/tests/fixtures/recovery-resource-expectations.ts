/**
 * 実境界試験の期待構成を既存DIの正本から構築する。
 * @responsibility 製品の回収Ownerではなく試験の構成Oracleだけを所有する。
 * @trace ERB-IT-014
 * @boundary 試験専用。Docker処置・保存・Authorityを発行しない。
 */
import {
  isDockerResourcePurpose,
  planDockerRecoveryResourceExpectations,
  codexAdviceProviderInitRequired,
} from "../../../docker-isolation/src/index.ts";
import type { CoordinatorStateTaskOperation } from "../../../domain-model/src/index.ts";

export function expectedRecoveryResources(
  operation: CoordinatorStateTaskOperation,
) {
  if (
    operation.resources.length !== 5 ||
    new Set(operation.resources.map((resource) => resource.purpose)).size !==
      5 ||
    operation.resources.some(
      (resource) => !isDockerResourcePurpose(resource.purpose),
    )
  )
    throw new Error("docker_task_recovery_resource_missing");
  const identity = JSON.parse(operation.identityJson);
  const plan = planDockerRecoveryResourceExpectations({
    authenticationContainerName: identity.resources.auth,
    executionContainerName: identity.resources.provider,
    proxyContainerName: identity.resources.proxy,
    internalNetworkName: identity.resources.internal,
    egressNetworkName: identity.resources.egress,
    ownershipLabel: identity.ownershipLabel,
    executionImageDigest: identity.images.provider,
    proxyImageDigest: identity.images.proxy,
    workspaceMounted: identity.operationMode === "isolated_task",
    workspaceReadOnly: identity.workspaceMountMode === "read_only",
    ...(identity.workspaceProtected === true
      ? {
          workspaceProtected: true,
          workspaceProtection: identity.workspaceProtection,
        }
      : {}),
    initRequired: codexAdviceProviderInitRequired(
      identity.operationMode,
      identity.images.provider,
    ),
  });
  if (!plan) throw new Error("docker_task_recovery_resource_missing");
  return Object.freeze(
    plan.map((entry) => {
      const resource = operation.resources.find(
        (candidate) => candidate.purpose === entry.purpose,
      );
      if (!resource) throw new Error("docker_task_recovery_resource_missing");
      return Object.freeze({ ...entry, resource });
    }),
  );
}
