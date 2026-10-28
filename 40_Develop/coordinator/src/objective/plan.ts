/**
 * 実行入口の要求検査をDomainの計画検査へ接続する。
 * @packageDocumentation
 * @responsibility Coordinator要求を検査し、計画の値規則はDomainへ委譲する。
 * @trace ARCH-000004
 * @boundary 実行認可・保存・外部Effectは発行しない。
 */
import {
  inspectExecutionPlan,
  type CoordinatorObjectivePlan,
} from "../../../domain-model/src/index.ts";

/**
 * 要求と計画を検査して不変の値を返す。
 * @responsibility Coordinator要求の検査とDomain値検査を接続する。
 * @trace ARCH-000004
 * @input 未信頼の計画とCoordinator要求。
 * @returns 不正入力はnull。正常時だけ検査済み計画。
 * @effect 外部Effectなし。
 * @security 入力検査を実行Authorityとして扱わない。
 */
export function inspectCoordinatorObjectivePlan(
  raw: unknown,
  request: CoordinatorObjectiveRequest,
): CoordinatorObjectivePlan | null {
  const accepted = inspectCoordinatorObjectiveRequest(request);
  return accepted
    ? inspectExecutionPlan(raw, { allowedPaths: accepted.allowedPaths })
    : null;
}

import {
  inspectCoordinatorObjectiveRequest,
  type CoordinatorObjectiveRequest,
} from "../../../domain-model/src/index.ts";
