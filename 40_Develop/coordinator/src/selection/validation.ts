/**
 * 現在Catalogに依存せず、AI選定値の閉形式・相関・内容Identityを検査する。
 * @responsibility 現在Catalogに依存せず、AI選定値の閉形式・相関・内容Identityを検査する。
 * @trace ARCH-000004
 * @boundary Repository設定・Task選定値と利用側。
 * @security 選定値から実行Authorityを発行しない。
 */
import { inspectExecutionSelection } from "../../../domain-model/src/index.ts";
import { createHash } from "node:crypto";
import type { AiReasoningEffort } from "../../../ai-adapter/src/index.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";

import type { AiSelectionChoice } from "../../../domain-model/src/index.ts";

/**
 * 明示選択の三項目を独立した値へ固定する。
 * @responsibility 公開入力の構造検査を現在Catalogによる用途検査から分離する。
 * @trace ARCH-000004
 * @input candidate: 未信頼のProvider・Model・Effort。
 * @returns 不変の三項目、又はnull。
 * @precondition 技術対応は新規選定時に別途検査する。
 * @postcondition 既定値・fallback・Authorityを作らない。
 * @effect N/A: 同期の値検査のみ。
 * @failure 欠落・過剰・Proxy・getter・不正文字列はnull。
 * @invariant 保存済み選定を現在Catalogで再解釈しない。
 * @boundary 公開Task／Objective入力と選定Owner。
 * @security CLI引数・Path・秘密値のfieldを受けない。
 * @concurrency 元入力の変更から分離する。
 */
export function inspectAiSelectionChoice(
  candidate: unknown,
): AiSelectionChoice | null {
  const value = snapshotPlainRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (
    !value ||
    (value.provider !== "codex" && value.provider !== "claude") ||
    typeof value.model !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.model) ||
    typeof value.effort !== "string" ||
    !["low", "medium", "high", "xhigh", "max"].includes(value.effort)
  )
    return null;
  return Object.freeze({
    provider: value.provider,
    model: value.model,
    effort: value.effort as AiReasoningEffort,
  });
}

/**
 * 完全な選定値の非Authority Identityを導く。
 * @responsibility Providerだけでなく選定元・当時の構成まで同じ相関へ含める。
 * @trace ARCH-000004
 * @input candidate: 十項目の選定候補。
 * @returns 正規化した選定のSHA-256、不正時null。
 * @precondition Hash自体で実行を許可しない。
 * @postcondition alias種別・設定Identity・役割・分類の差は別Hashになる。
 * @effect N/A: 局所検査と決定論的Hashだけ。
 * @failure 閉形式を満たさない値はnull。
 * @invariant 現在Catalogや設定を読まない。
 * @boundary Packet・Grant・保存選定の値相関。
 * @security Hashを資格や操作Capabilityにしない。
 * @concurrency 元値から独立したSnapshotだけをHash化する。
 */
export function hashExecutionSelection(candidate: unknown): string | null {
  const value = inspectExecutionSelection(candidate);
  return value
    ? createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")
    : null;
}
