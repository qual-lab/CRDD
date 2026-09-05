import type { ProjectRuntimePortResult } from "./port-result.ts";

export type ProjectRuntimeExecutionAuthorizationRequest = Readonly<{
  projectId: string;
  milestoneId: string;
  taskId: string;
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
}>;

/**
 * Host authorization for invoking the configured execution Runtime.
 *
 * This capability proves that the fixed Runtime package may be invoked. The
 * narrowed Task meaning remains bound separately by authorityBindingId and the
 * Single Task request; callers must not present this as a Task Authority.
 */
export type ProjectRuntimeExecutionAuthorizationPort = Readonly<{
  issue: (
    request: ProjectRuntimeExecutionAuthorizationRequest,
  ) => ProjectRuntimePortResult<object>;
  revokeUnused: (capability: object) => ProjectRuntimePortResult<null>;
}>;
