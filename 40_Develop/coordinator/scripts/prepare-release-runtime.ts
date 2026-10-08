/**
 * 署名前のRuntime固定入力を既存の一時操作へ準備する。
 *
 * @packageDocumentation
 * @responsibility 選択Gitファイルの展開と同一操作の終了処置だけを所有する。
 * @trace ARCH-000004
 * @boundary 固定Git入力、Repository-local一時操作と署名利用側の境界。
 * @security 秘密、署名Authority、永続Capabilityを保存・発行しない。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createTemporaryOperation,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  type TemporaryOperationCapability,
  type TemporaryOperationRecoveryReference,
} from "../../domain-model/src/index.ts";
import {
  materializeFixedSnapshotCandidate,
  verifyCandidateOutputDirectory,
} from "../../version-control/src/fixed-snapshot.ts";
import { gitFixedSnapshotAdapter } from "../../version-control/src/git/fixed-snapshot-adapter.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../version-control/src/repository/location.ts";
import { PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH } from "../src/diagnostics/platform-access-release.ts";
import { snapshotPlainRecord } from "../../domain-model/src/index.ts";
import { inspectRuntimeDistributionSigningFilesCandidate } from "../src/platform-access/package-verification.ts";
import { inspectPlatformProvisionerRuntimeGitProvenanceCandidate } from "../src/platform-access/release-identity.ts";

const SESSION_BRAND: unique symbol = Symbol("release-runtime-preparation");
/**
 * 同じProcessだけで使用する準備操作の参照。
 * @responsibility 偽造・JSON複製を操作能力として受理しない。
 * @trace ARCH-000004
 * @shape Symbol付きの不透明参照。
 * @invariant 実際の操作能力は非公開WeakMapだけが保持する。
 * @boundary 同一Process内の利用側。
 * @security 署名または公開Authorityを表さない。
 * @compatibility package-privateでありCLIや配布APIへ公開しない。
 */
export type ReleaseRuntimePreparationSession = Readonly<{
  [SESSION_BRAND]: true;
}>;
const sessions = new WeakMap<
  ReleaseRuntimePreparationSession,
  Readonly<{
    capability: TemporaryOperationCapability;
    reference: TemporaryOperationRecoveryReference;
  }>
>();

/**
 * 必要RuntimeとNativeだけを固定Git版から準備する。
 * @responsibility 展開前後の集合・出所一致と失敗時の同一操作終了を所有する。
 * @trace ARCH-000004
 * @input 検証済みRoot能力と閉じたcommit/tree/operationId/identity入力。
 * @returns 不透明Session、作業先、exact回復参照、または停止結果。
 * @precondition 呼出し側が採用固定版と初回作成前の両Identityを確定している。
 * @postcondition preparedは署名・公開・実行中固定保証を意味しない。
 * @effect 同じRepositoryの.crdd/tmpへ選択ファイルと既存操作記録を作成する。
 * @failure 不一致は書込み前拒否、展開後失敗は同じ操作を終了し未確認回復参照を保持する。
 * @invariant 両Identityを既存Ownerへ同値で渡し、固定Owner・初回世代1のexact参照を開始前から再構成できる。全Tree展開、既存候補変更、Evidence複製へ拡張しない。
 * @boundary VCS固定入力とRuntimeData一時操作。
 * @security 秘密やCapabilityをJSONへ保存しない。
 * @concurrency 同期観測であり、後続署名中の所有・利用終了は利用側が管理する。
 */
