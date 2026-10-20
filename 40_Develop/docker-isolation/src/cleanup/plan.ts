/**
 * 実Docker資源のIdentityと固定隔離構成を照合する。
 *
 * @responsibility 通常清掃とfresh回復に共通する技術条件を一箇所で所有する。
 * @trace ARCH-000008
 */
import { types } from "node:util";
import path from "node:path";
import { dockerContainerInitObservationMatches } from "./init.ts";
import type { DockerIsolationCommand } from "../execution/plan.ts";
import type { DockerAuthenticationCommand } from "../authentication/plan.ts";

/**
 * 回収する五用途の固定技術期待値を構築する。
 * @responsibility 回収順、Network、Image、MountとInitを下位の不変計画として所有する。
 * @trace ARCH-000008
 * @input input: 五資源名、Label、二Image digest、Workspace／read-only／Initの三boolean。
 * @returns Container先行の固定五用途と期待値候補、またはnull。
 * @precondition 上位がIdentityの意味、Provider判断と現在資源の結合を確認する。
 * @postcondition 秘密値・所在・実ID・状態・Authorityを計画へ含めない。
 * @effect N/A: 同期の値構築だけ。
 * @failure 不正な名前・Label・digest・型・欠測は部分計画を返さずnull。
 * @invariant Proxy候補順と独立booleanの意味を保持する。
 * @boundary 上位の検証済み非秘密入力とDocker技術構成。
 * @security この計画から存在・所有・削除許可を推定しない。
 * @concurrency 入力を書き換えず、返却値と入れ子配列を凍結する。
 */
export function planDockerRecoveryResourceExpectations(
  input: Readonly<{
    authenticationContainerName: string;
    executionContainerName: string;
    proxyContainerName: string;
    internalNetworkName: string;
    egressNetworkName: string;
    ownershipLabel: string;
    executionImageDigest: string;
    proxyImageDigest: string;
    workspaceMounted: boolean;
    workspaceReadOnly: boolean;
    initRequired: boolean;
    workspaceProtected?: boolean;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
  }>,
) {
  try {
    if (
      !input ||
      typeof input !== "object" ||
      types.isProxy(input) ||
      Array.isArray(input)
    )
      return null;
    const stringKeys = [
      "authenticationContainerName",
      "executionContainerName",
      "proxyContainerName",
      "internalNetworkName",
      "egressNetworkName",
      "ownershipLabel",
      "executionImageDigest",
      "proxyImageDigest",
    ] as const;
    const booleanKeys = [
      "workspaceMounted",
      "workspaceReadOnly",
      "initRequired",
    ] as const;
    const keys = [
      ...stringKeys,
      ...booleanKeys,
      ...(Object.hasOwn(input, "workspaceProtected")
        ? ["workspaceProtected" as const]
        : []),
      ...(Object.hasOwn(input, "workspaceProtection")
        ? ["workspaceProtection" as const]
        : []),
    ];
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(
        (key) =>
          typeof key !== "string" ||
          !keys.includes(key as (typeof keys)[number]),
      )
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (
      keys.some(
        (key) => !descriptors[key] || !Object.hasOwn(descriptors[key], "value"),
      )
    )
      return null;
    const raw = {
      authenticationContainerName:
        descriptors.authenticationContainerName.value,
      executionContainerName: descriptors.executionContainerName.value,
      proxyContainerName: descriptors.proxyContainerName.value,
      internalNetworkName: descriptors.internalNetworkName.value,
      egressNetworkName: descriptors.egressNetworkName.value,
      ownershipLabel: descriptors.ownershipLabel.value,
      executionImageDigest: descriptors.executionImageDigest.value,
      proxyImageDigest: descriptors.proxyImageDigest.value,
      workspaceMounted: descriptors.workspaceMounted.value,
      workspaceReadOnly: descriptors.workspaceReadOnly.value,
      initRequired: descriptors.initRequired.value,
      ...(descriptors.workspaceProtected
        ? { workspaceProtected: descriptors.workspaceProtected.value }
        : {}),
      ...(descriptors.workspaceProtection
        ? { workspaceProtection: descriptors.workspaceProtection.value }
        : {}),
    };
    if (
      stringKeys.some((key) => typeof raw[key] !== "string") ||
      booleanKeys.some((key) => typeof raw[key] !== "boolean") ||
      (Object.hasOwn(raw, "workspaceProtected") &&
        typeof raw.workspaceProtected !== "boolean") ||
      (raw.workspaceProtected === true && raw.workspaceMounted !== true)
    )
      return null;
    const captured = raw as Readonly<typeof input>;
    const order = [
      "create_provider",
      "create_subscription_auth_probe",
      "create_proxy",
      "create_internal_network",
      "create_egress_network",
    ] as const;
    const names = {
      create_provider: captured.executionContainerName,
      create_subscription_auth_probe: captured.authenticationContainerName,
      create_proxy: captured.proxyContainerName,
      create_internal_network: captured.internalNetworkName,
      create_egress_network: captured.egressNetworkName,
    };
    const plan = order.map((purpose) => {
      const network =
        purpose === "create_internal_network" ||
        purpose === "create_egress_network";
      const base: Omit<DockerResourceExpectation, "dockerId"> = {
        purpose,
        kind: network ? "network" : "container",
        expectedName: names[purpose],
        ownershipLabel: captured.ownershipLabel,
        expectedImage: network
          ? null
          : purpose === "create_proxy"
            ? captured.proxyImageDigest
            : captured.executionImageDigest,
        shouldBeInternal: network
          ? purpose === "create_internal_network"
          : null,
        expectedNetworks: Object.freeze(
          network
            ? []
            : purpose === "create_subscription_auth_probe"
              ? ["none"]
              : [captured.internalNetworkName],
        ),
        workspaceMounted:
          purpose === "create_provider" && captured.workspaceMounted,
        workspaceReadOnly:
          purpose === "create_provider" && captured.workspaceReadOnly,
        initRequired: purpose === "create_provider" && captured.initRequired,
        ...(captured.workspaceProtected === true &&
        purpose === "create_provider"
          ? { workspaceProtected: true }
          : {}),
        ...(captured.workspaceProtection && purpose === "create_provider"
          ? { workspaceProtection: captured.workspaceProtection }
          : {}),
      };
      return Object.freeze({
        purpose,
        expectations: Object.freeze([
          Object.freeze(base),
          ...(purpose === "create_proxy"
            ? [
                Object.freeze({
                  ...base,
                  expectedNetworks: Object.freeze([
                    captured.internalNetworkName,
                    captured.egressNetworkName,
                  ]),
                }),
              ]
            : []),
        ]),
      });
    });
    if (
      plan.some((entry) =>
        entry.expectations.some(
          (expectation) => !dockerResourceExpectationIsValid(expectation),
        ),
      )
    )
      return null;
    return Object.freeze(plan);
  } catch {
    return null;
  }
}

