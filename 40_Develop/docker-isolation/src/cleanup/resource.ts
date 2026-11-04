/**
 * fresh再入場の検査済み実IDに対するDocker資源処置を所有する。
 *
 * @responsibility 元実IDの識別照合と、ID欠測時の構成照合を区別して処置する。
 * @trace ARCH-000008
 */
import {
  dockerResourceConfigurationMatches,
  dockerResourceExpectationIsValid,
  dockerResourceLocatorIsValid,
} from "./validation.ts";
import type { DockerResourceExpectation } from "./types.ts";
import type { ResourceIdentity, ResourceSnapshot } from "./types.ts";

/** 固定inspectの正規の不存在応答だけを肯定する。失敗一般を不存在にしない。 */
export function explicitDockerResourceAbsence(
  result: Readonly<{
    status: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    error?: Error | null;
  }>,
  kind: "container" | "network",
  name: string,
): boolean {
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 1 ||
    !["", "[]"].includes(result.stdout.trim())
  )
    return false;
  const suffixes =
    kind === "network"
      ? [`network ${name} not found`, `No such network: ${name}`]
      : [`No such object: ${name}`, `No such container: ${name}`];
  const prefixes =
    kind === "network"
      ? ["", "Error response from daemon: "]
      : ["", "Error: ", "Error response from daemon: "];
  return prefixes.some((prefix) =>
    suffixes.some((suffix) => result.stderr.trim() === prefix + suffix),
  );
}

/**
 * 元Receiptの資源種別・完全実ID・正確な名前・所有Labelだけを照合する。
 * @responsibility 既知対象の識別と実行構成検査を分離する。
 * @trace ARCH-000008
 * @input resource: 単一fresh inspect。expected: 元Receiptの識別値。
 * @returns 元対象に一致する場合だけtrue。
 * @effect N/A: 値の照合のみ。
 * @failure 欠測・種別不正・別対象・観測不能はfalse。
 * @invariant 発見候補の完全構成検査には使用しない。
 */
export function dockerResourceIdentityMatches(
  resource: unknown,
  expected: Readonly<{
    kind: "container" | "network";
    dockerId: string;
    expectedName: string;
    ownershipLabel: string;
  }>,
): boolean {
  if (
    !resource ||
    typeof resource !== "object" ||
    Array.isArray(resource) ||
    !/^[a-f0-9]{64}$/u.test(expected.dockerId) ||
    !dockerResourceLocatorIsValid(
      expected.kind,
      expected.expectedName,
      expected.ownershipLabel,
    )
  )
    return false;
  const item = resource as Record<string, unknown>;
  const container = expected.kind === "container";
  const config = item.Config;
  const labels =
    container && config && typeof config === "object"
      ? (config as Record<string, unknown>).Labels
      : !container
        ? item.Labels
        : null;
  const separator = expected.ownershipLabel.indexOf("=");
  return (
    separator > 0 &&
    item.Id === expected.dockerId &&
    item.Name ===
      (container ? `/${expected.expectedName}` : expected.expectedName) &&
    !!labels &&
    typeof labels === "object" &&
    !Array.isArray(labels) &&
    (labels as Record<string, unknown>)[
      expected.ownershipLabel.slice(0, separator)
    ] === expected.ownershipLabel.slice(separator + 1)
  );
}

/**
 * 同じinspectから非秘密構成と識別情報を返す。
 * @responsibility 構成情報の返却と、削除対象の識別条件を分離する。
 * @trace ARCH-000008
 * @input resource: 固定CLIからJSONとして取得した単一inspect。key: 要求内の相関。
 * @returns 非秘密の資源情報。Command引数と環境値は含めない。
 * @effect N/A: JSON値の不変投影だけ。
 * @failure 不正Identityはnull。欠測した構成を既定構成で補完しない。
 * @invariant Snapshotは実行権限でも削除権限でもない。
 */
