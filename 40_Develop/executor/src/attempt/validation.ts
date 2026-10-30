/**
 * 一試行の入力・許可参照・技術選定を局所値へ固定する。
 * @packageDocumentation
 * @responsibility 保存元情報を解釈せず、動的Propertyと不正な技術値を拒否する。
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @boundary 信頼した上位Hostの搬送値とExecutorの準備・開始。
 */
import { types as utilTypes } from "node:util";
import type { AttemptSelection } from "./types.ts";

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
function captureRecord(value: unknown, keys: readonly string[]) {
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
 * 公開準備入力の三用途だけを捕捉する。
 * @responsibility task・advice・probeの既存field集合を維持する。
 * @trace ARCH-000015
 * @input prepareへ渡された未検査値。
 * @returns fieldを捕捉した値又はnull。用途相関は既存準備Ownerが検査する。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 内部Capabilityを複製・発行しない。
 * @effect N/A: 局所取得だけ。
 * @failure 不正shapeはnull。
 * @invariant 新しい入力fieldを許可しない。
 * @boundary 公開準備入力と準備Owner。
 * @security Proxy・getterを実行しない。
 * @concurrency N/A: 同期処理。
 */
export function captureAttemptInput(value: unknown) {
  const common = [
    "purpose",
    "managementCapability",
    "mountCapability",
    "mountAuthorizationCapability",
    "selectionUseCapability",
    "recoveryCorrelationId",
    "consumer",
  ];
  return (
    captureRecord(value, [
      ...common,
      "packetCapability",
      "packetOwnerCapability",
    ]) ??
    captureRecord(value, [...common, "packetCapability"]) ??
    captureRecord(value, common)
  );
}

/**
 * 上位が固定した許可参照を独立した配列へ捕捉する。
 * @responsibility 既存256件・512byte・非空・重複禁止を維持する。
 * @trace ARCH-000015
 * @input 未検査の参照配列。
 * @returns 凍結配列又はnull。
 * @precondition 参照の許可判断は上位が所有する。
 * @postcondition hole・動的Property・追加Keyを受理しない。
 * @effect N/A: 局所コピーだけ。
 * @failure 不正値・取得不能はnull。
 * @invariant 許可集合を拡張しない。
 * @boundary 上位Packetと一試行の結果検査。
 * @security getter・Proxyを実行しない。
 * @concurrency 元配列の変更から分離する。
 */
export function captureAllowedReferences(
  value: unknown,
): readonly string[] | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    )
      return null;
    const initial = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !initial ||
      !Object.hasOwn(initial, "value") ||
      initial.get !== undefined ||
      initial.set !== undefined ||
      !Number.isSafeInteger(initial.value) ||
      initial.value < 1 ||
      initial.value > 256
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = (
      descriptors as unknown as Record<string, PropertyDescriptor>
    ).length;
    if (
      !length ||
      !Object.hasOwn(length, "value") ||
      length.value !== initial.value ||
      Reflect.ownKeys(descriptors).length !== initial.value + 1
    )
      return null;
    const copy: string[] = [];
    for (let i = 0; i < initial.value; i++) {
      const d = descriptors[String(i)];
      if (
        !d ||
        !Object.hasOwn(d, "value") ||
        d.get !== undefined ||
        d.set !== undefined ||
        d.enumerable !== true ||
        typeof d.value !== "string" ||
        d.value.length === 0 ||
        d.value.includes("\0") ||
        Buffer.byteLength(d.value, "utf8") > 512
      )
        return null;
      copy.push(d.value);
    }
    return new Set(copy).size === copy.length ? Object.freeze(copy) : null;
  } catch {
    return null;
  }
}

/**
 * 保存元を含まない六項目の技術選定を検査する。
 * @responsibility Provider・Model・種別・努力量・用途・役割だけを保持する。
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
export function inspectAttemptSelection(
  value: unknown,
): AttemptSelection | null {
  const v = captureRecord(value, [
    "provider",
    "modelIdentifier",
    "identifierKind",
    "reasoningEffort",
    "purpose",
    "role",
  ]);
  if (
    !v ||
    (v.provider !== "codex" && v.provider !== "claude") ||
    typeof v.modelIdentifier !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(v.modelIdentifier) ||
    (v.identifierKind !== "exact" && v.identifierKind !== "alias") ||
    typeof v.reasoningEffort !== "string" ||
    !["low", "medium", "high", "xhigh", "max"].includes(v.reasoningEffort) ||
    typeof v.role !== "string" ||
    ![
      "coordinator",
      "executor",
      "independent_reviewer",
      "result_integration",
      "advice",
    ].includes(v.role) ||
    v.purpose !==
      (["executor", "independent_reviewer"].includes(v.role)
        ? "task"
        : "advice")
  )
    return null;
  return Object.freeze({ ...v }) as AttemptSelection;
}
