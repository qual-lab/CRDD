/**
 * execution-authorization-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorExecutionAuthorizationRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { OrchestratorPortResult } from "../operation-result.ts";

/**
 * execution-authorization-portで使用するOrchestrator Execution Authorization Requestの値契約を定義する。
 *
 * @responsibility Orchestrator Execution Authorization RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorExecutionAuthorizationRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionAuthorizationRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionAuthorizationRequestの宣言は外部境界を開かない。
 * @security OrchestratorExecutionAuthorizationRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorExecutionAuthorizationRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionAuthorizationRequest = Readonly<{
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
 * @responsibility Orchestrator Execution Authorization PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorExecutionAuthorizationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionAuthorizationPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionAuthorizationPortの宣言は外部境界を開かない。
 * @security OrchestratorExecutionAuthorizationPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorExecutionAuthorizationPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionAuthorizationPort = Readonly<{
  issue: (
    request: OrchestratorExecutionAuthorizationRequest,
  ) => OrchestratorPortResult<object>;
  revokeUnused: (capability: object) => OrchestratorPortResult<null>;
}>;