export function snapshotObservedDockerResource(
  resource: unknown,
  key: string,
  expected: Readonly<{
    kind: "container" | "network";
    dockerId: string;
    expectedName: string;
    ownershipLabel: string;
  }>,
): ResourceSnapshot | null {
  if (!dockerResourceIdentityMatches(resource, expected)) return null;
  const item = resource as Record<string, unknown>;
  const config = (item.Config ?? {}) as Record<string, unknown>;
  const network = (item.NetworkSettings ?? {}) as Record<string, unknown>;
  const image = config.Image;
  const mounts =
    Array.isArray(item.Mounts) &&
    item.Mounts.every((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
      const mount = value as Record<string, unknown>;
      return (
        typeof mount.Source === "string" &&
        typeof mount.Destination === "string" &&
        typeof mount.RW === "boolean"
      );
    })
      ? item.Mounts
      : null;
  const commands =
    Array.isArray(config.Cmd) &&
    config.Cmd.every((value: unknown) => typeof value === "string")
      ? config.Cmd
      : null;
  const environment =
    Array.isArray(config.Env) &&
    config.Env.every(
      (value: unknown) =>
        typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*=/u.test(value),
    )
      ? config.Env
      : null;
  return Object.freeze({
    resources: Object.freeze([
      Object.freeze({
        key,
        identity: Object.freeze({
          kind: expected.kind,
          dockerId: expected.dockerId,
          name: expected.expectedName,
          ownershipLabel: expected.ownershipLabel,
        }),
        request: "unknown" as const,
        configuration: Object.freeze({
          image:
            typeof image === "string" &&
            /^(?:sha256:|[a-z0-9./_-]+@sha256:)[a-f0-9]{64}$/u.test(image)
              ? image
              : null,
          command: commands
            ? Object.freeze(commands.map(() => "<redacted>"))
            : null,
          environmentNames: environment
            ? Object.freeze(
                environment.flatMap((value: unknown) => {
                  if (typeof value !== "string") return [];
                  const name = value.slice(0, value.indexOf("="));
                  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) ? [name] : [];
                }),
              )
            : null,
          mounts: mounts
            ? Object.freeze(
                mounts.flatMap((value: unknown) => {
                  if (!value || typeof value !== "object") return [];
                  const m = value as Record<string, unknown>;
                  return typeof m.Source === "string" &&
                    typeof m.Destination === "string" &&
                    typeof m.RW === "boolean"
                    ? [
                        Object.freeze({
                          source: m.Source,
                          target: m.Destination,
                          readOnly: !m.RW,
                        }),
                      ]
                    : [];
                }),
              )
            : null,
          networks:
            network.Networks &&
            typeof network.Networks === "object" &&
            !Array.isArray(network.Networks)
              ? Object.freeze(Object.keys(network.Networks))
              : null,
          internal:
            expected.kind === "network" && typeof item.Internal === "boolean"
              ? item.Internal
              : null,
        }),
      }),
    ]),
  });
}

/**
 * 固定Docker観測・清掃要求の同期結果。
 *
 * @responsibility 失敗・Signal・例外と出力を別fieldで搬送する。
 * @trace ARCH-000008
 * @shape status、signal、stdout、stderr、error。
 * @invariant exitだけで不存在や清掃成功を宣言しない。
 * @boundary 固定Docker実行primitiveから資源観測への境界。
 * @security 生Provider出力や処置許可は含めない。診断は上位が必要最小量へ限定する。
 * @compatibility 既存回復Runnerの結果fieldと同じ意味を保持する。
 */
export type DockerRecoveryCommandResult = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  error: Error | null;
}>;

/**
 * 実IDの単一inspect応答を共通の有界経路で取り出す。
 * @responsibility 失敗・Signal・容量超過・不正JSONを実体へ変換しない。
 * @trace ARCH-000008
 * @input runDocker: 内部の固定実行、kind: 資源種別、id: 実ID、maxBytes: 既存用途の上限。
 * @returns 単一実体又はnull。
 * @effect 固定inspect一回。
 * @failure 不明はnull。
 * @invariant 観測だけで削除許可を発行しない。
 */
export function inspectObservedDockerResource(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  kind: "container" | "network",
  id: string,
  maxBytes = 1_048_576,
): unknown {
  if (!/^[a-f0-9]{64}$/u.test(id)) return null;
  const observed = runDocker([kind, "inspect", id]);
  if (
    observed.status !== 0 ||
    observed.signal ||
    observed.error ||
    observed.stderr.length ||
    Buffer.byteLength(observed.stdout, "utf8") > maxBytes
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(observed.stdout);
    return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
  } catch {
    return null;
  }
}

/**
 * 構成確認済みの実IDを処置し、呼出し元の既存不存在観測まで完了する。
 * @responsibility 削除直前確認・rm成功・現在不存在の三条件を一正本へ集約する。
 * @trace ARCH-000008
 * @input runDocker: 内部固定実行、kind/id: 検査済み実体、observeAbsent: 固定観測。
 * @returns 三条件共同成立時true。
 * @precondition 直前に同じ元実ID・名前・所有Labelを確認している。ID欠測の発見条件は別途維持する。
 * @effect 実ID限定rmと現在不存在観測。
 * @failure 例外・非0・Signal・不明・Owner喪失はfalse。
 * @invariant この内部関数をDI Rootへ公開しない。
 */
