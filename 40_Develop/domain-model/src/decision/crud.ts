/**
 * 判断記録の作成・読取り・比較更新の候補を所有する。
 * @packageDocumentation
 * @responsibility 既存二世代・exact元本文・対象外区画を保つ用途固定の値操作を提供する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @boundary 検証済みSnapshotの値操作。Filesystem・Owner・Authority・保存確定を所有しない。
 */
import type { CoordinatorSnapshot } from "../state/types.ts";
import type {
  CoordinatorAcceptanceDecisionRecord,
  CoordinatorAcceptanceDecisionEnvelope,
  CoordinatorDecisionRecoveryIntent,
} from "./types.ts";
import {
  validCoordinatorAcceptanceDecisionRecord,
  validCoordinatorDecisionRecoveryIntent,
  COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
} from "./validation.ts";
import {
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  validId,
  digest,
} from "../state/validation.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";

/**
 * 既存Storeと同じ完了封筒へ候補又は読取り値を収める。
 * @responsibility 値の構築だけを共用し、保存完了を表さない。
 * @trace ARCH-000005、ARCH-000008
 * @input reason: 既存固定理由、value: 固定用途が導出した値。
 * @returns 元の三fieldと外側freezeを持つ候補結果。
 * @precondition 呼出し側が既存の局所検査を完了している。
 * @postcondition valueの追加freeze・cloneを行わない。
 * @effect N/A: 値の構築だけ。
 * @failure N/A: 検査は用途別関数が所有する。
 * @invariant completedはここでは候補生成・観測の完了であり、耐久保存の証明ではない。
 * @boundary Module内の非公開値constructor。
 * @security Authorityを発行しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/**
 * 既存Storeと同じ拒否封筒を構築する。
 * @responsibility 既存の未発行・回復参照なしの拒否形を維持する。
 * @trace ARCH-000005、ARCH-000008
 * @input reason: 用途別の既存固定理由。
 * @returns 元の五fieldと外側freezeを持つ拒否。
 * @precondition この純粋操作はI/Oを発行していない。
 * @postcondition 回復義務や任意Error本文を生成しない。
 * @effect N/A: 値の構築だけ。
 * @failure N/A: この関数自身は検査しない。
 * @invariant 永続化や実行の副作用を否定する一般的証明ではない。
 * @boundary Module内の非公開値constructor。
 * @security 秘密値・Path・Authorityを含めない。
 * @concurrency N/A: 共有状態を持たない。
 */
function storeBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
}

/**
 * 受入判断の初回候補を作成する。
 * @responsibility 既存の二世代と元Envelope Hashを保持する。
 * @trace ARCH-000005、ARCH-000008
 * @input current: 検証済みSnapshot、binding: 検証済みRepository結合、record: prepared判断。
 * @returns 変更候補又は読取り値、若しくは既存理由による拒否。
 * @precondition SnapshotとRepository bindingは既存の保存Owner内で検証済みである。
 * @postcondition 対象外区画と判定順を保持し、入力を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 不正値・重複・期待本文差を既存理由で拒否する。
 * @invariant 保存成功・人間判断の真正性・回復完了をこの結果だけから推定しない。
 * @boundary 局所候補と、別Ownerが所有する単一Writer。
 * @security この候補・記録は実行・保存Authorityではない。
 * @concurrency 同じ短期Ownerのfresh値で呼び、保存CASと解放は呼出し側が確認する。
 */
export function prepareCoordinatorAcceptanceDecisionCreation(
  current: CoordinatorSnapshot,
  binding: string,
  record: CoordinatorAcceptanceDecisionRecord,
) {
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    !validCoordinatorAcceptanceDecisionRecord(record) ||
    record.disposition !== "prepared"
  )
    return storeBlocked("orchestrator_acceptance_record_invalid");
  if (
    current.acceptanceDecisions.some(
      (item) => item.recordId === record.recordId,
    )
  )
    return storeBlocked("orchestrator_acceptance_record_exists");
  const entry: CoordinatorAcceptanceDecisionEnvelope = {
    contract: COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
    repositoryBindingId: binding,
    recordId: record.recordId,
    generation: 1,
    previousHash: null,
    record,
  };
  return completed("orchestrator_acceptance_record_created", {
    next: {
      ...current,
      acceptanceDecisions: [...current.acceptanceDecisions, entry],
    },
    value: record,
  });
}

