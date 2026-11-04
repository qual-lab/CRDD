/**
 * 実行構築前の固定Image・実行位置・技術配置を純粋に記述する。
 * @packageDocumentation
 * @responsibility 専門正本を一回の値へ合成し、実環境観測や実行許可を生成しない。
 * @trace ARCH-000008
 * @boundary 不変の配置記述と、上位の用途別構成。
 */
import {
  DIAGNOSTIC_IMAGE,
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "./image/assets.ts";
import type { IsolationConfiguration } from "./image/types.ts";

/**
 * 固定Image・配置・Proxy固定設定を返す。
 * @responsibility 各値の正本を再定義せず、実行構築前に同じ固定定義を提供する。
 * @trace ARCH-000008
 * @input provider: 固定配置識別子。未指定時は固定診断環境の記述。
 * @returns 非秘密の構成記述。Image・実行位置・Proxyの固定構成。
 * @precondition Repository選定・実行Authorityは利用側が所有する。
 * @postcondition 元入力を保持せず、Engine・Image存在・認証状態を判定しない。
 * @effect N/A: 固定値取得と固定値の合成のみ。
 * @failure 未知Providerは固定例外。
 * @invariant Assets取得を実行可能性や通信許可へ昇格しない。
 * @security Secret・Host Path・任意Image・任意argvを入力又は返却へ追加しない。
 * @concurrency Cache・状態・非同期処理を持たない。
 */
export function describeIsolationConfiguration(): IsolationConfiguration<"runtime">;
export function describeIsolationConfiguration<P extends "codex" | "claude">(
  provider: P,
): IsolationConfiguration<P>;
export function describeIsolationConfiguration(
  provider?: "codex" | "claude",
): IsolationConfiguration {
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
    throw Error("docker_isolation_configuration_invalid");
  const primary = describeDockerProviderExecutionLocations(provider, "primary");
  const common = { proxy: describeDockerProviderAssets(provider).proxy };
  return provider === "codex"
    ? Object.freeze({
        ...common,
        provider,
        assets: describeDockerProviderAssets(provider),
        locations: Object.freeze({
          primary,
          alternate: describeDockerProviderExecutionLocations(
            provider,
            "alternate",
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
