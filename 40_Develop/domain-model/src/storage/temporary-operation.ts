/**
 * temporary-operation-storeに属する責務をまとめる。
 *
 * @responsibility TemporaryOperationCapabilityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000011
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  TemporaryOperationCapability,
  TemporaryEvidencePromotionReceipt,
  TemporaryOperationRecoveryReference,
} from "./types.ts";

import { resolveRepositoryRuntimeDataPathsForInternalUse } from "../repository/resolve-storage-paths.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const OUTCOMES = new Set([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "parent_lost",
]);
const operations = new WeakMap<object, OperationRecord>();
const promotionReceipts = new WeakMap<object, PromotionRecord>();

/**
 * temporary-operation-storeで使用するOperation 記録の値契約を定義する。
 *
 * @responsibility Operation 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape OperationRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationRecordの宣言は外部境界を開かない。
 * @security N/A: OperationRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OperationRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationRecord = Readonly<{
  allowedContent: readonly string[];
  repositoryRoot: string;
  controlRoot: string;
  directory: string;
  documentPath: string;
  evidencePromotionRequired: boolean;
  generation: number;
  identity: string;
  operationId: string;
  owner: string;
  storage?: "signature";
}>;
/**
 * temporary-operation-storeで使用するPromotion 記録の値契約を定義する。
 *
 * @responsibility Promotion 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape PromotionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PromotionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: PromotionRecordの宣言は外部境界を開かない。
 * @security N/A: PromotionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PromotionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PromotionRecord = Readonly<{
  generation: number;
  identity: string;
  operationId: string;
  sha256: string;
  source: string;
  target: string;
  repositoryRoot: string;
  evidenceRelativePath: string;
}>;
/**
 * temporary-operation-storeで使用するTemporary Operation 入力の値契約を定義する。
 *
 * @responsibility Temporary Operation 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationInputの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TemporaryOperationInput = Readonly<{
  operationId: string;
  owner: string;
  storage?: "signature";
  identity: string;
  purpose: string;
  allowedContent: readonly string[];
  evidencePromotion: "required" | "not_required";
}>;
/**
 * temporary-operation-storeで使用するTemporary Operation Documentの値契約を定義する。
 *
 * @responsibility Temporary Operation DocumentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationDocumentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationDocumentで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationDocumentの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationDocumentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TemporaryOperationDocument = Readonly<{
  schema:
    | "crdd/runtime-data/temporary-operation/v3"
    | "crdd/runtime-data/temporary-operation/v4";
  operationId: string;
  identity: string;
  owner: string;
  storage?: "signature";
  generation: number;
  ownerProcessId: number;
  previousGeneration: number | null;
  state: "preparing" | "active" | "recovery_required";
  purpose: string;
  allowedContent: readonly string[];
  terminalPaths: readonly string[];
  evidencePromotion: "required" | "not_required";
}>;
/**
 * temporary-operation-storeで使用するLifecycle Lockの値契約を定義する。
 *
 * @responsibility Lifecycle LockのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape LifecycleLockが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LifecycleLockで宣言した値と責務の対応を維持する。
 * @boundary N/A: LifecycleLockの宣言は外部境界を開かない。
 * @security N/A: LifecycleLockはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LifecycleLockの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LifecycleLock = Readonly<{
  path: string;
  identity: string;
}>;
/**
 * temporary-operation-storeで使用するLifecycle Lock Documentの値契約を定義する。
 *
 * @responsibility Lifecycle Lock DocumentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape LifecycleLockDocumentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LifecycleLockDocumentで宣言した値と責務の対応を維持する。
 * @boundary N/A: LifecycleLockDocumentの宣言は外部境界を開かない。
 * @security N/A: LifecycleLockDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LifecycleLockDocumentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LifecycleLockDocument = Readonly<{
  schema: "crdd/runtime-data/lifecycle-lock/v1";
  identity: string;
  ownerProcessId: number;
  state: "active" | "released";
}>;

/**
 * Safe Directoryかを判定する。
 *
 * @responsibility Safe Directoryの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns booleanを返す。
 * @precondition 「target: string」がisSafeDirectoryの入力契約を満たす。
 * @postcondition isSafeDirectoryの責務を完了した結果だけを返す。
 * @effect isSafeDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: isSafeDirectoryは独自の失敗分岐を所有しない。
 * @invariant isSafeDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: isSafeDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSafeDirectoryは共有非同期状態を持たない同期処理である。
 */
function isSafeDirectory(target: string): boolean {
  const metadata = fs.lstatSync(target);
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    fs.realpathSync.native(target) === path.resolve(target)
  );
}
/**
 * Directoryが成立する状態を確保する。
 *
 * @responsibility Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns N/A: ensureDirectoryは戻り値を返さない。
 * @precondition 「target: string」がensureDirectoryの入力契約を満たす。
 * @postcondition ensureDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect ensureDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: ensureDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureDirectory(target: string): void {
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!isSafeDirectory(target))
    throw new Error("temporary_operation_boundary_invalid");
}
/**
 * 入力が有効か判定する。
 *
 * @responsibility 入力の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000011
 * @input input: TemporaryOperationInput
 * @returns booleanを返す。
 * @precondition 「input: TemporaryOperationInput」がvalidInputの入力契約を満たす。
 * @postcondition validInputの責務を完了した結果だけを返す。
 * @effect N/A: validInputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validInputは独自の失敗分岐を所有しない。
 * @invariant validInputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: validInputはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validInputは共有非同期状態を持たない同期処理である。
 */
function validInput(input: TemporaryOperationInput): boolean {
  return (
    ID.test(input.operationId) &&
    !/^signature\.*$/iu.test(input.operationId) &&
    (input.storage === undefined ||
      (input.storage === "signature" &&
        input.owner === "coordinator-release-runtime")) &&
    ID.test(input.owner) &&
    ID.test(input.identity) &&
    typeof input.purpose === "string" &&
    input.purpose.length > 0 &&
    input.purpose.length <= 512 &&
    Array.isArray(input.allowedContent) &&
    input.allowedContent.length > 0 &&
    input.allowedContent.length <= 64 &&
    input.allowedContent.every(
      (item) => typeof item === "string" && ID.test(item),
    ) &&
    new Set(input.allowedContent).size === input.allowedContent.length &&
    ["required", "not_required"].includes(input.evidencePromotion)
  );
}
/**
 * recovery Referenceを決定する。
 *
 * @responsibility recovery Referenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input record: OperationRecord
 * @returns TemporaryOperationRecoveryReferenceを返す。
 * @precondition 「record: OperationRecord」がrecoveryReferenceの入力契約を満たす。
 * @postcondition recoveryReferenceの責務を完了した結果だけを返す。
 * @effect N/A: recoveryReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryReferenceは独自の失敗分岐を所有しない。
 * @invariant recoveryReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: recoveryReferenceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryReferenceは共有非同期状態を持たない同期処理である。
 */
function recoveryReference(
  record: OperationRecord,
): TemporaryOperationRecoveryReference {
  return Object.freeze({
    operationId: record.operationId,
    owner: record.owner,
    ...(record.storage === "signature"
      ? { storage: "signature" as const }
      : {}),
    identity: record.identity,
    generation: record.generation,
  });
}
/**
 * Documentを観測する。
 *
 * @responsibility Documentの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000011
 * @input value: unknown
 * @returns TemporaryOperationDocument | nullを返す。
 * @precondition 「value: unknown」がinspectDocumentの入力契約を満たす。
 * @postcondition inspectDocumentの責務を完了した結果だけを返す。
 * @effect N/A: inspectDocumentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectDocumentは独自の失敗分岐を所有しない。
 * @invariant inspectDocumentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectDocumentは共有非同期状態を持たない同期処理である。
 */