export function removeObservedDockerResource(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  kind: "container" | "network",
  id: string,
  observeAbsent: () => boolean,
): boolean {
  if (!/^[a-f0-9]{64}$/u.test(id)) return false;
  try {
    const removed = runDocker(
      kind === "container"
        ? ["container", "rm", "--force", id]
        : ["network", "rm", id],
    );
    return (
      removed.status === 0 &&
      !removed.signal &&
      !removed.error &&
      observeAbsent() === true
    );
  } catch {
    return false;
  }
}

/**
 * 元実IDの存在又は二軸不存在を読取り専用で照合する。
 * @responsibility 名前・Label・構成の一致を判定し、資源を削除しない。
 * @trace ARCH-000008
 * @input runDocker: 固定観測、expectation: 元構成、options: 不存在受理の有無。
 * @returns 指定した存在条件を観測できた場合だけtrue。
 * @effect 固定ls／inspectだけ。削除要求は発行しない。
 * @failure 観測不能・構成差・不正応答はfalse。
 * @invariant 回収はcleanupDockerResourceへ集約し、この読取りから実施しない。
 */
export function observeExpectedDockerResource(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  expectation: DockerResourceExpectation,
  options: Readonly<{
    allowAlreadyAbsent?: boolean;
    onObserved?: (snapshot: ResourceSnapshot) => void;
  }> = Object.freeze({}),
) {
  if (!dockerResourceExpectationIsValid(expectation)) return false;
  return observeIsolationIdentity(
    runDocker,
    {
      kind: expectation.kind,
      dockerId: expectation.dockerId,
      name: expectation.expectedName,
      ownershipLabel: expectation.ownershipLabel,
    },
    expectation.key,
    { ...options, configuration: expectation },
  );
}

/**
 * 既知実IDの資源を用途・実行構成によらず観測する。
 * @responsibility 実ID・名前・所有Labelと明示不存在を同じ有界読取りへ結合する。
 * @trace ARCH-000008
 * @input runDocker: DI内部の固定接続。identity: 元Receipt。key: 要求内の相関。
 * @returns 元対象の存在、又は明示許可された不存在だけtrue。
 * @effect 固定Docker読取りだけ。削除・作成は発行しない。
 * @invariant 構成差や観測失敗を不存在・別対象へ読み替えない。
 */
export function observeIsolationIdentity(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  identity: ResourceIdentity,
  key: string,
  options: Readonly<{
    allowAlreadyAbsent?: boolean;
    onObserved?: (snapshot: ResourceSnapshot) => void;
    configuration?: DockerResourceExpectation;
  }> = {},
): boolean {
  if (
    !identity ||
    !["container", "network"].includes(identity.kind) ||
    typeof identity.dockerId !== "string" ||
    !/^[a-f0-9]{64}$/u.test(identity.dockerId) ||
    !dockerResourceLocatorIsValid(
      identity.kind,
      identity.name,
      identity.ownershipLabel,
    )
  )
    return false;
  const expectation = {
    kind: identity.kind,
    dockerId: identity.dockerId,
    expectedName: identity.name,
    ownershipLabel: identity.ownershipLabel,
  };
  const { kind, dockerId, expectedName } = expectation;

  const exactNameAbsent = () => {
    const named = runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            "--filter",
            `name=^/${expectedName}$`,
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            "--filter",
            `name=^${expectedName}$`,
            "--format",
            "{{.ID}}",
          ],
    );
    return (
      named.status === 0 &&
      !named.signal &&
      !named.error &&
      named.stderr.length === 0 &&
      named.stdout.trim() === ""
    );
  };
  const listArgs =
    kind === "container"
      ? [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ]
      : [
          "network",
          "ls",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ];
  const listed = runDocker(listArgs);
  if (
    listed.status !== 0 ||
    listed.signal ||
    listed.error ||
    listed.stderr.length
  )
    return false;
  const ids = listed.stdout.trim() ? listed.stdout.trim().split(/\r?\n/u) : [];
  if (ids.length === 0)
    return options.allowAlreadyAbsent !== false && exactNameAbsent();
  if (ids.length !== 1 || ids[0] !== dockerId) return false;
  const inspected = inspectObservedDockerResource(runDocker, kind, dockerId);
  if (!dockerResourceIdentityMatches(inspected, expectation)) return false;
  if (
    options.configuration &&
    !dockerResourceConfigurationMatches(inspected, options.configuration)
  )
    return false;
  const snapshot = snapshotObservedDockerResource(inspected, key, expectation);
  if (!snapshot) return false;
  const delivered: unknown = options.onObserved?.(snapshot);
  if (delivered !== undefined) {
    void Promise.resolve(delivered).catch(() => {});
    throw Error("docker_resource_observation_notification_invalid");
  }
  return true;
}

