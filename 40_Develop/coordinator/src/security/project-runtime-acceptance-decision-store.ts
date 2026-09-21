/**
 * Objective／Milestone受入判断をRepository-local Runtime Dataへ耐久化する。
 *
 * @responsibility Acceptance Decision Recordの一回限り作成、exact読取りおよびprepared→finalized比較交換を所有する。
 * @trace ARCH-000005
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  ProjectRuntimeAcceptanceDecisionRecord,
  ProjectRuntimeAcceptanceDecisionStore,
  ProjectRuntimePortResult,
} from "../../../project-runtime/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";

export const PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT =
  "crdd-coordinator/project-runtime-acceptance-decision-store/v1" as const;

/**
 * Acceptance Decision Recordの耐久世代Envelopeを定義する。
 *
 * @responsibility Binding、Record Identity、世代、前世代HashおよびRecord本体を一つの耐久契約へ閉じる。
 * @trace ARCH-000005
 * @shape generation 1のprepared Recordまたはgeneration 2のfinalized Recordと、その前世代参照を表す。
 * @invariant generation 1はpreviousHashを持たず、generation 2はgeneration 1のHashを持つ。
 * @boundary Project Runtime Acceptance Decision StoreとRepository-local JSONの型境界。
 * @security 秘密値、CapabilityまたはHost絶対Pathを保持しない。
 * @compatibility contract値とgeneration意味を変更せず、利用側は宣言済みPropertyだけへ依存する。
 */
type Envelope = Readonly<{
  contract: typeof PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT;
  repositoryBindingId: string;
  recordId: string;
  generation: 1 | 2;
  previousHash: string | null;
  record: ProjectRuntimeAcceptanceDecisionRecord;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const MAX_BYTES = 1024 * 1024;

/**
 * 文字列のSHA-256を算出する。
 *
 * @responsibility Store内のPath Identityと前世代参照に用いる固定長Hashを導出する。
 * @trace ARCH-000005
 * @input value: Hash対象文字列。
 * @returns 64桁の小文字16進SHA-256。
 * @precondition valueはProcess内で構築した文字列である。
 * @postcondition 入力に対して決定論的なHashを返す。
 * @effect N/A: 外部または共有Effectを発行しない。
 * @failure N/A: Node.jsがSHA-256を提供する実行環境を前提とする。
 * @invariant Hash algorithmと文字Encodingを変更しない。
 * @boundary Process内Domain処理とNode.js Cryptoの境界。
 * @security 生RecordをPath名へ含めない。
 * @concurrency N/A: 局所計算だけを行う。
 */
function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Port完了結果を構築する。
 *
 * @responsibility 耐久Storeの成功結果を一つのPort契約へ閉じる。
 * @trace ARCH-000005
 * @input value: 観測または確定した値。
 * @returns completed状態のProjectRuntimePortResult。
 * @precondition valueはStoreで検証済みである。
 * @postcondition cleanup確認済みの成功結果を返す。
 * @effect N/A: 結果値を構築するだけである。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant manualRecoveryRequiredをfalseに保つ。
 * @boundary Store AdapterとProject Runtime Portの境界。
 * @security 追加情報を結果へ混入しない。
 * @concurrency N/A: 局所値だけを扱う。
 */
function completed<T>(value: T): ProjectRuntimePortResult<T> {
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_acceptance_decision_store_completed",
    value,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
}

/**
 * Store観測不能結果を構築する。
 *
 * @responsibility 不確かなFilesystem結果を成功または不存在へ畳まず停止結果へ変換する。
 * @trace ARCH-000005
 * @input reason: 停止理由、manualRecoveryRequired: 人手回復要否。
 * @returns blocked状態のProjectRuntimePortResult。
 * @precondition 呼出し元が観測結果を確定できなかった。
 * @postcondition 値を返さず停止理由を保持する。
 * @effect N/A: 結果値を構築するだけである。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant 観測不能を不存在へ変換しない。
 * @boundary Store AdapterとProject Runtime Portの境界。
 * @security Host Pathや生Recordを公開しない。
 * @concurrency N/A: 局所値だけを扱う。
 */
function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
): ProjectRuntimePortResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId: null,
  });
}

