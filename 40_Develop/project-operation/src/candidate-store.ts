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
  applyProjectOperationCandidateDecision,
  type ProjectOperationCandidate,
  type ProjectOperationCandidateDecision,
  type ProjectOperationCandidateDecisionResult,
} from "./project-operation.ts";

export type ProjectOperationAuthorityPort = Readonly<{
  verify(
    candidate: ProjectOperationCandidate,
    decision: ProjectOperationCandidateDecision,
  ): boolean;
}>;

export type ProjectOperationCandidateStore = Readonly<{
  read(): ProjectOperationCandidate;
  compareAndSet(
    expectedState: ProjectOperationCandidate["state"],
    next: ProjectOperationCandidate,
  ): boolean;
}>;

export type ProjectOperationOwnerWriter = Readonly<{
  revision(): number;
  apply(
    expectedRevision: number,
    candidate: ProjectOperationCandidate,
  ): boolean;
}>;

function readRegularJson<T>(file: string): T {
  const metadata = fs.lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("project_operation_store_invalid");
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function replaceJson(file: string, value: unknown) {
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
  file: string,
  initial: ProjectOperationCandidate,
): ProjectOperationCandidateStore {
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
    compareAndSet(expectedState, next) {
      if (read().state !== expectedState) return false;
      replaceJson(file, next);
      return true;
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
  file: string,
  initialRevision: number,
): ProjectOperationOwnerWriter {
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
    apply(expectedRevision, candidate) {
      if (read().revision !== expectedRevision) return false;
      replaceJson(file, {
        revision: expectedRevision + 1,
        adoptedCandidateId: candidate.candidateId,
      });
      return true;
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
      reason: "project_operation_candidate_already_decided" as const,
      candidateState: candidateStore.read().state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  return result;
}
