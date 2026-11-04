/**
 * 用途に依存しない資源Identity・技術入力・実体一致を検査する。
 *
 * @responsibility 通常清掃とfresh回復に共通する技術条件を一箇所で所有する。
 * @trace ARCH-000008
 */

import path from "node:path";
import { types } from "node:util";
import type { DockerResourceExpectation } from "./types.ts";
import { dockerContainerInitObservationMatches } from "./init.ts";

/**
 * 資源種別と固定Namespace内の名前・Label文法を検査する。
 *
 * @responsibility 用途名を推定せず、任意Namespaceと不正filterを観測前に拒否する。
 * @trace ARCH-000008
 * @input kind、name、label: 上位が相関を確認する予定資源。
 * @returns 固定種別・名前形式・Labelの場合だけtrue。
 * @precondition 所有相関と用途の採用は上位が確認する。
 * @postcondition 種別は明示入力で扱い、名前prefixから構成を推定しない。
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
): boolean {
  return (
    (kind === "network" || kind === "container") &&
    typeof name === "string" &&
    /^crdd-[a-zA-Z0-9-]+$/u.test(name) &&
    typeof label === "string" &&
    /^crdd\.[a-z][a-z0-9_.-]*=[a-zA-Z0-9-]+$/u.test(label)
  );
}

/**
 * 回収対象の技術期待値をEffect前に照合する。
 *
 * @responsibility 相関key・Identity・明示した技術構成をEffect前に検査する。
 * @trace ARCH-000008
 * @input expectation: 上位が相関を確認した技術期待値。
 * @returns 閉じた技術fieldと資源形式に一致する場合だけtrue。
 * @precondition 対象選定と処置許可は上位Ownerが確認する。
 * @postcondition 余分なfieldと動的Propertyを技術構成へ採用しない。
 * @effect N/A: 値の検査だけ。
 * @failure 不正key・Identity・型・構成はfalse。
 * @invariant 形式一致だけで削除Authorityを発行しない。
 * @boundary 技術期待値と固定Docker処置の間。
 * @security filterへ任意文字列を搬送しない。
 * @concurrency N/A: 同期検査だけ。
 */
export function dockerResourceExpectationIsValid(
  expectation: Omit<DockerResourceExpectation, "dockerId"> & {
    dockerId?: string;
  },
): boolean {
  if (
    !expectation ||
    typeof expectation !== "object" ||
    types.isProxy(expectation)
  )
    return false;
  const keys = [
    "key",
    "kind",
    "expectedName",
    "ownershipLabel",
    "expectedImage",
    "shouldBeInternal",
    "expectedNetworks",
    "expectedUser",
    "expectedMounts",
    "initRequired",
    "tmpfsBytes",
    ...(Object.hasOwn(expectation, "dockerId") ? ["dockerId"] : []),
  ];
  const descriptors = Object.getOwnPropertyDescriptors(expectation);
  if (
    Reflect.ownKeys(expectation).length !== keys.length ||
    keys.some(
      (key) => !descriptors[key] || !Object.hasOwn(descriptors[key], "value"),
    )
  )
    return false;
  const network = expectation.kind === "network";
  return (
    typeof expectation.key === "string" &&
    /^[a-z][a-z0-9_-]*$/u.test(expectation.key) &&
    dockerResourceLocatorIsValid(
      expectation.kind,
      expectation.expectedName,
      expectation.ownershipLabel,
    ) &&
    (expectation.dockerId === undefined ||
      (typeof expectation.dockerId === "string" &&
        /^[a-f0-9]{64}$/u.test(expectation.dockerId))) &&
    (network
      ? expectation.expectedImage === null &&
        typeof expectation.shouldBeInternal === "boolean" &&
        expectation.expectedUser === null &&
        !expectation.initRequired &&
        expectation.tmpfsBytes === null
      : typeof expectation.expectedImage === "string" &&
        /^sha256:[a-f0-9]{64}$/u.test(expectation.expectedImage) &&
        expectation.shouldBeInternal === null &&
        ["65532:65532", "65534:65534"].includes(
          expectation.expectedUser ?? "",
        )) &&
    Array.isArray(expectation.expectedNetworks) &&
    new Set(expectation.expectedNetworks).size ===
      expectation.expectedNetworks.length &&
    (network
      ? expectation.expectedNetworks.length === 0
      : expectation.expectedNetworks.length > 0 &&
        expectation.expectedNetworks.every(
          (name) =>
            name === "none" ||
            dockerResourceLocatorIsValid(
              "network",
              name,
              expectation.ownershipLabel,
            ),
        )) &&
    typeof expectation.initRequired === "boolean" &&
    (expectation.tmpfsBytes === null || expectation.tmpfsBytes === 16777216) &&
    Array.isArray(expectation.expectedMounts) &&
    (!network || expectation.expectedMounts.length === 0) &&
    new Set(expectation.expectedMounts.map((m) => m.destination)).size ===
      expectation.expectedMounts.length &&
    expectation.expectedMounts.every(
      (m) =>
        m &&
        typeof m.destination === "string" &&
        /^\/[a-zA-Z0-9/_.-]+$/u.test(m.destination) &&
        path.posix.normalize(m.destination) === m.destination &&
        typeof m.readWrite === "boolean" &&
        (m.source === null ||
          (typeof m.source === "string" &&
            path.isAbsolute(m.source) &&
            !/[\0\r\n,]/u.test(m.source))),
    )
  );
}

