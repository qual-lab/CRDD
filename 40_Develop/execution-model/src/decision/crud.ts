/**
 * Blockerの提案・回答・適用履歴の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import type { Repository } from "../../../version-control/src/index.ts";
import { withSnapshotOperation, writeSnapshotOwned } from "../state/crud.ts";
import { validId } from "../state/validation.ts";
import { encodeStateValue } from "../state/operations.ts";
import type { HistoryRepositoryInput, StoreResult } from "../storage/lock.ts";
import { blocked, completed } from "../storage/lock.ts";
import {
  readDecisionHistoryOwned,
  updateHistoryOwned,
} from "../storage/store.ts";
import type {
  Decision,
  DecisionAnswer,
  DecisionRequest,
  DecisionSaveValue,
} from "./types.ts";
import {
  prepareDecisionApplying,
  prepareDecisionClosing,
  prepareDecisionCreation,
  prepareDecisionRecording,
  prepareDecisionSubmission,
} from "./validation.ts";

/**
 * 判断とBlockerを、既存の短期Ownerと単一Writerで登録する。
 * @responsibility 対象照合とID再送の候補を一回の保存へ接続する。
 * @trace ARCH-000004、ARCH-000008
 * @input repository: 検証済みRepository、binding: 現在受付結合、request: 認可済み要求。
 * @returns 保存・解放確認付き判断結果。
 * @precondition 現在の認可は信頼入口で検査済み。
 * @postcondition 同一要求の再送では保存しない。
 * @effect 固定stateの読取りと、必要な一回の出版。
 * @failure 対象差・競合・保存又は解放不明は停止。
 * @invariant Host Store・Capability・AI実行を発行しない。
 * @boundary 新判断契約と既存物理Writer。Root公開は本番切替時に行う。
 * @security Repositoryの内容を認可として復元しない。
 * @concurrency 取得からfresh読取り・候補・保存まで同じOwnerを保持する。
 */
export function requestDecision(
  repository: Repository | HistoryRepositoryInput,
  binding: string,
  request: DecisionRequest,
) {
  return saveDecision(repository, binding, { kind: "request", request });
}

/**
 * 回答・適用結果・対象状態・Queueを一回のState保存で確定する。
 * @responsibility 分離したprepared／finalized保存を使わず、全関連区画を同じCASへ載せる。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input repository／binding: 確認済み所在と受付、decisionId: 対象、answer: 認可済み回答。
 * @returns 同じ回答の再観測又は一回保存した判断結果。
 * @precondition 認証・現在認可は入口が所有する。
 * @postcondition 部分適用を成功にしない。履歴確定は別結果で扱う。
 * @effect 一回の短期排他内で読取り・固定state出版・確認。
 * @failure 不正回答・別回答再送・失効・保存不明は停止。
 * @invariant 自動再実行と履歴保存済みflagの追加保存を行わない。
 * @boundary 判断の一括更新と単一物理保存。
 * @security Capabilityを発行せずPrincipalを推測しない。
 * @concurrency 同じ元版とWriterのCASを使用する。
 */
export function answerDecision(
  repository: Repository | HistoryRepositoryInput,
  binding: string,
  decisionId: string,
  answer: DecisionAnswer,
  expected: Decision | null = null,
) {
  return saveDecision(repository, binding, {
    kind: "answer",
    decisionId,
    answer,
    expected,
  });
}

/**
 * 保存済み回答の明示適用を、同OwnerのState／Historyへ接続する。
 * @responsibility 回答不変・freshな期限と対象・一回CASを維持する。
 * @trace ARCH-000004、ARCH-000008
 * @input repository/binding: 認可済み所在、decisionId: 対象判断。
 * @returns 適用と履歴確定を分けた結果。
 * @precondition 信頼入口が現在認証・認可を確認する。
 * @postcondition 同じ適用の再送で状態を再適用しない。
 * @effect 必要なState一回保存と既存History出版。
 * @failure 対象・期限・Queue・保存不明は停止。
 * @invariant AI・自動回復を発行しない。
 * @boundary 判断の意味と単一Writer。
 * @security 保存済み回答は認可ではない。
 * @concurrency 同じOwnerでfresh確認・CAS・解放を行う。
 */
export function applyDecision(
  repository: Repository | HistoryRepositoryInput,
  binding: string,
  decisionId: string,
  expected: Decision | null = null,
) {
  return saveDecision(repository, binding, {
    kind: "apply",
    decisionId,
    expected,
  });
}

