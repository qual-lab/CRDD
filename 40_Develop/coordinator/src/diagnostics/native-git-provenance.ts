/**
 * 固定Native成果物と選択CheckoutのGit Blobを読み取り照合する。
 * @responsibility 単一Artifactの出所・実体相関を所有し、配布Treeや実行許可を扱わない。
 * @trace ARCH-000014
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  readFixedSnapshotFile,
  gitFixedSnapshotAdapter,
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
  observeRepositoryRevision,
  gitRepositoryRevisionAdapter,
} from "../../../version-control/src/index.ts";
import {
  beginPlatformAccessArtifactObservation,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES,
  verifyPlatformAccessArtifactObservation,
} from "../../../platform-access/src/index.ts";

/**
 * 選択Checkoutの固定Nativeだけを現在RevisionのGit Blobへ照合する。
 *
 * @responsibility 単一Nativeの出所・実体同一性を読み取り、実行許可は発行しない。
 * @trace ARCH-000014
 * @input distributionRoot: Moduleが選択した正規の絶対Root。
 * @returns 単一Nativeと前後一致したRepository改訂の非Authority候補。不成立時null。
 * @precondition 呼出し側が実行用途と固定入口を選択している。
 * @postcondition 同じRevisionの固定BlobとNativeのsize・Hash・modeが一致する。
 * @effect FilesystemとGit Objectを読み取る。書込み・子Process起動は行わない。
 * @failure Root、Git、Nativeの欠落・差替え・観測不能ではnull。
 * @invariant 署名、Publisher真正性、全Checkout一致、実行Authorityを主張しない。
 * @boundary 選択CheckoutとVersion Control／Platform Accessの読取り境界。
 * @security 絶対Path・実行物bytes・秘密値を返さない。
 * @concurrency Repository改訂・RootとNative実体を終了前にも再観測する。
 */
export function inspectPlatformAccessNativeGitProvenanceCandidate(
  distributionRoot: unknown,
) {
  try {
    if (
      typeof distributionRoot !== "string" ||
      !path.isAbsolute(distributionRoot) ||
      path.normalize(distributionRoot) !== distributionRoot ||
      fs.realpathSync.native(distributionRoot) !== distributionRoot
    )
      return null;
    const verified = verifyRepositoryRootFromWorkingDirectory(distributionRoot);
    if (verified.status !== "completed") return null;
    const repositoryRoot = resolveVerifiedRepositoryRoot(verified.capability);
    if (!repositoryRoot) return null;
    const prefix = path.relative(repositoryRoot, distributionRoot);
    if (
      path.isAbsolute(prefix) ||
      (prefix !== "" &&
        prefix
          .split(path.sep)
          .some((part) => part === "" || part === "." || part === ".."))
    )
      return null;
    let current = repositoryRoot;
    for (const segment of prefix === "" ? [] : prefix.split(path.sep)) {
      current = path.join(current, segment);
      const metadata = fs.lstatSync(current);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(current) !== current
      )
        return null;
    }
    const revision = observeRepositoryRevision(
      verified.capability,
      gitRepositoryRevisionAdapter,
    );
    if (revision?.observationComplete !== true) return null;
    const native = beginPlatformAccessArtifactObservation(distributionRoot);
    if (!native) return null;
    const relativePath = [
      ...(prefix === "" ? [] : prefix.split(path.sep)),
      ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
    ].join("/");
    const fixed = readFixedSnapshotFile(
      verified.capability,
      revision.revisionIdentity,
      relativePath,
      gitFixedSnapshotAdapter,
      PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES,
    );
    if (
      !fixed ||
      fixed.revisionIdentity !== revision.revisionIdentity ||
      fixed.relativePath !== relativePath ||
      fixed.mode !== "100644" ||
      fixed.bytes.byteLength !== native.artifact.byteLength ||
      fixed.sha256 !== native.artifact.sha256 ||
      createHash("sha256").update(fixed.bytes).digest("hex") !==
        native.artifact.sha256 ||
      !verifyPlatformAccessArtifactObservation(native.token) ||
      resolveVerifiedRepositoryRoot(verified.capability) !== repositoryRoot ||
      JSON.stringify(
        observeRepositoryRevision(
          verified.capability,
          gitRepositoryRevisionAdapter,
        ),
      ) !== JSON.stringify(revision)
    )
      return null;
    return Object.freeze({
      status: "candidate" as const,
      reason: "native_artifact_matches_fixed_repository_revision" as const,
      artifact: native.artifact,
      repositoryRevision: revision,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  } catch {
    return null;
  }
}
