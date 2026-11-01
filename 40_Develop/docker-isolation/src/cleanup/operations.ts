/**
 * 通常実行と再入場で共用する実資源の回収を所有する。
 * @responsibility 非同期I/Oを保持し、元ID・構成・削除・不存在を同じ順序で確認する。
 * @trace ARCH-000008
 */
import {
  dockerResourceConfigurationMatches,
  dockerResourceExpectationIsValid,
  type DockerResourceExpectation,
} from "./plan.ts";
import type { DockerRecoveryCommandResult } from "./resource.ts";

/**
 * 一つの元実IDをfresh照合し、削除後のIDと名前の不存在を確認する。
 * @responsibility 通常・単独回収の二重実装を作らず同じ技術条件を適用する。
 * @trace ARCH-000008
 * @input run: DI内部の固定CLI接続。expected: 元資源の技術構成。signal: 明示取消。
 * @returns 現在不存在又は照合・削除・二軸不存在が成立した場合だけtrue。
 * @effect 固定一覧・inspect・実ID限定削除。
 * @failure 例外・取消・構成差・出力超過・残存はfalse。
 * @invariant 上位の許可や保存状態を逆照会しない。
 */
export async function cleanupDockerResource(
  run: (
    argv: readonly string[],
  ) => DockerRecoveryCommandResult | Promise<DockerRecoveryCommandResult>,
  expected: DockerResourceExpectation,
  signal?: AbortSignal,
  previouslyAbsent = false,
): Promise<boolean> {
  if (!dockerResourceExpectationIsValid(expected)) return false;
  const { kind, dockerId, expectedName } = expected;
  const command = async (argv: readonly string[]) => {
    signal?.throwIfAborted();
    const result = await run(argv);
    signal?.throwIfAborted();
    if (
      result.status !== 0 ||
      result.signal ||
      result.error ||
      result.stderr.length ||
      Buffer.byteLength(result.stdout, "utf8") > 1_048_576
    )
      throw Error("docker_resource_observation_unconfirmed");
    return result.stdout;
  };
  const list = (filter: string) =>
    command([
      kind,
      "ls",
      ...(kind === "container" ? ["--all"] : []),
      "--no-trunc",
      "--filter",
      filter,
      "--format",
      "{{.ID}}",
    ]);
  const absent = async () =>
    (await list(`id=${dockerId}`)).trim() === "" &&
    (
      await list(
        kind === "container"
          ? `name=^/${expectedName}$`
          : `name=^${expectedName}$`,
      )
    ).trim() === "";
  try {
    if (previouslyAbsent) return await absent();
    signal?.throwIfAborted();
    const inspected = await run([kind, "inspect", dockerId]);
    signal?.throwIfAborted();
    if (inspected.status === 1 && !inspected.signal && !inspected.error)
      return await absent();
    if (
      inspected.status !== 0 ||
      inspected.signal ||
      inspected.error ||
      inspected.stderr.length ||
      Buffer.byteLength(inspected.stdout, "utf8") > 1_048_576
    )
      return false;
    const parsed: unknown = JSON.parse(inspected.stdout);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 1 ||
      !dockerResourceConfigurationMatches(parsed[0], expected)
    )
      return false;
    signal?.throwIfAborted();
    await command(
      kind === "container"
        ? ["container", "rm", "--force", dockerId]
        : ["network", "rm", dockerId],
    );
    return await absent();
  } catch {
    return false;
  }
}