/**
 * 元認証create操作と現在inspectの実ID・隔離構成を照合する。
 * @responsibility 通常Taskの照合条件を緩めず認証五資源の固定構成を評価する。
 * @trace ARCH-000008
 * @input input: 単一inspect実体。command: 元計画のcreate操作。dockerId: 元create結果。proxyEgressConnected: 元接続段階。
 * @returns 全技術条件一致時だけtrue。
 * @precondition 元操作の所属、観測成功、単一実体は呼出し元が確認する。
 * @postcondition Labelや名前だけで処置を許可しない。
 * @effect N/A: 同期構成比較のみ。
 * @failure 不足・不正・構成差はfalseであり不存在ではない。
 * @invariant 通常Taskの構成条件を変更しない。
 * @boundary 元認証計画とDocker wire観測。
 * @security Proxy秘密値は比較・保存・公開せず固定形式と非秘密構成を確認する。
 * @concurrency 元計画の凍結入力だけを参照する。
 */
export function dockerAuthenticationResourceConfigurationMatches(
  input: unknown,
  command: DockerAuthenticationCommand,
  dockerId: string,
  proxyEgressConnected: boolean,
  imageMetadata: Readonly<Record<string, unknown>> | null = null,
) {
  if (
    !/^[a-f0-9]{64}$/u.test(dockerId) ||
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  )
    return false;
  const resource = input as Record<string, unknown>;
  const argv = command.argv;
  const network =
    command.purpose === "create_internal_network" ||
    command.purpose === "create_egress_network";
  const container = ["create_probe", "create_login", "create_proxy"].includes(
    command.purpose,
  );
  if ((!network && !container) || resource.Id !== dockerId) return false;
  const labelIndex = argv.indexOf("--label");
  const label = argv[labelIndex + 1];
  if (labelIndex < 0 || !label) return false;
  const [labelKey, labelValue] = label.split("=");
  const config = resource.Config as Record<string, unknown> | undefined;
  const labels = (network ? resource.Labels : config?.Labels) as
    | Record<string, unknown>
    | undefined;
  const name = network ? argv.at(-1) : argv[argv.indexOf("--name") + 1];
  if (
    !name ||
    resource.Name !== (network ? name : `/${name}`) ||
    labels?.[labelKey ?? ""] !== labelValue
  )
    return false;
  if (network)
    return (
      resource.Driver === "bridge" &&
      resource.Scope === "local" &&
      resource.Internal === (command.purpose === "create_internal_network")
    );
  const host = resource.HostConfig as Record<string, unknown> | undefined;
  if (!config || !host) return false;
  if (!imageMetadata) return false;
  const imageIndex = argv.findIndex((value) =>
    /^sha256:[a-f0-9]{64}$/u.test(value),
  );
  if (
    imageIndex < 0 ||
    config?.Image !== argv[imageIndex] ||
    config.User !== "65534:65534" ||
    host?.ReadonlyRootfs !== true ||
    host.Privileged !== false
  )
    return false;
  if (
    JSON.stringify(host.CapDrop) !== '["ALL"]' ||
    !(
      host.CapAdd === null ||
      (Array.isArray(host.CapAdd) && host.CapAdd.length === 0)
    )
  )
    return false;
  if (
    !Array.isArray(host.SecurityOpt) ||
    host.SecurityOpt.length !== 1 ||
    !["no-new-privileges", "no-new-privileges:true"].includes(
      String(host.SecurityOpt[0]),
    ) ||
    host.PidsLimit !== (command.purpose === "create_probe" ? 32 : 64)
  )
    return false;
  if (!dockerContainerInitObservationMatches(host, false)) return false;
  const mode =
    argv
      .find((value) => value.startsWith("--network="))
      ?.slice("--network=".length) ?? argv[argv.indexOf("--network") + 1];
  if (!mode || host.NetworkMode !== mode) return false;
  const networks = (
    resource.NetworkSettings as Record<string, unknown> | undefined
  )?.Networks;
  if (!networks || typeof networks !== "object" || Array.isArray(networks))
    return false;
  const expectedNetworks = [mode];
  if (command.purpose === "create_proxy" && proxyEgressConnected)
    expectedNetworks.push(mode.replace("crdd-internal-", "crdd-egress-"));
  if (
    JSON.stringify(Object.keys(networks).sort()) !==
    JSON.stringify(expectedNetworks.sort())
  )
    return false;
  if (!Array.isArray(resource.Mounts)) return false;
  if (
    resource.Mounts.some(
      (mount: Record<string, unknown>) =>
        mount.Type !== "bind" && mount.Type !== "tmpfs",
    )
  )
    return false;
  const mounts = resource.Mounts.filter(
    (mount: Record<string, unknown>) => mount.Type === "bind",
  );
  const mountIndex = argv.indexOf("--mount");
  if (mountIndex < 0) {
    if (mounts.length !== 0) return false;
  } else {
    const declaration = argv[mountIndex + 1];
    if (!declaration || mounts.length !== 1) return false;
    const source = /(?:^|,)src=([^,]+)/u.exec(declaration)?.[1];
    const mount = mounts[0] as Record<string, unknown>;
    if (
      mount.Type !== "bind" ||
      mount.Source !== source ||
      mount.Destination !== "/provider-home" ||
      mount.RW !== !declaration.endsWith(",readonly") ||
      mount.Propagation !== "rprivate"
    )
      return false;
  }
  const tmpfs = host.Tmpfs;
  if (command.purpose !== "create_probe") {
    const expected =
      command.purpose === "create_proxy"
        ? "/tmp:rw,noexec,nosuid,size=16777216"
        : "/tmp:rw,noexec,nosuid,size=33554432";
    if (
      !tmpfs ||
      typeof tmpfs !== "object" ||
      Array.isArray(tmpfs) ||
      Object.keys(tmpfs).length !== 1 ||
      typeof (tmpfs as Record<string, unknown>)["/tmp"] !== "string" ||
      JSON.stringify(
        String((tmpfs as Record<string, unknown>)["/tmp"])
          .split(",")
          .sort(),
      ) !== JSON.stringify(expected.slice(5).split(",").sort())
    )
      return false;
  } else if (
    tmpfs !== undefined &&
    tmpfs !== null &&
    !(typeof tmpfs === "object" && Object.keys(tmpfs).length === 0)
  )
    return false;
  const workdirIndex = argv.indexOf("--workdir=/work");
  if (
    config.WorkingDir !==
    (workdirIndex >= 0 ? "/work" : (imageMetadata.WorkingDir ?? ""))
  )
    return false;
  if (
    JSON.stringify(config.Entrypoint ?? null) !==
    JSON.stringify(imageMetadata.Entrypoint ?? null)
  )
    return false;
  const payload = argv.slice(imageIndex + 1);
  if (
    JSON.stringify(config.Cmd ?? null) !==
    JSON.stringify(payload.length ? payload : (imageMetadata.Cmd ?? null))
  )
    return false;
  if (!Array.isArray(config.Env) || !Array.isArray(imageMetadata.Env))
    return false;
  const expectedEnvironment = new Map<string, string>();
  for (const entry of imageMetadata.Env) {
    if (typeof entry !== "string" || !entry.includes("=")) return false;
    const key = entry.slice(0, entry.indexOf("="));
    if (expectedEnvironment.has(key)) return false;
    expectedEnvironment.set(key, entry);
  }
  for (let index = 0; index < imageIndex; index += 1) {
    if (argv[index] !== "--env") continue;
    const expected = argv[index + 1];
    if (!expected) return false;
    expectedEnvironment.set(expected.slice(0, expected.indexOf("=")), expected);
  }
  if (config.Env.length !== expectedEnvironment.size) return false;
  const observedKeys = new Set<string>();
  for (const entry of config.Env) {
    if (typeof entry !== "string" || !entry.includes("=")) return false;
    const key = entry.slice(0, entry.indexOf("="));
    if (observedKeys.has(key) || !expectedEnvironment.has(key)) return false;
    observedKeys.add(key);
    const expected = expectedEnvironment.get(key) as string;
    if (key === "CRDD_PROXY_AUTH") {
      if (!/^CRDD_PROXY_AUTH=[a-f0-9]{64}$/u.test(entry)) return false;
    } else if (key.endsWith("_PROXY") && expected.includes("http://crdd:")) {
      if (
        entry.replace(
          /http:\/\/crdd:[a-f0-9]{64}@/u,
          "http://crdd:<secret>@",
        ) !==
        expected.replace(
          /http:\/\/crdd:[a-f0-9]{64}@/u,
          "http://crdd:<secret>@",
        )
      )
        return false;
    } else if (entry !== expected) return false;
  }
  return true;
}

