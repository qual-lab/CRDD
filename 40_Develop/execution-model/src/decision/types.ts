/**
 * Blockerの提案・回答・適用履歴の保存値と操作契約を定義する。
 * @responsibility 保存Schemaを変更せず、完成操作と検査が共有する型の正本を持つ。
 * @trace ARCH-000008
 */

import type { CoordinatorSnapshot } from "../state/types.ts";
import type { COORDINATOR_HUMAN_DECISION_CONTRACT } from "./validation.ts";

/** 同一保存内で判断の意味を検査する区画。保存RootやAuthorityは含めない。 */
export type DecisionSnapshot = Pick<
  CoordinatorSnapshot,
  | "decisions"
  | "blockers"
  | "projects"
  | "queueEntries"
  | "leaseIntents"
  | "results"
>;

/** 認証済み入口が同じ対象へ搬送する判断操作。Bearerや自由入力の主体を含まない。 */
export type CoordinatorDecisionRequest = Readonly<{
  operation: "request" | "answer" | "apply" | "close";
  decisionId: string;
  projectId: string;
  milestoneId: string;
  generation: number;
  repositoryRevision: string;
}> &
  (
    | Readonly<{
        operation: "request";
        blockerId: string;
        queueId: string;
        question: string;
        allowedOptions: readonly ("resume" | "cancel")[];
      }>
    | Readonly<{
        operation: "answer";
        selectedOption: "resume" | "cancel";
        comment?: string;
      }>
    | Readonly<{ operation: "apply" }>
    | Readonly<{
        operation: "close";
        status: "invalidated";
        reason: string;
      }>
  );

/** 状態と履歴の確定を区別する非秘密な公開結果。 */
export type CoordinatorDecisionResult = Readonly<{
  contract: typeof COORDINATOR_HUMAN_DECISION_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  decisionId: string | null;
  recoveryId: string | null;
  decision: Decision | null;
  history:
    | Readonly<{ status: "confirmed" }>
    | Readonly<{ status: "unconfirmed"; reason: string }>
    | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  effectState: "settled" | "no_effect" | "unknown";
}>;

/**
 * 判断の所属先と、回答が対象とする業務世代を定義する。
 * @responsibility Objective／Task／Milestoneを区別し、Attemptを所有者にしない。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @boundary Repository内の判断値。認可・実資源の所在を表さない。
 */
export type DecisionTarget = Readonly<{
  projectId: string;
  milestoneId: string;
  kind: "objective" | "task" | "milestone";
  id: string;
  generation: number;
  repositoryRevision: string;
}>;

/**
 * 進行できない理由を判断要求とは別に保持する。
 * @responsibility 問題を一件保持し、現在の提案と過去の提案・回答を分離する。
 * @trace ARCH-000004、ARCH-000008
 * @invariant resolvedだけで実行開始やCleanup完了を意味しない。
 * @boundary 状態値。解消の許可と実施は各Lifecycleが所有する。
 */
export type Blocker = Readonly<{
  blockerId: string;
  target: DecisionTarget;
  reason: string;
}> &
  (
    | Readonly<{ status: "active" | "resolved" }>
    | Readonly<{ status: "cancelled"; cancelledByDecisionId: string }>
  ) &
  (
    | Readonly<{ kind: "human_decision"; currentDecisionId: string }>
    | Readonly<{
        kind: "dependency" | "input" | "resource" | "recovery";
        currentDecisionId: null;
      }>
  );

/**
 * 判断要求の非秘密な本文を固定する。
 * @responsibility 質問、表示付き選択肢、対象を後の回答・履歴へ引き継ぐ。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @invariant Bearer Capability、Host Path、保存済み認可を持たない。
 * @boundary 信頼入口で認可された要求とDomain値。
 */
export type DecisionRequest = Readonly<{
  decisionId: string;
  blockerId: string;
  respondentPrincipalId: string;
  target: DecisionTarget;
  question: string;
  requestedAt: string;
}> &
  (
    | Readonly<{
        kind: "continuation";
        queueId: string;
        options: readonly Readonly<{
          value: "resume" | "cancel";
          label: string;
        }>[];
      }>
    | Readonly<{
        kind: "acceptance";
        options: readonly Readonly<{
          value: "accept" | "return" | "wait";
          label: string;
        }>[];
      }>
  );

/**
 * 人間の回答を、実際の状態への反映とは別の事実として保持する。
 * @responsibility 回答者・日時・選択・理由・根拠を欠測補完せず保存する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @boundary Principalは入口から搬送する値であり、本人認証の証明ではない。
 */
export type DecisionAnswer = Readonly<{
  principalId: string;
  answeredAt: string;
  selectedOption: "resume" | "cancel" | "accept" | "return" | "wait";
  reason: string | null;
  evidenceIds: readonly string[];
}>;

