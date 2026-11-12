/**
 * 人間判断の要求・回答・履歴を副作用なしで構成する。
 * @packageDocumentation
 * @responsibility 新保存契約の値候補を作り、回答と適用・履歴を分離する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @boundary 内部候補。認可、State遷移、保存、履歴追記は発行しない。
 */
import { isPrincipalId } from "../identity/validation.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import type {
  Blocker,
  Decision,
  DecisionAnswer,
  DecisionApplication,
  DecisionHistoryEvent,
  DecisionRequest,
  DecisionTarget,
} from "./types.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/** 通常データだけを捕捉し、呼出し後の入力変更を候補から切り離す。 */
function capture<T>(value: T): T | null {
  try {
    return JSON.parse(encodeRuntimeStateValue(value)) as T;
  } catch {
    return null;
  }
}

/** 空白だけの表示・理由と過大な値を拒否する。本文を補完しない。 */
function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

/** 日時の曖昧なローカル解釈を避け、UTCの正規表記だけを受理する。 */
function time(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

/** 回答本文だけの閉形式を検査する。現在認可と要求への適合は別に確認する。 */
function validAnswer(reply: DecisionAnswer): boolean {
  return Boolean(
    reply &&
      Object.keys(reply).sort().join() ===
        "answeredAt,evidenceIds,principalId,reason,selectedOption" &&
      isPrincipalId(reply.principalId) &&
      time(reply.answeredAt) &&
      ["resume", "cancel", "accept", "return", "wait"].includes(
        reply.selectedOption,
      ) &&
      (reply.reason === null || text(reply.reason, 8192)) &&
      Array.isArray(reply.evidenceIds) &&
      reply.evidenceIds.length <= 256 &&
      reply.evidenceIds.every((id) => typeof id === "string" && ID.test(id)) &&
      new Set(reply.evidenceIds).size === reply.evidenceIds.length,
  );
}

/** 適用の前後世代・時刻・保留と阻害解消の相関を検査する。 */
function validApplication(
  applied: DecisionApplication,
  target: DecisionTarget,
  reply: DecisionAnswer,
): boolean {
  const waiting = reply.selectedOption === "wait";
  return Boolean(
    applied &&
      Object.keys(applied).sort().join() ===
        "afterGeneration,applicationId,appliedAt,beforeGeneration,blockerResolved,nextState,previousState" &&
      typeof applied.applicationId === "string" &&
      ID.test(applied.applicationId) &&
      time(applied.appliedAt) &&
      applied.appliedAt >= reply.answeredAt &&
      applied.beforeGeneration === target.generation &&
      Number.isSafeInteger(applied.afterGeneration) &&
      applied.afterGeneration ===
        applied.beforeGeneration + (waiting ? 0 : 1) &&
      text(applied.previousState, 128) &&
      text(applied.nextState, 128) &&
      typeof applied.blockerResolved === "boolean" &&
      (reply.selectedOption !== "cancel" ||
        applied.nextState === "cancelled") &&
      applied.blockerResolved ===
        (reply.selectedOption === "accept" ||
          reply.selectedOption === "resume") &&
      (!waiting ||
        (!applied.blockerResolved &&
          applied.previousState === applied.nextState)),
  );
}

/** 判断対象の識別子・所属・業務世代を閉形式で確認する。 */
function validTarget(target: DecisionTarget): boolean {
  return Boolean(
    target &&
      Object.keys(target).sort().join() ===
        "generation,id,kind,milestoneId,projectId,repositoryRevision" &&
      [target.projectId, target.milestoneId, target.id].every(
        (id) => typeof id === "string" && ID.test(id),
      ) &&
      ["objective", "task", "milestone"].includes(target.kind) &&
      Number.isSafeInteger(target.generation) &&
      target.generation >= 1 &&
      typeof target.repositoryRevision === "string" &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(target.repositoryRevision) &&
      (target.kind !== "milestone" || target.id === target.milestoneId),
  );
}

/** 新判断要求の閉じた形と、種類・対象・選択肢の相関を検査する。 */
function validRequest(value: DecisionRequest): boolean {
  if (!value || typeof value !== "object") return false;
  const target = value.target;
  if (
    Object.keys(value).sort().join() !==
      (value.kind === "continuation"
        ? "blockerId,decisionId,kind,options,question,queueId,requestedAt,respondentPrincipalId,target"
        : "blockerId,decisionId,kind,options,question,requestedAt,respondentPrincipalId,target") ||
    !isPrincipalId(value.respondentPrincipalId) ||
    (value.kind === "continuation" &&
      (typeof value.queueId !== "string" || !ID.test(value.queueId))) ||
    typeof value.decisionId !== "string" ||
    !ID.test(value.decisionId) ||
    typeof value.blockerId !== "string" ||
    !ID.test(value.blockerId) ||
    !text(value.question, 8192) ||
    !time(value.requestedAt) ||
    !validTarget(target) ||
    !Array.isArray(value.options) ||
    value.options.length < 1 ||
    value.options.length > 3
  )
    return false;
  const allowed =
    value.kind === "continuation"
      ? ["resume", "cancel"]
      : value.kind === "acceptance"
        ? ["accept", "return", "wait"]
        : [];
  if (value.kind === "acceptance" && target.kind === "task") return false;
  return (
    new Set(value.options.map((option) => option?.value)).size ===
      value.options.length &&
    value.options.every(
      (option) =>
        option &&
        Object.keys(option).sort().join() === "label,value" &&
        allowed.includes(option.value) &&
        text(option.label, 1024),
    )
  );
}

/**
 * 判断要求と人間判断Blockerを同一保存用の候補として作る。
 * @responsibility 質問と選択肢の表示を保持し、所有者をAttemptへ広げない。
 * @trace ARCH-000004、ARCH-000008
 * @input request: 認可された新判断要求。
 * @returns 二つの値候補、又は不正入力ならnull。
 * @precondition 現在Stateの重複・対象存在・認可は保存接続側で検査する。
 * @postcondition 元入力と参照を共有せず、pendingとactiveを共同で返す。
 * @effect N/A: メモリ内の値構成のみ。
 * @failure 通常データ以外、未知field、対象・選択肢不整合はnull。
 * @invariant 保存又は進行可能を主張しない。
 * @boundary 内部の純粋候補とState Writer接続。
 * @security PrincipalやCapabilityを推測・発行しない。
 * @concurrency 現在版のCASはWriterの責務。
 */
export function prepareDecisionRequest(request: DecisionRequest): Readonly<{
  decision: Decision;
  blocker: Blocker;
}> | null {
  const value = capture(request);
  if (!value || !validRequest(value)) return null;
  return {
    decision: { ...value, status: "pending", result: null },
    blocker: {
      blockerId: value.blockerId,
      target: value.target,
      kind: "human_decision",
      currentDecisionId: value.decisionId,
      reason: value.question,
      status: "active",
    },
  };
}

/**
 * 検査済み状態遷移の結果と回答を一つの判断候補へ結合する。
 * @responsibility 回答未適用の理由と、保留を含む適用結果を区別する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input current: pending判断、answer: 回答、application: 実際の遷移候補、unappliedReason: 未適用理由。
 * @returns 新判断とBlocker処置。無効・相関不一致ならnull。
 * @precondition applicationは内部の用途別遷移から導く。外部入力を渡さない。
 * @postcondition 回答と適用を一つのState候補へ載せられる値で返す。
 * @effect N/A: 保存、実行、履歴追記は行わない。
 * @failure 不正形、選択肢差、適用前後不整合を拒否する。
 * @invariant 保留の適用はBlockerを解消しない。再回答を受理しない。
 * @boundary 新Schemaの純粋値候補。保存成否と認可はWriter接続側が所有する。
 * @security 回答者IDの形式を検査するが、認証済みとは扱わない。
 * @concurrency 重複再送の再観測と一回保存は保存接続側が所有する。
 */
export function prepareDecisionAnswer(
  current: Decision,
  answer: DecisionAnswer,
  application: DecisionApplication | null,
  unappliedReason: string | null,
): Readonly<{ decision: Decision; blockerResolved: boolean }> | null {
  const value = capture({ current, answer, application, unappliedReason });
  if (value?.current?.status !== "pending") return null;
  const { status, result, ...request } = value.current;
  if (status !== "pending" || result !== null || !validRequest(request))
    return null;
  const reply = value.answer;
  if (
    !validAnswer(reply) ||
    reply.principalId !== request.respondentPrincipalId ||
    reply.answeredAt < request.requestedAt ||
    !request.options.some((option) => option.value === reply.selectedOption)
  )
    return null;
  const applied = value.application;
  if (applied === null) {
    if (!text(value.unappliedReason, 1024)) return null;
    return {
      decision: {
        ...request,
        status: "answered",
        result: {
          answer: reply,
          status: "unapplied",
          reason: value.unappliedReason,
        },
      },
      blockerResolved: false,
    };
  }
  if (
    value.unappliedReason !== null ||
    !validApplication(applied, request.target, reply)
  )
    return null;
  return {
    decision: {
      ...request,
      status: "applied",
      result: { answer: reply, status: "applied", application: applied },
    },
    blockerResolved: applied.blockerResolved,
  };
}

/** 既存の未終端判断を再構成し、元値の矛盾・未知fieldを捨てずに拒否する。 */
function captureOpenDecision(current: Decision): Decision | null {
  const value = capture(current);
  if (value?.status !== "pending" && value?.status !== "answered") return null;
  const { status, result, ...request } = value;
  const prepared = prepareDecisionRequest(request);
  if (!prepared) return null;
  let rebuilt = prepared.decision;
  if (status === "answered") {
    if (result?.status !== "unapplied") return null;
    const answered = prepareDecisionAnswer(
      prepared.decision,
      result.answer,
      null,
      result.reason,
    );
    if (!answered) return null;
    rebuilt = answered.decision;
  }
  return encodeRuntimeStateValue(rebuilt) === encodeRuntimeStateValue(value)
    ? rebuilt
    : null;
}

/**
 * 回答済み判断を、後から導いた状態遷移結果へ結合する。
 * @responsibility 元の回答を変えず、要求時世代との照合を維持する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 未適用の回答、application: 用途別状態遷移の結果。
 * @returns 適用候補又はnull。
 * @precondition 現在世代と認可はWriter接続側で再検査する。
 * @postcondition 回答者・回答日時・選択・理由を不変にする。
 * @effect N/A: メモリ内の値構成のみ。
 * @failure 回答前、適用済み、失効、不正結果はnull。
 * @invariant 後からの適用を新しい回答として記録しない。
 * @boundary 内部候補。保存成功・実行再開を意味しない。
 * @security 保存済み回答を、現在の実行許可にしない。
 * @concurrency 現在対象とのCASはWriterが所有する。
 */
export function prepareDecisionApplication(
  current: Decision,
  application: DecisionApplication,
) {
  const value = captureOpenDecision(current);
  if (value?.status !== "answered") return null;
  return prepareDecisionAnswer(
    { ...value, status: "pending", result: null },
    value.result.answer,
    application,
    null,
  );
}

/**
 * 未適用判断を明示無効化し、判断要求だけを閉じる。
 * @responsibility 既存回答を保持し、適用済み判断を未適用へ巻き戻さない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: pending又はanswered、status: 閉鎖種別、closedAt: 観測時刻、reason: 理由。
 * @returns 閉じた判断候補又はnull。
 * @precondition 失効の実施許可は呼出し側が確認する。
 * @postcondition 回答を失わず、閉鎖理由・時刻を保持する。
 * @effect N/A: 値構成のみ。
 * @failure 不正時刻・適用済み・二重閉鎖はnull。
 * @invariant 閉鎖だけでBlocker解消やTask再開を意味しない。
 * @boundary 内部候補とState保存。
 * @security 保存済み値を新たな操作許可にしない。
 * @concurrency 現在版比較はWriterが所有する。
 */
export function prepareDecisionClosure(
  current: Decision,
  status: "invalidated",
  closedAt: string,
  reason: string,
): Decision | null {
  const value = captureOpenDecision(current);
  if (
    !value ||
    (value.status !== "pending" && value.status !== "answered") ||
    status !== "invalidated" ||
    !time(closedAt) ||
    closedAt < value.requestedAt ||
    (value.result && closedAt < value.result.answer.answeredAt) ||
    !text(reason, 1024)
  )
    return null;
  return { ...value, status, closedAt, closeReason: reason };
}

/**
 * 判断そのものから、要求・回答・適用・失効の履歴を再構成する。
 * @responsibility 安定したEvent IDと本文で再追記照合できる内容を返す。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input current: 新判断契約の保存候補。
 * @returns 出来事順のイベント、又は不整合ならnull。
 * @precondition 本文を保存から読む場合は保存OwnerがSchemaも検査する。
 * @postcondition 元要求、理由、主体、実際の状態変化を履歴だけで読める。
 * @effect N/A: 履歴を読書きしない。
 * @failure 未知field・状態と結果の矛盾をnullで拒否する。
 * @invariant historyPendingや保存済みフラグを作らない。
 * @boundary 値投影と履歴Writer。履歴確定はこの関数から主張しない。
 * @security Capability、認証値、保存Pathを追加しない。
 * @concurrency 同じ記録から同じID・本文を導く。排他はWriterが所有する。
 */
export function projectDecisionHistory(
  current: Decision,
): readonly DecisionHistoryEvent[] | null {
  const value = capture(current);
  if (!value) return null;
  const commonRequest = {
    decisionId: value.decisionId,
    blockerId: value.blockerId,
    respondentPrincipalId: value.respondentPrincipalId,
    target: value.target,
    question: value.question,
    requestedAt: value.requestedAt,
  };
  const request: DecisionRequest =
    value.kind === "continuation"
      ? {
          ...commonRequest,
          kind: value.kind,
          options: value.options,
          queueId: value.queueId,
        }
      : { ...commonRequest, kind: value.kind, options: value.options };
  const prepared = prepareDecisionRequest(request);
  if (!prepared) return null;
  let rebuilt: Decision = prepared.decision;
  if (value.result) {
    const answered = prepareDecisionAnswer(
      prepared.decision,
      value.result.answer,
      value.result.status === "applied" ? value.result.application : null,
      value.result.status === "unapplied" ? value.result.reason : null,
    );
    if (!answered) return null;
    rebuilt = answered.decision;
  }
  if (value.status === "invalidated") {
    const closed = prepareDecisionClosure(
      rebuilt,
      value.status,
      value.closedAt,
      value.closeReason,
    );
    if (!closed) return null;
    rebuilt = closed;
  }
  if (encodeRuntimeStateValue(rebuilt) !== encodeRuntimeStateValue(value))
    return null;
  const common = {
    decisionId: request.decisionId,
    blockerId: request.blockerId,
    respondentPrincipalId: request.respondentPrincipalId,
    target: request.target,
    question: request.question,
    options: request.options,
  };
  const events: DecisionHistoryEvent[] = [
    {
      ...common,
      eventId: `${request.decisionId}:requested`,
      occurredAt: request.requestedAt,
      kind: "decision_requested",
    },
  ];
  if (value.result) {
    events.push({
      ...common,
      eventId: `${request.decisionId}:answered`,
      occurredAt: value.result.answer.answeredAt,
      kind: "decision_answered",
      answer: value.result.answer,
    });
    if (value.result.status === "applied")
      events.push({
        ...common,
        eventId: `${request.decisionId}:applied`,
        occurredAt: value.result.application.appliedAt,
        kind: "decision_applied",
        answer: value.result.answer,
        application: value.result.application,
      });
  }
  if (value.status === "invalidated")
    events.push({
      ...common,
      eventId: `${request.decisionId}:${value.status}`,
      occurredAt: value.closedAt,
      kind: "decision_invalidated",
      reason: value.closeReason,
    });
  return events;
}

/**
 * 独立した履歴行の判断イベントを閉形式で検査する。
 * @responsibility 退役後も質問・回答・適用を読める正規値だけを受理する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input input: 履歴から復号した未信頼値。
 * @returns 捕捉済みイベント又はnull。
 * @precondition 認証や現在状態の存在を履歴から推定しない。
 * @postcondition 不正なID・本文・相関・未知fieldを補完しない。
 * @effect N/A: 通常データの同期検査のみ。
 * @failure 不正形・時刻・選択肢混同・状態矛盾はnull。
 * @invariant 履歴イベントは現在の実行又は回復Authorityではない。
 * @boundary 長期履歴codecと判断値。
 * @security getter・Proxyを評価せず秘密値を追加しない。
 * @concurrency 同期処理。実体と同一ID本文は履歴Writerが確認する。
 */
export function inspectDecisionHistoryEvent(
  input: unknown,
): DecisionHistoryEvent | null {
  try {
    const value = capture(input) as DecisionHistoryEvent | null;
    if (
      !value ||
      typeof value !== "object" ||
      !ID.test(value.decisionId) ||
      typeof value.decisionId !== "string" ||
      typeof value.blockerId !== "string" ||
      !ID.test(value.blockerId) ||
      !isPrincipalId(value.respondentPrincipalId) ||
      !time(value.occurredAt) ||
      !validTarget(value.target) ||
      !text(value.question, 8192) ||
      !Array.isArray(value.options) ||
      value.options.length < 1 ||
      value.options.length > 3
    )
      return null;
    const choices = value.options.map((option) => option?.value);
    const family = choices.some(
      (choice) => choice === "resume" || choice === "cancel",
    )
      ? ["resume", "cancel"]
      : ["accept", "return", "wait"];
    if (
      new Set(choices).size !== choices.length ||
      value.options.some(
        (option) =>
          !option ||
          Object.keys(option).sort().join() !== "label,value" ||
          !family.includes(option.value) ||
          !text(option.label, 1024),
      )
    )
      return null;
    const common = [
      "eventId",
      "decisionId",
      "blockerId",
      "respondentPrincipalId",
      "target",
      "question",
      "options",
      "occurredAt",
      "kind",
    ];
    const suffix =
      value.kind === "decision_requested"
        ? "requested"
        : value.kind === "decision_answered"
          ? "answered"
          : value.kind === "decision_applied"
            ? "applied"
            : value.kind === "decision_invalidated"
              ? "invalidated"
              : null;
    if (!suffix || value.eventId !== `${value.decisionId}:${suffix}`)
      return null;
    if (
      value.kind === "decision_answered" ||
      value.kind === "decision_applied"
    ) {
      common.push("answer");
      if (
        !validAnswer(value.answer) ||
        value.answer.principalId !== value.respondentPrincipalId ||
        !choices.includes(value.answer.selectedOption) ||
        value.occurredAt < value.answer.answeredAt
      )
        return null;
      if (value.kind === "decision_applied") {
        common.push("application");
        if (
          !validApplication(value.application, value.target, value.answer) ||
          value.application.appliedAt !== value.occurredAt
        )
          return null;
      } else if (value.answer.answeredAt !== value.occurredAt) return null;
    } else if (value.kind === "decision_invalidated") {
      common.push("reason");
      if (!text(value.reason, 1024)) return null;
    }
    return Object.keys(value).sort().join() === common.sort().join()
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * 同一State内の判断と阻害条件を閉じた集合として照合する。
 * @responsibility 重複・孤立・別対象への付替え・Blocker解消の片側更新を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input decisions／blockers: 復号した集合、projectIds: 同じStateのProject ID。
 * @returns 全記録と相関が成立する場合だけtrue。
 * @precondition Project自体の定義検査は保存codecが所有する。
 * @postcondition 既定値や旧形式変換で不足を補完しない。
 * @effect N/A: 同期の値検査のみ。
 * @failure 不正形・未知field・参照不一致・過大集合はfalse。
 * @invariant JSONの成立を認可又は実行可能性の根拠にしない。
 * @boundary 新State Schemaの内部codecと判断モデル。
 * @security 外部入力のgetter・Proxyを評価しない。
 * @concurrency 現在版との遷移比較は別のWriter検査が所有する。
 */
export function validateDecisionCollections(
  decisions: unknown,
  blockers: unknown,
  projectIds: readonly string[],
): boolean {
  try {
    const value = capture({ decisions, blockers });
    if (
      !value ||
      !Array.isArray(value.decisions) ||
      !Array.isArray(value.blockers) ||
      value.decisions.length > 4096 ||
      value.blockers.length > 4096
    )
      return false;
    const records = value.decisions as Decision[];
    const conditions = value.blockers as Blocker[];
    if (
      new Set(records.map((record) => record?.decisionId)).size !==
        records.length ||
      new Set(conditions.map((condition) => condition?.blockerId)).size !==
        conditions.length ||
      records.some((record) => projectDecisionHistory(record) === null)
    )
      return false;
    for (const condition of conditions) {
      if (
        !condition ||
        Object.keys(condition).sort().join() !==
          (condition.status === "cancelled"
            ? "blockerId,cancelledByDecisionId,currentDecisionId,kind,reason,status,target"
            : "blockerId,currentDecisionId,kind,reason,status,target") ||
        typeof condition.blockerId !== "string" ||
        !ID.test(condition.blockerId) ||
        !text(condition.reason, 8192) ||
        !["active", "resolved", "cancelled"].includes(condition.status) ||
        !validTarget(condition.target) ||
        !projectIds.includes(condition.target.projectId)
      )
        return false;
      if (condition.status === "cancelled") {
        const cause = records.find(
          (item) => item.decisionId === condition.cancelledByDecisionId,
        );
        if (
          cause?.kind !== "continuation" ||
          cause.target.kind !== "milestone" ||
          cause.target.projectId !== condition.target.projectId ||
          cause.target.milestoneId !== condition.target.milestoneId ||
          cause.target.generation < condition.target.generation ||
          cause.result?.status !== "applied" ||
          cause.result.answer.selectedOption !== "cancel"
        )
          return false;
      }
      if (condition.kind === "human_decision") {
        const first = records.find(
          (item) => item.blockerId === condition.blockerId,
        );
        const record = records.find(
          (item) => item.decisionId === condition.currentDecisionId,
        );
        if (
          !record ||
          !first ||
          condition.reason !== first.question ||
          encodeRuntimeStateValue(first.target) !==
            encodeRuntimeStateValue(condition.target) ||
          record.blockerId !== condition.blockerId ||
          !sameDecisionSubject(record.target, condition.target) ||
          (condition.status === "resolved") !==
            (record.result?.status === "applied" &&
              record.result.application.blockerResolved) ||
          (record.result?.status === "applied" &&
            record.result.answer.selectedOption === "cancel" &&
            (condition.status !== "cancelled" ||
              condition.cancelledByDecisionId !== record.decisionId))
        )
          return false;
      } else if (
        !["dependency", "input", "resource", "recovery"].includes(
          condition.kind,
        ) ||
        condition.currentDecisionId !== null
      )
        return false;
    }
    return records.every((record) =>
      conditions.some(
        (condition) =>
          condition.kind === "human_decision" &&
          condition.blockerId === record.blockerId &&
          sameDecisionSubject(condition.target, record.target) &&
          records.some(
            (current) =>
              current.decisionId === condition.currentDecisionId &&
              current.kind === record.kind &&
              current.respondentPrincipalId === record.respondentPrincipalId &&
              current.requestedAt >= record.requestedAt &&
              (current.kind !== "continuation" ||
                (record.kind === "continuation" &&
                  current.queueId === record.queueId)) &&
              (record.decisionId === current.decisionId ||
                (record.status !== "pending" &&
                  !(
                    record.result?.status === "applied" &&
                    (record.result.application.blockerResolved ||
                      record.result.answer.selectedOption === "cancel")
                  ))),
          ),
      ),
    );
  } catch {
    return false;
  }
}

/**
 * 同じ問題の対象を比較し、提案時点の世代・Revisionは各提案に保持する。
 * @responsibility 問題の所属ID比較だけを共用し、現在世代の実行可否検査を代替しない。
 * @trace ARCH-000004、ARCH-000008
 * @input left/right: 検査済み提案又はBlockerの対象。
 * @returns 同じProject・Milestone・対象種別・対象IDならtrue。
 * @effect N/A: 値比較のみ。
 * @failure 不正な対象の捕捉は呼出し側が行う。
 * @boundary 内部の判断値契約。
 */
export function sameDecisionSubject(
  left: DecisionTarget,
  right: DecisionTarget,
): boolean {
  return (
    left.projectId === right.projectId &&
    left.milestoneId === right.milestoneId &&
    left.kind === right.kind &&
    left.id === right.id
  );
}
