/**
 * 診断Probeの固定Container構成とbind mount実体を照合する。
 * @packageDocumentation
 * @responsibility Docker固有条件と同期Filesystem観測を所有し、payload選択・Host保存・Authorityは所有しない。
 * @trace ARCH-000008
 * @boundary 検査済み技術投影とDocker inspect値、Filesystemの読取り。
 */
import fs from "node:fs";
import { describeDockerProbeResource } from "./plan.ts";

/**
 * 上位で選択済みのProbe構成だけを搬送する。
 * @responsibility 三つの借用mountと許可payload候補を技術照合へ固定する。
 * @trace ARCH-000008
 * @shape id、probeId、sourceCandidates、workspace／providerHome／tmp。
 * @invariant Host能力・保存Owner・Task用途を含めない。
 * @boundary 上位の選択と下位の固定照合。
 * @security Pathの利用許可は上位が先に確認する。
 * @compatibility 固定Probe条件をTaskの異なる構成へ一般化しない。
 */
export type DockerProbeConfigurationExpectation = Readonly<{
  id: string;
  probeId: string;
  sourceCandidates: readonly string[];
  mounts: Readonly<{ workspace: string; providerHome: string; tmp: string }>;
}>;

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisProbeInspectObjectの入力契約を満たす。
 * @postcondition isProbeInspectObjectの責務を完了した結果だけを返す。
 * @effect N/A: isProbeInspectObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isProbeInspectObjectは独自の失敗分岐を所有しない。
 * @invariant isProbeInspectObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isProbeInspectObjectはProcess内の同一Subsystemで完結する。
 * @security isProbeInspectObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isProbeInspectObjectは共有非同期状態を持たない同期処理である。
 */
function isProbeInspectObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownProbeInspectValueの入力契約を満たす。
 * @postcondition ownProbeInspectValueの責務を完了した結果だけを返す。
 * @effect N/A: ownProbeInspectValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownProbeInspectValueは独自の失敗分岐を所有しない。
 * @invariant ownProbeInspectValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownProbeInspectValueはProcess内の同一Subsystemで完結する。
 * @security ownProbeInspectValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownProbeInspectValueは共有非同期状態を持たない同期処理である。
 */
function ownProbeInspectValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * expected Mountsを決定する。
 *
 * @responsibility expected Mountsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerProbeConfigurationExpectation["mounts"]
 * @returns Map<string, string>を返す。
 * @precondition 「mounts: DockerProbeConfigurationExpectation["mounts"]」がexpectedMountsの入力契約を満たす。
 * @postcondition expectedMountsの責務を完了した結果だけを返す。
 * @effect N/A: expectedMountsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedMountsは独自の失敗分岐を所有しない。
 * @invariant expectedMountsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedMountsはProcess内の同一Subsystemで完結する。
 * @security expectedMountsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedMountsは共有非同期状態を持たない同期処理である。
 */
function expectedMounts(
  mounts: DockerProbeConfigurationExpectation["mounts"],
): Map<string, string> {
  return new Map([
    ["/operation/workspace", mounts.workspace],
    ["/operation/provider-home", mounts.providerHome],
    ["/operation/tmp", mounts.tmp],
  ]);
}

/**
 * Container Inspectの契約を検証する。
 *
 * @responsibility Container Inspectの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input inspect: unknown、expected: DockerProbeConfigurationExpectation
 * @returns booleanを返す。
 * @precondition 「inspect: unknown、expected: DockerProbeConfigurationExpectation」がdockerProbeConfigurationMatchesの入力契約を満たす。
 * @postcondition dockerProbeConfigurationMatchesの責務を完了した結果だけを返す。
 * @effect mountの観測側と期待側のrealpathを同期で読み取る。書込み・Docker要求は行わない。
 * @failure dockerProbeConfigurationMatchesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant dockerProbeConfigurationMatchesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security dockerProbeConfigurationMatchesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerProbeConfigurationMatchesは共有非同期状態を持たない同期処理である。
 */
export function dockerProbeConfigurationMatches(
  inspect: unknown,
  expected: DockerProbeConfigurationExpectation,
): boolean {
  if (!isProbeInspectObject(inspect)) return false;
  if (
    ownProbeInspectValue(inspect, "Id") !== expected.id ||
    ownProbeInspectValue(inspect, "Name") !==
      `/${describeDockerProbeResource(expected.probeId).name}`
  )
    return false;
  const config = ownProbeInspectValue(inspect, "Config");
  const host = ownProbeInspectValue(inspect, "HostConfig");
  if (!isProbeInspectObject(config) || !isProbeInspectObject(host))
    return false;
  const labels = ownProbeInspectValue(config, "Labels");
  const entrypoint = ownProbeInspectValue(config, "Entrypoint");
  const command = ownProbeInspectValue(config, "Cmd");
  if (
    !isProbeInspectObject(labels) ||
    ownProbeInspectValue(
      labels,
      describeDockerProbeResource(expected.probeId).labelName,
    ) !== expected.probeId
  )
    return false;
  if (
    ownProbeInspectValue(config, "Image") !==
      describeDockerProbeResource(expected.probeId).image ||
    ownProbeInspectValue(config, "User") !== "65532:65532"
  )
    return false;
  if (
    !Array.isArray(entrypoint) ||
    entrypoint.length !== 1 ||
    entrypoint[0] !== "python"
  )
    return false;
  if (
    !Array.isArray(command) ||
    command.length !== 2 ||
    command[0] !== "-c" ||
    typeof command[1] !== "string" ||
    !expected.sourceCandidates.includes(command[1])
  )
    return false;
  if (
    ownProbeInspectValue(host, "NetworkMode") !== "none" ||
    ownProbeInspectValue(host, "ReadonlyRootfs") !== true ||
    ownProbeInspectValue(host, "Privileged") !== false
  )
    return false;
  const capDrop = ownProbeInspectValue(host, "CapDrop");
  const capAdd = ownProbeInspectValue(host, "CapAdd");
  const devices = ownProbeInspectValue(host, "Devices");
  const securityOptions = ownProbeInspectValue(host, "SecurityOpt");
  if (!Array.isArray(capDrop) || capDrop.length !== 1 || capDrop[0] !== "ALL")
    return false;
  if (
    (capAdd != null && (!Array.isArray(capAdd) || capAdd.length !== 0)) ||
    (devices != null && (!Array.isArray(devices) || devices.length !== 0)) ||
    !Array.isArray(securityOptions) ||
    !securityOptions.includes("no-new-privileges")
  )
    return false;
  const wanted = expectedMounts(expected.mounts);
  const inspectMounts = ownProbeInspectValue(inspect, "Mounts");
  if (!Array.isArray(inspectMounts) || inspectMounts.length !== wanted.size)
    return false;
  for (const mount of inspectMounts) {
    if (!isProbeInspectObject(mount)) return false;
    const destination = ownProbeInspectValue(mount, "Destination");
    const sourcePath = ownProbeInspectValue(mount, "Source");
    if (typeof destination !== "string" || typeof sourcePath !== "string")
      return false;
    const source = wanted.get(destination);
    if (
      !source ||
      ownProbeInspectValue(mount, "Type") !== "bind" ||
      ownProbeInspectValue(mount, "RW") !== true
    )
      return false;
    try {
      const observedSource = fs.realpathSync.native(sourcePath);
      const expectedSource = fs.realpathSync.native(source);
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