/**
 * 受入判断の最新の記録を投影する。
 * @responsibility 既存の二世代と元Envelope Hashを保持する。
 * @trace ARCH-000005、ARCH-000008
 * @input current: 検証済みSnapshot、recordId: 対象の判断ID。
 * @returns 変更候補又は読取り値、若しくは既存理由による拒否。
 * @precondition SnapshotとRepository bindingは既存の保存Owner内で検証済みである。
 * @postcondition 対象外区画と判定順を保持し、入力を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 不正なID又はSchemaは既存理由で拒否し、真正不存在は値nullで返す。
 * @invariant 保存成功・人間判断の真正性・回復完了をこの結果だけから推定しない。
 * @boundary 局所候補と、別Ownerが所有する単一Writer。
 * @security この候補・記録は実行・保存Authorityではない。
 * @concurrency 同じ短期Ownerのfresh値で呼び、保存CASと解放は呼出し側が確認する。
 */
export function projectCoordinatorAcceptanceDecisionRecord(
  current: CoordinatorSnapshot,
  recordId: string,
) {
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    !validId(recordId)
  )
    return storeBlocked("orchestrator_acceptance_record_identity_invalid");
  const groups = current.acceptanceDecisions.filter(
    (item) => item.recordId === recordId,
  );
  return completed("orchestrator_acceptance_record_observed", {
    next: null,
    value:
      groups.find((item) => item.generation === 2)?.record ??
      groups.find((item) => item.generation === 1)?.record ??
      null,
  });
}

/**
 * 受入判断の比較更新候補を作成する。
 * @responsibility 既存の二世代と元Envelope Hashを保持する。
 * @trace ARCH-000005、ARCH-000008
 * @input current: 検証済みSnapshot、binding: 検証済みRepository結合、expected: 元prepared判断、next: finalized判断。
 * @returns 変更候補又は読取り値、若しくは既存理由による拒否。
 * @precondition SnapshotとRepository bindingは既存の保存Owner内で検証済みである。
 * @postcondition 対象外区画と判定順を保持し、入力を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 不正値・重複・期待本文差を既存理由で拒否する。
 * @invariant 保存成功・人間判断の真正性・回復完了をこの結果だけから推定しない。
 * @boundary 局所候補と、別Ownerが所有する単一Writer。
 * @security この候補・記録は実行・保存Authorityではない。
 * @concurrency 同じ短期Ownerのfresh値で呼び、保存CASと解放は呼出し側が確認する。
 */
export function prepareCoordinatorAcceptanceDecisionFinalization(
  current: CoordinatorSnapshot,
  binding: string,
  expected: CoordinatorAcceptanceDecisionRecord,
  next: CoordinatorAcceptanceDecisionRecord,
) {
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    !validCoordinatorAcceptanceDecisionRecord(expected) ||
    !validCoordinatorAcceptanceDecisionRecord(next) ||
    expected.recordId !== next.recordId ||
    expected.disposition !== "prepared" ||
    next.disposition !== "finalized"
  )
    return storeBlocked("orchestrator_acceptance_record_transition_invalid");
  const first = current.acceptanceDecisions.find(
    (item) => item.recordId === expected.recordId && item.generation === 1,
  );
  if (
    !first ||
    encodeRuntimeStateValue(first.record) !== encodeRuntimeStateValue(expected)
  )
    return storeBlocked("orchestrator_acceptance_record_generation_mismatch");
  if (
    current.acceptanceDecisions.some(
      (item) => item.recordId === expected.recordId && item.generation === 2,
    )
  )
    return storeBlocked("orchestrator_acceptance_record_exists");
  const entry: CoordinatorAcceptanceDecisionEnvelope = {
    contract: COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
    repositoryBindingId: binding,
    recordId: expected.recordId,
    generation: 2,
    previousHash: digest(encodeRuntimeStateValue(first)),
    record: next,
  };
  return completed("orchestrator_acceptance_record_finalized", {
    next: {
      ...current,
      acceptanceDecisions: [...current.acceptanceDecisions, entry],
    },
    value: next,
  });
}

/**
 * 判断回復の初回候補を作成する。
 * @responsibility 既存のexact回復参照と期待本文を保持する。
 * @trace ARCH-000005、ARCH-000008
 * @input current: 検証済みSnapshot、intent: 初回の判断回復記録。
 * @returns 変更候補又は読取り値、若しくは既存理由による拒否。
 * @precondition SnapshotとRepository bindingは既存の保存Owner内で検証済みである。
 * @postcondition 対象外区画と判定順を保持し、入力を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 不正値・重複・期待本文差を既存理由で拒否する。
 * @invariant 保存成功・人間判断の真正性・回復完了をこの結果だけから推定しない。
 * @boundary 局所候補と、別Ownerが所有する単一Writer。
 * @security この候補・記録は実行・保存Authorityではない。
 * @concurrency 同じ短期Ownerのfresh値で呼び、保存CASと解放は呼出し側が確認する。
 */
