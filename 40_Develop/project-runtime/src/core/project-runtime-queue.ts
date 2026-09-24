/**
 * project-runtime-queueに属する責務をまとめる。
 *
 * @responsibility ProjectQueueStateを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * project-runtime-queueで使用するProject Queue 状態の値契約を定義する。
 *
 * @responsibility Project Queue 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectQueueStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectQueueStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectQueueStateの宣言は外部境界を開かない。
 * @security N/A: ProjectQueueStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectQueueStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectQueueState =
  | "queued"
  | "leased"
  | "running"
  | "waiting_foreground"
  | "integration_pending"
  | "replan_required"
  | "human_decision_required"
  | "recovery_required"
  | "completed"
  | "cancelled";

/**
 * project-runtime-queueで使用するProject Queue Entryの値契約を定義する。
 *
 * @responsibility Project Queue EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectQueueEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectQueueEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectQueueEntryの宣言は外部境界を開かない。
 * @security N/A: ProjectQueueEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectQueueEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectQueueEntry = Readonly<{
  queueId: string;
  projectId: string;
  milestoneId: string;
  requestHash: string;
  originLane: "interactive" | "scheduled";
  repositoryRevision: string;
  scopeHash: string;
  state: ProjectQueueState;
  generation: number;
  ownerGeneration: string | null;
  resumeCondition: string | null;
  resultReference: string | null;
}>;
