/**
 * ProjectQueueStateが扱う値の構造を表す。
 *
 * @responsibility ProjectQueueStateに必要な値と制約を一つの型契約として保持する。
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
 * ProjectQueueEntryが扱う値の構造を表す。
 *
 * @responsibility ProjectQueueEntryに必要な値と制約を一つの型契約として保持する。
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
