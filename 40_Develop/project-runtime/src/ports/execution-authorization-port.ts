import type { ProjectRuntimePortResult } from "./port-result.ts";

/**
 * ProjectRuntimeExecutionAuthorizationRequestが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeExecutionAuthorizationRequestに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeExecutionAuthorizationRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeExecutionAuthorizationRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeExecutionAuthorizationRequestの宣言は外部境界を開かない。
 * @security ProjectRuntimeExecutionAuthorizationRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeExecutionAuthorizationRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
 * @responsibility ProjectRuntimeExecutionAuthorizationPortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeExecutionAuthorizationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeExecutionAuthorizationPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeExecutionAuthorizationPortの宣言は外部境界を開かない。
 * @security ProjectRuntimeExecutionAuthorizationPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeExecutionAuthorizationPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeExecutionAuthorizationPort = Readonly<{
  issue: (
    request: ProjectRuntimeExecutionAuthorizationRequest,
  ) => ProjectRuntimePortResult<object>;
  revokeUnused: (capability: object) => ProjectRuntimePortResult<null>;
}>;
