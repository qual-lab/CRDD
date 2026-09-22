/**
 * Project Operation候補判断をAuthority Adapter、Candidate Storeおよび所有正本へ接続する。
 *
 * @packageDocumentation
 * @responsibility 候補の現行状態、判断Authority、所有正本Revisionおよび一回性を耐久境界で統合する。
 * @trace ARCH-000006
 * @boundary Candidate Request→Authority Port→Candidate Store→Owner Writer。
 * @effect 明示adoptだけを所有正本へ反映し、全完了判断をCandidate Storeへ記録する。
 * @security Authority未確認ではCandidateとOwnerを変更しない。
 */
import fs from "node:fs";
import path from "node:path";

import {
  resolveFilesystemStorePath,
  withFilesystemStoreLock,
  type FilesystemStoreRoot,
} from "../../crdd-domain-library/src/filesystem-store-root/index.ts";

import {
  applyProjectOperationCandidateDecision,
  type ProjectOperationCandidate,
  type ProjectOperationCandidateDecision,
  type ProjectOperationCandidateDecisionResult,
} from "./project-operation.ts";

/**
 * Project Operation候補判断のAuthority確認Portを定義する。
 *
 * @responsibility 候補と判断入力を外部の判断Authorityへ照合する。
 * @trace ARCH-000006
 * @shape 候補と判断入力を受け取る検証関数だけを持つ。
 * @invariant trueは当該候補判断に対するAuthority確認だけを表す。
 * @boundary Candidate Applicationと判断Authorityの境界。
 * @security 判断値またはPrincipal文字列だけからAuthorityを生成しない。
 * @compatibility 実Authority方式を公開型へ固定しない。
 */
export type ProjectOperationAuthorityPort = Readonly<{
  verify(
    candidate: ProjectOperationCandidate,
    decision: ProjectOperationCandidateDecision,
  ): boolean;
}>;

/**
 * Project Operation候補の耐久Store契約を定義する。
 *
 * @responsibility 候補の読取りと状態付き比較交換を提供する。
 * @trace ARCH-000006
 * @shape readとcompareAndSetだけを持つ。
 * @invariant 比較交換は期待状態一致時だけ成功する。
 * @boundary Candidate Applicationと耐久Storeの境界。
 * @security Authority判定をStore内部で生成しない。
 * @compatibility 保存方式を公開契約へ固定しない。
 */
export type ProjectOperationCandidateStore = Readonly<{
  read(): ProjectOperationCandidate;
  compareAndSet(
    expectedState: ProjectOperationCandidate["state"],
    next: ProjectOperationCandidate,
  ): boolean;
}>;

/**
 * Project Operation所有正本の更新Portを定義する。
 *
 * @responsibility 現行Revisionの観測と候補採用の比較交換を提供する。
 * @trace ARCH-000006
 * @shape revisionとapplyだけを持つ。
 * @invariant applyは期待Revision一致時だけ成功する。
 * @boundary Candidate Applicationと所有正本の境界。
 * @security Candidate判断済みであることを呼出し側の契約として維持する。
 * @compatibility 保存方式を公開契約へ固定しない。
 */
export type ProjectOperationOwnerWriter = Readonly<{
  revision(): number;
  apply(
    expectedRevision: number,
    candidate: ProjectOperationCandidate,
  ): boolean;
}>;

/**
 * Linkではない通常FileからJSONを読取る。
 *
 * @responsibility 耐久RecordのFile種別を確認してJSON値を返す。
 * @trace ARCH-000006
 * @input Store Root Capabilityから解決済みのFile Path。
 * @returns JSONから復元した型付きRecord。
 * @precondition File Pathは用途限定Root配下へ解決済みである。
 * @postcondition File内容を変更せず値を返す。
 * @effect Filesystem metadataとFile内容を読取る。
 * @failure 不在、非通常File、Linkまたは不正JSONを例外で拒否する。
 * @invariant Link先を耐久Recordとして受理しない。
 * @boundary Filesystem StoreとApplication Recordの境界。
 * @security Root Capability外のPathを呼出し側から受け取らない。
 * @concurrency 一貫Snapshotが必要な呼出しは同じOperation Lock内で使用する。
 */