/**
 * 現在資源のIdentityと隔離構成の期待値。
 *
 * @responsibility Task・Providerの意味を含めず、清掃に必要な技術条件を固定する。
 * @trace ARCH-000008
 * @shape 資源種別、実ID、名前、Label、Image、Network、MountとInit条件。
 * @invariant この値だけでは資源の存在・所有・処置許可を証明しない。
 * @boundary 元の検査済み計画から現在Docker観測への境界。
 * @security Host Path・本文・認証値を保持しない。
 * @compatibility 通常清掃とfresh回復で同じ固定隔離条件を利用する。
 */
export type DockerResourceExpectation = Readonly<{
  kind: "container" | "network";
  dockerId: string;
  expectedName: string;
  ownershipLabel: string;
  expectedImage: string | null;
  shouldBeInternal: boolean | null;
  purpose: Extract<
    DockerIsolationCommand["purpose"],
    | "create_subscription_auth_probe"
    | "create_internal_network"
    | "create_egress_network"
    | "create_proxy"
    | "create_provider"
  >;
  expectedNetworks: readonly string[];
  workspaceMounted: boolean;
  workspaceReadOnly: boolean;
  initRequired: boolean;
  workspaceProtected?: boolean;
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
}>;

/**
 * 資源を作成する五用途だけを識別する。
 *
 * @responsibility 起動・接続・未知用途を回収対象から除く。
 * @trace ARCH-000008
 * @input value: 呼出し元の用途値。
 * @returns 固定作成用途の場合だけtrue。
 * @precondition N/A: 未検査入力を受ける。
 * @postcondition trueの値を閉じた用途型へ絞る。
 * @effect N/A: 同期値検査だけ。
 * @failure 不明な値はfalse。
 * @invariant 処置許可を発行しない。
 * @boundary 上位の用途と下位資源処置。
 * @security 任意操作を採用しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function isDockerResourcePurpose(
  value: unknown,
): value is DockerResourceExpectation["purpose"] {
  return (
    value === "create_subscription_auth_probe" ||
    value === "create_internal_network" ||
    value === "create_egress_network" ||
    value === "create_proxy" ||
    value === "create_provider"
  );
}

/**
 * 固定資源種別と名前・Labelの対応を検査する。
 *
 * @responsibility 不正filterと別種別の資源名を観測前に拒否する。
 * @trace ARCH-000008
 * @input kind、name、label: 上位が相関を確認する予定資源。
 * @returns 固定種別・名前形式・Labelの場合だけtrue。
 * @precondition 所有相関と用途の採用は上位が確認する。
 * @postcondition container名をnetwork観測へ搬送しない。
 * @effect N/A: 値検査だけ。
 * @failure 不明種別・名前・Labelはfalse。
 * @invariant 名前とLabelだけで削除を許可しない。
 * @boundary 予定資源から固定Docker filter。
 * @security 任意filter構文を受けない。
 * @concurrency N/A: 同期検査だけ。
 */
