import { createHash } from "node:crypto";

export const DOCKER_DESKTOP_CURRENT_ARTIFACT_TRUST_POLICY =
  "CRDD_DOCKER_RESTART_TRUST_V1|official-fixed-paths|Docker Inc|cache-only|deny-write-delete|optional-dev-envs";

export const dockerDesktopCurrentArtifactTrustPolicySha256 = createHash(
  "sha256",
)
  .update(DOCKER_DESKTOP_CURRENT_ARTIFACT_TRUST_POLICY, "ascii")
  .digest("hex");

/**
 * describeDockerDesktopCurrentArtifactTrustContractの処理を実行する。
 *
 * @responsibility describeDockerDesktopCurrentArtifactTrustContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerDesktopCurrentArtifactTrustContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerDesktopCurrentArtifactTrustContractの入力契約を満たす。
 * @postcondition describeDockerDesktopCurrentArtifactTrustContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerDesktopCurrentArtifactTrustContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerDesktopCurrentArtifactTrustContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerDesktopCurrentArtifactTrustContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDockerDesktopCurrentArtifactTrustContractはProcess内の同一Subsystemで完結する。
 * @security describeDockerDesktopCurrentArtifactTrustContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerDesktopCurrentArtifactTrustContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerDesktopCurrentArtifactTrustContract() {
  return Object.freeze({
    officialFixedPathsRequired: true,
    publisherOrganization: "Docker Inc",
    authenticodeRequired: true,
    revocationMode: "cache_only",
    exactVersionRequired: false,
    exactHashRequiredAcrossOperations: false,
    sameIdentityAndHashRequiredWithinOperation: true,
  });
}