function readRegularJson<T>(file: string): T {
  const metadata = fs.lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("project_operation_store_invalid");
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/**
 * JSON Recordを一時Fileから同一Store Fileへ置換する。
 *
 * @responsibility 完成済みJSONだけを耐久Record Pathへ公開する。
 * @trace ARCH-000006
 * @input 解決済みFile Pathと保存するJSON値。
 * @returns N/A: 置換完了時に復帰する。
 * @precondition 呼出し側が必要なOperation LockとAuthorityを確認済みである。
 * @postcondition 成功時は対象Fileが新しい完全Recordを表す。
 * @effect 一時Fileを作成し対象Fileを置換する。
 * @failure 作成または置換失敗を例外で返す。
 * @invariant 部分JSONを対象Fileへ直接書き込まない。
 * @boundary Application RecordとFilesystem Storeの境界。
 * @security 解決済みRoot外Pathを受け取らない。
 * @concurrency 排他は呼出し側が所有し、本関数単独では直列化しない。
 */
function replaceJson(file: string, value: unknown): void {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
}

/**
 * File-backedなCandidate Storeを作成する。
 *
 * @responsibility 候補状態を通常Fileへ保存し、状態比較交換を所有する。
 * @trace ARCH-000006
 * @input file: Candidate File、initial: 初期Candidate。
 * @returns readとcompareAndSetを持つStore。
 * @precondition fileは許可済みStore Root内である。
 * @postcondition 初回だけinitialを作成する。
 * @effect 比較交換成功時だけCandidate Fileを置換する。
 * @failure Link、不正Fileまたは状態競合を例外またはfalseで拒否する。
 * @invariant decided状態を別判断で上書きしない。
 * @boundary Candidate Application→Filesystem Candidate Store。
 * @security Source本文またはCredentialを追加保存しない。
 * @concurrency 更新直前の状態再読取りで競合を拒否する。
 */
export function createFileProjectOperationCandidateStore(
  storeRoot: FilesystemStoreRoot,
  relativePath: string,
  initial: ProjectOperationCandidate,
): ProjectOperationCandidateStore {
  const file = resolveFilesystemStorePath(storeRoot, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(file))
    fs.writeFileSync(file, `${JSON.stringify(initial)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  const read = () => readRegularJson<ProjectOperationCandidate>(file);
  return Object.freeze({
    read,
    /**
     * 期待状態に一致する候補Recordを置換する。
     *
     * @responsibility 跨Process排他区間で候補のread-check-writeを実行する。
     * @trace ARCH-000006
     * @input 期待状態と次の候補Record。
     * @returns 更新成功時true、競合またはLock未取得時false。
     * @precondition 次RecordはDomain判断済みである。
     * @postcondition true時は再読取りで次状態を観測できる。
     * @effect true時だけCandidate Fileを一回置換する。
     * @failure 状態競合またはLock未取得をfalseで拒否する。
     * @invariant read-check-write全体を同じKernel Lock内で行う。
     * @boundary Candidate ApplicationとFilesystem Storeの境界。
     * @security Root Capability外へ書き込まない。
     * @concurrency 跨Process Lockにより同時更新を直列化する。
     */
    compareAndSet(expectedState, next) {
      const locked = withFilesystemStoreLock(
        storeRoot,
        `${relativePath}.lock`,
        () => {
          if (read().state !== expectedState) return false;
          replaceJson(file, next);
          return true;
        },
      );
      return locked.acquired ? locked.value : false;
    },
  });
}

/**
 * File-backedな所有正本Writerを作成する。
 *
 * @responsibility 所有正本Revisionと採用Candidate Identityを一つの耐久Recordへ閉じる。
 * @trace ARCH-000006
 * @input file: Owner File、initialRevision: 初期Revision。
 * @returns revisionとapplyを持つOwner Writer。
 * @precondition fileは許可済みStore Root内である。
 * @postcondition 初回だけ初期Owner Recordを作成する。
 * @effect apply成功時だけOwner Fileを置換する。
 * @failure Revision競合をfalseで拒否する。
 * @invariant 一つの採用でRevisionを一つだけ進める。
 * @boundary Candidate Adoption→Filesystem Canonical Owner。
 * @security Candidate本文を複製せずIdentityだけを記録する。
 * @concurrency 更新直前のRevision再読取りで競合を拒否する。
 */
export function createFileProjectOperationOwnerWriter(
  storeRoot: FilesystemStoreRoot,
  relativePath: string,
  initialRevision: number,
): ProjectOperationOwnerWriter {
  const file = resolveFilesystemStorePath(storeRoot, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(file))
    fs.writeFileSync(
      file,
      `${JSON.stringify({ revision: initialRevision, adoptedCandidateId: null })}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
  const read = () =>
    readRegularJson<{ revision: number; adoptedCandidateId: string | null }>(
      file,
    );
  return Object.freeze({
    revision: () => read().revision,
    /**
     * 期待Revisionに一致する所有正本へ候補Identityを反映する。
     *
     * @responsibility 跨Process排他区間でOwnerのread-check-writeを実行する。
     * @trace ARCH-000006
     * @input 期待Revisionと採用する候補。
     * @returns 更新成功時true、競合またはLock未取得時false。
     * @precondition 呼出し側がAuthorityと候補状態を確認済みである。
     * @postcondition true時はRevisionが一つ進み候補Identityを観測できる。
     * @effect true時だけOwner Fileを一回置換する。
     * @failure Revision競合またはLock未取得をfalseで拒否する。
     * @invariant 候補本文を所有正本へ複製しない。
     * @boundary Candidate Applicationと所有正本Storeの境界。
     * @security Root Capability外へ書き込まない。
     * @concurrency 跨Process Lockにより同時更新を直列化する。
     */
    apply(expectedRevision, candidate) {
      const locked = withFilesystemStoreLock(
        storeRoot,
        `${relativePath}.lock`,
        () => {
          if (read().revision !== expectedRevision) return false;
          replaceJson(file, {
            revision: expectedRevision + 1,
            adoptedCandidateId: candidate.candidateId,
          });
          return true;
        },
      );
      return locked.acquired ? locked.value : false;
    },
  });
}

/**
 * 候補判断を実際のAuthority、Candidate StoreおよびOwner Writerへ適用する。
 *
 * @responsibility 現行Snapshotを読み、AuthorityとRevisionを確認して判断結果を一度だけ耐久化する。
 * @trace ARCH-000006
 * @input candidateStore: 候補Store、owner: 所有正本、authority: Authority Port、decision: 判断入力。
 * @returns ProjectOperationCandidateDecisionResult。
 * @precondition 三Portは同じ候補・Owner境界へ構成されている。
 * @postcondition completed時はCandidate Storeへ判断済み状態を保存する。
 * @effect adopt時だけOwnerを一回更新し、全完了判断をCandidate Storeへ一回反映する。
 * @failure Authority不足、Revision競合、二重判断またはStore競合をEffect 0で拒否する。
 * @invariant Domain結果のEffect許可だけでは更新済みと扱わない。
 * @boundary Candidate Store→Authority Gate→Owner Writer→Candidate Settlement。
 * @security Authority Portのtrue以外から更新権限を生成しない。
 * @concurrency Candidate状態とOwner Revisionの比較交換で後着判断を拒否する。
 */
export function executeProjectOperationCandidateDecision(
  candidateStore: ProjectOperationCandidateStore,
  owner: ProjectOperationOwnerWriter,
  authority: ProjectOperationAuthorityPort,
  decision: ProjectOperationCandidateDecision,
): ProjectOperationCandidateDecisionResult {
  const candidate = candidateStore.read();
  const verifiedDecision = Object.freeze({
    ...decision,
    authorityVerified: authority.verify(candidate, decision),
    observedOwnerRevision: owner.revision(),
  });
  const result = applyProjectOperationCandidateDecision(
    candidate,
    verifiedDecision,
  );
  if (result.status !== "completed") return result;
  if (
    result.ownerEffectIssued &&
    !owner.apply(candidate.expectedOwnerRevision, candidate)
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "project_operation_candidate_revision_conflict" as const,
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  const nextCandidate = Object.freeze({
    ...candidate,
    state: result.candidateState,
  });
  if (!candidateStore.compareAndSet(candidate.state, nextCandidate))
    return Object.freeze({
      status: "blocked" as const,
      reason: result.ownerEffectIssued
        ? ("project_operation_candidate_settlement_incomplete" as const)
        : ("project_operation_candidate_already_decided" as const),
      candidateState: candidateStore.read().state,
      ownerEffectIssued: result.ownerEffectIssued,
      nextOwnerRevision: result.ownerEffectIssued
        ? candidate.expectedOwnerRevision + 1
        : null,
    });
  return result;
}

/**
 * Project Operation候補採用の耐久Journalを定義する。
 *
 * @responsibility Owner反映前後の段階とexact判断Identityを再入場用に保持する。
 * @trace ARCH-000006
 * @shape 候補、期待Revision、Principal、判断および段階を持つ。
 * @invariant owner_appliedは同じ候補のOwner Effect成立後だけ記録する。
 * @boundary Candidate判断と部分成功Recoveryの境界。
 * @security 再入場時に同じPrincipalとAuthorityを再確認する。
 * @compatibility 段階語彙を追加する場合は既存Journal移行を判断する。
 */
type ProjectOperationDecisionJournal = Readonly<{
  candidateId: string;
  expectedOwnerRevision: number;
  principalId: string;
  decision: "adopt";
  phase: "prepared" | "owner_applied";
}>;

/**
 * Candidate判断とOwner更新を耐久Journal付きの単一Writer境界で実行する。
 *
 * @responsibility Candidate、Owner、Operation Journalを一つの排他区間で更新し、部分成功を同じIdentityで回復する。
 * @trace ARCH-000006
 * @input Store Root、Candidate／Owner／Journal相対Path、Authority Portおよび判断入力。
 * @returns 完了または競合を表すProjectOperationCandidateDecisionResult。
 * @precondition 三Pathは同じ用途限定Store Root内にあり、全Writerが本入口を利用する。
 * @postcondition 完了時はCandidate状態とOwner Revisionが同時に整合し、Journalは不存在となる。
 * @effect adopt時だけJournal、Owner、Candidateを順に置換し、reject／holdはCandidateだけを置換する。
 * @failure Authority不足、Revision競合、Lock競合または不正JournalをEffect 0か回復可能な部分状態で拒否する。
 * @invariant Owner Effect後の失敗をfalseへ畳まず、JournalからCandidate Settlementだけを再開する。
 * @boundary Candidate Store→Operation Journal→Owner Writer→Candidate Settlement。
 * @security Root Capability外のPathと未確認Authorityを拒否する。
 * @concurrency Operation LockによりCandidateとOwnerのread-check-writeを一つに限定する。
 */
export function executeFileProjectOperationCandidateDecision(
  storeRoot: FilesystemStoreRoot,
  candidateRelativePath: string,
  ownerRelativePath: string,
  journalRelativePath: string,
  authority: ProjectOperationAuthorityPort,
  decision: ProjectOperationCandidateDecision,
): ProjectOperationCandidateDecisionResult {
  const candidateFile = resolveFilesystemStorePath(
    storeRoot,
    candidateRelativePath,
  );
  const ownerFile = resolveFilesystemStorePath(storeRoot, ownerRelativePath);
  const journalFile = resolveFilesystemStorePath(
    storeRoot,
    journalRelativePath,
  );
  const locked = withFilesystemStoreLock(
    storeRoot,
    `${journalRelativePath}.lock`,
    () => {
      const candidate =
        readRegularJson<ProjectOperationCandidate>(candidateFile);
      if (fs.existsSync(journalFile)) {
        const journal =
          readRegularJson<ProjectOperationDecisionJournal>(journalFile);
        let owner = readRegularJson<{
          revision: number;
          adoptedCandidateId: string | null;
        }>(ownerFile);
        if (
          journal.candidateId !== candidate.candidateId ||
          journal.expectedOwnerRevision !== candidate.expectedOwnerRevision ||
          journal.principalId !== decision.principalId ||
          journal.decision !== "adopt" ||
          decision.decision !== "adopt" ||
          !authority.verify(candidate, decision)
        )
          throw new Error("project_operation_decision_journal_invalid");
        if (journal.phase === "prepared") {
          if (
            owner.revision === journal.expectedOwnerRevision &&
            owner.adoptedCandidateId === null
          ) {
            replaceJson(ownerFile, {
              revision: journal.expectedOwnerRevision + 1,
              adoptedCandidateId: candidate.candidateId,
            });
            owner = readRegularJson<{
              revision: number;
              adoptedCandidateId: string | null;
            }>(ownerFile);
          }
          if (
            owner.revision !== journal.expectedOwnerRevision + 1 ||
            owner.adoptedCandidateId !== candidate.candidateId
          )
            throw new Error("project_operation_decision_journal_invalid");
          replaceJson(journalFile, { ...journal, phase: "owner_applied" });
        }
        if (
          journal.phase !== "owner_applied" &&
          readRegularJson<ProjectOperationDecisionJournal>(journalFile)
            .phase !== "owner_applied"
        )
          throw new Error("project_operation_decision_journal_invalid");
        if (
          owner.revision !== journal.expectedOwnerRevision + 1 ||
          owner.adoptedCandidateId !== candidate.candidateId
        )
          throw new Error("project_operation_decision_journal_invalid");
        replaceJson(candidateFile, { ...candidate, state: "adopted" });
        fs.rmSync(journalFile);
        return Object.freeze({
          status: "completed" as const,
          reason: "project_operation_candidate_adopted" as const,
          candidateState: "adopted" as const,
          ownerEffectIssued: true,
          nextOwnerRevision: owner.revision,
        });
      }
      const owner = readRegularJson<{
        revision: number;
        adoptedCandidateId: string | null;
      }>(ownerFile);
      const result = applyProjectOperationCandidateDecision(candidate, {
        ...decision,
        authorityVerified: authority.verify(candidate, decision),
        observedOwnerRevision: owner.revision,
      });
      if (result.status !== "completed") return result;
      if (!result.ownerEffectIssued) {
        replaceJson(candidateFile, {
          ...candidate,
          state: result.candidateState,
        });
        return result;
      }
      fs.mkdirSync(path.dirname(journalFile), { recursive: true, mode: 0o700 });
      replaceJson(journalFile, {
        candidateId: candidate.candidateId,
        expectedOwnerRevision: candidate.expectedOwnerRevision,
        principalId: decision.principalId,
        decision: "adopt",
        phase: "prepared",
      });
      replaceJson(ownerFile, {
        revision: candidate.expectedOwnerRevision + 1,
        adoptedCandidateId: candidate.candidateId,
      });
      replaceJson(journalFile, {
        candidateId: candidate.candidateId,
        expectedOwnerRevision: candidate.expectedOwnerRevision,
        principalId: decision.principalId,
        decision: "adopt",
        phase: "owner_applied",
      });
      replaceJson(candidateFile, {
        ...candidate,
        state: result.candidateState,
      });
      fs.rmSync(journalFile);
      return result;
    },
  );
  return locked.acquired
    ? locked.value
    : Object.freeze({
        status: "blocked" as const,
        reason: "project_operation_candidate_already_decided" as const,
        candidateState:
          readRegularJson<ProjectOperationCandidate>(candidateFile).state,
        ownerEffectIssued: false,
        nextOwnerRevision: null,
      });
}