function inspectDocument(value: unknown): TemporaryOperationDocument | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const r = value as Readonly<Record<string, unknown>>;
  const expectedKeys = [
    "allowedContent",
    "evidencePromotion",
    "generation",
    "identity",
    "operationId",
    "owner",
    "ownerProcessId",
    "previousGeneration",
    "purpose",
    "schema",
    "state",
    "terminalPaths",
  ];
  if (r.storage !== undefined) expectedKeys.push("storage");
  expectedKeys.sort();
  const keys = Object.keys(r).sort();
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index]) ||
    (r.storage === undefined
      ? r.schema !== "crdd/runtime-data/temporary-operation/v3"
      : r.storage !== "signature" ||
        r.schema !== "crdd/runtime-data/temporary-operation/v4" ||
        r.owner !== "coordinator-release-runtime") ||
    typeof r.operationId !== "string" ||
    !ID.test(r.operationId) ||
    typeof r.owner !== "string" ||
    !ID.test(r.owner) ||
    typeof r.identity !== "string" ||
    !ID.test(r.identity) ||
    !Number.isSafeInteger(r.generation) ||
    Number(r.generation) < 1 ||
    !Number.isSafeInteger(r.ownerProcessId) ||
    Number(r.ownerProcessId) < 1 ||
    (r.previousGeneration !== null &&
      (!Number.isSafeInteger(r.previousGeneration) ||
        Number(r.previousGeneration) < 1 ||
        Number(r.previousGeneration) >= Number(r.generation))) ||
    !["preparing", "active", "recovery_required"].includes(String(r.state)) ||
    typeof r.purpose !== "string" ||
    r.purpose.length < 1 ||
    r.purpose.length > 512 ||
    !Array.isArray(r.allowedContent) ||
    r.allowedContent.length < 1 ||
    r.allowedContent.length > 64 ||
    !r.allowedContent.every(
      (item) => typeof item === "string" && ID.test(item),
    ) ||
    new Set(r.allowedContent).size !== r.allowedContent.length ||
    !Array.isArray(r.terminalPaths) ||
    r.terminalPaths.join("\n") !==
      "completed\nfailed\ncancelled\ntimed_out\nparent_lost" ||
    !["required", "not_required"].includes(String(r.evidencePromotion))
  )
    return null;
  return r as TemporaryOperationDocument;
}
/**
 * Documentを読み取る。
 *
 * @responsibility Documentの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string
 * @returns TemporaryOperationDocumentを返す。
 * @precondition 「documentPath: string」がreadDocumentの入力契約を満たす。
 * @postcondition readDocumentの責務を完了した結果だけを返す。
 * @effect readDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure readDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readDocumentは共有非同期状態を持たない同期処理である。
 */
function readDocument(documentPath: string): TemporaryOperationDocument {
  const metadata = fs.lstatSync(documentPath);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("temporary_operation_boundary_invalid");
  const document = inspectDocument(
    JSON.parse(fs.readFileSync(documentPath, "utf8")),
  );
  if (!document) throw new Error("temporary_operation_document_invalid");
  return document;
}
/**
 * Documentを書き込む。
 *
 * @responsibility Documentの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、document: TemporaryOperationDocument
 * @returns N/A: writeDocumentは戻り値を返さない。
 * @precondition 「documentPath: string、document: TemporaryOperationDocument」がwriteDocumentの入力契約を満たす。
 * @postcondition writeDocumentの責務を完了して呼出し元へ制御を戻す。
 * @effect writeDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure writeDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeDocumentは共有非同期状態を持たない同期処理である。
 */
function writeDocument(
  documentPath: string,
  document: TemporaryOperationDocument,
): void {
  const directory = path.dirname(documentPath);
  const stagingDirectory =
    document.storage === "signature"
      ? directory
      : path.join(directory, ".staging");
  ensureDirectory(stagingDirectory);
  const temporary = path.join(
    stagingDirectory,
    `${document.operationId}.${document.identity}.${document.generation}.${document.state}${document.storage === "signature" ? ".pending" : ""}.json`,
  );
  if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, documentPath);
    const observed = readDocument(documentPath);
    if (
      observed.identity !== document.identity ||
      observed.generation !== document.generation ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_document_publish_unconfirmed");
  } finally {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // A failed replacement remains a recovery obligation at the caller.
    }
  }
}

/**
 * Documentを構築する。
 *
 * @responsibility Documentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、document: TemporaryOperationDocument、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void
 * @returns N/A: createDocumentは戻り値を返さない。
 * @precondition 「documentPath: string、document: TemporaryOperationDocument、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void」がcreateDocumentの入力契約を満たす。
 * @postcondition createDocumentの責務を完了して呼出し元へ制御を戻す。
 * @effect createDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure createDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDocumentは共有非同期状態を持たない同期処理である。
 */