export function prepareCoordinatorDecisionRecoveryCreation(
  current: CoordinatorSnapshot,
  intent: CoordinatorDecisionRecoveryIntent,
) {
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    !validCoordinatorDecisionRecoveryIntent(intent)
  )
    return storeBlocked("orchestrator_decision_recovery_invalid");
  if (
    current.decisionRecoveries.some(
      (item) => item.value.recoveryId === intent.recoveryId,
    )
  )
    return storeBlocked("orchestrator_decision_recovery_exists");
  return completed("orchestrator_decision_recovery_created", {
    next: {
      ...current,
      decisionRecoveries: [
        ...current.decisionRecoveries,
        { generation: 1, value: intent },
      ],
    },
    value: intent,
  });
}

/**
 * 判断回復の最新の記録を投影する。
 * @responsibility 既存のexact回復参照と期待本文を保持する。
 * @trace ARCH-000005、ARCH-000008
 * @input current: 検証済みSnapshot、recoveryId: 対象のexact回復参照。
 * @returns 変更候補又は読取り値、若しくは既存理由による拒否。
 * @precondition SnapshotとRepository bindingは既存の保存Owner内で検証済みである。
 * @postcondition 対象外区画と判定順を保持し、入力を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 不正なID又はSchemaは既存理由で拒否し、真正不存在は値nullで返す。
 * @invariant 保存成功・人間判断の真正性・回復完了をこの結果だけから推定しない。
 * @boundary 局所候補と、別Ownerが所有する単一Writer。
 * @security この候補・記録は実行・保存Authorityではない。
 * @concurrency 同じ短期Ownerのfresh値で呼び、保存CASと解放は呼出し側が確認する。
 */
export function projectCoordinatorDecisionRecoveryRecord(
  current: CoordinatorSnapshot,
  recoveryId: string,
) {
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    !validId(recoveryId)
  )
    return storeBlocked("orchestrator_decision_recovery_invalid");
  return completed("orchestrator_decision_recovery_observed", {
    next: null,
    value:
      current.decisionRecoveries.find(
        (item) => item.value.recoveryId === recoveryId,
      )?.value ?? null,
  });
}

/**
 * 判断回復の比較更新候補を作成する。
 * @responsibility 既存のexact回復参照と期待本文を保持する。
 * @trace ARCH-000005、ARCH-000008
 * @input current: 検証済みSnapshot、expected: 元の回復記録全文、next: 同じ回復参照の更新値。
 * @returns 変更候補又は読取り値、若しくは既存理由による拒否。
 * @precondition SnapshotとRepository bindingは既存の保存Owner内で検証済みである。
 * @postcondition 対象外区画と判定順を保持し、入力を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 不正値・重複・期待本文差を既存理由で拒否する。
 * @invariant 保存成功・人間判断の真正性・回復完了をこの結果だけから推定しない。
 * @boundary 局所候補と、別Ownerが所有する単一Writer。
 * @security この候補・記録は実行・保存Authorityではない。
 * @concurrency 同じ短期Ownerのfresh値で呼び、保存CASと解放は呼出し側が確認する。
 */
export function prepareCoordinatorDecisionRecoveryUpdate(
  current: CoordinatorSnapshot,
  expected: CoordinatorDecisionRecoveryIntent,
  next: CoordinatorDecisionRecoveryIntent,
) {
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    !validCoordinatorDecisionRecoveryIntent(expected) ||
    !validCoordinatorDecisionRecoveryIntent(next) ||
    expected.recoveryId !== next.recoveryId
  )
    return storeBlocked("orchestrator_decision_recovery_invalid");
  const prior = current.decisionRecoveries.find(
    (item) => item.value.recoveryId === expected.recoveryId,
  );
  if (
    !prior ||
    encodeRuntimeStateValue(prior.value) !== encodeRuntimeStateValue(expected)
  )
    return storeBlocked("orchestrator_decision_recovery_generation_mismatch");
  return completed("orchestrator_decision_recovery_updated", {
    next: {
      ...current,
      decisionRecoveries: current.decisionRecoveries.map((item) =>
        item === prior
          ? { generation: prior.generation + 1, value: next }
          : item,
      ),
    },
    value: next,
  });
}