export function prepareReleaseRuntime(
  repositoryRoot: VerifiedRepositoryRoot,
  rawFixedCommitTree: unknown,
) {
  const fixedCommitTree = snapshotPlainRecord(
    rawFixedCommitTree,
    new Set(["commit", "tree", "operationId", "identity"]),
  );
  const root = resolveVerifiedRepositoryRoot(repositoryRoot);
  if (
    root === null ||
    !fixedCommitTree ||
    typeof fixedCommitTree.commit !== "string" ||
    typeof fixedCommitTree.tree !== "string" ||
    typeof fixedCommitTree.operationId !== "string" ||
    typeof fixedCommitTree.identity !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(fixedCommitTree.operationId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(fixedCommitTree.identity) ||
    !/^[0-9a-f]{40}$/u.test(fixedCommitTree.commit) ||
    !/^[0-9a-f]{40}$/u.test(fixedCommitTree.tree)
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "release_runtime_preparation_input_invalid",
      cleanupConfirmed: true,
      recoveryReference: null,
      session: null,
    });
  const provenanceInput = {
    repositoryRoot,
    crddCommit: fixedCommitTree.commit,
    crddTree: fixedCommitTree.tree,
  };
  const before = inspectRuntimeDistributionSigningFilesCandidate(root);
  const provenance = inspectPlatformProvisionerRuntimeGitProvenanceCandidate({
    ...provenanceInput,
    distributionRoot: root,
  });
  if (before.status !== "candidate" || provenance.status !== "candidate")
    return Object.freeze({
      status: "blocked" as const,
      reason: "release_runtime_preparation_fixed_content_mismatch",
      cleanupConfirmed: true,
      recoveryReference: null,
      session: null,
    });
  const selectedFiles = [
    ...before.files.map((file) => file.path),
    PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  ].sort();
  const operation = createTemporaryOperation(repositoryRoot, {
    operationId: fixedCommitTree.operationId,
    identity: fixedCommitTree.identity,
    owner: "coordinator-release-runtime",
    storage: "signature",
    purpose: "fixed-runtime-signing-preparation",
    allowedContent: ["runtime-files", "signed-manifest"],
    evidencePromotion: "not_required",
  });
  if (operation.status !== "completed")
    return Object.freeze({ ...operation, session: null });
  const session: ReleaseRuntimePreparationSession = Object.freeze({
    [SESSION_BRAND]: true as const,
  });
  sessions.set(session, {
    capability: operation.capability,
    reference: operation.recoveryReference,
  });
  try {
    const output = verifyCandidateOutputDirectory(
      operation.workDirectory,
      operation.capability,
      path.dirname(operation.workDirectory),
    );
    if (output.status !== "completed") throw new Error("output_invalid");
    const materialized = materializeFixedSnapshotCandidate(
      repositoryRoot,
      fixedCommitTree.commit,
      operation.capability,
      output.capability,
      selectedFiles,
      null,
      gitFixedSnapshotAdapter,
    );
    if (
      materialized?.status !== "materialized" ||
      materialized.baseRevisionIdentity !== fixedCommitTree.commit ||
      materialized.baseSnapshotIdentity !== fixedCommitTree.tree ||
      materialized.fileCount !== selectedFiles.length
    )
      throw new Error("materialization_invalid");
    const after = inspectRuntimeDistributionSigningFilesCandidate(
      operation.workDirectory,
    );
    const fixedAfter = inspectPlatformProvisionerRuntimeGitProvenanceCandidate({
      ...provenanceInput,
      distributionRoot: operation.workDirectory,
    });
    if (
      after.status !== "candidate" ||
      fixedAfter.status !== "candidate" ||
      JSON.stringify(after.files) !== JSON.stringify(before.files) ||
      after.packageContentRootSha256 !== before.packageContentRootSha256 ||
      fixedAfter.nativeHash !== provenance.nativeHash ||
      fixedAfter.fileCount !== selectedFiles.length
    )
      throw new Error("prepared_content_invalid");
    return Object.freeze({
      status: "prepared" as const,
      session,
      workDirectory: operation.workDirectory,
      recoveryReference: operation.recoveryReference,
      crddCommit: fixedCommitTree.commit,
      crddTree: fixedCommitTree.tree,
      runtimeContentRootSha256: after.packageContentRootSha256,
      fileCount: selectedFiles.length,
      nativeHash: fixedAfter.nativeHash,
      runtimeAuthorityConferred: false,
    });
  } catch {
    const settled = releaseReleaseRuntimePreparation(session, "failed");
    return Object.freeze({
      status: "blocked" as const,
      reason: "release_runtime_preparation_failed",
      cleanupConfirmed: settled.cleanupConfirmed,
      recoveryReference: settled.cleanupConfirmed
        ? null
        : operation.recoveryReference,
      session: sessions.has(session) ? session : null,
    });
  }
}

/**
 * 正式適用済みの同じ署名準備を再署名せず終了する。
 * @responsibility exact回復参照と候補・正式Manifest全bytesの一致だけを清掃へ接続する。
 * @trace ARCH-000004
 * @input 検証済みRoot、署名専用回復参照、次世代Identity。
 * @returns 清掃成立またはexact回復参照付き停止。
 * @precondition 旧利用Processが終了しており、RuntimeDataが再入場を許可する。
 * @postcondition 成立時だけsignature領域が不存在となる。正式Manifestは変更しない。
 * @effect exact操作へ再入場し、一致した適用済み候補の一時領域だけを回収する。
 * @failure 未適用、別内容、読取り不能、Path別名は清掃せず停止する。
 * @invariant 候補と正式Manifestの全file Hashを照合し、payload Hashだけで代替しない。
 * @boundary Repository-local署名準備と正式Manifest。
 * @security 秘密入力、再署名、昇格、Provider、Docker、実行Authority発行は行わない。
 * @concurrency 既存一時操作OwnerのLockと世代を使用する。新しいLock機構は作らない。
 */