export function dockerResourceLocatorIsValid(
  kind: unknown,
  name: string,
  label: string,
) {
  return (
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(label) &&
    (kind === "network"
      ? /^crdd-(?:internal|egress)-[a-f0-9]{16}$/u.test(name)
      : kind === "container" &&
        /^crdd-(?:auth|proxy|claude|codex)-[a-f0-9]{16}$/u.test(name))
  );
}

/**
 * 回収対象の技術期待値をEffect前に照合する。
 *
 * @responsibility 固定作成用途と資源Identityの形式を検査する。
 * @trace ARCH-000008
 * @input expectation: 上位が相関を確認した技術期待値。
 * @returns 閉じた用途・資源形式に一致する場合だけtrue。
 * @precondition 用途の採用と処置許可は上位Ownerが確認する。
 * @postcondition start・connectや未知用途を回収へ搬送しない。
 * @effect N/A: 値の検査だけ。
 * @failure 不正用途・名前・Label・ID・digestはfalse。
 * @invariant 形式一致だけで削除Authorityを発行しない。
 * @boundary 技術期待値と固定Docker処置の間。
 * @security filterへ任意文字列を搬送しない。
 * @concurrency N/A: 同期検査だけ。
 */
export function dockerResourceExpectationIsValid(
  expectation: Omit<DockerResourceExpectation, "dockerId"> & {
    dockerId?: string;
  },
) {
  if (!isDockerResourcePurpose(expectation.purpose)) return false;
  const prefix = {
    create_subscription_auth_probe: "auth",
    create_internal_network: "internal",
    create_egress_network: "egress",
    create_proxy: "proxy",
    create_provider: "(?:claude|codex)",
  }[expectation.purpose];
  if (
    !prefix ||
    !new RegExp(`^crdd-${prefix}-[a-f0-9]{16}$`, "u").test(
      expectation.expectedName,
    )
  )
    return false;
  const network =
    expectation.purpose === "create_internal_network" ||
    expectation.purpose === "create_egress_network";
  const networks = expectation.expectedNetworks;
  if (!Array.isArray(networks) || networks.length > 2) return false;
  const internal = /^crdd-internal-[a-f0-9]{16}$/u;
  const egress = /^crdd-egress-[a-f0-9]{16}$/u;
  const networkShape = network
    ? networks.length === 0
    : expectation.purpose === "create_subscription_auth_probe"
      ? networks.length === 1 && networks[0] === "none"
      : expectation.purpose === "create_provider"
        ? networks.length === 1 && internal.test(networks[0] ?? "")
        : (networks.length === 1 && internal.test(networks[0] ?? "")) ||
          (networks.length === 2 &&
            networks.some((name) => internal.test(name)) &&
            networks.some((name) => egress.test(name)));
  return (
    expectation.kind === (network ? "network" : "container") &&
    dockerResourceLocatorIsValid(
      expectation.kind,
      expectation.expectedName,
      expectation.ownershipLabel,
    ) &&
    (expectation.dockerId === undefined ||
      /^[a-f0-9]{64}$/u.test(expectation.dockerId)) &&
    (network
      ? expectation.expectedImage === null &&
        expectation.shouldBeInternal ===
          (expectation.purpose === "create_internal_network")
      : typeof expectation.expectedImage === "string" &&
        /^sha256:[a-f0-9]{64}$/u.test(expectation.expectedImage) &&
        expectation.shouldBeInternal === null) &&
    networkShape &&
    typeof expectation.workspaceMounted === "boolean" &&
    typeof expectation.workspaceReadOnly === "boolean" &&
    typeof expectation.initRequired === "boolean" &&
    (expectation.workspaceProtection === undefined ||
      (expectation.workspaceProtected === true &&
        [
          expectation.workspaceProtection.gitSourcePath,
          expectation.workspaceProtection.internalSourcePath,
        ].every(
          (item) =>
            typeof item === "string" &&
            path.isAbsolute(item) &&
            !/[\0\r\n,]/u.test(item),
        ))) &&
    (expectation.workspaceProtected === undefined ||
      (typeof expectation.workspaceProtected === "boolean" &&
        (!expectation.workspaceProtected ||
          (expectation.purpose === "create_provider" &&
            expectation.workspaceMounted))))
  );
}

