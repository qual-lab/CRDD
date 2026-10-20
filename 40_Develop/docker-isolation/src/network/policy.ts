/**
 * Repository内AI実行の実効通信条件を純粋に組み立てる。
 * @responsibility Provider固定集合と追加Hostの技術検査・合成・Hashを所有する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import net from "node:net";
import { types } from "node:util";
import { describeDockerProviderAssets } from "../image/assets.ts";

const PROVIDER_HOSTS = Object.freeze({
  codex: Object.freeze(["auth.openai.com", "chatgpt.com"]),
  claude: Object.freeze([
    "api.anthropic.com",
    "claude.ai",
    "platform.claude.com",
  ]),
});

/**
 * 固定Proxy Imageと二Networkの技術構成を記述する。
 * @responsibility Image・port・固定Provider通信先・直接通信禁止をDI内の単一定義へ結合する。
 * @trace ARCH-000008
 * @input provider: 対象Provider。
 * @returns 不変の構成記述。実資源の観測結果ではない。
 * @precondition 呼出し側がProviderを選定済み。
 * @postcondition Repository追加Hostは含めず、一回の実効Policyで別途渡す。
 * @effect N/A: 固定値の取得だけ。
 * @failure 未知Providerは固定例外。
 * @invariant 過去Probe結果やBuild Hashを通常実行の証明にしない。
 * @boundary 上位の意味判断とDIの技術構成。
 * @security 認証情報・Host Path・Authorityなし。
 * @concurrency N/A: 凍結した局所値のみ。
 */
export function describeDockerProxyTopology(provider: "codex" | "claude") {
  const assets = describeDockerProviderAssets(provider).proxy;
  return Object.freeze({
    provider,
    proxyProfile: provider,
    containerPort: assets.containerPort,
    imageDigest: assets.imageDigest,
    allowedHostnames: PROVIDER_HOSTS[provider],
    providerNetwork: "operation_internal",
    providerNetworkInternal: true,
    providerDirectExternalNetwork: false,
    proxyNetworks: Object.freeze(["operation_internal", "proxy_egress"]),
    dockerSocketMounted: false,
    hostNetworkModeAllowed: false,
    localFallbackAllowed: false,
    enforcement: "fixed_digest_proxy_runtime_validation_required",
  });
}

/**
 * 一回のRepository内実行に使う技術設定を表す。
 * @responsibility 実効集合と同じ意味のHashを所有する。
 * @trace ARCH-000004
 * @shape 契約版・用途・Provider・Host・port・method・Hash。
 * @invariant Host配列を含め凍結する。
 * @boundary 上位の確認値と後続Proxy構成。
 * @security Authorityではなく、接続・DNS検証の成立も証明しない。
 * @compatibility ログイン用途へ追加集合を渡さない。
 */
export type DockerNetworkPolicy = Readonly<{
  contractRevision: 1;
  purpose: "repository_ai_execution";
  provider: "codex" | "claude";
  allowedHosts: readonly string[];
  allowedPort: 443;
  allowedMethod: "CONNECT";
  policyHash: string;
}>;

/**
 * 実効設定の構成可否を返す。
 * @responsibility 不正入力から部分的な許可集合を返さない。
 * @trace ARCH-000004
 * @shape ready/policyまたはblocked/reason。
 * @invariant blockedにはpolicyがない。
 * @boundary 上位入力と技術検査。
 * @security 生入力・秘密値を理由へ複製しない。
 * @compatibility 正常でも通信許可・起動を発行しない。
 */
export type DockerNetworkPolicyResult =
  | Readonly<{ status: "ready"; policy: DockerNetworkPolicy }>
  | Readonly<{ status: "blocked"; reason: "docker_network_policy_invalid" }>;

/**
 * Provider固定Hostと一Repositoryの追加集合を合成する。
 * @responsibility Host文法・上限・不変性と実効Hashを固定する。
 * @trace ARCH-000004
 * @input provider: 対象Provider、additionalHosts: 最大32追加Host。
 * @returns 不変Policyまたは固定停止結果。
 * @precondition 上位がRepositoryと同意を別途結合する。
 * @postcondition 元配列を保持せず、整列した集合からHashを生成する。
 * @effect N/A: Process内の純粋計算。
 * @failure 不正Provider・配列・DNS名・重複・上限超過はblocked。
 * @invariant Role別設定やRepository探索を持たない。
 * @boundary 未信頼の値とDocker技術入力。
 * @security accessor・Proxy・疎配列を評価せず、IP直接指定を拒否する。
 * @concurrency N/A: 同期局所値だけ。
 */
