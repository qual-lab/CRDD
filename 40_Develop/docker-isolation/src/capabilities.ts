/**
 * 実行構築前の固定構成と同意用通信条件を純粋に記述する。
 * @packageDocumentation
 * @responsibility 専門正本を一回の値へ合成し、実環境観測や実行許可を生成しない。
 * @trace ARCH-000008
 * @boundary 不変の配置記述と、上位の用途別構成・同意判断。
 */
import {
  DIAGNOSTIC_IMAGE,
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "./image/assets.ts";
import type { IsolationCapabilities } from "./image/types.ts";
import {
  describeDockerProxyTopology,
  prepareDockerNetworkPolicy,
} from "./network/policy.ts";

/**
 * 固定Image・配置・Proxyと実効通信条件を返す。
 * @responsibility 各値の正本を再定義せず、構築前と同意前に同じ定義を提供する。
 * @trace ARCH-000008
 * @input provider: 配置識別子。additionalHosts: 既存検査へ渡す追加Host、既定は追加なし。
 * @returns 非秘密の構成記述。networkPolicyはready又はblockedを明示する。
 * @precondition Repository選定・同意・Authorityは利用側が所有する。
 * @postcondition 元入力を保持せず、Engine・Image存在・認証状態を判定しない。
 * @effect N/A: 固定値取得と同期の正規化・Hash計算のみ。
 * @failure 未知Providerは例外。不正追加HostはnetworkPolicyがblockedとなる。
 * @invariant Assets取得を実行可能性や通信許可へ昇格しない。
 * @security Secret・Host Path・任意Image・任意argvを入力又は返却へ追加しない。
 * @concurrency Cache・状態・非同期処理を持たない。
 */
export function describeIsolationCapabilities(): IsolationCapabilities<"runtime">;
export function describeIsolationCapabilities<P extends "codex" | "claude">(
  provider: P,
  additionalHosts?: unknown,
): IsolationCapabilities<P>;
export function describeIsolationCapabilities(
  provider?: "codex" | "claude",
  additionalHosts: unknown = [],
): IsolationCapabilities {
  if (provider === undefined)
    return Object.freeze({
      image: DIAGNOSTIC_IMAGE,
      engine: "docker_desktop_linux_named_pipe",
      runtimeProfile: Object.freeze({
        backend: "docker_desktop_linux",
        endpoint: "local_named_pipe",
        dockerCliTrust:
          "fixed_path_valid_windows_authenticode_docker_inc_and_operation_snapshot",
        imagePinnedByDigest: true,
        networkMode: "none",
      }),
    });
  if (provider !== "codex" && provider !== "claude")
    throw Error("docker_isolation_capabilities_invalid");
  const primary = describeDockerProviderExecutionLocations(provider, "task");
  const common = {
    proxy: describeDockerProxyTopology(provider),
    networkPolicy: prepareDockerNetworkPolicy(provider, additionalHosts),
  };
  return provider === "codex"
    ? Object.freeze({
        ...common,
        provider,
        assets: describeDockerProviderAssets(provider),
        locations: Object.freeze({
          primary,
          alternate: describeDockerProviderExecutionLocations(
            provider,
            "advice",
          ),
        }),
      })
    : Object.freeze({
        ...common,
        provider,
        assets: describeDockerProviderAssets(provider),
        locations: Object.freeze({ primary }),
      });
}
