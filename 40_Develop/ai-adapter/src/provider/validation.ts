/**
 * ProviderのModel識別子構文と固定環境変数を検査する。
 *
 * @responsibility Model識別子の構文と固定CLI環境の拒否条件を保持し、現在の利用可否は判断しない。
 * @trace ARCH-000010
 * @boundary Provider固有の固定設定と共通実行計画の間。
 * @effect N/A: 同期の値検査だけで、実観測・設定保存・Process起動を行わない。
 * @security 検査の成功から認証成立・実行Authority・隔離成立を推定しない。
 */

import type { Provider } from "./types.ts";

import { CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES } from "../claude/plan.ts";

import { CODEX_FORBIDDEN_ENVIRONMENT_NAMES } from "../codex/plan.ts";

/**
 * 検証した環境値または拒否結果を表す。
 * @responsibility 空の正常環境と拒否を区別する。
 * @trace ARCH-000010
 * @shape readyでは値組、blockedでは固定理由を返す。
 * @invariant 拒否時に部分環境を返さない。
 * @boundary 固定計画と環境搬送。
 * @security 禁止変数を受理しない。
 * @compatibility 検査・値取得順序を維持する。
 */
export type ProviderEnvironmentResult =
  | Readonly<{
      status: "ready";
      entries: readonly (readonly [string, string])[];
    }>
  | Readonly<{ status: "blocked"; reason: "provider_environment_invalid" }>;

/**
 * Model ID構文の確認値と拒否理由を表す。
 * @responsibility 無変換の構文検査を登録・提供・認証の確認と区別する。
 * @trace ARCH-000010
 * @shape validは入力文字列、blockedは値欠測と固定理由を持つ直和型。
 * @invariant 大小文字補正、空白除去、別Modelへの置換をしない。
 * @boundary Model構文検査とProvider計画の値契約。
 * @security Path、秘密値、任意引数、Authorityを発行しない。
 * @compatibility 旧構文の受理集合を維持し、内部結果形だけを変更する。
 */
export type ProviderModelIdValidationResult = Readonly<
  | { status: "valid"; value: string; error: null }
  | { status: "blocked"; value: null; error: "provider_model_id_invalid" }
>;

const codexForbiddenEnvironmentNames = new Set(
  CODEX_FORBIDDEN_ENVIRONMENT_NAMES,
);

const claudeForbiddenEnvironmentNames = new Set(
  CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES,
);

/**
 * 固定Provider環境の一回Snapshotを検査し、元の順序で返す。
 *
 * @responsibility Provider別禁止環境名、文字列以外の値およびNULを拒否する。
 * @trace ARCH-000010
 * @input provider: 計画のProvider。environment: 固定CLI計画から取得した環境値。
 * @returns readyと取得順の名前・値組、またはblockedと固定拒否理由。
 * @precondition 呼出し側は固定CLI計画を選択済みで、任意環境を実行へ昇格しない。
 * @postcondition 入力を変更せず、一回取得した同じ値を利用側へ返す。
 * @effect N/A: 環境Snapshotを検査するだけでProcessへ設定しない。
 * @failure 禁止名、文字列以外またはNULをblockedで拒否する。取得例外は呼出し側の既存準備失敗境界へ伝播する。
 * @invariant Proxy認証値、Docker引数、MountまたはAuthorityを生成しない。
 * @boundary AI Adapter内部の固定CLI環境と共通実行計画の間。
 * @security API KeyとProvider接続先の上書きを既存禁止集合で拒否する。
 * @concurrency N/A: 共有集合を変更しない同期検査である。
 */
export function prepareProviderEnvironment(
  provider: Provider,
  environment: Readonly<Record<string, string>>,
): ProviderEnvironmentResult {
  const forbiddenNames =
    provider === "codex"
      ? codexForbiddenEnvironmentNames
      : claudeForbiddenEnvironmentNames;
  const entries = Object.entries(environment);
  if (
    entries.some(
      ([name, value]) =>
        forbiddenNames.has(name) ||
        typeof value !== "string" ||
        value.includes("\0"),
    )
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_environment_invalid",
    });
  return Object.freeze({ status: "ready", entries });
}

/**
 * exact Model IDが固定CLIへ搬送できる構文か確認する。
 *
 * @responsibility 小文字識別子と128文字以内の既存構文を変更せず検証する。
 * @trace ARCH-000010
 * @input model: 解決済みModel ID。
 * @returns validの入力文字列又はblockedの固定拒否理由。
 * @precondition 入力は文字列であり、Catalog対応の確認は呼出し側が所有する。
 * @postcondition trim、大小文字変換および別Modelへの置換を行わない。
 * @effect N/A: 文字列検査だけを行う。
 * @failure 不正文字、空値または上限超過をblockedで拒否する。
 * @invariant 構文受理をModel提供・実行権限の成立としない。
 * @boundary Model選定とProvider CLI計画の間。
 * @security 空白、制御文字およびCLI引数区切りを受理しない。
 * @concurrency N/A: 共有状態を持たない同期検査である。
 */
export function validateProviderModelId(
  model: string,
): ProviderModelIdValidationResult {
  return /^[a-z0-9][a-z0-9._-]{0,127}$/.test(model)
    ? Object.freeze({ status: "valid", value: model, error: null })
    : Object.freeze({
        status: "blocked",
        value: null,
        error: "provider_model_id_invalid",
      });
}
