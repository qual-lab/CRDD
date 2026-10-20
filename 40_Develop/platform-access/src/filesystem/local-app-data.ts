/**
 * OSが定義する利用者のLocalAppDataを固定Nativeから読取り観測する。
 * @packageDocumentation
 * @responsibility 旧RuntimeState Rootや環境変数に依存せず、非Authorityの所在値だけを返す。
 * @trace ARCH-000008
 * @boundary 固定Native ProcessとWindows Known Folder、Directory前後観測。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginPlatformAccessArtifactObservation,
  PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactObservation,
} from "../artifact/identity.ts";

const distributionRoot = fileURLToPath(new URL("../../../..", import.meta.url));

/**
 * 現在Processの利用者のLocalAppDataをOS Known Folderから取得する。
 * @responsibility 固定frame・Artifact前後一致・安定した非link Directoryだけを所在値として返す。
 * @trace ARCH-000008
 * @input N/A: GUID・利用者・Path・環境を指定できない。
 * @returns 正規な絶対Directory Path、または観測不能のnull。
 * @precondition 呼出し側が意図した利用者との一致と処置許可を別途確認する。
 * @postcondition 環境変数や旧保存Rootへのfallback、Directory作成・権限発行を行わない。
 * @effect 固定Nativeの読取りmode一回、返却Directoryのlstat／realpath読取り。
 * @failure 未対応OS、Artifact／Process／frame／Directory不明はnull。
 * @invariant Path取得をRoot Authority、ACL、排他、修復完了にしない。
 * @boundary Platform Accessの固定OS観測と利用側。
 * @security 生応答・Pathをログや公開理由へ複製しない。
 * @concurrency Native前後Artifact一致とDirectory前後実体一致を確認する。
 */
export function observeWindowsLocalAppDataDirectory(): string | null {
  if (process.platform !== "win32") return null;
  try {
    const snapshot = beginPlatformAccessArtifactObservation(distributionRoot);
    if (
      !snapshot ||
      snapshot.artifact.sha256 !== PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256
    )
      return null;
    const result = spawnSync(
      path.join(
        distributionRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      ),
      ["--local-app-data-directory"],
      {
        env: {},
        cwd: distributionRoot,
        shell: false,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 65_548,
        encoding: "buffer",
      },
    );
    if (
      !verifyPlatformAccessArtifactObservation(snapshot.token) ||
      result.error ||
      result.status !== 0 ||
      result.signal !== null ||
      result.stderr.length !== 0 ||
      result.stdout.length < 14 ||
      result.stdout.subarray(0, 8).toString("ascii") !== "CRDDLA01"
    )
      return null;
    const length = result.stdout.readUInt32LE(8);
    if (
      length === 0 ||
      length >= 32_768 ||
      result.stdout.length !== 12 + length * 2
    )
      return null;
    const directory = new TextDecoder("utf-16le", {
      fatal: true,
      ignoreBOM: true,
    }).decode(result.stdout.subarray(12));
    if (
      !/^[A-Z]:\\/u.test(directory) ||
      /[\u0000-\u001f\u007f]/u.test(directory) ||
      path.win32.normalize(directory) !== directory ||
      path.win32.parse(directory).root === directory ||
      directory.endsWith("\\")
    )
      return null;
    const before = fs.lstatSync(directory, { bigint: true });
    if (
      !before.isDirectory() ||
      before.isSymbolicLink() ||
      before.dev <= 0n ||
      before.ino <= 0n ||
      before.birthtimeNs <= 0n
    )
      return null;
    const real = fs.realpathSync.native(directory).replace(/^\\\\\?\\/u, "");
    if (
      real.toLocaleLowerCase("en-US") !== directory.toLocaleLowerCase("en-US")
    )
      return null;
    const after = fs.lstatSync(directory, { bigint: true });
    if (
      !after.isDirectory() ||
      after.isSymbolicLink() ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.birthtimeNs !== before.birthtimeNs
    )
      return null;
    return directory;
  } catch {
    return null;
  }
}