/**
 * 現在資源を明示された技術構成へ完全照合する。
 * @responsibility 用途から推測せず、Identity・Image・User・Network・Mount・Init・Tmpfsを照合する。
 * @trace ARCH-000008
 * @input input: 単一inspect。expectation: 同じ資源の確定した技術期待値。
 * @returns 必要な全条件が一致するときだけtrue。
 * @precondition 呼出し元が観測成功と対象の相関を確認する。
 * @postcondition 既知IDの最小照合を完全構成照合へ置換しない。
 * @effect N/A: 値の比較だけ。
 * @failure 欠測・型差・構成差はfalse。不明を不存在へ変換しない。
 * @invariant 共通隔離防御と、明示Mount元の一致を維持する。
 * @boundary Docker観測値から技術構成判定。
 * @security 用途名・保存State・処置許可を解釈しない。
 * @concurrency N/A: 同期の比較だけ。
 */
export function dockerResourceConfigurationMatches(
  input: unknown,
  expectation: DockerResourceExpectation,
): boolean {
  if (
    !dockerResourceExpectationIsValid(expectation) ||
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  )
    return false;
  const resource = input as Record<string, unknown>;
  const {
    kind,
    dockerId,
    expectedName,
    ownershipLabel,
    expectedImage,
    shouldBeInternal,
    expectedNetworks,
    initRequired,
  } = expectation;
  const config = resource.Config as Record<string, unknown> | undefined;
  const labels = kind === "container" ? config?.Labels : resource.Labels;
  const separator = ownershipLabel.indexOf("=");
  const name = resource.Name;
  const normalizedName =
    kind === "container" && typeof name === "string" && name.startsWith("/")
      ? name.slice(1)
      : name;
  if (
    resource.Id !== dockerId ||
    normalizedName !== expectedName ||
    !labels ||
    typeof labels !== "object" ||
    (labels as Record<string, unknown>)[ownershipLabel.slice(0, separator)] !==
      ownershipLabel.slice(separator + 1) ||
    (kind === "container" && config?.Image !== expectedImage) ||
    (kind === "network" && resource.Internal !== shouldBeInternal)
  )
    return false;
  if (kind === "network")
    return resource.Driver === "bridge" && resource.Scope === "local";
  const hostConfig = resource.HostConfig as Record<string, unknown> | undefined;
  const networkSettings = resource.NetworkSettings as
    | Record<string, unknown>
    | undefined;
  const networks = networkSettings?.Networks;
  const networkNames =
    networks && typeof networks === "object" && !Array.isArray(networks)
      ? Object.keys(networks as Record<string, unknown>).sort()
      : [];
  const capDrop = Array.isArray(hostConfig?.CapDrop)
    ? hostConfig.CapDrop.map(String)
    : [];
  const capAdd = hostConfig?.CapAdd;
  const securityOptions = Array.isArray(hostConfig?.SecurityOpt)
    ? hostConfig.SecurityOpt.map(String)
    : [];
  const observedMounts = Array.isArray(resource.Mounts)
    ? (resource.Mounts as Array<Record<string, unknown>>)
        .filter((m) => m.Type === "bind")
        .map((m) => ({
          source: m.Source,
          destination: m.Destination,
          readWrite: m.RW,
          propagation: m.Propagation,
        }))
        .sort((a, b) =>
          String(a.destination).localeCompare(String(b.destination)),
        )
    : [];
  const expectedMounts = [...expectation.expectedMounts].sort((a, b) =>
    a.destination.localeCompare(b.destination),
  );
  const mountsMatch =
    observedMounts.length === expectedMounts.length &&
    observedMounts.every((mount, index) => {
      const expected = expectedMounts[index];
      if (
        !expected ||
        mount.destination !== expected.destination ||
        mount.readWrite !== expected.readWrite ||
        mount.propagation !== "rprivate"
      )
        return false;
      if (expected.source === null) return true;
      return (
        typeof mount.source === "string" &&
        (process.platform === "win32"
          ? mount.source.replaceAll("\\", "/").toLowerCase()
          : mount.source) ===
          (process.platform === "win32"
            ? expected.source.replaceAll("\\", "/").toLowerCase()
            : expected.source)
      );
    });
  const tmpfs = hostConfig?.Tmpfs;
  const tmpfsMatches =
    expectation.tmpfsBytes === null ||
    (tmpfs !== null &&
      typeof tmpfs === "object" &&
      !Array.isArray(tmpfs) &&
      Object.keys(tmpfs).length === 1 &&
      typeof (tmpfs as Record<string, unknown>)["/tmp"] === "string" &&
      String((tmpfs as Record<string, unknown>)["/tmp"]).includes("noexec") &&
      String((tmpfs as Record<string, unknown>)["/tmp"]).includes("nosuid") &&
      String((tmpfs as Record<string, unknown>)["/tmp"]).includes(
        `size=${expectation.tmpfsBytes}`,
      ));
  return (
    config?.User === expectation.expectedUser &&
    hostConfig?.ReadonlyRootfs === true &&
    hostConfig?.Privileged === false &&
    capDrop.length === 1 &&
    capDrop[0]?.toUpperCase() === "ALL" &&
    (capAdd === null || (Array.isArray(capAdd) && capAdd.length === 0)) &&
    securityOptions.some((option) => option.startsWith("no-new-privileges")) &&
    dockerContainerInitObservationMatches(hostConfig, initRequired) &&
    networkNames.length === expectedNetworks.length &&
    networkNames.every(
      (name, index) => name === [...expectedNetworks].sort()[index],
    ) &&
    mountsMatch &&
    tmpfsMatches
  );
}