/**
 * 未適用判断の明示閉鎖を同じState／Historyへ保存する。
 * @responsibility 既存回答を保持し、BlockerやQueueを閉鎖から自動解消しない。
 * @trace ARCH-000004、ARCH-000008
 * @input repository/binding: 認可済み所在、decisionId/status/reason: 明示処置。
 * @returns 閉鎖と履歴確定を分けた結果。
 * @precondition 信頼入口が現在認証・認可を確認する。
 * @postcondition 同じ閉鎖再送でStateを再保存しない。
 * @effect 必要なState一回保存と既存History出版。
 * @failure 適用済み・不正閉鎖・保存不明は停止。
 * @invariant 無効化を業務進行や実行再開と扱わない。
 * @boundary 判断の明示処置と単一Writer。
 * @security 新しい認可を発行しない。
 * @concurrency 同じOwnerでfresh確認・CAS・解放を行う。
 */
export function closeDecision(
  repository: Repository | HistoryRepositoryInput,
  binding: string,
  decisionId: string,
  status: "invalidated",
  reason: string,
  expected: Decision | null = null,
) {
  return saveDecision(repository, binding, {
    kind: "close",
    decisionId,
    status,
    reason,
    expected,
  });
}

/**
 * 認可済みの明示判断を、質問・回答・状態の一回保存と履歴へ接続する。
 * @responsibility 要求と回答を別々に保存せず、既存の判断Writerを利用する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input repository／binding: 検証済み所在、request／answer: 信頼入口で確認した判断、expectedApplied: 再送だけに限定する非Authorityの比較値。
 * @returns State確定と履歴確定を分けた判断結果。
 * @precondition 認証・現在認可・質問の発生条件は呼出し元が確認する。
 * @postcondition 不正回答では要求だけを保存しない。
 * @effect 一回のState保存と、既存履歴Writerによる出版。
 * @failure 対象差・別回答・観測不能は停止。履歴未確定を未適用へ戻さない。
 * @invariant 新しいStore・prepared保存・Provider Effectを作らない。expectedApplied指定時は同Ownerの既存applied全文一致が必須で、新規作成へ戻らない。
 * @boundary 信頼入口からDomainの単一Writer。
 * @security 保存値を実行認可として再利用しない。
 * @concurrency 同一Owner下のfresh値とCASを用いる。
 */
export function recordDecision(
  repository: Repository | HistoryRepositoryInput,
  binding: string,
  request: DecisionRequest,
  answer: DecisionAnswer,
  expectedApplied: Decision | null = null,
) {
  return saveDecision(repository, binding, {
    kind: "record",
    request,
    answer,
    expectedApplied,
  });
}

/**
 * 現在Stateの一判断を検証済みRepositoryから読み取る。
 * @responsibility 不存在と保存観測不能を区別し、Host Storeを参照しない。
 * @trace ARCH-000004、ARCH-000008
 * @input repository／binding: 認可済み所在、decisionId: 対象ID。
 * @returns 現在の判断又は真正不存在のnull。観測不能はblocked。
 * @precondition 信頼入口で内容権限を検査する。
 * @postcondition 判断を適用・退役せず、生Snapshotを返さない。履歴pendingがあっても検証済みStateの値だけを返す。
 * @effect 既存短期Lockと現在Stateの読取り。
 * @failure 不正ID・Root・保存・解放不明は停止。
 * @invariant 履歴を現在判断へ自動復元しない。
 * @boundary 内容参照と固定State Reader。
 * @security Principal・Pathを推測せず、値を認証の証明にしない。
 * @concurrency 同Ownerの読取りと解放確認を使用する。
 */
export function readDecision(
  repository: Repository,
  binding: string,
  decisionId: string,
): StoreResult<Decision | null> {
  if (!validId(decisionId)) return blocked("decision_identity_invalid");
  return withSnapshotOperation<Decision | null>(
    repository,
    binding,
    (current) =>
      completed("decision_observed", {
        next: null,
        value:
          current.decisions.find((item) => item.decisionId === decisionId) ??
          null,
      }),
    "history",
  );
}

/**
 * 同じOwnerで前回の履歴出版を再入場し、判断を一回保存して履歴を確定する。
 * @responsibility 状態と履歴の二つの確定事実を保持し、保存済みflagの追加保存をしない。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input repository／binding: 現在の保存先、input: 固定用途の要求又は回答。
 * @returns State確認済みの判断と履歴結果、又は状態確認不能の停止。
 * @precondition 信頼入口が現在認可を確認する。
 * @postcondition 履歴失敗時も適用結果を返し、元判断をStateに残す。
 * @effect 必要なState出版一回と、欠測履歴の論理追記一回。
 * @failure 前回出版不整合・状態保存不明は停止。履歴未確定は別結果。
 * @invariant 空Hook・第三Writer・別pending集合・追加flag保存を作らない。
 * @boundary 既存短期OwnerとState／Historyの物理保存。
 * @security 保存値を人間の認可として復元しない。
 * @concurrency 同じOwnerを借用し、取得・解放を内側で繰り返さない。
 */