/**
 * 作成結果不明の予定資源を現在観測から識別する。
 *
 * @responsibility exact名とLabelの単一IDが一致し、隔離構成も成立する場合だけ実IDを返す。
 * @trace ARCH-000008
 * @input runDocker: 固定観測primitive。expectation: 上位検査済み予定資源の技術条件。
 * @returns 構成確認済み実ID、またはnull。
 * @precondition 上位が同じ回復参照と限定した未解決作成要求を検査している。
 * @postcondition 名前だけで採用せず、作成成功や清掃完了を宣言しない。
 * @effect 固定Docker ls／inspectで現在資源を観測する。削除しない。
 * @failure 観測不能・複数・名とLabelの差・構成差・資源未発見はnull。
 * @invariant 未発見を不存在・過去要求の未発行へ読み替えない。
 * @boundary 限定未解決作成Classから技術的な現在実IDの観測。
 * @security 実IDから新しい処置許可や汎用Recoveryを発行しない。
 * @concurrency 各観測を同じ予定資源へ結合し、不一致では停止する。
 */
export function discoverSubmittedDockerResource(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  expectation: Omit<DockerResourceExpectation, "dockerId">,
) {
  if (!dockerResourceExpectationIsValid(expectation)) return null;
  const { kind, expectedName, ownershipLabel } = expectation;

  const list = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  const ids = (result: DockerRecoveryCommandResult) => {
    if (
      result.status !== 0 ||
      result.signal ||
      result.error ||
      result.stderr.length !== 0
    )
      return null;
    const values = result.stdout.trim()
      ? result.stdout.trim().split(/\r?\n/u)
      : [];
    return values.length <= 1 &&
      values.every((value) => /^[a-f0-9]{64}$/u.test(value))
      ? values
      : null;
  };
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const labelFilter = `label=${ownershipLabel}`;
  const byNameItems = ids(list(nameFilter));
  const byOwnershipItems = ids(list(nameFilter, labelFilter));
  if (!byNameItems || !byOwnershipItems) return null;
  if (byNameItems.length === 0 && byOwnershipItems.length === 0) return null;
  if (
    byNameItems.length !== 1 ||
    byOwnershipItems.length !== 1 ||
    byNameItems[0] !== byOwnershipItems[0]
  )
    return null;
  return observeExpectedDockerResource(
    runDocker,
    { ...expectation, dockerId: byNameItems[0] as string },
    Object.freeze({
      allowAlreadyAbsent: false,
    }),
  )
    ? (byNameItems[0] as string)
    : null;
}

/**
 * 予定名とLabelで現在資源の明示不存在を観測する。
 *
 * @responsibility 二つの成功観測を要求し、失敗・Signal・例外を空集合へ変換しない。
 * @trace ARCH-000008
 * @input runDocker、kind、expectedName、ownershipLabel: 固定観測と検査済み予定資源。
 * @returns 両方の明示不存在が成立する場合だけtrue。
 * @precondition 上位が遅延作成の扱いと回復Classを別に検査している。
 * @postcondition この値だけで過去作成結果unknownを消さない。
 * @effect 固定Docker lsを予定名と名／Labelで二回実行する。
 * @failure 観測不能・不正終了・残存はfalse。
 * @invariant falseは不存在ではなく、再試行や閉鎖の許可も含めない。
 * @boundary 現在資源の観測から上位の限定回復判断。
 * @security 名前だけの削除とRoot／State操作を追加しない。
 * @concurrency 現在観測を二経路で照合し、遅延作成の無害化は上位に残す。
 */
export function observeSubmittedDockerResourceAbsent(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  kind: "container" | "network",
  expectedName: string,
  ownershipLabel: string,
) {
  if (!dockerResourceLocatorIsValid(kind, expectedName, ownershipLabel))
    return false;
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const executeRecoveryOperation = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  return [
    executeRecoveryOperation(nameFilter),
    executeRecoveryOperation(nameFilter, `label=${ownershipLabel}`),
  ].every(
    (result) =>
      result.status === 0 &&
      !result.signal &&
      !result.error &&
      result.stderr.length === 0 &&
      result.stdout.trim() === "",
  );
}