/**
 * Acceptance Decision Recordの構造を検査する。
 *
 * @responsibility 耐久化可能な固定Property、Identity、Source、判断およびDispositionを検証する。
 * @trace ARCH-000005
 * @input value: 未信頼の読取り値。
 * @returns 正しいRecordならtrue。
 * @precondition valueはJSON由来を含むunknownである。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検査する。
 * @failure 不正値は例外でなくfalseへ閉じる。
 * @invariant SPEC-000002以外を受入判断Sourceとして許可しない。
 * @boundary Filesystem JSONとProject Runtime Port型の境界。
 * @security Capabilityや秘密値Propertyを許可しない。
 * @concurrency N/A: 局所値だけを扱う。
 */
function validRecord(
  value: unknown,
): value is ProjectRuntimeAcceptanceDecisionRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Partial<ProjectRuntimeAcceptanceDecisionRecord>;
  return (
    [
      record.recordId,
      record.decisionId,
      record.projectId,
      record.milestoneId,
      record.targetId,
      record.principalId,
    ].every((item) => typeof item === "string" && ID.test(item)) &&
    record.sourceSpecId === "SPEC-000002" &&
    typeof record.repositoryRevision === "string" &&
    /^[0-9a-f]{40,64}$/u.test(record.repositoryRevision) &&
    Number.isSafeInteger(record.expectedGeneration) &&
    Number(record.expectedGeneration) >= 1 &&
    (record.target === "objective" || record.target === "milestone") &&
    (record.decision === "accept" ||
      record.decision === "return" ||
      record.decision === "wait") &&
    Array.isArray(record.criterionEvidenceIds) &&
    record.criterionEvidenceIds.every(
      (item) => typeof item === "string" && ID.test(item),
    ) &&
    new Set(record.criterionEvidenceIds).size ===
      record.criterionEvidenceIds.length &&
    (record.disposition === "prepared" || record.disposition === "finalized") &&
    (record.newGeneration === null ||
      (Number.isSafeInteger(record.newGeneration) &&
        Number(record.newGeneration) >= 1))
  );
}

/**
 * Envelopeを検査する。
 *
 * @responsibility Store世代、Binding、前世代HashおよびRecordの相関不変条件を検証する。
 * @trace ARCH-000005
 * @input value: 未信頼のJSON値、repositoryBindingId: 期待Binding、recordId: 期待Record。
 * @returns 正しいEnvelopeならtrue。
 * @precondition 期待Identityは呼出し側で検証済みである。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検査する。
 * @failure 不正値はfalseへ閉じる。
 * @invariant generation 1はprepared、generation 2はfinalizedである。
 * @boundary Filesystem JSONとStore内部Envelopeの境界。
 * @security Host Pathまたは秘密値を返さない。
 * @concurrency N/A: 局所値だけを扱う。
 */
function validEnvelope(
  value: unknown,
  repositoryBindingId: string,
  recordId: string,
): value is Envelope {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const envelope = value as Partial<Envelope>;
  return (
    envelope.contract === PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT &&
    envelope.repositoryBindingId === repositoryBindingId &&
    envelope.recordId === recordId &&
    (envelope.generation === 1 || envelope.generation === 2) &&
    (envelope.previousHash === null ||
      (typeof envelope.previousHash === "string" &&
        HASH.test(envelope.previousHash))) &&
    validRecord(envelope.record) &&
    envelope.record.recordId === recordId &&
    ((envelope.generation === 1 &&
      envelope.previousHash === null &&
      envelope.record.disposition === "prepared") ||
      (envelope.generation === 2 &&
        envelope.previousHash !== null &&
        envelope.record.disposition === "finalized"))
  );
}

