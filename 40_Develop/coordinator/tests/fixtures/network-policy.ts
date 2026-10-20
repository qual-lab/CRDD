/**
 * 通信条件を必要とする試験へ非Authorityの固定値を提供する。
 * @responsibility Repository既定の追加HostとProvider別設定を構成する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 通信設定を搬送する既存の試験入力。
 * @boundary 純粋な値だけ。Docker・File・送信なし。
 */
import { prepareDockerNetworkPolicy } from "../../../docker-isolation/src/index.ts";

/**
 * Repository既定値に対応する試験用設定を返す。
 * @responsibility 試験が同じ正式構成APIの型付き値を使うようにする。
 * @trace ERB-UT-023
 * @precondition ProviderはCodexまたはClaude。
 * @stimulus 固定のnpm／PyPI三Hostを構成する。
 * @observation 正式構成APIの結果を取得する。
 * @oracle 不成立は試験準備失敗としてthrowする。
 * @cleanup N/A: 資源なし。
 * @boundary 純粋値のみ。
 */
export function fixtureNetworkPolicy(provider: "codex" | "claude") {
  const result = prepareDockerNetworkPolicy(provider, [
    "registry.npmjs.org",
    "pypi.org",
    "files.pythonhosted.org",
  ]);
  if (result.status !== "ready")
    throw new Error("fixture_network_policy_invalid");
  return result.policy;
}
