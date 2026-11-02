/**
 * 通常実行と再入場で共用する実資源の回収を所有する。
 * @responsibility 非同期I/Oを保持し、元ID・名前・所有Label・削除・不存在を順に確認する。
 * @trace ARCH-000008
 */
import {
  dockerResourceConfigurationMatches,
  dockerResourceExpectationIsValid,
  type DockerResourceExpectation,
} from "./plan.ts";
import {
  dockerResourceIdentityMatches,
  type DockerRecoveryCommandResult,
} from "./resource.ts";

/**
 * 一つの元実IDをfresh照合し、削除後のIDと名前の不存在を確認する。
 * @responsibility 通常・単独回収の二重実装を作らず同じ技術条件を適用する。
 * @trace ARCH-000008
 * @input run: DI内部の固定CLI接続。expected: 元資源の技術構成。signal: 明示取消。
 * @returns 現在不存在又は照合・削除・二軸不存在が成立した場合だけtrue。
 * @effect 固定一覧・inspect・実ID限定削除。
 * @failure 例外・取消・識別不一致・出力超過・残存はfalse。
 * @invariant 上位の許可や保存状態を逆照会しない。
 */
export async function cleanupDockerResource(
  run: (
    argv: readonly string[],
  ) => DockerRecoveryCommandResult | Promise<DockerRecoveryCommandResult>,
  expected: DockerResourceExpectation,
  signal?: AbortSignal,
  previouslyAbsent = false,
  requireConfigurationMatch = false,
): Promise<boolean> {
  if (!dockerResourceExpectationIsValid(expected)) return false;
  return cleanupResourceIdentity(
    run,
    expected,
    signal,
    previouslyAbsent,
    requireConfigurationMatch
      ? (value) => dockerResourceConfigurationMatches(value, expected)
      : undefined,
  );
}

/**
 * 受領済み元IDの共通技術回収。用途・保存・上位Ownerを解釈しない。
 * @responsibility fresh識別照合・実ID削除・IDと名前の不存在を一つにする。
 * @trace ARCH-000008
 * @input expected: 元実ID・名前・所有Label。match: ID欠測発見経路だけの内部構成検査。
 * @returns 不存在を観測できた場合だけtrue。
 * @effect 固定inspect・ls・元実IDのrm。
 * @failure 観測不能・取消・通知後構成差・別対象はfalse。
 * @invariant 内部matchを上位公開の検査省略設定にしない。
 */
export async function cleanupResourceIdentity(
  run: (
    argv: readonly string[],
  ) => DockerRecoveryCommandResult | Promise<DockerRecoveryCommandResult>,
  expected: Readonly<{
    kind: "container" | "network";
    dockerId: string;
    expectedName: string;
    ownershipLabel: string;
  }>,
  signal?: AbortSignal,
  previouslyAbsent = false,
  match?: (resource: unknown) => boolean,
): Promise<boolean> {
  if (
    !expected ||
    !["container", "network"].includes(expected.kind) ||
    !/^[a-f0-9]{64}$/u.test(expected.dockerId) ||
    !/^crdd-[a-zA-Z0-9-]+$/u.test(expected.expectedName) ||
    !/^crdd\.coordinator\.(runtime|authentication|probe)=[a-fA-F0-9-]+$/u.test(
      expected.ownershipLabel,
    )
  )
    return false;
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
      !dockerResourceIdentityMatches(parsed[0], expected) ||
      (match && !match(parsed[0]))
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