export function recoverAppliedReleaseRuntimePreparation(
  root: VerifiedRepositoryRoot,
  reference: TemporaryOperationRecoveryReference,
  nextIdentity: string,
) {
  const repository = resolveVerifiedRepositoryRoot(root);
  const snapshot = snapshotPlainRecord(
    reference,
    new Set(["generation", "identity", "operationId", "owner", "storage"]),
  );
  if (
    !repository ||
    !snapshot ||
    Object.keys(snapshot).sort().join(",") !==
      "generation,identity,operationId,owner,storage" ||
    snapshot.owner !== "coordinator-release-runtime" ||
    snapshot.storage !== "signature"
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "release_preparation_recovery_input_invalid",
      cleanupConfirmed: false,
      recoveryReference: null,
    });
  }
  const resumed = resumeTemporaryOperation(
    root,
    snapshot as TemporaryOperationRecoveryReference,
    nextIdentity,
  );
  if (resumed.status !== "completed") return resumed;
  try {
    const relativePaths = [
      "template",
      "tools",
      "coordinator",
      "coordinator-package-manifest.json",
    ];
    const paths = [
      path.join(resumed.workDirectory, ...relativePaths),
      path.join(repository, ...relativePaths),
    ];
    const hashes: string[] = [];
    for (const target of paths) {
      let directory = path.dirname(target);
      while (directory !== repository) {
        const metadata = fs.lstatSync(directory);
        if (
          !metadata.isDirectory() ||
          metadata.isSymbolicLink() ||
          fs.realpathSync.native(directory) !== directory
        )
          throw new Error("manifest_boundary_invalid");
        const parent = path.dirname(directory);
        if (parent === directory) throw new Error("manifest_boundary_invalid");
        directory = parent;
      }
      const before = fs.lstatSync(target);
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        fs.realpathSync.native(target) !== target ||
        before.size === 0 ||
        before.size > 1024 * 1024
      )
        throw new Error("manifest_unobservable");
      const bytes = fs.readFileSync(target);
      const after = fs.lstatSync(target);
      if (
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        bytes.length !== before.size
      )
        throw new Error("manifest_changed");
      hashes.push(createHash("sha256").update(bytes).digest("hex"));
    }
    if (hashes[0] !== hashes[1]) throw new Error("manifest_not_applied");
    return settleTemporaryOperation(resumed.capability, "completed", null);
  } catch {
    const retained = settleTemporaryOperation(
      resumed.capability,
      "parent_lost",
      null,
    );
    return Object.freeze({
      ...retained,
      status: "blocked" as const,
      reason: "release_preparation_applied_manifest_unconfirmed",
    });
  }
}

/**
 * 準備操作を既存Ownerの終了契約へ返す。
 * @responsibility exact Sessionだけを受理し、清掃と回復の結果を区別する。
 * @trace ARCH-000004
 * @input Process-local Sessionと既存終端結果。
 * @returns 清掃成立または同じexact回復参照を伴う停止。
 * @precondition 利用側が署名・昇格利用の終了を確認済み。parent_lostでは終了を推定しない。
 * @postcondition cleanupConfirmedだけが作業物と操作記録の不存在を表す。
 * @effect 既存RuntimeData APIだけでexact一時操作を終了する。
 * @failure 偽造SessionはEffect 0、清掃未確認は回復参照を維持する。
 * @invariant 正式Manifest、別操作、旧領域へ清掃を拡張しない。
 * @boundary 利用側とRuntimeData操作Owner。
 * @security Sessionの複製・保存から能力を復元しない。
 * @concurrency 呼出し側が後続Processの利用と終了を所有する。
 */
export function releaseReleaseRuntimePreparation(
  session: ReleaseRuntimePreparationSession,
  outcome: unknown,
) {
  const record = sessions.get(session);
  if (!record)
    return Object.freeze({
      status: "blocked" as const,
      reason: "release_runtime_preparation_session_invalid",
      cleanupConfirmed: false,
      recoveryRequired: false,
      recoveryReference: null,
    });
  if (
    outcome !== "completed" &&
    outcome !== "failed" &&
    outcome !== "cancelled" &&
    outcome !== "timed_out" &&
    outcome !== "parent_lost"
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "release_runtime_preparation_outcome_invalid",
      cleanupConfirmed: false,
      recoveryRequired: false,
      recoveryReference: record.reference,
    });
  let result: ReturnType<typeof settleTemporaryOperation>;
  try {
    result = settleTemporaryOperation(record.capability, outcome, null);
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "release_runtime_preparation_settlement_unconfirmed",
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: record.reference,
    });
  }
  if (result.cleanupConfirmed || result.recoveryRequired)
    sessions.delete(session);
  return Object.freeze({
    ...result,
    recoveryReference: result.cleanupConfirmed ? null : record.reference,
  });
}
