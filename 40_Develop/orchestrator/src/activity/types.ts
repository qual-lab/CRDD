/**
 * 認可済みRepositoryから投影する活動の値契約。
 * @responsibility 現在状態、履歴、出所と継続位置を閉じる。
 * @trace ARCH-000004
 */
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import type { OrchestratorProjection } from "../state/transitions.ts";

/**
 * 一Repositoryの読取り入力。
 * @responsibility 呼出側が今回認可したIdentityと技術的Root能力を保持する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type ActivityRepository = Readonly<{
  projectId: string;
  repositoryId: string;
  root: VerifiedRepositoryRoot;
}>;

/**
 * 一Repositoryの観測出所。
 * @responsibility 現在のGit改訂の既知・不明を区別する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type ActivitySource = Readonly<{
  repositoryId: string;
  revision: string | null;
}>;

/**
 * 活動へ投影する一実行Event。
 * @responsibility Execution Intelligenceの非秘密要約とRepository出所を保持する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type RuntimeActivityEvent = Readonly<{
  repositoryId: string;
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
 * 一要求の閉じた活動観測。
 * @responsibility 現在状態と履歴を独立判定し出所を固定する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type RuntimeActivityObservation = Readonly<{
  projectId: string;
  state: "observed" | "absent" | "unknown";
  reason: string;
  projection: OrchestratorProjection | null;
  currentSourceRepositoryId: string | null;
  sources: readonly ActivitySource[];
  eventState: "observed" | "unknown";
  eventReason: string;
  events: readonly RuntimeActivityEvent[];
  eventContinuation: string | null;
}>;

/**
 * 認可済み活動取得の入力。
 * @responsibility 同じProjectの全許可対象とページ要求を一回へ結合する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type RuntimeActivityRequest = Readonly<{
  projectId: string;
  repositories: readonly ActivityRepository[];
  limit: number;
  cursor?: string;
}>;