function createDocument(
  documentPath: string,
  document: TemporaryOperationDocument,
  afterStagingDocumentCreated: () => void,
  afterStagingDocumentWritten: () => void,
  afterCanonicalDocumentLinked: () => void,
): void {
  const directory = path.dirname(documentPath);
  const stagingDirectory =
    document.storage === "signature"
      ? directory
      : path.join(directory, ".staging");
  ensureDirectory(stagingDirectory);
  const temporary = path.join(
    stagingDirectory,
    `${document.operationId}.${document.identity}.${document.generation}.preparing${document.storage === "signature" ? ".pending" : ""}.json`,
  );
  if (fs.existsSync(temporary))
    throw new Error("temporary_operation_creation_in_progress");
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    afterStagingDocumentCreated();
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  afterStagingDocumentWritten();
  try {
    fs.linkSync(temporary, documentPath);
    afterCanonicalDocumentLinked();
    const observed = readDocument(documentPath);
    if (
      observed.identity !== document.identity ||
      observed.generation !== document.generation ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_document_publish_unconfirmed");
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

/**
 * initial Document Staging Pathを決定する。
 *
 * @responsibility initial Document Staging Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、reference: TemporaryOperationRecoveryReference
 * @returns stringを返す。
 * @precondition 「documentPath: string、reference: TemporaryOperationRecoveryReference」がinitialDocumentStagingPathの入力契約を満たす。
 * @postcondition initialDocumentStagingPathの責務を完了した結果だけを返す。
 * @effect N/A: initialDocumentStagingPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: initialDocumentStagingPathは独自の失敗分岐を所有しない。
 * @invariant initialDocumentStagingPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: initialDocumentStagingPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: initialDocumentStagingPathは共有非同期状態を持たない同期処理である。
 */
function initialDocumentStagingPath(
  documentPath: string,
  reference: TemporaryOperationRecoveryReference,
): string {
  return path.join(
    path.dirname(documentPath),
    reference.storage === "signature" ? "." : ".staging",
    `${reference.operationId}.${reference.identity}.${reference.generation}.preparing${reference.storage === "signature" ? ".pending" : ""}.json`,
  );
}

/**
 * Confirmed Initial Document Staging Aliasを除去する。
 *
 * @responsibility Confirmed Initial Document Staging Aliasの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、reference: TemporaryOperationRecoveryReference
 * @returns voidを返す。
 * @precondition 「documentPath: string、reference: TemporaryOperationRecoveryReference」がremoveConfirmedInitialDocumentStagingAliasの入力契約を満たす。
 * @postcondition removeConfirmedInitialDocumentStagingAliasの責務を完了した結果だけを返す。
 * @effect removeConfirmedInitialDocumentStagingAliasはFilesystemの読取りまたは書込みを実行する。
 * @failure removeConfirmedInitialDocumentStagingAliasは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeConfirmedInitialDocumentStagingAliasは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: removeConfirmedInitialDocumentStagingAliasはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: removeConfirmedInitialDocumentStagingAliasは共有非同期状態を持たない同期処理である。
 */
function removeConfirmedInitialDocumentStagingAlias(
  documentPath: string,
  reference: TemporaryOperationRecoveryReference,
): void {
  const stagingDocumentPath = initialDocumentStagingPath(
    documentPath,
    reference,
  );
  if (!fs.existsSync(stagingDocumentPath)) return;
  if (!fs.existsSync(documentPath))
    throw new Error("temporary_operation_staging_alias_unconfirmed");
  const canonicalMetadata = fs.lstatSync(documentPath);
  const stagingMetadata = fs.lstatSync(stagingDocumentPath);
  if (
    !canonicalMetadata.isFile() ||
    canonicalMetadata.isSymbolicLink() ||
    !stagingMetadata.isFile() ||
    stagingMetadata.isSymbolicLink() ||
    canonicalMetadata.dev !== stagingMetadata.dev ||
    canonicalMetadata.ino !== stagingMetadata.ino ||
    !fs.readFileSync(documentPath).equals(fs.readFileSync(stagingDocumentPath))
  )
    throw new Error("temporary_operation_staging_alias_unconfirmed");
  const stagedDocument = readDocument(stagingDocumentPath);
  if (
    stagedDocument.storage !== reference.storage ||
    stagedDocument.operationId !== reference.operationId ||
    stagedDocument.owner !== reference.owner ||
    stagedDocument.identity !== reference.identity ||
    stagedDocument.generation !== reference.generation ||
    stagedDocument.state !== "preparing"
  )
    throw new Error("temporary_operation_staging_alias_unconfirmed");
  fs.unlinkSync(stagingDocumentPath);
  if (fs.existsSync(stagingDocumentPath))
    throw new Error("temporary_operation_staging_alias_cleanup_unconfirmed");
}

/**
 * process Is Aliveを決定する。
 *
 * @responsibility process Is Aliveの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input processId: number
 * @returns processIsAliveの計算結果を返す。
 * @precondition 「processId: number」がprocessIsAliveの入力契約を満たす。
 * @postcondition processIsAliveの責務を完了した結果だけを返す。
 * @effect processIsAliveは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure processIsAliveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant processIsAliveは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: processIsAliveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: processIsAliveは共有非同期状態を持たない同期処理である。
 */
function processIsAlive(processId: number) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
/**
 * Lock Documentを読み取る。
 *
 * @responsibility Lock Documentの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns LifecycleLockDocument | nullを返す。
 * @precondition 「target: string」がreadLockDocumentの入力契約を満たす。
 * @postcondition readLockDocumentの責務を完了した結果だけを返す。
 * @effect readLockDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure readLockDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readLockDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readLockDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readLockDocumentは共有非同期状態を持たない同期処理である。
 */
function readLockDocument(target: string): LifecycleLockDocument | null {
  try {
    const metadata = fs.lstatSync(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return null;
    const value = JSON.parse(fs.readFileSync(target, "utf8")) as Record<
      string,
      unknown
    >;
    if (
      Object.keys(value).sort().join("\n") !==
        "identity\nownerProcessId\nschema\nstate" ||
      value.schema !== "crdd/runtime-data/lifecycle-lock/v1" ||
      typeof value.identity !== "string" ||
      !ID.test(value.identity) ||
      !Number.isSafeInteger(value.ownerProcessId) ||
      Number(value.ownerProcessId) < 1 ||
      !["active", "released"].includes(String(value.state))
    )
      return null;
    return value as LifecycleLockDocument;
  } catch {
    return null;
  }
}
/**
 * Lock Documentを公開する。
 *
 * @responsibility Lock Documentの公開条件、公開範囲、未確定内容の非公開境界を所有する。
 * @trace ARCH-000011
 * @input controlRoot: string、operationId: string、document: LifecycleLockDocument、afterStagingLockCreated: () => void、afterStagingLockWritten: () => void、afterCanonicalLockLinked: () => void
 * @returns stringを返す。
 * @precondition 「controlRoot: string、operationId: string、document: LifecycleLockDocument、afterStagingLockCreated: () => void、afterStagingLockWritten: () => void、afterCanonicalLockLinked: () => void」がpublishLockDocumentの入力契約を満たす。
 * @postcondition publishLockDocumentの責務を完了した結果だけを返す。
 * @effect publishLockDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure publishLockDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant publishLockDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: publishLockDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: publishLockDocumentは共有非同期状態を持たない同期処理である。
 */
function publishLockDocument(
  controlRoot: string,
  operationId: string,
  document: LifecycleLockDocument,
  afterStagingLockCreated: () => void,
  afterStagingLockWritten: () => void,
  afterCanonicalLockLinked: () => void,
): string {
  const isSignatureStorage = path.basename(controlRoot) === "signature";
  const stagingDirectory = isSignatureStorage
    ? controlRoot
    : path.join(controlRoot, ".staging");
  ensureDirectory(stagingDirectory);
  const target = path.join(
    controlRoot,
    isSignatureStorage ? "preparation.lock" : `${operationId}.lock`,
  );
  const temporary = path.join(
    stagingDirectory,
    `${operationId}.${document.identity}.lock.json`,
  );
  if (fs.existsSync(temporary)) {
    const staged = readLockDocument(temporary);
    if (!staged) fs.rmSync(temporary);
    else {
      if (processIsAlive(staged.ownerProcessId))
        throw new Error("temporary_operation_lifecycle_busy");
      fs.rmSync(temporary);
    }
  }
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    afterStagingLockCreated();
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  afterStagingLockWritten();
  try {
    fs.linkSync(temporary, target);
    afterCanonicalLockLinked();
    const observed = readLockDocument(target);
    if (
      observed?.identity !== document.identity ||
      observed.ownerProcessId !== document.ownerProcessId ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_lock_publish_unconfirmed");
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  return target;
}
/**
 * Lock Fileを除去する。
 *
 * @responsibility Lock Fileの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns N/A: removeLockFileは戻り値を返さない。
 * @precondition 「target: string」がremoveLockFileの入力契約を満たす。
 * @postcondition removeLockFileの責務を完了して呼出し元へ制御を戻す。
 * @effect removeLockFileはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: removeLockFileは独自の失敗分岐を所有しない。
 * @invariant removeLockFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: removeLockFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: removeLockFileは共有非同期状態を持たない同期処理である。
 */
function removeLockFile(target: string): void {
  fs.rmSync(target);
}
/**
 * Lock Documentを更新する。
 *
 * @responsibility Lock Documentの更新対象、競合条件、更新結果の境界を所有する。
 * @trace ARCH-000011
 * @input target: string、document: LifecycleLockDocument
 * @returns N/A: updateLockDocumentは戻り値を返さない。
 * @precondition 「target: string、document: LifecycleLockDocument」がupdateLockDocumentの入力契約を満たす。
 * @postcondition updateLockDocumentの責務を完了して呼出し元へ制御を戻す。
 * @effect updateLockDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure updateLockDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant updateLockDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: updateLockDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: updateLockDocumentは共有非同期状態を持たない同期処理である。
 */
function updateLockDocument(
  target: string,
  document: LifecycleLockDocument,
): void {
  const directory = path.dirname(target);
  const stagingDirectory =
    path.basename(directory) === "signature"
      ? directory
      : path.join(directory, ".staging");
  ensureDirectory(stagingDirectory);
  const temporary = path.join(
    stagingDirectory,
    `${path.basename(target, ".lock")}.${document.identity}.${document.state}.lock.json`,
  );
  if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, target);
    const observed = readLockDocument(target);
    if (
      observed?.identity !== document.identity ||
      observed.ownerProcessId !== document.ownerProcessId ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_lock_publish_unconfirmed");
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}
/**
 * Lockを取得する。
 *
 * @responsibility Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000011
 * @input controlRoot: string、operationId: string、identity: string、afterStagingLockCreated: () => void、afterStagingLockWritten: () => void、afterCanonicalLockLinked: () => void
 * @returns LifecycleLockを返す。
 * @precondition 「controlRoot: string、operationId: string、identity: string、afterStagingLockCreated: () => void、afterStagingLockWritten: () => void、afterCanonicalLockLinked: () => void」がacquireLockの入力契約を満たす。
 * @postcondition acquireLockの責務を完了した結果だけを返す。
 * @effect acquireLockは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure acquireLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: acquireLockはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: acquireLockは共有非同期状態を持たない同期処理である。
 */
function acquireLock(
  controlRoot: string,
  operationId: string,
  identity: string,
  afterStagingLockCreated: () => void = () => {},
  afterStagingLockWritten: () => void = () => {},
  afterCanonicalLockLinked: () => void = () => {},
): LifecycleLock {
  const lockPath = path.join(
    controlRoot,
    path.basename(controlRoot) === "signature"
      ? "preparation.lock"
      : `${operationId}.lock`,
  );
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      publishLockDocument(
        controlRoot,
        operationId,
        Object.freeze({
          schema: "crdd/runtime-data/lifecycle-lock/v1",
          identity,
          ownerProcessId: process.pid,
          state: "active",
        }),
        afterStagingLockCreated,
        afterStagingLockWritten,
        afterCanonicalLockLinked,
      );
      return Object.freeze({ path: lockPath, identity });
    } catch (error) {
      if (
        error instanceof Error &&
        /^temporary_operation_(boundary|lock_publish)_/u.test(error.message)
      )
        throw error;
      const previous = readLockDocument(lockPath);
      if (
        !previous ||
        (previous.state === "active" && processIsAlive(previous.ownerProcessId))
      )
        throw new Error("temporary_operation_lifecycle_busy");
      try {
        removeLockFile(lockPath);
      } catch {
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      }
    }
  }
  throw new Error("temporary_operation_lifecycle_busy");
}
/**
 * Lockを解放する。
 *
 * @responsibility Lockの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000011
 * @input lock: LifecycleLock、remove: (target: string) => void
 * @returns booleanを返す。
 * @precondition 「lock: LifecycleLock、remove: (target: string) => void」がreleaseLockの入力契約を満たす。
 * @postcondition releaseLockの責務を完了した結果だけを返す。
 * @effect releaseLockはFilesystemの読取りまたは書込みを実行する。
 * @failure releaseLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: releaseLockはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: releaseLockは共有非同期状態を持たない同期処理である。
 */
function releaseLock(
  lock: LifecycleLock,
  remove: (target: string) => void = removeLockFile,
): boolean {
  try {
    const current = readLockDocument(lock.path);
    if (
      !current ||
      current.identity !== lock.identity ||
      current.ownerProcessId !== process.pid ||
      current.state !== "active"
    )
      return false;
    updateLockDocument(
      lock.path,
      Object.freeze({ ...current, state: "released" }),
    );
    remove(lock.path);
    return !fs.existsSync(lock.path);
  } catch {
    return false;
  }
}
/**
 * Capabilityを発行する。
 *
 * @responsibility Capabilityの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: 検証済みRoot、controlRoot、directory、documentPath、document: 同RootのOperation。
 * @returns issueCapabilityの計算結果を返す。
 * @precondition 作成または再入場のOwnerが検証したRootから全Operation Pathを導出済みである。
 * @postcondition issueCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: issueCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueCapabilityは独自の失敗分岐を所有しない。
 * @invariant issueCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: issueCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: issueCapabilityは共有非同期状態を持たない同期処理である。
 */
function issueCapability(
  repositoryRoot: string,
  controlRoot: string,
  directory: string,
  documentPath: string,
  document: TemporaryOperationDocument,
) {
  const capability = Object.freeze({
    contract: "crdd/runtime-data/temporary-operation-capability/v1" as const,
  });
  const record = Object.freeze({
    allowedContent: document.allowedContent,
    repositoryRoot,
    controlRoot,
    directory,
    documentPath,
    evidencePromotionRequired: document.evidencePromotion === "required",
    generation: document.generation,
    identity: document.identity,
    operationId: document.operationId,
    owner: document.owner,
    ...(document.storage === "signature"
      ? { storage: "signature" as const }
      : {}),
  });
  operations.set(capability, record);
  return { capability, record };
}

/**
 * Temporary Operation Internalを構築する。
 *
 * @responsibility Temporary Operation Internalの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: VerifiedRepositoryRoot、input: TemporaryOperationInput、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void、afterControlDocumentPublished: () => void
 * @returns createTemporaryOperationInternalの計算結果を返す。
 * @precondition 「rootCapability: VerifiedRepositoryRoot、input: TemporaryOperationInput、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void、afterControlDocumentPublished: () => void」がcreateTemporaryOperationInternalの入力契約を満たす。
 * @postcondition createTemporaryOperationInternalの責務を完了した結果だけを返す。
 * @effect createTemporaryOperationInternalはFilesystemの読取りまたは書込みを実行する。
 * @failure createTemporaryOperationInternalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTemporaryOperationInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createTemporaryOperationInternalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTemporaryOperationInternalは共有非同期状態を持たない同期処理である。
 */
function createTemporaryOperationInternal(
  rootCapability: VerifiedRepositoryRoot,
  input: TemporaryOperationInput,
  afterStagingDocumentCreated: () => void,
  afterStagingDocumentWritten: () => void,
  afterCanonicalDocumentLinked: () => void,
  afterControlDocumentPublished: () => void,
) {
  let createdDirectory: string | null = null;
  let documentPath: string | null = null;
  let isDocumentPublished = false;
  let workspaceOwnershipConfirmed = false;
  let pendingReference: TemporaryOperationRecoveryReference | null = null;
  try {
    if (!validInput(input))
      throw new Error("temporary_operation_input_invalid");
    const paths =
      resolveRepositoryRuntimeDataPathsForInternalUse(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    ensureDirectory(paths.root);
    ensureDirectory(paths.temporary);
    const isSignatureStorage = input.storage === "signature";
    const controlRoot = path.join(
      paths.temporary,
      isSignatureStorage ? "signature" : ".operations",
    );
    if (isSignatureStorage) {
      fs.mkdirSync(controlRoot, { mode: 0o700 });
      createdDirectory = controlRoot;
      workspaceOwnershipConfirmed = true;
    } else ensureDirectory(controlRoot);
    const directory = isSignatureStorage
      ? controlRoot
      : path.join(paths.temporary, input.operationId);
    documentPath = path.join(
      controlRoot,
      isSignatureStorage ? "preparation.json" : `${input.operationId}.json`,
    );
    if (!isSignatureStorage && fs.existsSync(directory))
      throw new Error("temporary_operation_creation_failed");
    const preparing: TemporaryOperationDocument = Object.freeze({
      schema: isSignatureStorage
        ? "crdd/runtime-data/temporary-operation/v4"
        : "crdd/runtime-data/temporary-operation/v3",
      ...(isSignatureStorage ? { storage: "signature" as const } : {}),
      operationId: input.operationId,
      identity: input.identity,
      owner: input.owner,
      generation: 1,
      ownerProcessId: process.pid,
      previousGeneration: null,
      state: "preparing",
      purpose: input.purpose,
      allowedContent: Object.freeze([...input.allowedContent]),
      terminalPaths: Object.freeze([
        "completed",
        "failed",
        "cancelled",
        "timed_out",
        "parent_lost",
      ]),
      evidencePromotion: input.evidencePromotion,
    });
    pendingReference = Object.freeze({
      operationId: input.operationId,
      owner: input.owner,
      ...(isSignatureStorage ? { storage: "signature" as const } : {}),
      identity: input.identity,
      generation: 1,
    });
    try {
      createDocument(
        documentPath,
        preparing,
        afterStagingDocumentCreated,
        afterStagingDocumentWritten,
        afterCanonicalDocumentLinked,
      );
      isDocumentPublished = true;
    } catch (error) {
      isDocumentPublished = fs.existsSync(documentPath);
      throw error;
    }
    afterControlDocumentPublished();
    if (!isSignatureStorage) fs.mkdirSync(directory, { mode: 0o700 });
    createdDirectory = directory;
    workspaceOwnershipConfirmed = true;
    if (
      !isSafeDirectory(directory) ||
      path.dirname(directory) !== paths.temporary
    )
      throw new Error("temporary_operation_boundary_invalid");
    ensureDirectory(path.join(directory, "work"));
    const active = Object.freeze({ ...preparing, state: "active" as const });
    writeDocument(documentPath, active);
    const issued = issueCapability(
      paths.repositoryRoot,
      controlRoot,
      directory,
      documentPath,
      active,
    );
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_created" as const,
      capability: issued.capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(issued.record),
    });
  } catch (error) {
    let cleanupConfirmed = createdDirectory === null && !isDocumentPublished;
    if (
      isDocumentPublished &&
      !workspaceOwnershipConfirmed &&
      documentPath !== null
    ) {
      try {
        fs.unlinkSync(documentPath);
        cleanupConfirmed = !fs.existsSync(documentPath);
        isDocumentPublished = !cleanupConfirmed;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (
      isDocumentPublished &&
      workspaceOwnershipConfirmed &&
      documentPath !== null &&
      pendingReference
    ) {
      try {
        const current = readDocument(documentPath);
        writeDocument(
          documentPath,
          Object.freeze({ ...current, state: "recovery_required" }),
        );
      } catch {
        // The exact caller-owned identity still identifies the failed creation.
      }
    } else if (createdDirectory !== null) {
      try {
        if (!isSafeDirectory(createdDirectory)) throw new Error();
        fs.rmSync(createdDirectory, { recursive: true });
        cleanupConfirmed = !fs.existsSync(createdDirectory);
      } catch {
        cleanupConfirmed = false;
      }
    }
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_creation_failed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      capability: null,
      workDirectory: null,
      cleanupConfirmed,
      recoveryRequired: isDocumentPublished || !cleanupConfirmed,
      recoveryReference:
        isDocumentPublished || !cleanupConfirmed ? pendingReference : null,
    });
  }
}

/**
 * Temporary Operationを構築する。
 *
 * @responsibility Temporary Operationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: VerifiedRepositoryRoot、input: TemporaryOperationInput
 * @returns createTemporaryOperationの計算結果を返す。
 * @precondition 「rootCapability: VerifiedRepositoryRoot、input: TemporaryOperationInput」がcreateTemporaryOperationの入力契約を満たす。
 * @postcondition createTemporaryOperationの責務を完了した結果だけを返す。
 * @effect N/A: createTemporaryOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createTemporaryOperationは独自の失敗分岐を所有しない。
 * @invariant createTemporaryOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createTemporaryOperationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTemporaryOperationは共有非同期状態を持たない同期処理である。
 */
export function createTemporaryOperation(
  rootCapability: VerifiedRepositoryRoot,
  input: TemporaryOperationInput,
) {
  return createTemporaryOperationInternal(
    rootCapability,
    input,
    () => {},
    () => {},
    () => {},
    () => {},
  );
}

/**
 * Direct-file verification seam; intentionally omitted from the public index.
 *
 * @responsibility Temporary Operation With Interruption For Verificationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: VerifiedRepositoryRoot、input: TemporaryOperationInput、phase: | "after_staging_created" | "after_staging" | "after_staging_linked" | "after_control"、interrupt: () => void
 * @returns createTemporaryOperationWithInterruptionForVerificationの計算結果を返す。
 * @precondition 「rootCapability: VerifiedRepositoryRoot、input: TemporaryOperationInput、phase: | "after_staging_created" | "after_staging" | "after_staging_linked" | "after_control"、interrupt: () => void」がcreateTemporaryOperationWithInterruptionForVerificationの入力契約を満たす。
 * @postcondition createTemporaryOperationWithInterruptionForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: createTemporaryOperationWithInterruptionForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createTemporaryOperationWithInterruptionForVerificationは独自の失敗分岐を所有しない。
 * @invariant createTemporaryOperationWithInterruptionForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createTemporaryOperationWithInterruptionForVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTemporaryOperationWithInterruptionForVerificationは共有非同期状態を持たない同期処理である。
 */
export function createTemporaryOperationWithInterruptionForVerification(
  rootCapability: VerifiedRepositoryRoot,
  input: TemporaryOperationInput,
  phase:
    | "after_staging_created"
    | "after_staging"
    | "after_staging_linked"
    | "after_control",
  interrupt: () => void,
) {
  return createTemporaryOperationInternal(
    rootCapability,
    input,
    phase === "after_staging_created" ? interrupt : () => {},
    phase === "after_staging" ? interrupt : () => {},
    phase === "after_staging_linked" ? interrupt : () => {},
    phase === "after_control" ? interrupt : () => {},
  );
}

/**
 * resume Temporary Operation Internalを決定する。
 *
 * @responsibility resume Temporary Operation Internalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: VerifiedRepositoryRoot、reference: TemporaryOperationRecoveryReference、nextIdentity: string、afterStagingLockCreated: () => void、afterStagingLockWritten: () => void、afterCanonicalLockLinked: () => void、afterNextGenerationPublished: () => void
 * @returns resumeTemporaryOperationInternalの計算結果を返す。
 * @precondition 「rootCapability: VerifiedRepositoryRoot、reference: TemporaryOperationRecoveryReference、nextIdentity: string、afterStagingLockCreated: () => void、afterStagingLockWritten: () => void、afterCanonicalLockLinked: () => void、afterNextGenerationPublished: () => void」がresumeTemporaryOperationInternalの入力契約を満たす。
 * @postcondition resumeTemporaryOperationInternalの責務を完了した結果だけを返す。
 * @effect resumeTemporaryOperationInternalはFilesystemの読取りまたは書込みを実行する。
 * @failure resumeTemporaryOperationInternalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resumeTemporaryOperationInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resumeTemporaryOperationInternalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resumeTemporaryOperationInternalは共有非同期状態を持たない同期処理である。
 */
function resumeTemporaryOperationInternal(
  rootCapability: VerifiedRepositoryRoot,
  reference: TemporaryOperationRecoveryReference,
  nextIdentity: string,
  afterStagingLockCreated: () => void,
  afterStagingLockWritten: () => void,
  afterCanonicalLockLinked: () => void,
  afterNextGenerationPublished: () => void,
) {
  let lock: LifecycleLock | null = null;
  let directory: string | null = null;
  let documentPath: string | null = null;
  let pendingRecoveryDocument: TemporaryOperationDocument | null = null;
  try {
    if (
      typeof reference !== "object" ||
      reference === null ||
      !ID.test(reference.operationId) ||
      /^signature\.*$/iu.test(reference.operationId) ||
      (reference.storage !== undefined &&
        (reference.storage !== "signature" ||
          reference.owner !== "coordinator-release-runtime")) ||
      !ID.test(reference.owner) ||
      !ID.test(reference.identity) ||
      !ID.test(nextIdentity) ||
      nextIdentity === reference.identity ||
      !Number.isSafeInteger(reference.generation) ||
      reference.generation < 1
    )
      throw new Error("temporary_operation_recovery_reference_invalid");
    const paths =
      resolveRepositoryRuntimeDataPathsForInternalUse(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    const isSignatureStorage = reference.storage === "signature";
    const controlRoot = path.join(
      paths.temporary,
      isSignatureStorage ? "signature" : ".operations",
    );
    if (!isSafeDirectory(controlRoot))
      throw new Error("temporary_operation_boundary_invalid");
    directory = isSignatureStorage
      ? controlRoot
      : path.join(paths.temporary, reference.operationId);
    documentPath = path.join(
      controlRoot,
      isSignatureStorage ? "preparation.json" : `${reference.operationId}.json`,
    );
    if (path.dirname(directory) !== paths.temporary)
      throw new Error("temporary_operation_boundary_invalid");
    if (!fs.existsSync(documentPath)) {
      const stagingDocumentPath = initialDocumentStagingPath(
        documentPath,
        reference,
      );
      if (!fs.existsSync(stagingDocumentPath))
        throw new Error("temporary_operation_recovery_identity_mismatch");
      let stagedDocument: TemporaryOperationDocument | null = null;
      try {
        stagedDocument = readDocument(stagingDocumentPath);
      } catch {
        const metadata = fs.lstatSync(stagingDocumentPath);
        if (!metadata.isFile() || metadata.isSymbolicLink())
          throw new Error("temporary_operation_boundary_invalid");
        fs.rmSync(stagingDocumentPath);
        throw new Error("temporary_operation_prepublication_cleanup_confirmed");
      }
      if (
        stagedDocument.storage !== reference.storage ||
        stagedDocument.operationId !== reference.operationId ||
        stagedDocument.owner !== reference.owner ||
        stagedDocument.identity !== reference.identity ||
        stagedDocument.generation !== reference.generation ||
        stagedDocument.state !== "preparing"
      )
        throw new Error("temporary_operation_recovery_identity_mismatch");
      fs.linkSync(stagingDocumentPath, documentPath);
      fs.rmSync(stagingDocumentPath);
    } else {
      removeConfirmedInitialDocumentStagingAlias(documentPath, reference);
    }
    lock = acquireLock(
      controlRoot,
      reference.operationId,
      nextIdentity,
      afterStagingLockCreated,
      afterStagingLockWritten,
      afterCanonicalLockLinked,
    );
    let document = readDocument(documentPath);
    if (
      document.storage !== reference.storage ||
      document.operationId !== reference.operationId ||
      document.owner !== reference.owner ||
      document.identity !== reference.identity
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    const isOwnerAlive = processIsAlive(document.ownerProcessId);
    if (document.state === "preparing") {
      if (isOwnerAlive)
        throw new Error("temporary_operation_recovery_not_required");
      if (document.generation !== reference.generation)
        throw new Error("temporary_operation_recovery_identity_mismatch");
      if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
      if (!isSafeDirectory(directory))
        throw new Error("temporary_operation_boundary_invalid");
      const work = path.join(directory, "work");
      if (!fs.existsSync(work)) ensureDirectory(work);
      if (!isSafeDirectory(work))
        throw new Error("temporary_operation_boundary_invalid");
      document = Object.freeze({
        ...document,
        state: "recovery_required" as const,
      });
      writeDocument(documentPath, document);
    } else if (document.state === "active") {
      if (document.generation !== reference.generation)
        throw new Error("temporary_operation_recovery_identity_mismatch");
      if (isOwnerAlive)
        throw new Error("temporary_operation_recovery_not_required");
      if (
        !isSafeDirectory(directory) ||
        !isSafeDirectory(path.join(directory, "work"))
      )
        throw new Error("temporary_operation_boundary_invalid");
      document = Object.freeze({
        ...document,
        state: "recovery_required" as const,
      });
      writeDocument(documentPath, document);
    }
    if (
      document.state !== "recovery_required" ||
      document.generation !== reference.generation
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
    if (!isSafeDirectory(directory))
      throw new Error("temporary_operation_boundary_invalid");
    const work = path.join(directory, "work");
    if (!fs.existsSync(work)) ensureDirectory(work);
    if (!isSafeDirectory(work))
      throw new Error("temporary_operation_boundary_invalid");
    const resumed: TemporaryOperationDocument = Object.freeze({
      ...document,
      identity: nextIdentity,
      state: "active",
      generation: document.generation + 1,
      ownerProcessId: process.pid,
      previousGeneration: document.generation,
    });
    pendingRecoveryDocument = resumed;
    writeDocument(documentPath, resumed);
    afterNextGenerationPublished();
    if (!releaseLock(lock))
      throw new Error("temporary_operation_lock_cleanup_unconfirmed");
    lock = null;
    const issued = issueCapability(
      paths.repositoryRoot,
      controlRoot,
      directory,
      documentPath,
      resumed,
    );
    pendingRecoveryDocument = null;
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_resumed" as const,
      capability: issued.capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(issued.record),
    });
  } catch (error) {
    let recoveryReferenceValue: TemporaryOperationRecoveryReference | null =
      null;
    if (documentPath !== null && pendingRecoveryDocument !== null) {
      let known = pendingRecoveryDocument;
      let hasObservedNext = false;
      try {
        const observed = readDocument(documentPath);
        if (
          observed.operationId === reference.operationId &&
          observed.owner === reference.owner &&
          observed.storage === reference.storage
        ) {
          if (
            observed.identity === reference.identity &&
            observed.generation === reference.generation
          )
            known = observed;
          else if (
            observed.identity === pendingRecoveryDocument.identity &&
            observed.generation === pendingRecoveryDocument.generation
          ) {
            known = observed;
            hasObservedNext = true;
          }
        }
      } catch {
        // 公開結果不明でも試行したIdentityを非Authorityの参照として保持する。
      }
      recoveryReferenceValue = Object.freeze({
        operationId: known.operationId,
        owner: known.owner,
        ...(known.storage === "signature"
          ? { storage: "signature" as const }
          : {}),
        identity: known.identity,
        generation: known.generation,
      });
      if (hasObservedNext) {
        try {
          writeDocument(
            documentPath,
            Object.freeze({ ...known, state: "recovery_required" as const }),
          );
        } catch {
          // 再保存不明を成功にせず、既知参照を失わない。
        }
      }
    }
    if (lock !== null) releaseLock(lock);
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_resume_failed";
    const cleanupConfirmed =
      reason === "temporary_operation_prepublication_cleanup_confirmed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      capability: null,
      workDirectory: null,
      cleanupConfirmed,
      recoveryReference: recoveryReferenceValue,
    });
  }
}

/**
 * resume Temporary Operationを決定する。
 *
 * @responsibility resume Temporary Operationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: VerifiedRepositoryRoot、reference: TemporaryOperationRecoveryReference、nextIdentity: string
 * @returns resumeTemporaryOperationの計算結果を返す。
 * @precondition 「rootCapability: VerifiedRepositoryRoot、reference: TemporaryOperationRecoveryReference、nextIdentity: string」がresumeTemporaryOperationの入力契約を満たす。
 * @postcondition resumeTemporaryOperationの責務を完了した結果だけを返す。
 * @effect N/A: resumeTemporaryOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resumeTemporaryOperationは独自の失敗分岐を所有しない。
 * @invariant resumeTemporaryOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resumeTemporaryOperationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resumeTemporaryOperationは共有非同期状態を持たない同期処理である。
 */
export function resumeTemporaryOperation(
  rootCapability: VerifiedRepositoryRoot,
  reference: TemporaryOperationRecoveryReference,
  nextIdentity: string,
) {
  return resumeTemporaryOperationInternal(
    rootCapability,
    reference,
    nextIdentity,
    () => {},
    () => {},
    () => {},
    () => {},
  );
}

/**
 * Direct-file verification seam; intentionally omitted from the public index.
 *
 * @responsibility temporary-operation-storeの入力からresume Temporary Operation With Interruption For Verificationを導く規則と結果境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: VerifiedRepositoryRoot、reference: TemporaryOperationRecoveryReference、nextIdentity: string、phase: | "after_lock_staging_created" | "after_lock_staging" | "after_lock_linked" | "after_generation"、afterNextGenerationPublished: () => void
 * @returns resumeTemporaryOperationWithInterruptionForVerificationの計算結果を返す。
 * @precondition 「rootCapability: VerifiedRepositoryRoot、reference: TemporaryOperationRecoveryReference、nextIdentity: string、phase: | "after_lock_staging_created" | "after_lock_staging" | "after_lock_linked" | "after_generation"、afterNextGenerationPublished: () => void」がresumeTemporaryOperationWithInterruptionForVerificationの入力契約を満たす。
 * @postcondition resumeTemporaryOperationWithInterruptionForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: resumeTemporaryOperationWithInterruptionForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resumeTemporaryOperationWithInterruptionForVerificationは独自の失敗分岐を所有しない。
 * @invariant resumeTemporaryOperationWithInterruptionForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resumeTemporaryOperationWithInterruptionForVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resumeTemporaryOperationWithInterruptionForVerificationは共有非同期状態を持たない同期処理である。
 */
export function resumeTemporaryOperationWithInterruptionForVerification(
  rootCapability: VerifiedRepositoryRoot,
  reference: TemporaryOperationRecoveryReference,
  nextIdentity: string,
  phase:
    | "after_lock_staging_created"
    | "after_lock_staging"
    | "after_lock_linked"
    | "after_generation",
  afterNextGenerationPublished: () => void,
) {
  return resumeTemporaryOperationInternal(
    rootCapability,
    reference,
    nextIdentity,
    phase === "after_lock_staging_created"
      ? afterNextGenerationPublished
      : () => {},
    phase === "after_lock_staging" ? afterNextGenerationPublished : () => {},
    phase === "after_lock_linked" ? afterNextGenerationPublished : () => {},
    phase === "after_generation" ? afterNextGenerationPublished : () => {},
  );
}

/**
 * 同一Repositoryの正式Evidenceを読取り、全Path境界と単一fileのHashを確認する。
 *
 * @responsibility CHG／Release Evidenceだけの有限Path文法とalias／hardlink拒否を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: 検証済みRoot、evidenceRelativePath: 相対POSIX Path。
 * @returns 既存Evidence fileのSHA-256。
 * @precondition 正式copyは呼出し側が所有し、この処理は作成しない。
 * @postcondition Rootからfileまでの実体が正規Pathと一致し読取り前後で変わらない。
 * @effect 既存Directory metadataと単一file descriptorを読取り、必ずcloseする。
 * @failure 不正文法、dot segment、alias、hardlink、観測不能または途中置換を拒否する。
 * @invariant tests／tmpのcopyを正式Evidenceへ昇格せず、任意absolute Pathを受けない。
 * @boundary 検証済みRepositoryと正式CHG／Release EvidenceのFilesystem境界。
 * @security 同一Root内の有限allowlistだけを読み、Authorityを発行しない。
 * @concurrency 親Directoryとfile Identityを前後照合し途中差を拒否する。
 */
function readTemporaryOperationEvidenceHash(
  repositoryRoot: string,
  evidenceRelativePath: string,
) {
  if (
    typeof evidenceRelativePath !== "string" ||
    !/^99_Roadmap\/(?:Changes\/CHG-[0-9]{6}|Releases\/v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?)\/Evidence\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,127})*$/u.test(
      evidenceRelativePath,
    )
  )
    throw new Error("temporary_operation_evidence_target_invalid");
  const segments = evidenceRelativePath.split("/");
  const target = path.join(repositoryRoot, ...segments);
  const parents = [repositoryRoot];
  for (const segment of segments.slice(0, -1))
    parents.push(path.join(parents.at(-1) ?? repositoryRoot, segment));
  const observations = parents.map((parent) => {
    const metadata = fs.lstatSync(parent, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(parent) !== parent
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    return { parent, metadata };
  });
  const before = fs.lstatSync(target, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    fs.realpathSync.native(target) !== target
  )
    throw new Error("temporary_operation_evidence_target_invalid");
  const descriptor = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    const hash = createHash("sha256")
      .update(fs.readFileSync(descriptor))
      .digest("hex");
    const after = fs.lstatSync(target, { bigint: true });
    const finished = fs.fstatSync(descriptor, { bigint: true });
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1n ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs ||
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs ||
      finished.size !== opened.size ||
      finished.mtimeNs !== opened.mtimeNs ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    for (const { parent, metadata } of observations) {
      const current = fs.lstatSync(parent, { bigint: true });
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        current.dev !== metadata.dev ||
        current.ino !== metadata.ino ||
        current.birthtimeNs !== metadata.birthtimeNs ||
        fs.realpathSync.native(parent) !== parent
      )
        throw new Error("temporary_operation_evidence_target_invalid");
    }
    return hash;
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * Temporary Operation Evidence Promotionを検証する。
 *
 * @responsibility Temporary Operation Evidence Promotionの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: VerifiedRepositoryRoot、capability: TemporaryOperationCapability、input: 正式Evidence相対Path、artifactName、sha256。
 * @returns verifyTemporaryOperationEvidencePromotionの計算結果を返す。
 * @precondition 呼出し側が同一RootのCHG／Release Evidenceへ正式copyを完了している。
 * @postcondition verifyTemporaryOperationEvidencePromotionの責務を完了した結果だけを返す。
 * @effect verifyTemporaryOperationEvidencePromotionはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyTemporaryOperationEvidencePromotionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyTemporaryOperationEvidencePromotionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyTemporaryOperationEvidencePromotionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyTemporaryOperationEvidencePromotionは共有非同期状態を持たない同期処理である。
 */
export function verifyTemporaryOperationEvidencePromotion(
  rootCapability: VerifiedRepositoryRoot,
  capability: TemporaryOperationCapability,
  input: Readonly<{
    evidenceRelativePath: string;
    artifactName: string;
    sha256: string;
  }>,
) {
  try {
    const record = operations.get(capability);
    if (!record) throw new Error("temporary_operation_capability_invalid");
    if (
      !input ||
      !ID.test(input.artifactName) ||
      !SHA256.test(input.sha256) ||
      !record.allowedContent.includes(input.artifactName)
    )
      throw new Error("temporary_operation_evidence_receipt_invalid");
    const paths =
      resolveRepositoryRuntimeDataPathsForInternalUse(rootCapability);
    if (!paths || paths.repositoryRoot !== record.repositoryRoot)
      throw new Error("temporary_operation_root_invalid");
    const observed = readTemporaryOperationEvidenceHash(
      paths.repositoryRoot,
      input.evidenceRelativePath,
    );
    const target = path.join(
      paths.repositoryRoot,
      ...input.evidenceRelativePath.split("/"),
    );
    const source = path.join(record.directory, "work", input.artifactName);
    const sourceMetadata = fs.lstatSync(source);
    const metadata = fs.lstatSync(target);
    if (
      !sourceMetadata.isFile() ||
      sourceMetadata.isSymbolicLink() ||
      sourceMetadata.nlink !== 1 ||
      fs.realpathSync.native(source) !== source ||
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    const sourceHash = createHash("sha256")
      .update(fs.readFileSync(source))
      .digest("hex");
    if (sourceHash !== input.sha256 || observed !== input.sha256)
      throw new Error("temporary_operation_evidence_hash_mismatch");
    const receipt = Object.freeze({
      contract:
        "crdd/runtime-data/temporary-evidence-promotion-receipt/v1" as const,
    });
    promotionReceipts.set(
      receipt,
      Object.freeze({
        operationId: record.operationId,
        identity: record.identity,
        generation: record.generation,
        sha256: observed,
        source,
        target,
        repositoryRoot: paths.repositoryRoot,
        evidenceRelativePath: input.evidenceRelativePath,
      }),
    );
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_evidence_promotion_verified" as const,
      receipt,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof Error &&
        /^temporary_operation_[a-z_]+$/u.test(error.message)
          ? error.message
          : "temporary_operation_evidence_verification_failed",
      receipt: null,
    });
  }
}