export function prepareDockerNetworkPolicy(
  provider: unknown,
  additionalHosts: unknown,
): DockerNetworkPolicyResult {
  try {
    if (
      (provider !== "codex" && provider !== "claude") ||
      !Array.isArray(additionalHosts) ||
      types.isProxy(additionalHosts) ||
      Object.getPrototypeOf(additionalHosts) !== Array.prototype
    )
      throw new Error("input");
    if (
      additionalHosts.length > 32 ||
      Reflect.ownKeys(additionalHosts).length !== additionalHosts.length + 1
    )
      throw new Error("array");
    const additions = new Set<string>();
    for (let index = 0; index < additionalHosts.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        additionalHosts,
        String(index),
      );
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "string" ||
        !/^[\x00-\x7f]*$/u.test(descriptor.value)
      )
        throw new Error("entry");
      const host = descriptor.value.toLowerCase();
      if (
        host.length === 0 ||
        host.length > 253 ||
        !/^[a-z0-9.-]+$/u.test(host) ||
        net.isIP(host) !== 0 ||
        host
          .split(".")
          .some(
            (label) =>
              label.length === 0 ||
              label.length > 63 ||
              !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
          ) ||
        additions.has(host)
      )
        throw new Error("hostname");
      const canonicalHostname = new URL(`https://${host}/`).hostname;
      if (canonicalHostname !== host || net.isIP(canonicalHostname) !== 0)
        throw new Error("hostname");
      additions.add(host);
    }
    const allowedHosts = Object.freeze(
      [...new Set([...PROVIDER_HOSTS[provider], ...additions])].sort(),
    );
    const policyHash = createHash("sha256")
      .update("crdd-docker-network-policy-v1\0")
      .update(
        JSON.stringify([
          1,
          "repository_ai_execution",
          provider,
          allowedHosts,
          443,
          "CONNECT",
        ]),
      )
      .digest("hex");
    return Object.freeze({
      status: "ready",
      policy: Object.freeze({
        contractRevision: 1,
        purpose: "repository_ai_execution",
        provider,
        allowedHosts,
        allowedPort: 443,
        allowedMethod: "CONNECT",
        policyHash,
      }),
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "docker_network_policy_invalid",
    });
  }
}

/**
 * 実行入力の通信設定を再検査し、正規形だけを返す。
 * @responsibility Provider・固定Host・Hash・閉じた値構造の一致を確認する。
 * @trace ARCH-000008
 * @input value: 外部境界から受け取った通信設定。
 * @returns 正規化済み設定、または不正時null。
 * @precondition 認可・同意は上位で確認する。
 * @postcondition 入力の参照やaccessorを保持しない。
 * @effect N/A: 同期の値検査のみ。
 * @failure 不正・観測不能はnull。
 * @invariant Hash一致だけで通信を許可しない。
 * @boundary 起動・回収計画の値境界。
 * @security Proxy・getterを実行しない。
 * @concurrency N/A: 局所値のみ。
 */
export function parseDockerNetworkPolicy(
  value: unknown,
): DockerNetworkPolicy | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return null;
    const keys = [
      "contractRevision",
      "purpose",
      "provider",
      "allowedHosts",
      "allowedPort",
      "allowedMethod",
      "policyHash",
    ];
    if (Reflect.ownKeys(value).length !== keys.length) return null;
    const data: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
      data[key] = descriptor.value;
    }
    if (data.provider !== "codex" && data.provider !== "claude") return null;
    if (
      !Array.isArray(data.allowedHosts) ||
      types.isProxy(data.allowedHosts) ||
      Object.getPrototypeOf(data.allowedHosts) !== Array.prototype ||
      data.allowedHosts.length > 35 ||
      Reflect.ownKeys(data.allowedHosts).length !== data.allowedHosts.length + 1
    )
      return null;
    const hosts: string[] = [];
    for (let index = 0; index < data.allowedHosts.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        data.allowedHosts,
        String(index),
      );
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "string"
      )
        return null;
      hosts.push(descriptor.value);
    }
    const result = prepareDockerNetworkPolicy(
      data.provider,
      hosts.filter(
        (host) =>
          !PROVIDER_HOSTS[data.provider as "codex" | "claude"].includes(host),
      ),
    );
    if (
      result.status !== "ready" ||
      keys.some((key) =>
        key === "allowedHosts"
          ? JSON.stringify(hosts) !== JSON.stringify(result.policy.allowedHosts)
          : data[key] !== result.policy[key as keyof DockerNetworkPolicy],
      )
    )
      return null;
    return result.policy;
  } catch {
    return null;
  }
}