/**
 * 同じState更新で確定する判断の適用事実を定義する。
 * @responsibility 適用相関、前後世代、実際の状態変化とBlocker処置を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 保留の適用も表せる。適用済みをBlocker解消へ読み替えない。
 * @boundary 純粋候補と唯一のState Writer。保存成功は別途確認する。
 */
export type DecisionApplication = Readonly<{
  applicationId: string;
  appliedAt: string;
  beforeGeneration: number;
  afterGeneration: number;
  previousState: string;
  nextState: string;
  blockerResolved: boolean;
}>;

/**
 * 回答の受理と適用可否を相関する結果値。
 * @responsibility 未適用理由を必須にし、未確認の適用を成功にしない。
 * @trace ARCH-000004、ARCH-000008
 * @boundary 値契約。現在の認可・保存・実行を代替しない。
 */
export type DecisionResult = Readonly<{ answer: DecisionAnswer }> &
  (
    | Readonly<{ status: "applied"; application: DecisionApplication }>
    | Readonly<{ status: "unapplied"; reason: string }>
  );

/**
 * 一つの提案と、最大一件の回答・適用・明示無効化の相関を保持する。
 * @responsibility 同じBlockerへの再提案を別IDで保持し、過去回答を上書きしない。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @invariant pendingに回答を持たせず、終端化しても既存回答を失わない。
 * @boundary 新Schemaの保存値。明示受入・継続判断を同じRoot Writerへ接続する。
 */
export type Decision = DecisionRequest &
  (
    | Readonly<{ status: "pending"; result: null }>
    | Readonly<{
        status: "answered";
        result: Extract<DecisionResult, { status: "unapplied" }>;
      }>
    | Readonly<{
        status: "applied";
        result: Extract<DecisionResult, { status: "applied" }>;
      }>
    | Readonly<{
        status: "invalidated";
        result: DecisionResult | null;
        closedAt: string;
        closeReason: string;
      }>
  );

/**
 * 判断記録から再構成する、内容付きの履歴イベント。
 * @responsibility 元の質問・表示付き選択肢と、出来事時点の回答・適用を残す。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @invariant 薄いID参照だけにせず、要求イベントへ未来の回答を混入しない。
 * @boundary 内部投影。追記・重複照合・退役確認は履歴保存Ownerが行う。
 */
export type DecisionHistoryEvent = Readonly<{
  eventId: string;
  decisionId: string;
  blockerId: string;
  respondentPrincipalId: string;
  target: DecisionTarget;
  question: string;
  options: DecisionRequest["options"];
  occurredAt: string;
}> &
  (
    | Readonly<{ kind: "decision_requested" }>
    | Readonly<{ kind: "decision_answered"; answer: DecisionAnswer }>
    | Readonly<{
        kind: "decision_applied";
        answer: DecisionAnswer;
        application: DecisionApplication;
      }>
    | Readonly<{
        kind: "decision_invalidated";
        reason: string;
      }>
  );

/**
 * Coordinatorの受入判断対象を定義する。
 *
 * @responsibility Objective判断とMilestone判断を混同しない対象区分を所有する。
 * @trace ARCH-000005
 * @shape `objective`または`milestone`のいずれか一つを表す。
 * @invariant Task、ProjectionまたはProviderを受入判断対象へ昇格しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: 型宣言はAuthorityや秘密値を保持しない。
 * @compatibility 利用側は宣言済みの二つの対象区分だけへ依存する。
 */
export type CoordinatorAcceptanceTarget = "objective" | "milestone";

/**
 * Coordinatorの明示的な受入判断を定義する。
 *
 * @responsibility 受入、差戻し、判断待ちを別の判断値として所有する。
 * @trace ARCH-000005
 * @shape `accept`、`return`、`wait`のいずれか一つを表す。
 * @invariant Task完了または下位状態から判断値を推定しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: 型宣言はAuthorityや秘密値を保持しない。
 * @compatibility 利用側は宣言済みの三つの判断値だけへ依存する。
 */
export type CoordinatorAcceptanceDecision = "accept" | "return" | "wait";

/**
 * Coordinator受入判断の状態遷移入力を定義する。
 *
 * @responsibility exactな対象、判断および判断根拠の組を型境界として所有する。
 * @trace ARCH-000005
 * @shape 対象区分、対象ID、判断および根拠ID列を表す。
 * @invariant ObjectiveとMilestoneの対象IDを同じ入力で兼用しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority検証はApplication境界が所有し、本型は秘密値を保持しない。
 * @compatibility 利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorAcceptanceDecisionInput = Readonly<{
  target: CoordinatorAcceptanceTarget;
  targetId: string;
  decision: CoordinatorAcceptanceDecision;
  criterionEvidenceIds: readonly string[];
}>;

/** 判断の状態確定と履歴確定を分けて返す。未確定履歴を未適用へ畳まない。 */
export type DecisionSaveValue = Readonly<{
  decision: Decision;
  history:
    | Readonly<{ status: "confirmed" }>
    | Readonly<{ status: "unconfirmed"; reason: string }>;
}>;
