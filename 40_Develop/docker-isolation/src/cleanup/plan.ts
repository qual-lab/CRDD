/**
 * 実Docker資源のIdentityと固定隔離構成を照合する。
 *
 * @responsibility 通常清掃とfresh回復に共通する技術条件を一箇所で所有する。
 * @trace ARCH-000008
 */

import path from "node:path";
import { dockerContainerInitObservationMatches } from "./init.ts";

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
  purpose:
    | "create_subscription_auth_probe"
    | "create_internal_network"
    | "create_egress_network"
    | "create_proxy"
    | "create_provider";
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