/**
 * Temporary Operation With Removalを終端状態へ確定する。
 *
 * @responsibility Temporary Operation With Removalの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000011
 * @input capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void、removeLifecycleLock: (target: string) => void
 * @returns settleTemporaryOperationWithRemovalの計算結果を返す。
 * @precondition 「capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void、removeLifecycleLock: (target: string) => void」がsettleTemporaryOperationWithRemovalの入力契約を満たす。
 * @postcondition settleTemporaryOperationWithRemovalの責務を完了した結果だけを返す。
 * @effect settleTemporaryOperationWithRemovalはFilesystemの読取りまたは書込みを実行する。
 * @failure settleTemporaryOperationWithRemovalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleTemporaryOperationWithRemovalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleTemporaryOperationWithRemovalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleTemporaryOperationWithRemovalは共有非同期状態を持たない同期処理である。
 */
function settleTemporaryOperationWithRemoval(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
  removeDirectory: (directory: string) => void,
  removeLifecycleLock: (target: string) => void = removeLockFile,
) {
  const record = operations.get(capability);
  if (!record)
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_capability_invalid" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: null,
    });
  if (typeof outcome !== "string" || !OUTCOMES.has(outcome))
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_outcome_invalid" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: recoveryReference(record),
    });
  let lock: LifecycleLock | null = null;
  let durableRecoveryConfirmed = false;
  let hasAttemptedRecoveryStateUpdate = false;
  try {
    lock = acquireLock(record.controlRoot, record.operationId, record.identity);
    const document = readDocument(record.documentPath);
    if (
      document.storage !== record.storage ||
      document.operationId !== record.operationId ||
      document.owner !== record.owner ||
      document.state !== "active" ||
      document.identity !== record.identity ||
      document.generation !== record.generation
    )
      throw new Error("temporary_operation_capability_stale");
    if (outcome === "parent_lost") {
      hasAttemptedRecoveryStateUpdate = true;
      writeDocument(
        record.documentPath,
        Object.freeze({ ...document, state: "recovery_required" }),
      );
      durableRecoveryConfirmed = true;
      operations.delete(capability);
      const released = releaseLock(lock, removeLifecycleLock);
      lock = null;
      if (!released)
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      return Object.freeze({
        status: "blocked" as const,
        reason: "temporary_operation_parent_lost" as const,
        cleanupConfirmed: false,
        recoveryRequired: true,
        recoveryReference: recoveryReference(record),
      });
    }
    if (record.evidencePromotionRequired) {
      const promotion =
        promotionReceipt === null
          ? undefined
          : promotionReceipts.get(promotionReceipt);
      if (
        !promotion ||
        promotion.repositoryRoot !== record.repositoryRoot ||
        promotion.operationId !== record.operationId ||
        promotion.identity !== record.identity ||
        promotion.generation !== record.generation
      )
        throw new Error("temporary_operation_evidence_not_promoted");
      const sourceMetadata = fs.lstatSync(promotion.source);
      const targetMetadata = fs.lstatSync(promotion.target);
      if (
        !sourceMetadata.isFile() ||
        sourceMetadata.isSymbolicLink() ||
        sourceMetadata.nlink !== 1 ||
        fs.realpathSync.native(promotion.source) !== promotion.source ||
        !targetMetadata.isFile() ||
        targetMetadata.isSymbolicLink() ||
        fs.realpathSync.native(promotion.target) !== promotion.target ||
        createHash("sha256")
          .update(fs.readFileSync(promotion.source))
          .digest("hex") !== promotion.sha256 ||
        readTemporaryOperationEvidenceHash(
          promotion.repositoryRoot,
          promotion.evidenceRelativePath,
        ) !== promotion.sha256
      )
        throw new Error("temporary_operation_evidence_not_promoted");
    }
    hasAttemptedRecoveryStateUpdate = true;
    writeDocument(
      record.documentPath,
      Object.freeze({ ...document, state: "recovery_required" }),
    );
    durableRecoveryConfirmed = true;
    operations.delete(capability);
    if (record.storage === "signature") {
      const work = path.join(record.directory, "work");
      removeDirectory(work);
      if (fs.existsSync(work))
        throw new Error("temporary_operation_cleanup_unconfirmed");
      removeConfirmedInitialDocumentStagingAlias(
        record.documentPath,
        recoveryReference(record),
      );
      const remainingEntries = fs.readdirSync(record.directory);
      if (
        remainingEntries.some(
          (name) => name !== "preparation.json" && name !== "preparation.lock",
        )
      )
        throw new Error("temporary_operation_cleanup_unconfirmed");
      const released = releaseLock(lock, removeLifecycleLock);
      lock = null;
      if (!released)
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      fs.unlinkSync(record.documentPath);
      fs.rmdirSync(record.directory);
    } else {
      const released = releaseLock(lock, removeLifecycleLock);
      lock = null;
      if (!released)
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      removeDirectory(record.directory);
      if (fs.existsSync(record.directory))
        throw new Error("temporary_operation_cleanup_unconfirmed");
      removeConfirmedInitialDocumentStagingAlias(
        record.documentPath,
        recoveryReference(record),
      );
      fs.unlinkSync(record.documentPath);
    }
    const stagingDocumentPath = initialDocumentStagingPath(
      record.documentPath,
      recoveryReference(record),
    );
    const cleanupConfirmed =
      !fs.existsSync(record.directory) &&
      !fs.existsSync(record.documentPath) &&
      !fs.existsSync(stagingDocumentPath);
    if (cleanupConfirmed) {
      if (promotionReceipt) promotionReceipts.delete(promotionReceipt);
    }
    return Object.freeze({
      status: cleanupConfirmed ? ("completed" as const) : ("blocked" as const),
      reason: cleanupConfirmed
        ? ("temporary_operation_settled" as const)
        : ("temporary_operation_cleanup_unconfirmed" as const),
      cleanupConfirmed,
      recoveryRequired: !cleanupConfirmed,
      recoveryReference: cleanupConfirmed ? null : recoveryReference(record),
    });
  } catch (error) {
    let recoveryRequired = durableRecoveryConfirmed;
    if (
      record.storage === "signature" &&
      hasAttemptedRecoveryStateUpdate &&
      !durableRecoveryConfirmed
    ) {
      try {
        const observed = readDocument(record.documentPath);
        recoveryRequired = !(
          observed.storage === record.storage &&
          observed.operationId === record.operationId &&
          observed.owner === record.owner &&
          observed.identity === record.identity &&
          observed.generation === record.generation &&
          observed.state === "active"
        );
      } catch {
        recoveryRequired = true;
      }
    }
    if (lock !== null) releaseLock(lock);
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_cleanup_unconfirmed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      cleanupConfirmed: false,
      recoveryRequired,
      recoveryReference:
        recoveryRequired || record.storage === "signature"
          ? recoveryReference(record)
          : null,
    });
  }
}

