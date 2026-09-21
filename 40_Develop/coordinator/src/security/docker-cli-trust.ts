import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createWindowsPowerShellAuthenticodeEnvironment } from "../core/windows-child-environment.ts";

export const DOCKER_CLI_TRUST_CONTRACT = "crdd-coordinator/docker-cli-trust";
export const DOCKER_CLI_TRUST_CONTRACT_REVISION = 1;

export const DOCKER_CLI_ROOT =
  "C:\\Program Files\\Docker\\Docker\\resources\\bin";
export const DOCKER_CLI_EXECUTABLE = `${DOCKER_CLI_ROOT}\\docker.exe`;

const MAXIMUM_DOCKER_CLI_BYTES = 256 * 1024 * 1024;
const AUTHENTICODE_TIMEOUT_MS = 10_000;
const AUTHENTICODE_SUCCESS = "CRDD_DOCKER_AUTHENTICODE_OK";
const DOCKER_PUBLISHER_ORGANIZATION = "Docker Inc";

/**
 * DockerCliTrustSnapshotが扱う値の構造を表す。
 *
 * @responsibility DockerCliTrustSnapshotに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape DockerCliTrustSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerCliTrustSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerCliTrustSnapshotの宣言は外部境界を開かない。
 * @security DockerCliTrustSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerCliTrustSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerCliTrustSnapshot = Readonly<{
  executablePath: typeof DOCKER_CLI_EXECUTABLE;
  rootIdentity: string;
  executableIdentity: string;
  bytes: number;
  sha256: string;
  publisherOrganization: typeof DOCKER_PUBLISHER_ORGANIZATION;
  trustBasis: "windows_authenticode_valid_docker_inc_publisher";
}>;

/**
 * filesystemIdentityの処理を実行する。
 *
 * @responsibility filesystemIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input target: string、expected: "file" | "directory"
 * @returns filesystemIdentityの計算結果を返す。
 * @precondition 「target: string、expected: "file" | "directory"」がfilesystemIdentityの入力契約を満たす。
 * @postcondition filesystemIdentityの責務を完了した結果だけを返す。
 * @effect filesystemIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure filesystemIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant filesystemIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security filesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: filesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function filesystemIdentity(target: string, expected: "file" | "directory") {
  const metadata = fs.lstatSync(target, { bigint: true });
  const isExpectedType =
    expected === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isExpectedType ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("docker_cli_filesystem_identity_invalid");
  }
  return `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
}

/**
 * inspectDockerAuthenticodeの処理を実行する。
 *
 * @responsibility inspectDockerAuthenticodeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: inspectDockerAuthenticodeは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinspectDockerAuthenticodeの入力契約を満たす。
 * @postcondition inspectDockerAuthenticodeの責務を完了して呼出し元へ制御を戻す。
 * @effect inspectDockerAuthenticodeはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectDockerAuthenticodeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerAuthenticodeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectDockerAuthenticodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerAuthenticodeは共有非同期状態を持たない同期処理である。
 */
function inspectDockerAuthenticode() {
  const environment = createWindowsPowerShellAuthenticodeEnvironment();
  if (!environment) throw new Error("docker_cli_authenticode_unavailable");
  const systemRoot = environment.SystemRoot;
  if (typeof systemRoot !== "string" || systemRoot.length === 0)
    throw new Error("docker_cli_authenticode_unavailable");
  const powershell = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  if (
    fs.realpathSync.native(powershell).toLocaleLowerCase("en-US") !==
      powershell.toLocaleLowerCase("en-US") ||
    !fs.lstatSync(powershell).isFile() ||
    fs.lstatSync(powershell).isSymbolicLink()
  ) {
    throw new Error("docker_cli_authenticode_unavailable");
  }
  const script = [
    "$ErrorActionPreference='Stop'",
    `$signature=Get-AuthenticodeSignature -LiteralPath '${DOCKER_CLI_EXECUTABLE.replaceAll("'", "''")}'`,
    "$certificate=$signature.SignerCertificate",
    `if(([string]$signature.Status -ne 'Valid') -or ($null -eq $certificate) -or ([string]$certificate.Subject -notmatch '(?:^|, )O=${DOCKER_PUBLISHER_ORGANIZATION}(?:,|$)')){exit 2}`,
    `Write-Output '${AUTHENTICODE_SUCCESS}'`,
  ].join(";");
  const result = spawnSync(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    {
      cwd: systemRoot,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: AUTHENTICODE_TIMEOUT_MS,
      maxBuffer: 512,
    },
  );
  if (
    result.error ||
    result.status !== 0 ||
    result.signal !== null ||
    result.stdout !== `${AUTHENTICODE_SUCCESS}\r\n` ||
    result.stderr !== ""
  ) {
    throw new Error("docker_cli_authenticode_untrusted");
  }
}

/**
 * inspectDockerCliFileの処理を実行する。
 *
 * @responsibility inspectDockerCliFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns inspectDockerCliFileの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinspectDockerCliFileの入力契約を満たす。
 * @postcondition inspectDockerCliFileの責務を完了した結果だけを返す。
 * @effect inspectDockerCliFileはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectDockerCliFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerCliFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectDockerCliFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerCliFileは共有非同期状態を持たない同期処理である。
 */