/**
 * Docker inspectの一実体が期待Identityと隔離構成を満たすか判定する。
 *
 * @responsibility ID・名前・Label・Image・Network・User・Mount・Initを同時に照合する。
 * @trace ARCH-000008
 * @input input: inspectの一実体。expectation: 元計画から導いた技術条件。
 * @returns 全条件一致の場合だけtrue。
 * @precondition 呼出し側が観測の成功・単一実体・出力上限と期待値の由来を確認している。
 * @postcondition 部分構成や名前・Labelだけを所有根拠にしない。
 * @effect N/A: 渡された値の照合だけで外部操作を発行しない。
 * @failure 不正実体・不足・構成差はfalse。不存在の証明ではない。
 * @invariant 戻り値だけから削除許可や清掃完了を発行しない。
 * @boundary Docker wire値から固定技術構成判定への境界。
 * @security non-root、read-only、能力剥奪、NetworkとMount modeを維持する。
 * @concurrency N/A: 同期値の照合で共有状態を持たない。
 */
export function dockerResourceConfigurationMatches(
  input: unknown,
  expectation: DockerResourceExpectation,
) {
  if (!dockerResourceExpectationIsValid(expectation)) return false;
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return false;
  const resource = input as Record<string, unknown>;
  const {
    kind,
    dockerId,
    expectedName,
    ownershipLabel,
    expectedImage,
    shouldBeInternal,
    purpose,
    expectedNetworks,
    workspaceMounted,
    workspaceReadOnly,
    initRequired,
  } = expectation;
  const labels =
    kind === "container"
      ? (resource.Config as Record<string, unknown> | undefined)?.Labels
      : resource.Labels;
  const labelValue = ownershipLabel.slice(ownershipLabel.indexOf("=") + 1);
  const name = kind === "container" ? resource.Name : resource.Name;
  const normalizedName =
    kind === "container" && typeof name === "string" && name.startsWith("/")
      ? name.slice(1)
      : name;
  const configurationMatches = (() => {
    if (kind === "network")
      return resource.Driver === "bridge" && resource.Scope === "local";
    const config = resource.Config as Record<string, unknown> | undefined;
    const hostConfig = resource.HostConfig as
      | Record<string, unknown>
      | undefined;
    const networkSettings = resource.NetworkSettings as
      | Record<string, unknown>
      | undefined;
    const networks = networkSettings?.Networks;
    const networkNames =
      networks && typeof networks === "object" && !Array.isArray(networks)
        ? Object.keys(networks as Record<string, unknown>).sort()
        : [];
    const droppedCapabilities = Array.isArray(hostConfig?.CapDrop)
      ? hostConfig.CapDrop.map(String)
      : [];
    const capAdd = hostConfig?.CapAdd;
    const securityOptions = Array.isArray(hostConfig?.SecurityOpt)
      ? hostConfig.SecurityOpt.map(String)
      : [];
    const expectedPids = purpose === "create_subscription_auth_probe" ? 32 : 64;
    const bindMounts = Array.isArray(resource.Mounts)
      ? (resource.Mounts as Array<Record<string, unknown>>).filter(
          (mount) => mount.Type === "bind",
        )
      : [];
    const expectedMounts =
      purpose === "create_subscription_auth_probe"
        ? [{ destination: "/provider-home", readWrite: false }]
        : purpose === "create_provider"
          ? [
              { destination: "/provider-home", readWrite: true },
              { destination: "/tmp", readWrite: true },
              ...(workspaceMounted
                ? [
                    {
                      destination: "/work",
                      readWrite: !workspaceReadOnly,
                    },
                  ]
                : []),
              ...(expectation.workspaceProtected
                ? [
                    { destination: "/work/.git", readWrite: false },
                    { destination: "/work/.crdd", readWrite: false },
                  ]
                : []),
            ]
          : [];
    const observedMounts = bindMounts
      .map((mount) => ({
        source: mount.Source,
        destination: mount.Destination,
        readWrite: mount.RW,
        propagation: mount.Propagation,
      }))
      .sort((left, right) =>
        String(left.destination).localeCompare(String(right.destination)),
      );
    const sortedExpectedMounts = [...expectedMounts].sort((left, right) =>
      left.destination.localeCompare(right.destination),
    );
    const mountsMatch =
      observedMounts.length === sortedExpectedMounts.length &&
      observedMounts.every(
        (mount, index) =>
          mount.destination === sortedExpectedMounts[index]?.destination &&
          mount.readWrite === sortedExpectedMounts[index]?.readWrite &&
          (expectation.workspaceProtection === undefined ||
            (mount.destination !== "/work/.git" &&
              mount.destination !== "/work/.crdd") ||
            (typeof mount.source === "string" &&
              (process.platform === "win32"
                ? mount.source.replaceAll("\\", "/").toLowerCase()
                : mount.source) ===
                (process.platform === "win32"
                  ? (mount.destination === "/work/.git"
                      ? expectation.workspaceProtection.gitSourcePath
                      : expectation.workspaceProtection.internalSourcePath
                    )
                      .replaceAll("\\", "/")
                      .toLowerCase()
                  : mount.destination === "/work/.git"
                    ? expectation.workspaceProtection.gitSourcePath
                    : expectation.workspaceProtection.internalSourcePath))) &&
          mount.propagation === "rprivate",
      );
    const tmpfs = hostConfig?.Tmpfs;
    const proxyTmpfsMatches =
      purpose !== "create_proxy" ||
      (tmpfs !== null &&
        typeof tmpfs === "object" &&
        !Array.isArray(tmpfs) &&
        Object.keys(tmpfs as Record<string, unknown>).length === 1 &&
        typeof (tmpfs as Record<string, unknown>)["/tmp"] === "string" &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes("noexec") &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes("nosuid") &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes(
          "size=16777216",
        ));
    return (
      config?.User === "65534:65534" &&
      hostConfig?.ReadonlyRootfs === true &&
      hostConfig?.Privileged === false &&
      droppedCapabilities.length === 1 &&
      droppedCapabilities[0]?.toUpperCase() === "ALL" &&
      (capAdd === null || (Array.isArray(capAdd) && capAdd.length === 0)) &&
      securityOptions.some((option) =>
        option.startsWith("no-new-privileges"),
      ) &&
      hostConfig?.PidsLimit === expectedPids &&
      dockerContainerInitObservationMatches(
        hostConfig,
        purpose === "create_provider" && initRequired,
      ) &&
      networkNames.length === expectedNetworks.length &&
      networkNames.every(
        (value, index) => value === [...expectedNetworks].sort()[index],
      ) &&
      mountsMatch &&
      proxyTmpfsMatches
    );
  })();
  if (
    resource.Id !== dockerId ||
    normalizedName !== expectedName ||
    !labels ||
    typeof labels !== "object" ||
    (labels as Record<string, unknown>)["crdd.coordinator.runtime"] !==
      labelValue ||
    (kind === "container" &&
      (resource.Config as Record<string, unknown> | undefined)?.Image !==
        expectedImage) ||
    (kind === "network" && resource.Internal !== shouldBeInternal) ||
    !configurationMatches
  )
    return false;
  return true;
}
