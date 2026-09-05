import { types as utilTypes } from "node:util";

import type {
  ProjectRuntimeExecutionAuthorizationPort,
  ProjectRuntimeExecutionAuthorizationRequest,
} from "../../../project-runtime/src/index.ts";

export type ProjectRuntimeExecutionAuthorizationAdapterDependencies = Readonly<{
  issueRuntimeCapability: () => object | null;
  revokeRuntimeCapability?: (capability: object) => boolean;
}>;

function isOpaqueCapability(value: unknown): value is object {
  return (
    typeof value === "object" && value !== null && !utilTypes.isProxy(value)
  );
}

function validIdentity(value: string) {
  return (
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validRequest(request: ProjectRuntimeExecutionAuthorizationRequest) {
  return (
    validIdentity(request.projectId) &&
    validIdentity(request.milestoneId) &&
    validIdentity(request.taskId) &&
    validIdentity(request.attemptId) &&
    validIdentity(request.operationId) &&
    validIdentity(request.authorityBindingId) &&
    /^[0-9a-f]{40,64}$/u.test(request.repositoryRevision)
  );
}

/** Bind the Project Runtime authorization Port to the signed package gate. */
export function createProjectRuntimeExecutionAuthorizationAdapter(
  dependencies: ProjectRuntimeExecutionAuthorizationAdapterDependencies,
): ProjectRuntimeExecutionAuthorizationPort {
  return Object.freeze({
    issue(request) {
      let isValid = false;
      try {
        isValid = validRequest(request);
      } catch {
        isValid = false;
      }
      if (!isValid)
        return Object.freeze({
          status: "blocked" as const,
          reason: "project_runtime_execution_authorization_request_invalid",
          value: null,
          manualRecoveryRequired: false,
          recoveryId: null,
        });
      try {
        const capability = dependencies.issueRuntimeCapability();
        return isOpaqueCapability(capability)
          ? Object.freeze({
              status: "completed" as const,
              reason: "project_runtime_execution_authorization_issued",
              value: capability,
            })
          : Object.freeze({
              status: "blocked" as const,
              reason: "project_runtime_execution_authorization_not_issued",
              value: null,
              manualRecoveryRequired: false,
              recoveryId: null,
            });
      } catch {
        return Object.freeze({
          status: "blocked" as const,
          reason: "project_runtime_execution_authorization_issue_unknown",
          value: null,
          manualRecoveryRequired: true,
          recoveryId: null,
        });
      }
    },
    revokeUnused(capability) {
      try {
        return isOpaqueCapability(capability) &&
          dependencies.revokeRuntimeCapability?.(capability) === true
          ? Object.freeze({
              status: "completed" as const,
              reason: "project_runtime_execution_authorization_revoked",
              value: null,
            })
          : Object.freeze({
              status: "blocked" as const,
              reason: "project_runtime_execution_authorization_revoke_unknown",
              value: null,
              manualRecoveryRequired: true,
              recoveryId: null,
            });
      } catch {
        return Object.freeze({
          status: "blocked" as const,
          reason: "project_runtime_execution_authorization_revoke_unknown",
          value: null,
          manualRecoveryRequired: true,
          recoveryId: null,
        });
      }
    },
  });
}