function inspectDockerCliFile() {
  if (
    fs.realpathSync.native(DOCKER_CLI_ROOT) !== DOCKER_CLI_ROOT ||
    fs.realpathSync.native(DOCKER_CLI_EXECUTABLE) !== DOCKER_CLI_EXECUTABLE
  ) {
    throw new Error("docker_cli_path_untrusted");
  }
  const metadata = fs.lstatSync(DOCKER_CLI_EXECUTABLE);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > MAXIMUM_DOCKER_CLI_BYTES
  ) {
    throw new Error("docker_cli_file_untrusted");
  }
  return Object.freeze({
    rootIdentity: filesystemIdentity(DOCKER_CLI_ROOT, "directory"),
    executableIdentity: filesystemIdentity(DOCKER_CLI_EXECUTABLE, "file"),
    bytes: metadata.size,
    sha256: createHash("sha256")
      .update(fs.readFileSync(DOCKER_CLI_EXECUTABLE))
      .digest("hex")
      .toUpperCase(),
  });
}

/**
 * observeTrustedDockerCliの処理を実行する。
 *
 * @responsibility observeTrustedDockerCliに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns DockerCliTrustSnapshotを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveTrustedDockerCliの入力契約を満たす。
 * @postcondition observeTrustedDockerCliの責務を完了した結果だけを返す。
 * @effect observeTrustedDockerCliは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeTrustedDockerCliは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeTrustedDockerCliは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeTrustedDockerCliはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeTrustedDockerCliは共有非同期状態を持たない同期処理である。
 */
export function observeTrustedDockerCli(): DockerCliTrustSnapshot {
  if (process.platform !== "win32")
    throw new Error("docker_cli_platform_unsupported");
  const before = inspectDockerCliFile();
  inspectDockerAuthenticode();
  const after = inspectDockerCliFile();
  if (
    before.rootIdentity !== after.rootIdentity ||
    before.executableIdentity !== after.executableIdentity ||
    before.bytes !== after.bytes ||
    before.sha256 !== after.sha256
  ) {
    throw new Error("docker_cli_changed_during_trust_observation");
  }
  return Object.freeze({
    executablePath: DOCKER_CLI_EXECUTABLE,
    ...after,
    publisherOrganization: DOCKER_PUBLISHER_ORGANIZATION,
    trustBasis: "windows_authenticode_valid_docker_inc_publisher",
  });
}

/**
 * verifyTrustedDockerCliSnapshotの処理を実行する。
 *
 * @responsibility verifyTrustedDockerCliSnapshotに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input snapshot: DockerCliTrustSnapshot
 * @returns verifyTrustedDockerCliSnapshotの計算結果を返す。
 * @precondition 「snapshot: DockerCliTrustSnapshot」がverifyTrustedDockerCliSnapshotの入力契約を満たす。
 * @postcondition verifyTrustedDockerCliSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: verifyTrustedDockerCliSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyTrustedDockerCliSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyTrustedDockerCliSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyTrustedDockerCliSnapshotはProcess内の同一Subsystemで完結する。
 * @security verifyTrustedDockerCliSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyTrustedDockerCliSnapshotは共有非同期状態を持たない同期処理である。
 */
export function verifyTrustedDockerCliSnapshot(
  snapshot: DockerCliTrustSnapshot,
) {
  const current = inspectDockerCliFile();
  if (
    snapshot.executablePath !== DOCKER_CLI_EXECUTABLE ||
    snapshot.publisherOrganization !== DOCKER_PUBLISHER_ORGANIZATION ||
    snapshot.trustBasis !== "windows_authenticode_valid_docker_inc_publisher" ||
    current.rootIdentity !== snapshot.rootIdentity ||
    current.executableIdentity !== snapshot.executableIdentity ||
    current.bytes !== snapshot.bytes ||
    current.sha256 !== snapshot.sha256
  ) {
    throw new Error("docker_cli_replaced");
  }
  return DOCKER_CLI_EXECUTABLE;
}

/**
 * describeDockerCliTrustContractの処理を実行する。
 *
 * @responsibility describeDockerCliTrustContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerCliTrustContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerCliTrustContractの入力契約を満たす。
 * @postcondition describeDockerCliTrustContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerCliTrustContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerCliTrustContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerCliTrustContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDockerCliTrustContractはProcess内の同一Subsystemで完結する。
 * @security describeDockerCliTrustContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerCliTrustContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerCliTrustContract() {
  return Object.freeze({
    contract: DOCKER_CLI_TRUST_CONTRACT,
    contractRevision: DOCKER_CLI_TRUST_CONTRACT_REVISION,
    absolutePath: DOCKER_CLI_EXECUTABLE,
    pathLookupAllowed: false,
    publisherOrganization: DOCKER_PUBLISHER_ORGANIZATION,
    trustBasis: "windows_authenticode_valid_docker_inc_publisher",
    exactVersionRequired: false,
    exactHashRequiredAcrossOperations: false,
    sameIdentityAndHashRequiredWithinOperation: true,
    unknownOrInvalidSignatureEffect: "fail_closed_before_docker_effect",
  });
}