/**
 * Temporary Operationを終端状態へ確定する。
 *
 * @responsibility Temporary Operationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000011
 * @input capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null
 * @returns settleTemporaryOperationの計算結果を返す。
 * @precondition 「capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null」がsettleTemporaryOperationの入力契約を満たす。
 * @postcondition settleTemporaryOperationの責務を完了した結果だけを返す。
 * @effect settleTemporaryOperationはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: settleTemporaryOperationは独自の失敗分岐を所有しない。
 * @invariant settleTemporaryOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleTemporaryOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleTemporaryOperationは共有非同期状態を持たない同期処理である。
 */
export function settleTemporaryOperation(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
) {
  return settleTemporaryOperationWithRemoval(
    capability,
    outcome,
    promotionReceipt,
    (directory) => fs.rmSync(directory, { recursive: true }),
  );
}

/**
 * Internal contract-test entry; omitted from the package public index.
 *
 * @responsibility Temporary Operation With Removal For Verificationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000011
 * @input capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void、removeLifecycleLock: (target: string) => void
 * @returns settleTemporaryOperationWithRemovalForVerificationの計算結果を返す。
 * @precondition 「capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void、removeLifecycleLock: (target: string) => void」がsettleTemporaryOperationWithRemovalForVerificationの入力契約を満たす。
 * @postcondition settleTemporaryOperationWithRemovalForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: settleTemporaryOperationWithRemovalForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settleTemporaryOperationWithRemovalForVerificationは独自の失敗分岐を所有しない。
 * @invariant settleTemporaryOperationWithRemovalForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleTemporaryOperationWithRemovalForVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleTemporaryOperationWithRemovalForVerificationは共有非同期状態を持たない同期処理である。
 */
export function settleTemporaryOperationWithRemovalForVerification(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
  removeDirectory: (directory: string) => void,
  removeLifecycleLock: (target: string) => void = removeLockFile,
) {
  return settleTemporaryOperationWithRemoval(
    capability,
    outcome,
    promotionReceipt,
    removeDirectory,
    removeLifecycleLock,
  );
}