function saveDecision(
  repository: Repository | HistoryRepositoryInput,
  binding: string,
  input:
    | Readonly<{ kind: "request"; request: DecisionRequest }>
    | Readonly<{
        kind: "record";
        request: DecisionRequest;
        answer: DecisionAnswer;
        expectedApplied: Decision | null;
      }>
    | Readonly<{
        kind: "answer";
        decisionId: string;
        answer: DecisionAnswer;
        expected: Decision | null;
      }>
    | Readonly<{ kind: "apply"; decisionId: string; expected: Decision | null }>
    | Readonly<{
        kind: "close";
        decisionId: string;
        status: "invalidated";
        reason: string;
        expected: Decision | null;
      }>,
): StoreResult<DecisionSaveValue> {
  // ID照会・履歴の再入場より前に捕捉する。getterやProxyに処置の順序を渡さない。
  try {
    input = JSON.parse(encodeStateValue(input)) as typeof input;
  } catch {
    return blocked("decision_input_invalid");
  }
  return withSnapshotOperation<DecisionSaveValue>(
    repository,
    binding,
    (current, owner) => {
      if (
        (input.kind === "answer" ||
          input.kind === "apply" ||
          input.kind === "close") &&
        input.expected !== null
      ) {
        const existing = current.decisions.find(
          (record) => record.decisionId === input.decisionId,
        );
        if (
          !existing ||
          encodeStateValue(existing) !== encodeStateValue(input.expected)
        )
          return blocked("decision_target_changed_before_save");
      }
      if (input.kind === "record" && input.expectedApplied !== null) {
        const existing = current.decisions.find(
          (record) => record.decisionId === input.request.decisionId,
        );
        if (
          existing?.status !== "applied" ||
          input.expectedApplied.status !== "applied" ||
          encodeStateValue(existing) !== encodeStateValue(input.expectedApplied)
        )
          return blocked("decision_replay_state_changed");
        const replay = prepareDecisionRecording(
          current,
          input.request,
          input.answer,
          new Date().toISOString(),
        );
        if (
          replay.status !== "completed" ||
          replay.value.next !== null ||
          replay.value.value.status !== "applied"
        )
          return blocked("decision_replay_state_changed");
      }
      const resumed = updateHistoryOwned(
        owner,
        null,
        Date.now(),
        "resume_decision",
      );
      if (resumed.status !== "completed")
        return blocked("decision_history_recovery_required", true);
      if (
        (input.kind === "request" || input.kind === "record") &&
        !current.decisions.some(
          (record) => record.decisionId === input.request.decisionId,
        )
      ) {
        const history = readDecisionHistoryOwned(owner, {
          decisionId: input.request.decisionId,
        });
        if (history === null)
          return blocked("decision_history_observation_unknown", true);
        if (history.length > 0) return blocked("decision_identity_retired");
        if (
          !current.blockers.some(
            (item) => item.blockerId === input.request.blockerId,
          )
        ) {
          const previous = readDecisionHistoryOwned(owner, {
            blockerId: input.request.blockerId,
          });
          if (previous === null)
            return blocked("decision_history_observation_unknown", true);
          if (previous.length > 0) return blocked("decision_blocker_retired");
        }
      }
      const candidate =
        input.kind === "request"
          ? prepareDecisionCreation(current, input.request)
          : input.kind === "apply"
            ? prepareDecisionApplying(
                current,
                input.decisionId,
                new Date().toISOString(),
              )
            : input.kind === "close"
              ? prepareDecisionClosing(
                  current,
                  input.decisionId,
                  input.status,
                  new Date().toISOString(),
                  input.reason,
                )
              : input.kind === "record"
                ? prepareDecisionRecording(
                    current,
                    input.request,
                    input.answer,
                    new Date().toISOString(),
                  )
                : prepareDecisionSubmission(
                    current,
                    input.decisionId,
                    input.answer,
                    new Date().toISOString(),
                  );
      if (candidate.status !== "completed") return candidate;
      if (candidate.value.next !== null) {
        const saved = writeSnapshotOwned(
          owner,
          binding,
          encodeStateValue({
            ...candidate.value.next,
            snapshotRevision: current.snapshotRevision + 1,
          }),
          current.snapshotRevision,
        );
        if (saved.status !== "completed") return saved;
      }
      const history = updateHistoryOwned(owner, null, Date.now(), "decision");
      return completed(
        history.status === "completed"
          ? candidate.reason
          : "decision_state_saved_history_unconfirmed",
        {
          next: null,
          value: {
            decision: candidate.value.value,
            history:
              history.status === "completed"
                ? { status: "confirmed" as const }
                : { status: "unconfirmed" as const, reason: history.reason },
          },
        },
      );
    },
    "history",
  );
}