/**
 * Acceptance Decision StoreをRepository-local Runtime Dataへ結合する。
 *
 * @responsibility 検証済みRepository Root内の専用領域だけを使う耐久Store Portを構築する。
 * @trace ARCH-000005
 * @input workingDirectory: Repository内Path、repositoryBindingId: 検証済みBinding Identity。
 * @returns ProjectRuntimeAcceptanceDecisionStoreを返す。
 * @precondition workingDirectoryからRepository Rootを一意に検証でき、Binding IDが有効である。
 * @postcondition Storeは`.crdd/project-runtime/state/acceptance-decisions`以外へ書き込まない。
 * @effect 呼出し時にRepository-local Runtime Data Directoryを必要範囲で作成する。
 * @failure Root、IdentityまたはFilesystemを確認できない操作はblocked結果へ閉じる。
 * @invariant 同じRecord IDはgeneration 1と2の最大二世代だけを持つ。
 * @boundary Project Runtime PortとRepository-local Filesystemの境界。
 * @security Host絶対Path、Capabilityおよび秘密値をRecordへ保存しない。
 * @concurrency `wx`による排他的世代作成で重複書込みを拒否する。
 */
export function createProjectRuntimeAcceptanceDecisionStore(
  workingDirectory: string,
  repositoryBindingId: string,
): ProjectRuntimeAcceptanceDecisionStore {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      workingDirectory,
      "project-runtime",
    ),
    "project_runtime_repository_root_invalid",
  );
  const root = path.join(area.directory, "state", "acceptance-decisions");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!ID.test(repositoryBindingId))
    throw new Error("project_runtime_repository_binding_invalid");

  const directory = (recordId: string) =>
    path.join(root, digest(recordId).slice(0, 40));
  const readEnvelope = (
    recordId: string,
    generation: 1 | 2,
  ): Envelope | null => {
    const file = path.join(
      directory(recordId),
      `generation-${generation}.json`,
    );
    if (!fs.existsSync(file)) return null;
    const metadata = fs.lstatSync(file);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size > MAX_BYTES
    )
      throw new Error("project_runtime_acceptance_record_invalid");
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!validEnvelope(parsed, repositoryBindingId, recordId))
      throw new Error("project_runtime_acceptance_record_invalid");
    return parsed;
  };
  const writeEnvelope = (value: Envelope) => {
    const target = directory(value.recordId);
    fs.mkdirSync(target, { recursive: true, mode: 0o700 });
    const file = path.join(target, `generation-${value.generation}.json`);
    const bytes = `${JSON.stringify(value)}\n`;
    if (Buffer.byteLength(bytes, "utf8") > MAX_BYTES)
      throw new Error("project_runtime_acceptance_record_too_large");
    fs.writeFileSync(file, bytes, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    const observed = readEnvelope(value.recordId, value.generation);
    if (!observed || JSON.stringify(observed) !== JSON.stringify(value))
      throw new Error("project_runtime_acceptance_record_confirmation_unknown");
  };

  return Object.freeze({
    /**
     * prepared Acceptance Decision Recordを一度だけ作成する。
     *
     * @responsibility 有効なprepared Recordをgeneration 1として排他的に耐久化する。
     * @trace ARCH-000005
     * @input record: 初回作成するprepared Acceptance Decision Record。
     * @returns 作成済みRecordまたは理由付きblocked結果。
     * @precondition Recordは有効で、同じRecord IDの世代が存在しない。
     * @postcondition 成功時はgeneration 1を再読取り確認できる。
     * @effect Repository-local Acceptance Decision Storeへgeneration 1を一回書き込む。
     * @failure 不正Record、重複または観測不能をblockedへ閉じる。
     * @invariant finalized Recordを初回世代として作成しない。
     * @boundary Project Runtime PortとRepository-local Filesystem書込みの境界。
     * @security 検証済みRoot外へ書き込まず、秘密値を保存しない。
     * @concurrency `wx`によって同じ世代の競合書込みを拒否する。
     */
    create(record) {
      try {
        if (!validRecord(record) || record.disposition !== "prepared")
          return blocked("project_runtime_acceptance_record_invalid");
        if (
          readEnvelope(record.recordId, 1) ||
          readEnvelope(record.recordId, 2)
        )
          return blocked("project_runtime_acceptance_record_exists");
        const value: Envelope = Object.freeze({
          contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT,
          repositoryBindingId,
          recordId: record.recordId,
          generation: 1,
          previousHash: null,
          record,
        });
        writeEnvelope(value);
        return completed(record);
      } catch {
        return blocked(
          "project_runtime_acceptance_record_observation_unknown",
          true,
        );
      }
    },
    /**
     * exact Record IDの最新確認済み世代を読み取る。
     *
     * @responsibility generation 1と2の連鎖を検証し、確定可能な最新Recordだけを返す。
     * @trace ARCH-000005
     * @input recordId: 読み取るAcceptance Decision Record Identity。
     * @returns 最新Record、不存在または理由付きblocked結果。
     * @precondition recordIdが固定Identity契約を満たす。
     * @postcondition StoreとRecordを変更せず、観測できた値だけを返す。
     * @effect N/A: Repository-local Storeを読み取るだけである。
     * @failure 不正Identity、壊れた世代連鎖または観測不能をblockedへ閉じる。
     * @invariant generation 2だけが存在する状態を成功として扱わない。
     * @boundary Project Runtime PortとRepository-local Filesystem読取りの境界。
     * @security 検証済みStore外を探索せず、Pathを結果へ露出しない。
     * @concurrency 一つの呼出し内で二世代を読み、競合を成功へ推定しない。
     */
    read(recordId) {
      try {
        if (!ID.test(recordId))
          return blocked("project_runtime_acceptance_record_identity_invalid");
        const second = readEnvelope(recordId, 2);
        const first = readEnvelope(recordId, 1);
        if (second && !first)
          return blocked(
            "project_runtime_acceptance_record_history_invalid",
            true,
          );
        return completed(second?.record ?? first?.record ?? null);
      } catch {
        return blocked(
          "project_runtime_acceptance_record_observation_unknown",
          true,
        );
      }
    },
    /**
     * prepared Recordを一致確認してfinalized Recordへ比較交換する。
     *
     * @responsibility exactなgeneration 1を前提にgeneration 2を一度だけ作成する。
     * @trace ARCH-000005
     * @input expected: 既存prepared Record、next: 作成するfinalized Record。
     * @returns 確定済みRecordまたは理由付きblocked結果。
     * @precondition expectedとnextは同じRecord IDを持ち、許可された遷移を表す。
     * @postcondition 成功時はgeneration 2がgeneration 1のHashへ接続される。
     * @effect Repository-local Acceptance Decision Storeへgeneration 2を一回書き込む。
     * @failure 世代不一致、重複、遷移不正または観測不能をblockedへ閉じる。
     * @invariant preparedからfinalized以外の遷移を作成しない。
     * @boundary Project Runtime PortとRepository-local Filesystem比較交換の境界。
     * @security 検証済みStore外へ書き込まず、Record間へ秘密値を追加しない。
     * @concurrency `wx`と前世代完全一致によって競合するfinalizeを拒否する。
     */
    compareAndSet(expected, next) {
      try {
        if (
          !validRecord(expected) ||
          !validRecord(next) ||
          expected.recordId !== next.recordId ||
          expected.disposition !== "prepared" ||
          next.disposition !== "finalized"
        )
          return blocked(
            "project_runtime_acceptance_record_transition_invalid",
          );
        const first = readEnvelope(expected.recordId, 1);
        if (!first || JSON.stringify(first.record) !== JSON.stringify(expected))
          return blocked(
            "project_runtime_acceptance_record_generation_mismatch",
          );
        if (readEnvelope(expected.recordId, 2))
          return blocked("project_runtime_acceptance_record_exists");
        const value: Envelope = Object.freeze({
          contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT,
          repositoryBindingId,
          recordId: expected.recordId,
          generation: 2,
          previousHash: digest(JSON.stringify(first)),
          record: next,
        });
        writeEnvelope(value);
        return completed(next);
      } catch {
        return blocked(
          "project_runtime_acceptance_record_observation_unknown",
          true,
        );
      }
    },
  });
}
