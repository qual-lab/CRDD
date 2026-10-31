/**
 * 一試行の技術入力を固定し、開始と隔離構成で共有する基本条件を検査する。
 * @packageDocumentation
 * @responsibility 選定・用途・Mount・Command外形を検査し、モデルと資源Identityの規則は所有元へ委譲する。
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @boundary 信頼した上位Hostの搬送値とExecutorの準備・開始。
 */
import { types as utilTypes } from "node:util";
import type { AttemptPlan } from "./types.ts";
import { PURPOSES } from "../result/constants.ts";
import { dockerIsolationResourceIdentityIsValid } from "../../../docker-isolation/src/index.ts";
import {
  describeProviderAuthentication,
  resolveAiModelSelection,
  type AiModelSelection,
} from "../../../ai-adapter/src/index.ts";

/**
 * 用途限定入力のdata propertyだけを一度捕捉する。
 * @responsibility Proxy・accessor・特殊prototype・余剰と欠測を拒否する。
 * @trace ARCH-000008
 * @input 未検査値と内部の固定Key集合。
 * @returns 凍結した浅い値又はnull。
 * @precondition Key集合はこのModule内の用途だけが定める。
 * @postcondition getterを実行せず元Objectから分離する。
 * @effect N/A: 同期の局所検査。
 * @failure reflection不能はnull。
 * @invariant Authorityを生成しない。
 * @boundary 一試行の入力捕捉内部。
 * @security 任意の継承値を実行入力へ昇格しない。
 * @concurrency N/A: 共有状態なし。
 */
function copyPlainDataRecord(value: unknown, keys: readonly string[]) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const actual = Reflect.ownKeys(descriptors);
    if (
      actual.length !== keys.length ||
      actual.some((k) => typeof k !== "string" || !keys.includes(k))
    )
      return null;
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const d = descriptors[key];
      if (
        !d ||
        !Object.hasOwn(d, "value") ||
        d.get !== undefined ||
        d.set !== undefined ||
        d.enumerable !== true
      )
        return null;
      copy[key] = d.value;
    }
    return Object.freeze(copy);
  } catch {
    return null;
  }
}

/**
 * 五項目の入力を固定し、モデルの対応条件はAI Adapterへ照会する。
 * @responsibility Objectの形と五項目投影を所有し、対応モデル・推論強度の規則を複製しない。
 * @trace ARCH-000015
 * @input 上位で完全選定を検査した後の技術投影。
 * @returns 凍結した技術選定又はnull。
 * @precondition 上位が完全選定Hash・設定世代・Authorityを別に検査する。
 * @postcondition 設定・Catalog・保存元情報をExecutorへ持ち込まない。
 * @effect N/A: 値検査のみ。
 * @failure 欠測・余剰・不正な用途相関はnull。
 * @invariant 成立を実行許可へ昇格しない。
 * @boundary 準備と開始で共有する技術入力。
 * @security Hashから完全選定や許可を推定しない。
 * @concurrency 元入力から分離する。
 */
export function parseModelSelection(value: unknown): AiModelSelection | null {
  const v = copyPlainDataRecord(value, [
    "provider",
    "modelIdentifier",
    "identifierKind",
    "reasoningEffort",
    "purpose",
  ]);
  if (!v) return null;
  const resolved = resolveAiModelSelection({
    provider: v.provider,
    modelIdentifier: v.modelIdentifier,
    reasoningEffort: v.reasoningEffort,
    purpose: v.purpose,
  });
  if (
    resolved.status !== "resolved" ||
    resolved.value.provider !== v.provider ||
    resolved.value.modelIdentifier !== v.modelIdentifier ||
    resolved.value.reasoningEffort !== v.reasoningEffort ||
    resolved.value.purpose !== v.purpose ||
    resolved.value.identifierKind !== v.identifierKind
  )
    return null;
  return Object.freeze({
    provider: resolved.value.provider,
    modelIdentifier: resolved.value.modelIdentifier,
    identifierKind: resolved.value.identifierKind,
    reasoningEffort: resolved.value.reasoningEffort,
    purpose: resolved.value.purpose,
  });
}

/**
 * Object自身のdata propertyから値を読み取る。
 * @responsibility 開始参照のfield取得だけを行い、値の意味や保存成立は判断しない。
 * @trace ARCH-000008
 * @input 対象Objectと取得するfield名。
 * @returns 自身の値、又は欠測・accessor・取得不能の場合のundefined。
 * @effect N/A: Property descriptorの局所読取り。getterは呼ばない。
 * @invariant 新しい参照・Authorityを発行しない。
 * @boundary 上位が保存後に渡した参照と単発実行の開始検査。
 */
export function readOwnDataProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 開始前とDocker構成照合で共有する試行入力の基本条件を検査する。
 * @responsibility 選定・用途・Mount・資源Identity・Command外形を一箇所で検査する。
 * @trace ARCH-000008
 * @input Factoryが固定した一試行の技術構成。
 * @returns 全基本条件が成立する場合だけtrue。
 * @effect N/A: メモリ内の照合のみ。Home・Docker・保存を操作しない。
 * @boundary Executor準備済み入力と開始前の技術検査。
 * @invariant 完全Command一致、Authority、清掃成立の代わりにはしない。
 */
export function isAttemptPlanValid(plan: AttemptPlan): boolean {
  const isTaskPlan = plan.operationMode === "isolated_task";
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    parseModelSelection(plan.executionSelection)?.provider === plan.provider &&
    plan.subscriptionOffering ===
      describeProviderAuthentication(plan.provider).offering &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    (plan.operationMode === "boolean_probe" || isTaskPlan || isAdvicePlan) &&
    (isTaskPlan
      ? (plan.taskRole === "executor" || plan.taskRole === "reviewer") &&
        typeof plan.providerInput === "string" &&
        plan.providerInput.length > 0 &&
        typeof plan.workspaceSourcePath === "string" &&
        plan.workspaceSourcePath.length > 0 &&
        plan.workspaceMountMode ===
          (plan.taskRole === "executor" ? "read_write" : "read_only")
      : isAdvicePlan
        ? plan.taskRole === null &&
          /^[a-f0-9]{64}$/u.test(plan.adviceCommandHash ?? "") &&
          typeof plan.providerInput === "string" &&
          plan.providerInput.length > 0 &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null
        : plan.taskRole === null &&
          (plan.adviceCommandHash ?? null) === null &&
          plan.providerInput === null &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null) &&
    dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    }) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) &&
    /^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) &&
    /^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) &&
    Array.isArray(plan.commands) &&
    plan.commands.length === PURPOSES.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === PURPOSES[index] &&
        Array.isArray(command.argv) &&
        command.argv.length > 0 &&
        command.argv.every(
          (value: unknown) =>
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("\0"),
        ),
    )
  );
}
