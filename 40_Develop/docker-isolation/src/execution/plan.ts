/**
 * 固定実行物・資源Identity・起動入力の技術定義を所有する。
 *
 * @responsibility 共通Lifecycleに渡す固定技術値とSeccomp同一性の確認を所有する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const executorSeccompProfilePath = fileURLToPath(
  new URL("./codex-executor-seccomp.json", import.meta.url),
);

/**
 * 固定ExecutorのSeccomp実物を同一性・容量・Hashで照合する。
 *
 * @responsibility Fixed Codex Executor Seccomp Profileの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input expectedSha256: string、expectedBytes: number
 * @returns resolveFixedCodexExecutorSeccompProfileの計算結果を返す。
 * @precondition 「expectedSha256: string、expectedBytes: number」がresolveFixedCodexExecutorSeccompProfileの入力契約を満たす。
 * @postcondition resolveFixedCodexExecutorSeccompProfileの責務を完了した結果だけを返す。
 * @effect resolveFixedCodexExecutorSeccompProfileは固定Artifactのmetadataと本文だけを読み取る。
 * @failure resolveFixedCodexExecutorSeccompProfileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveFixedCodexExecutorSeccompProfileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resolveFixedCodexExecutorSeccompProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveFixedCodexExecutorSeccompProfileは共有非同期状態を持たない同期処理である。
 */
export function resolveFixedCodexExecutorSeccompProfile(
  expectedSha256: string,
  expectedBytes: number,
) {
  try {
    const before = fs.lstatSync(executorSeccompProfilePath, {
      bigint: true,
    });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size !== BigInt(expectedBytes) ||
      fs.realpathSync.native(executorSeccompProfilePath) !==
        executorSeccompProfilePath
    ) {
      return null;
    }
    const bytes = fs.readFileSync(executorSeccompProfilePath);
    const after = fs.lstatSync(executorSeccompProfilePath, {
      bigint: true,
    });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      createHash("sha256").update(bytes).digest("hex") !== expectedSha256
    ) {
      return null;
    }
    return executorSeccompProfilePath;
  } catch {
    return null;
  }
}

/**
 * Docker資源名・所有Label・固定Imageの文法を確認する。
 *
 * @responsibility 五資源名の文法と重複、Labelと二digestの固定形式を一箇所で判定する。
 * @trace ARCH-000008
 * @input input: 五資源名、ownershipLabel、executionImageDigest、proxyImageDigest。
 * @returns 全項目が文字列・固定文法であり五資源名が相異なる場合だけtrue。
 * @precondition 呼出し側がTask・Provider・Authorityとの意味相関を別に確認する。
 * @postcondition 入力を変更せず、文法以外の成立を推定しない。
 * @effect N/A: 同期文字列検査だけ。Filesystem・Artifact・Processを観測しない。
 * @failure 不正型・欠測・不正文法・重複はfalse。
 * @invariant trueは所有権、実行許可、資源存在または清掃完了を証明しない。
 * @boundary 上位の非秘密Identity投影とDocker技術文法。
 * @security 本文・認証値・Authorityを入力に持たず、外部へ公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理。
 */
export function dockerIsolationResourceIdentityIsValid(
  input: Readonly<{
    authenticationContainerName: string;
    executionContainerName: string;
    proxyContainerName: string;
    internalNetworkName: string;
    egressNetworkName: string;
    ownershipLabel: string;
    executionImageDigest: string;
    proxyImageDigest: string;
  }>,
): boolean {
  if (!input || typeof input !== "object") return false;
  const names = [
    input.authenticationContainerName,
    input.executionContainerName,
    input.proxyContainerName,
    input.internalNetworkName,
    input.egressNetworkName,
  ];
  return (
    names.every(
      (name) =>
        typeof name === "string" &&
        /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u.test(
          name,
        ),
    ) &&
    new Set(names).size === names.length &&
    typeof input.ownershipLabel === "string" &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(input.ownershipLabel) &&
    [input.executionImageDigest, input.proxyImageDigest].every(
      (digest) =>
        typeof digest === "string" && /^sha256:[a-f0-9]{64}$/u.test(digest),
    )
  );
}
