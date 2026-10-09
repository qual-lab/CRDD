/**
 * CROSの許可済みRuntime活動観測の型契約。
 *
 * @responsibility 現在投影、Eventの欠測とContinuationを利用側共通の読取り契約として保持する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 */
import type { OrchestratorProjection } from "../../../orchestrator/src/index.ts";
import type { CrosRepository } from "../access/session-context.ts";

/**
 * 許可済みRuntime活動へ投影するEvent要約。
 *
 * @responsibility CROS境界で搬送できる非秘密の実行結果Propertyを固定する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @shape Event、Objective、Task、Attempt、時刻、結果および回復要否を表す。
 * @invariant 生Provider入出力、Credential、PathおよびRecovery Authorityを含まない。
 * @boundary Repository Runtime Activity ReaderとRemote Consumerの型境界。
 * @security Content Grant外RepositoryのEventを入力にも結果にも含めない。
 * @compatibility Event Property追加時はRemote Response Validatorも同時に更新する。
 */
export type CrosRemoteRuntimeEventProjection = Readonly<{
  eventId: string;
  occurredAt: string;
  objectiveId: string;
  taskId: string;
  attemptId: string;
  status: "completed" | "blocked" | "cancelled" | "unknown";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;

/**
 * CROSが利用側へ返すOrchestrator Activity観測。
 *
 * @responsibility 現在状態とEvent観測を独立させ、不完全性とContinuationを同じ結果へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @shape 現在状態、Event状態、理由、投影、PageおよびContinuationを表す。
 * @invariant observedだけが現在投影を持ち、Event観測不能を空集合の意味へ変換しない。
 * @boundary CROSの活動読取りと利用側Projectionの型境界。
 * @security 許可済みRepositoryから導出した表示Propertyだけを含む。
 * @compatibility Workbench等のConsumerは状態語彙を再定義しない。
 */
export type CrosRemoteRuntimeActivityObservation = Readonly<{
  state: "observed" | "absent" | "unknown";
  reason: string;
  projection: OrchestratorProjection | null;
  eventState: "observed" | "unknown";
  eventReason: string;
  events: readonly CrosRemoteRuntimeEventProjection[];
  eventContinuation: string | null;
}>;

/**
 * 認証後に呼び出すRuntime Activity Reader。
 *
 * @responsibility Project IDと許可済みRepository集合をRemote公開可能な一観測へ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @shape read操作だけを持つ読取り専用Portを表す。
 * @invariant CROSはGrant外RepositoryをReaderへ渡さない。
 * @boundary CROS Request Access ContextとRepository Runtime Adapterの境界。
 * @security ReaderはBearer Token、Credential RecordまたはGrant外Identityを受け取らない。
 * @compatibility Runtime書込みまたはRecovery Authorityは別境界とする。
 */
export type CrosRuntimeActivityReader = Readonly<{
  read(input: {
    projectId: string;
    repositories: readonly CrosRepository[];
    cursor?: string;
    limit: number;
  }): Promise<CrosRemoteRuntimeActivityObservation>;
}>;
