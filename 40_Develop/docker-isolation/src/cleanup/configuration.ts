/**
 * 作成時の技術構成とContainer実体を照合する。
 * @packageDocumentation
 * @responsibility Image・Command・所有Identity・隔離条件・Mount実体を照合し用途を判断しない。
 * @trace ARCH-000008
 * @boundary 検査済み作成構成とDocker inspect／Filesystem読取り。
 */
import fs from "node:fs";

/**
 * 作成時と同じContainer技術構成。
 * @responsibility 診断名・Task・保存Ownerを含めず実体照合に必要な構成だけを保持する。
 * @trace ARCH-000008
 * @shape 実ID・名前・Label・Image・User・EntryPoint・完全Command候補・Mount。
 * @invariant 構成は操作許可や資源不存在を表さない。
 * @boundary Executorの構成とDIのfresh照合。
 * @security 任意の照合関数・検査省略条件を受け取らない。
 * @compatibility 保存Schemaではなく短命の技術投影。
 */
export type DockerContainerConfigurationExpectation = Readonly<{
  id: string;
  name: string;
  ownershipLabel: string;
  image: string;
  user: string;
  entrypoint: readonly string[];
  commands: readonly (readonly string[])[];
  mounts: Readonly<
    Record<string, Readonly<{ source: string; readWrite: boolean }>>
  >;
}>;

/**
 * own dataだけを読む。
 * @responsibility accessorを実行せず欠測を返す。
 * @trace ARCH-000008
 * @input value: 観測object、key: 固定field。
 * @returns own dataまたはundefined。
 * @effect N/A: 値読取りのみ。
 * @failure 欠測・accessorはundefined。
 * @invariant 外部処置を発行しない。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * Object外形を確認する。
 * @responsibility nullを実体として採用しない。
 * @trace ARCH-000008
 * @input value: 観測値。
 * @returns objectのときtrue。
 * @effect N/A: 同期判定だけ。
 * @failure 不正値はfalse。
 * @invariant 判定から所有権限を生成しない。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * 現在の実体を作成時構成へ照合する。
 * @responsibility 実ID・名前・所有Label・完全Command・隔離条件・Mount元実体の共同一致を確認する。
 * @trace ARCH-000008
 * @input inspect: 単一inspect値、expected: 元作成構成。
 * @returns 全条件一致時true。
 * @precondition 入力捕捉と観測成功・容量検査は呼出し元が行う。
 * @postcondition Running=falseを不存在へ読み替えない。
 * @effect Mount元のfresh realpathを読む。
 * @failure 欠測・構成差・観測不能はfalse。
 * @invariant 目的・故障Profile・保存記録を参照しない。
 * @boundary Docker実体と技術構成。
 * @security Root読取り専用・非特権・能力剥奪・追加Device禁止を維持する。
 * @concurrency 各呼出しでMountを再観測する。
 */
export function dockerContainerConfigurationMatches(
  inspect: unknown,
  expected: DockerContainerConfigurationExpectation,
): boolean {
  if (
    !isObject(inspect) ||
    ownValue(inspect, "Id") !== expected.id ||
    ownValue(inspect, "Name") !== "/" + expected.name
  )
    return false;
  const config = ownValue(inspect, "Config"),
    host = ownValue(inspect, "HostConfig");
  if (!isObject(config) || !isObject(host)) return false;
  const labels = ownValue(config, "Labels");
  const split = expected.ownershipLabel.indexOf("=");
  if (
    !isObject(labels) ||
    split <= 0 ||
    ownValue(labels, expected.ownershipLabel.slice(0, split)) !==
      expected.ownershipLabel.slice(split + 1) ||
    ownValue(config, "Image") !== expected.image ||
    ownValue(config, "User") !== expected.user
  )
    return false;
  const entrypoint = ownValue(config, "Entrypoint"),
    command = ownValue(config, "Cmd");
  if (
    !Array.isArray(entrypoint) ||
    entrypoint.length !== expected.entrypoint.length ||
    entrypoint.some((v, i) => v !== expected.entrypoint[i]) ||
    !Array.isArray(command) ||
    !expected.commands.some(
      (candidate) =>
        candidate.length === command.length &&
        candidate.every((v, i) => v === command[i]),
    )
  )
    return false;
  if (
    ownValue(host, "NetworkMode") !== "none" ||
    ownValue(host, "ReadonlyRootfs") !== true ||
    ownValue(host, "Privileged") !== false
  )
    return false;
  const capDrop = ownValue(host, "CapDrop"),
    capAdd = ownValue(host, "CapAdd");
  const devices = ownValue(host, "Devices"),
    securityOptions = ownValue(host, "SecurityOpt");
  if (
    !Array.isArray(capDrop) ||
    capDrop.length !== 1 ||
    capDrop[0] !== "ALL" ||
    (capAdd != null && (!Array.isArray(capAdd) || capAdd.length !== 0)) ||
    (devices != null && (!Array.isArray(devices) || devices.length !== 0)) ||
    !Array.isArray(securityOptions) ||
    !securityOptions.includes("no-new-privileges")
  )
    return false;
  const wanted = new Map(Object.entries(expected.mounts));
  const observedMounts = ownValue(inspect, "Mounts");
  if (!Array.isArray(observedMounts) || observedMounts.length !== wanted.size)
    return false;
  for (const mount of observedMounts) {
    if (!isObject(mount)) return false;
    const destination = ownValue(mount, "Destination"),
      sourcePath = ownValue(mount, "Source");
    if (typeof destination !== "string" || typeof sourcePath !== "string")
      return false;
    const expectedMount = wanted.get(destination);
    if (
      !expectedMount ||
      ownValue(mount, "Type") !== "bind" ||
      ownValue(mount, "RW") !== expectedMount.readWrite
    )
      return false;
    try {
      const observedSource = fs.realpathSync.native(sourcePath);
      const expectedSource = fs.realpathSync.native(expectedMount.source);
      if (
        process.platform === "win32"
          ? observedSource.toLocaleLowerCase("en-US") !==
            expectedSource.toLocaleLowerCase("en-US")
          : observedSource !== expectedSource
      )
        return false;
    } catch {
      return false;
    }
    wanted.delete(destination);
  }
  return wanted.size === 0;
}
